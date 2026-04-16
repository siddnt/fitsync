import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import Gym from '../models/gym.model.js';
import GymImpressionDaily from '../models/gymImpressionDaily.model.js';
import {
  acquireTransientFlag,
  consumeBufferedCounters,
  incrementBufferedCounter,
  invalidateCacheByTags,
} from './cache.service.js';
import { syncGymSearchDocumentById } from './search.service.js';

const GYM_IMPRESSION_BUCKET = 'gym-impressions';
const GYM_OPEN_BUCKET = 'gym-opens';
const GYM_IMPRESSION_FLUSH_INTERVAL_MS = Number(process.env.GYM_IMPRESSION_FLUSH_INTERVAL_MS ?? 15000);
const GYM_IMPRESSION_COOLDOWN_SECONDS = Number(process.env.GYM_IMPRESSION_COOLDOWN_SECONDS ?? 1800);
const GYM_IMPRESSION_VIEWER_SALT = process.env.GYM_IMPRESSION_VIEWER_SALT?.trim() || 'fitsync-gym-impressions';

let flushTimer = null;
let inFlightFlush = null;

const buildGymImpressionCacheTags = (gymIds = []) => {
  const tags = new Set(['gyms:list']);

  gymIds.filter(Boolean).forEach((gymId) => {
    tags.add(`gym:${gymId}`);
  });

  return Array.from(tags);
};

const toUtcDayStart = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

const buildImpressionDayKey = (value = new Date()) => toUtcDayStart(value).toISOString().slice(0, 10);

const parseBufferedField = (field) => {
  const [gymId, dayKey] = String(field || '').split('::');

  if (!mongoose.Types.ObjectId.isValid(gymId) || !/^\d{4}-\d{2}-\d{2}$/.test(dayKey || '')) {
    return null;
  }

  const dayStart = new Date(`${dayKey}T00:00:00.000Z`);
  if (Number.isNaN(dayStart.getTime())) {
    return null;
  }

  return {
    gymId,
    dayKey,
    dayStart,
  };
};

const normalizeBufferedEntries = (entries = {}) =>
  Object.entries(entries)
    .map(([field, rawCount]) => {
      const parsed = parseBufferedField(field);
      const count = Number(rawCount);

      if (!parsed || !Number.isFinite(count) || count <= 0) {
        return null;
      }

      return {
        gymId: parsed.gymId,
        dayKey: parsed.dayKey,
        dayStart: parsed.dayStart,
        count,
      };
    })
    .filter(Boolean);

const buildViewerHash = (value) =>
  createHash('sha256')
    .update(`${GYM_IMPRESSION_VIEWER_SALT}:${String(value || '')}`)
    .digest('hex');

const getForwardedIp = (req) => {
  const headerValue = req?.headers?.['x-forwarded-for'];
  if (!headerValue) {
    return '';
  }

  return String(Array.isArray(headerValue) ? headerValue[0] : headerValue)
    .split(',')
    .map((entry) => entry.trim())
    .find(Boolean) || '';
};

const resolveViewerFingerprint = (req) => {
  const userId = req?.user?._id ?? req?.user?.id ?? null;
  if (userId) {
    return `user:${userId}`;
  }

  const viewerId = String(req?.body?.viewerId ?? '').trim();
  if (viewerId) {
    return `device:${viewerId}`;
  }

  const ip = getForwardedIp(req) || req?.ip || req?.socket?.remoteAddress || '';
  const userAgent = req?.get?.('user-agent') || req?.headers?.['user-agent'] || '';

  if (!ip && !userAgent) {
    return '';
  }

  return `anon:${buildViewerHash(`${ip}|${userAgent}`)}`;
};

const buildInteractionLockKey = (gymId, req, interaction = 'impression') => {
  const fingerprint = resolveViewerFingerprint(req);
  if (!fingerprint) {
    return '';
  }

  return `gym-${interaction}:${gymId}:${fingerprint}`;
};

