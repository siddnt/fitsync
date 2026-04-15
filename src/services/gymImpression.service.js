import mongoose from 'mongoose';
import Gym from '../models/gym.model.js';
import {
  consumeBufferedCounters,
  incrementBufferedCounter,
  invalidateCacheByTags,
} from './cache.service.js';
import { syncGymSearchDocumentById } from './search.service.js';

const GYM_IMPRESSION_BUCKET = 'gym-impressions';
const GYM_IMPRESSION_FLUSH_INTERVAL_MS = Number(process.env.GYM_IMPRESSION_FLUSH_INTERVAL_MS ?? 15000);

let flushTimer = null;
let inFlightFlush = null;

const buildGymImpressionCacheTags = (gymIds = []) => {
  const tags = new Set(['gyms:list']);

  gymIds.filter(Boolean).forEach((gymId) => {
    tags.add(`gym:${gymId}`);
  });

  return Array.from(tags);
};

const normalizeBufferedEntries = (entries = {}) =>
  Object.entries(entries)
    .map(([gymId, count]) => ({ gymId, count: Number(count) }))
    .filter(({ gymId, count }) => mongoose.Types.ObjectId.isValid(gymId) && Number.isFinite(count) && count > 0);

export const queueGymImpression = async (gymId, increment = 1) => {
  if (!mongoose.Types.ObjectId.isValid(gymId)) {
    return 0;
  }

  return incrementBufferedCounter(GYM_IMPRESSION_BUCKET, String(gymId), increment);
};

export const flushGymImpressions = async () => {
  if (inFlightFlush) {
    return inFlightFlush;
  }

  inFlightFlush = (async () => {
    const rawEntries = await consumeBufferedCounters(GYM_IMPRESSION_BUCKET);
    const entries = normalizeBufferedEntries(rawEntries);

    if (!entries.length) {
      return { processed: 0, updated: 0 };
    }

    const now = new Date();
    const result = await Gym.bulkWrite(
      entries.map(({ gymId, count }) => ({
        updateOne: {
          filter: { _id: gymId },
          update: {
            $inc: { 'analytics.impressions': count },
            $set: { 'analytics.lastImpressionAt': now },
          },
        },
      })),
      { ordered: false },
    );

    await invalidateCacheByTags(buildGymImpressionCacheTags(entries.map((entry) => entry.gymId)));
    await Promise.all(entries.map(({ gymId }) =>
      syncGymSearchDocumentById(gymId).catch((error) => {
        console.error('Gym search sync failed after impression flush', error);
      })));

    return {
      processed: entries.length,
      updated: result.modifiedCount ?? result.nModified ?? 0,
    };
  })().finally(() => {
    inFlightFlush = null;
  });

  return inFlightFlush;
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
