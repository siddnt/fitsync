import { performance } from 'node:perf_hooks';
import { createClient } from 'redis';
import {
  recordCacheEvent,
  recordCacheInvalidation,
  recordCacheLoad,
} from './observability.service.js';

const DEFAULT_TTL_SECONDS = Number(process.env.REDIS_DEFAULT_TTL_SECONDS ?? 120);
const CACHE_PREFIX = process.env.REDIS_PREFIX ?? 'fitsync';
const REDIS_URL = process.env.REDIS_URL?.trim() || null;
const MEMORY_CACHE_MAX_ENTRIES = Number(process.env.MEMORY_CACHE_MAX_ENTRIES ?? 500);

const memoryCache = new Map();
const memoryTags = new Map();
const memoryCounters = new Map();
const memoryTransientFlags = new Map();
const inFlightLoads = new Map();

let redisClient = null;
let redisReady = false;
let initAttempted = false;
let lastRedisError = null;

const getScopedKey = (key) => `${CACHE_PREFIX}:cache:${key}`;
const getScopedTagKey = (tag) => `${CACHE_PREFIX}:tag:${tag}`;
const getScopedCounterKey = (bucket) => `${CACHE_PREFIX}:counter:${bucket}`;
const getScopedTransientKey = (key) => `${CACHE_PREFIX}:transient:${key}`;

const stableSort = (value) => {
  if (Array.isArray(value)) {
    return value.map(stableSort);
  }

  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        const nested = value[key];
        if (nested !== undefined) {
          acc[key] = stableSort(nested);
        }
        return acc;
      }, {});
  }

  return value;
};

const serializePayload = (payload) => JSON.stringify(payload);
const deserializePayload = (payload) => JSON.parse(payload);

const removeMemoryEntry = (key, entry = memoryCache.get(key)) => {
  if (!entry) {
    return false;
  }

  memoryCache.delete(key);
  entry.tags?.forEach((tag) => {
    const keys = memoryTags.get(tag);
    if (!keys) {
      return;
    }
    keys.delete(key);
    if (!keys.size) {
      memoryTags.delete(tag);
    }
  });

  return true;
};

const pruneExpiredMemoryEntry = (key, entry = memoryCache.get(key)) => {
  if (!entry) {
    return false;
  }

  if (entry.expiresAt > Date.now()) {
    return false;
  }

  return removeMemoryEntry(key, entry);
};

const evictMemoryOverflow = () => {
  const maxEntries = Number.isFinite(MEMORY_CACHE_MAX_ENTRIES) && MEMORY_CACHE_MAX_ENTRIES > 0
    ? MEMORY_CACHE_MAX_ENTRIES
    : 500;

  if (memoryCache.size <= maxEntries) {
    return;
  }

  for (const [key, entry] of memoryCache.entries()) {
    if (memoryCache.size <= maxEntries) {
      break;
    }

    if (pruneExpiredMemoryEntry(key, entry)) {
      continue;
    }

    removeMemoryEntry(key, entry);
  }
};

const storeInMemory = async (key, payload, ttlSeconds, tags = []) => {
  const expiresAt = Date.now() + ttlSeconds * 1000;
  removeMemoryEntry(key);
  memoryCache.set(key, { payload, expiresAt, tags });

  tags.forEach((tag) => {
    const keys = memoryTags.get(tag) ?? new Set();
    keys.add(key);
    memoryTags.set(tag, keys);
  });

  evictMemoryOverflow();
};

const getFromMemory = async (key) => {
  const entry = memoryCache.get(key);
  if (!entry) {
    return null;
  }

  if (pruneExpiredMemoryEntry(key, entry)) {
    return null;
  }

  memoryCache.delete(key);
  memoryCache.set(key, entry);
  return entry.payload;
};

const deleteFromMemory = async (keys = []) => {
  keys.forEach((key) => pruneExpiredMemoryEntry(key));
  keys.forEach((key) => {
    removeMemoryEntry(key);
  });
};

const deleteByTagsFromMemory = async (tags = []) => {
  const keys = new Set();
  tags.forEach((tag) => {
    const taggedKeys = memoryTags.get(tag);
    if (!taggedKeys) {
      return;
    }
    taggedKeys.forEach((key) => keys.add(key));
  });

  await deleteFromMemory(Array.from(keys));
  return keys.size;
};

