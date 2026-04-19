import { Redis } from '@upstash/redis';

let redis = null;
let isRedisAvailable = false;

/**
 * Initialise the Upstash Redis client.
 * Called once at app startup — if env vars are missing the app continues
 * without caching.
 */
export const initRedis = () => {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    console.log('[Redis] UPSTASH_REDIS_REST_URL or TOKEN not set — caching disabled');
    return;
  }

  try {
    redis = new Redis({ url, token });
    isRedisAvailable = true;
    console.log('[Redis] Connected to Upstash Redis');
  } catch (error) {
    console.error('[Redis] Failed to connect:', error.message);
    isRedisAvailable = false;
  }
};

/**
 * Check whether Redis is currently usable.
 */
export const isReady = () => isRedisAvailable && redis !== null;

/**
 * GET a cached value by key. Returns parsed JSON or null.
 */
export const cacheGet = async (key) => {
  if (!isReady()) return null;
  try {
    const value = await redis.get(key);
    return value ?? null;
  } catch (error) {
    console.error(`[Redis] GET error (${key}):`, error.message);
    return null;
  }
};

/**
 * SET a value with an optional TTL (seconds).  Default 300s (5 min).
 */
export const cacheSet = async (key, value, ttlSeconds = 300) => {
  if (!isReady()) return;
  try {
    await redis.set(key, JSON.stringify(value), { ex: ttlSeconds });
  } catch (error) {
    console.error(`[Redis] SET error (${key}):`, error.message);
  }
};

/**
 * DELETE one or more exact keys.
 */
export const cacheDel = async (...keys) => {
  if (!isReady() || !keys.length) return;
  try {
    await redis.del(...keys);
  } catch (error) {
    console.error(`[Redis] DEL error:`, error.message);
  }
};

/**
 * Invalidate all keys matching a given prefix.
 * Uses SCAN so it is safe in production (no KEYS *).
 */
export const invalidatePrefix = async (prefix) => {
  if (!isReady()) return;
  try {
    let cursor = 0;
    do {
      const [nextCursor, keys] = await redis.scan(cursor, { match: `${prefix}*`, count: 100 });
      cursor = Number(nextCursor);
      if (keys.length) {
        await redis.del(...keys);
      }
    } while (cursor !== 0);
  } catch (error) {
    console.error(`[Redis] INVALIDATE error (${prefix}):`, error.message);
  }
};

/**
 * Flush the entire cache (use sparingly, mostly for tests).
 */
export const flushAll = async () => {
  if (!isReady()) return;
  try {
    await redis.flushall();
  } catch (error) {
    console.error('[Redis] FLUSH error:', error.message);
  }
};

/**
 * Return the raw redis client (for advanced use / tests).
 */
export const getRedisClient = () => redis;

export default {
  initRedis,
  isReady,
  cacheGet,
  cacheSet,
  cacheDel,
  invalidatePrefix,
  flushAll,
  getRedisClient,
};