export const queueGymImpression = async (gymId, increment = 1, viewedAt = new Date()) => {
  if (!mongoose.Types.ObjectId.isValid(gymId)) {
    return 0;
  }

  const dayKey = buildImpressionDayKey(viewedAt);
  return incrementBufferedCounter(GYM_IMPRESSION_BUCKET, `${String(gymId)}::${dayKey}`, increment);
};

export const queueGymOpen = async (gymId, increment = 1, viewedAt = new Date()) => {
  if (!mongoose.Types.ObjectId.isValid(gymId)) {
    return 0;
  }

  const dayKey = buildImpressionDayKey(viewedAt);
  return incrementBufferedCounter(GYM_OPEN_BUCKET, `${String(gymId)}::${dayKey}`, increment);
};

export const registerGymImpression = async ({ gymId, req, viewedAt = new Date() } = {}) => {
  if (!mongoose.Types.ObjectId.isValid(gymId)) {
    return { recorded: false, reason: 'invalid-gym' };
  }

  const cooldownSeconds = Number.isFinite(GYM_IMPRESSION_COOLDOWN_SECONDS) && GYM_IMPRESSION_COOLDOWN_SECONDS > 0
    ? GYM_IMPRESSION_COOLDOWN_SECONDS
    : 1800;

  const lockKey = buildInteractionLockKey(gymId, req, 'impression');
  if (lockKey) {
    const acquired = await acquireTransientFlag(lockKey, cooldownSeconds);
    if (!acquired) {
      return { recorded: false, reason: 'deduped' };
    }
  }

  await queueGymImpression(gymId, 1, viewedAt);
  return { recorded: true };
};

export const registerGymOpen = async ({ gymId, req, viewedAt = new Date() } = {}) => {
  if (!mongoose.Types.ObjectId.isValid(gymId)) {
    return { recorded: false, reason: 'invalid-gym' };
  }

  const cooldownSeconds = Number.isFinite(GYM_IMPRESSION_COOLDOWN_SECONDS) && GYM_IMPRESSION_COOLDOWN_SECONDS > 0
    ? GYM_IMPRESSION_COOLDOWN_SECONDS
    : 1800;

  const lockKey = buildInteractionLockKey(gymId, req, 'open');
  if (lockKey) {
    const acquired = await acquireTransientFlag(lockKey, cooldownSeconds);
    if (!acquired) {
      return { recorded: false, reason: 'deduped' };
    }
  }

  await queueGymOpen(gymId, 1, viewedAt);
  return { recorded: true };
};