const incrementCounterInMemory = (bucket, field, amount) => {
  const scopedBucket = memoryCounters.get(bucket) ?? new Map();
  const nextValue = Number(scopedBucket.get(field) ?? 0) + amount;
  scopedBucket.set(field, nextValue);
  memoryCounters.set(bucket, scopedBucket);
  return nextValue;
};

const pruneTransientFlagsInMemory = (now = Date.now()) => {
  for (const [key, expiresAt] of memoryTransientFlags.entries()) {
    if (Number(expiresAt) <= now) {
      memoryTransientFlags.delete(key);
    }
  }
};

const acquireTransientFlagInMemory = (key, ttlSeconds) => {
  const now = Date.now();
  if (memoryTransientFlags.size >= 5000) {
    pruneTransientFlagsInMemory(now);
  }
  const existingExpiry = Number(memoryTransientFlags.get(key) ?? 0);

  if (existingExpiry > now) {
    return false;
  }

  memoryTransientFlags.set(key, now + ttlSeconds * 1000);
  return true;
};

const consumeCountersFromMemory = (bucket) => {
  const scopedBucket = memoryCounters.get(bucket);
  if (!scopedBucket) {
    return {};
  }

  memoryCounters.delete(bucket);
  return Object.fromEntries(scopedBucket.entries());
};

const connectRedis = async () => {
  if (!REDIS_URL || redisReady) {
    return redisClient;
  }

  if (!redisClient) {
    redisClient = createClient({ url: REDIS_URL });
    redisClient.on('error', (error) => {
      lastRedisError = error;
      redisReady = false;
    });
  }

  if (!redisClient.isOpen) {
    await redisClient.connect();
  }

  redisReady = true;
  lastRedisError = null;
  return redisClient;
};

export const initializeCache = async () => {
  if (initAttempted) {
    return getCacheStatus();
  }

  initAttempted = true;
  if (!REDIS_URL) {
    return getCacheStatus();
  }

  try {
    await connectRedis();
  } catch (error) {
    lastRedisError = error;
    redisReady = false;
  }

  return getCacheStatus();
};

export const closeCache = async () => {
  if (redisClient?.isOpen) {
    await redisClient.quit();
  }

  inFlightLoads.clear();
  redisClient = null;
  redisReady = false;
};

export const getCacheStatus = () => ({
  provider: redisReady ? 'redis' : 'memory',
  redisConfigured: Boolean(REDIS_URL),
  redisReady,
  lastRedisError: lastRedisError?.message ?? null,
});

export const buildCacheKey = (scope, params = {}) => {
  const normalized = stableSort(params);
  return `${scope}:${serializePayload(normalized)}`;
};

const normalizeTags = (tags = []) =>
  Array.from(
    new Set(
      tags
        .map((tag) => String(tag).trim())
        .filter(Boolean),
    ),
  );

const getStoredPayload = async (key) => {
  if (redisReady) {
    try {
      const client = await connectRedis();
      const raw = await client.get(getScopedKey(key));
      return raw ? deserializePayload(raw) : null;
    } catch (error) {
      lastRedisError = error;
      redisReady = false;
    }
  }

  return getFromMemory(key);
};

const setStoredPayload = async (key, payload, ttlSeconds, tags = []) => {
  const normalizedTags = normalizeTags(tags);

  if (redisReady) {
    try {
      const client = await connectRedis();
      const scopedKey = getScopedKey(key);
      const multi = client.multi().set(scopedKey, serializePayload(payload), { EX: ttlSeconds });

      normalizedTags.forEach((tag) => {
        multi.sAdd(getScopedTagKey(tag), scopedKey);
        multi.expire(getScopedTagKey(tag), ttlSeconds);
      });

      await multi.exec();
      return;
    } catch (error) {
      lastRedisError = error;
      redisReady = false;
    }
  }

  await storeInMemory(key, payload, ttlSeconds, normalizedTags);
};