export const flushGymImpressions = async () => {
  if (inFlightFlush) {
    return inFlightFlush;
  }

  inFlightFlush = (async () => {
    const [rawImpressionEntries, rawOpenEntries] = await Promise.all([
      consumeBufferedCounters(GYM_IMPRESSION_BUCKET),
      consumeBufferedCounters(GYM_OPEN_BUCKET),
    ]);
    const impressionEntries = normalizeBufferedEntries(rawImpressionEntries);
    const openEntries = normalizeBufferedEntries(rawOpenEntries);

    if (!impressionEntries.length && !openEntries.length) {
      return { processed: 0, updated: 0, opened: 0 };
    }

    const now = new Date();
    const impressionCountsByGym = impressionEntries.reduce((acc, entry) => {
      const key = String(entry.gymId);
      acc[key] = (acc[key] || 0) + entry.count;
      return acc;
    }, {});
    const openCountsByGym = openEntries.reduce((acc, entry) => {
      const key = String(entry.gymId);
      acc[key] = (acc[key] || 0) + entry.count;
      return acc;
    }, {});
    const gymIds = Array.from(
      new Set([
        ...Object.keys(impressionCountsByGym),
        ...Object.keys(openCountsByGym),
      ]),
    );

    const [gymResult] = await Promise.all([
      Gym.bulkWrite(
        gymIds.map((gymId) => {
          const impressionCount = impressionCountsByGym[gymId] || 0;
          const openCount = openCountsByGym[gymId] || 0;
          const update = {};

          if (impressionCount > 0) {
            update.$inc = { ...(update.$inc || {}), 'analytics.impressions': impressionCount };
            update.$set = { ...(update.$set || {}), 'analytics.lastImpressionAt': now };
          }

          if (openCount > 0) {
            update.$inc = { ...(update.$inc || {}), 'analytics.opens': openCount };
            update.$set = { ...(update.$set || {}), 'analytics.lastOpenAt': now };
          }

          return {
            updateOne: {
              filter: { _id: gymId },
              update,
            },
          };
        }),
        { ordered: false },
      ),
      GymImpressionDaily.bulkWrite(
        [
          ...impressionEntries.map(({ gymId, dayStart, count }) => ({
            updateOne: {
              filter: { gym: gymId, date: dayStart },
              update: {
                $inc: { count },
                $set: { lastImpressionAt: now },
                $setOnInsert: { gym: gymId, date: dayStart },
              },
              upsert: true,
            },
          })),
          ...openEntries.map(({ gymId, dayStart, count }) => ({
            updateOne: {
              filter: { gym: gymId, date: dayStart },
              update: {
                $inc: { openCount: count },
                $set: { lastOpenAt: now },
                $setOnInsert: { gym: gymId, date: dayStart },
              },
              upsert: true,
            },
          })),
        ],
        { ordered: false },
      ),
    ]);

    await invalidateCacheByTags(buildGymImpressionCacheTags(gymIds));
    await Promise.all(gymIds.map((gymId) =>
      syncGymSearchDocumentById(gymId).catch((error) => {
        console.error('Gym search sync failed after impression flush', error);
      })));

    return {
      processed: impressionEntries.length + openEntries.length,
      updated: gymResult.modifiedCount ?? gymResult.nModified ?? 0,
      opened: openEntries.length,
    };
  })().finally(() => {
    inFlightFlush = null;
  });

  return inFlightFlush;
};

export const getGymImpressionCountsSince = async (gymIds = [], sinceDate = new Date()) => {
  const normalizedGymIds = gymIds
    .map((gymId) => (mongoose.Types.ObjectId.isValid(gymId) ? new mongoose.Types.ObjectId(gymId) : null))
    .filter(Boolean);

  if (!normalizedGymIds.length) {
    return new Map();
  }

  const dayStart = toUtcDayStart(sinceDate);
  const rows = await GymImpressionDaily.aggregate([
    {
      $match: {
        gym: { $in: normalizedGymIds },
        date: { $gte: dayStart },
      },
    },
    {
      $group: {
        _id: '$gym',
        count: { $sum: '$count' },
        openCount: { $sum: '$openCount' },
        lastImpressionAt: { $max: '$lastImpressionAt' },
        lastOpenAt: { $max: '$lastOpenAt' },
      },
    },
  ]);

  return rows.reduce((acc, row) => {
    acc.set(String(row._id), {
      count: Number(row.count) || 0,
      openCount: Number(row.openCount) || 0,
      lastImpressionAt: row.lastImpressionAt || null,
      lastOpenAt: row.lastOpenAt || null,
    });
    return acc;
  }, new Map());
};

export const startGymImpressionFlushLoop = () => {
  if (flushTimer || process.env.NODE_ENV === 'test') {
    return flushTimer;
  }

  const intervalMs = Number.isFinite(GYM_IMPRESSION_FLUSH_INTERVAL_MS) && GYM_IMPRESSION_FLUSH_INTERVAL_MS > 0
    ? GYM_IMPRESSION_FLUSH_INTERVAL_MS
    : 15000;

  flushTimer = setInterval(() => {
    flushGymImpressions().catch((error) => {
      console.error('Gym impression flush failed', error);
    });
  }, intervalMs);

  if (typeof flushTimer.unref === 'function') {
    flushTimer.unref();
  }

  return flushTimer;
};

export const stopGymImpressionFlushLoop = async () => {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }

  return flushGymImpressions();
};