export const getOrSetCache = async ({
  key,
  ttlSeconds = DEFAULT_TTL_SECONDS,
  staleWhileRevalidateSeconds = 0,
  tags = [],
  bypass = false,
}, loader) => {
  await initializeCache();

  if (!key) {
    const value = await loader();
    recordCacheEvent({ state: 'bypass', provider: 'none' });
    return { value, meta: { provider: 'none', state: 'bypass' } };
  }

  const totalTtlSeconds = Math.max(ttlSeconds + Math.max(Number(staleWhileRevalidateSeconds) || 0, 0), ttlSeconds);

  if (!bypass) {
    const cached = await getStoredPayload(key);
    if (cached) {
      const provider = cached.provider ?? getCacheStatus().provider;
      const now = Date.now();
      const freshUntil = Number(cached.freshUntil ?? 0);
      const staleUntil = Number(cached.staleUntil ?? freshUntil);

      if (freshUntil > now) {
        recordCacheEvent({ state: 'hit', provider });
        return {
          value: cached.value,
          meta: {
            provider,
            state: 'hit',
            cachedAt: cached.cachedAt,
            freshUntil: freshUntil ? new Date(freshUntil).toISOString() : null,
          },
        };
      }

      if (staleUntil > now) {
        const pendingRefresh = inFlightLoads.get(key);
        if (!pendingRefresh) {
          const backgroundRefresh = (async () => {
            const startedAt = performance.now();
            const value = await loader();
            const refreshProvider = getCacheStatus().provider;
            const cachedAt = new Date().toISOString();
            const refreshedAt = Date.now();
            const nextFreshUntil = refreshedAt + ttlSeconds * 1000;
            const nextStaleUntil = refreshedAt + totalTtlSeconds * 1000;

            await setStoredPayload(
              key,
              {
                value,
                cachedAt,
                provider: refreshProvider,
                freshUntil: nextFreshUntil,
                staleUntil: nextStaleUntil,
              },
              totalTtlSeconds,
              tags,
            );
            recordCacheLoad({ provider: refreshProvider, durationMs: performance.now() - startedAt });

            return {
              value,
              provider: refreshProvider,
              cachedAt,
              freshUntil: nextFreshUntil,
              staleUntil: nextStaleUntil,
            };
          })()
            .catch((error) => {
              console.error('Background cache revalidation failed', error);
              return null;
            })
            .finally(() => {
              inFlightLoads.delete(key);
            });

          inFlightLoads.set(key, backgroundRefresh);
        }

        recordCacheEvent({ state: 'stale', provider });
        return {
          value: cached.value,
          meta: {
            provider,
            state: 'stale',
            cachedAt: cached.cachedAt,
            freshUntil: freshUntil ? new Date(freshUntil).toISOString() : null,
            staleUntil: staleUntil ? new Date(staleUntil).toISOString() : null,
          },
        };
      }
    }

    const pendingLoad = inFlightLoads.get(key);
    if (pendingLoad) {
      const shared = await pendingLoad;
      recordCacheEvent({ state: 'coalesced', provider: shared.provider });
      return {
        value: shared.value,
        meta: {
          provider: shared.provider,
          state: 'coalesced',
          cachedAt: shared.cachedAt,
          freshUntil: shared.freshUntil ? new Date(shared.freshUntil).toISOString() : null,
        },
      };
    }
  }

  const loadAndStore = async () => {
    const startedAt = performance.now();
    const value = await loader();
    const provider = getCacheStatus().provider;
    const cachedAt = new Date().toISOString();
    const freshUntil = Date.now() + ttlSeconds * 1000;
    const staleUntil = Date.now() + totalTtlSeconds * 1000;

    if (!bypass) {
      await setStoredPayload(
        key,
        {
          value,
          cachedAt,
          provider,
          freshUntil,
          staleUntil,
        },
        totalTtlSeconds,
        tags,
      );
    }

    recordCacheLoad({ provider, durationMs: performance.now() - startedAt });

    return {
      value,
      provider,
      cachedAt,
      freshUntil,
      staleUntil,
    };
  };

  const pendingLoad = bypass
    ? loadAndStore()
    : loadAndStore().finally(() => {
      inFlightLoads.delete(key);
    });

  if (!bypass) {
    inFlightLoads.set(key, pendingLoad);
  }

  const {
    value,
    provider,
    cachedAt,
    freshUntil,
    staleUntil,
  } = await pendingLoad;
  recordCacheEvent({ state: bypass ? 'bypass' : 'miss', provider });

  return {
    value,
    meta: {
      provider,
      state: bypass ? 'bypass' : 'miss',
      cachedAt,
      freshUntil: freshUntil ? new Date(freshUntil).toISOString() : null,
      staleUntil: staleUntil ? new Date(staleUntil).toISOString() : null,
    },
  };
};

export const invalidateCacheByTags = async (tags = []) => {
  await initializeCache();

  const normalizedTags = normalizeTags(tags);
  if (!normalizedTags.length) {
    return 0;
  }

  if (redisReady) {
    try {
      const client = await connectRedis();
      const scopedTagKeys = normalizedTags.map((tag) => getScopedTagKey(tag));
      const keyGroups = await Promise.all(scopedTagKeys.map((tagKey) => client.sMembers(tagKey)));
      const cacheKeys = Array.from(new Set(keyGroups.flat().filter(Boolean)));

      const multi = client.multi();
      if (cacheKeys.length) {
        multi.del(cacheKeys);
      }
      if (scopedTagKeys.length) {
        multi.del(scopedTagKeys);
      }
      await multi.exec();
      recordCacheInvalidation({ invalidatedKeys: cacheKeys.length });
      return cacheKeys.length;
    } catch (error) {
      lastRedisError = error;
      redisReady = false;
    }
  }

  const invalidatedKeys = await deleteByTagsFromMemory(normalizedTags);
  recordCacheInvalidation({ invalidatedKeys });
  return invalidatedKeys;
};

export const incrementBufferedCounter = async (bucket, field, amount = 1) => {
  await initializeCache();

  const normalizedBucket = String(bucket ?? '').trim();
  const normalizedField = String(field ?? '').trim();
  const normalizedAmount = Number(amount);

  if (!normalizedBucket || !normalizedField || !Number.isFinite(normalizedAmount) || normalizedAmount === 0) {
    return 0;
  }

  if (redisReady) {
    try {
      const client = await connectRedis();
      return client.hIncrBy(getScopedCounterKey(normalizedBucket), normalizedField, normalizedAmount);
    } catch (error) {
      lastRedisError = error;
      redisReady = false;
    }
  }

  return incrementCounterInMemory(normalizedBucket, normalizedField, normalizedAmount);
};

export const consumeBufferedCounters = async (bucket) => {
  await initializeCache();

  const normalizedBucket = String(bucket ?? '').trim();
  if (!normalizedBucket) {
    return {};
  }

  if (redisReady) {
    try {
      const client = await connectRedis();
      const scopedKey = getScopedCounterKey(normalizedBucket);
      const counters = await client.hGetAll(scopedKey);
      if (Object.keys(counters).length) {
        await client.del(scopedKey);
      }
      return counters;
    } catch (error) {
      lastRedisError = error;
      redisReady = false;
    }
  }

  return consumeCountersFromMemory(normalizedBucket);
};

export const acquireTransientFlag = async (key, ttlSeconds = 60) => {
  await initializeCache();

  const normalizedKey = String(key ?? '').trim();
  const normalizedTtl = Math.max(Number(ttlSeconds) || 0, 1);

  if (!normalizedKey) {
    return false;
  }

  if (redisReady) {
    try {
      const client = await connectRedis();
      const result = await client.set(getScopedTransientKey(normalizedKey), '1', {
        NX: true,
        EX: normalizedTtl,
      });
      return result === 'OK';
    } catch (error) {
      lastRedisError = error;
      redisReady = false;
    }
  }

  return acquireTransientFlagInMemory(normalizedKey, normalizedTtl);
};

export const clearAllCache = async () => {
  memoryCache.clear();
  memoryTags.clear();
  memoryCounters.clear();
  memoryTransientFlags.clear();
  inFlightLoads.clear();

  if (redisReady) {
    try {
      const client = await connectRedis();
      const iterator = client.scanIterator({ MATCH: `${CACHE_PREFIX}:*`, COUNT: 100 });
      const scopedKeys = [];
      // eslint-disable-next-line no-restricted-syntax
      for await (const key of iterator) {
        scopedKeys.push(key);
      }
      if (scopedKeys.length) {
        await client.del(scopedKeys);
      }
      recordCacheInvalidation({ invalidatedKeys: scopedKeys.length });
      return scopedKeys.length;
    } catch (error) {
      lastRedisError = error;
      redisReady = false;
    }
  }

  recordCacheInvalidation({ invalidatedKeys: 0 });
  return 0;
};

export const shouldBypassCache = (req) => {
  const headerValue = req.headers['x-cache-mode'];
  const queryValue = req.query?.cache;
  return String(headerValue ?? queryValue ?? '').toLowerCase() === 'bypass';
};
