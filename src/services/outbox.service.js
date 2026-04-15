import OutboxEvent from '../models/outboxEvent.model.js';
import { invalidateCacheByTags } from './cache.service.js';
import {
  deleteGymSearchDocument,
  deleteProductSearchDocument,
  syncGymSearchDocumentById,
  syncProductSearchDocumentById,
} from './search.service.js';

const OUTBOX_BATCH_SIZE = Number(process.env.OUTBOX_BATCH_SIZE ?? 25);
const OUTBOX_POLL_INTERVAL_MS = Number(process.env.OUTBOX_POLL_INTERVAL_MS ?? 3000);
const OUTBOX_RETRY_DELAY_MS = Number(process.env.OUTBOX_RETRY_DELAY_MS ?? 15000);

let outboxTimer = null;
let activeDrain = null;

const topicHandlers = {
  'gym.cache.invalidate': async ({ payload }) => {
    await invalidateCacheByTags(payload?.tags ?? []);
  },
  'gym.search.upsert': async ({ aggregateId }) => {
    await syncGymSearchDocumentById(aggregateId);
  },
  'gym.search.delete': async ({ aggregateId }) => {
    await deleteGymSearchDocument(aggregateId);
  },
  'product.cache.invalidate': async ({ payload }) => {
    await invalidateCacheByTags(payload?.tags ?? []);
  },
  'product.search.upsert': async ({ aggregateId }) => {
    await syncProductSearchDocumentById(aggregateId);
  },
  'product.search.delete': async ({ aggregateId }) => {
    await deleteProductSearchDocument(aggregateId);
  },
};

export const enqueueOutboxEvents = async (events = [], { session } = {}) => {
  if (!events.length) {
    return [];
  }

  return OutboxEvent.insertMany(events.map((event) => ({
    status: 'pending',
    availableAt: new Date(),
    ...event,
  })), { session, ordered: true });
};

const processOutboxEvent = async (event) => {
  const handler = topicHandlers[event.topic];
  if (!handler) {
    throw new Error(`No outbox handler registered for topic ${event.topic}`);
  }

  await handler(event);
};

export const drainOutbox = async ({ limit = OUTBOX_BATCH_SIZE } = {}) => {
  if (activeDrain) {
    return activeDrain;
  }

  activeDrain = (async () => {
    const now = new Date();
    const events = await OutboxEvent.find({
      status: { $in: ['pending', 'failed'] },
      availableAt: { $lte: now },
    })
      .sort({ createdAt: 1 })
      .limit(limit);

    let processed = 0;
    let failed = 0;

    for (const event of events) {
      try {
        event.status = 'processing';
        event.attempts += 1;
        await event.save();

        // eslint-disable-next-line no-await-in-loop
        await processOutboxEvent(event);

        event.status = 'processed';
        event.processedAt = new Date();
        event.lastError = undefined;
        // eslint-disable-next-line no-await-in-loop
        await event.save();
        processed += 1;
      } catch (error) {
        event.status = 'failed';
        event.lastError = error?.message ?? String(error);
        event.availableAt = new Date(Date.now() + OUTBOX_RETRY_DELAY_MS);
        // eslint-disable-next-line no-await-in-loop
        await event.save();
        failed += 1;
      }
    }

    return { processed, failed };
  })().finally(() => {
    activeDrain = null;
  });

  return activeDrain;
};

export const startOutboxWorker = () => {
  if (process.env.NODE_ENV === 'test' || outboxTimer) {
    return outboxTimer;
  }

  outboxTimer = setInterval(() => {
    drainOutbox().catch((error) => {
      console.error('Outbox drain failed', error);
    });
  }, OUTBOX_POLL_INTERVAL_MS);

  if (typeof outboxTimer.unref === 'function') {
    outboxTimer.unref();
  }

  return outboxTimer;
};

export const stopOutboxWorker = async () => {
  if (outboxTimer) {
    clearInterval(outboxTimer);
    outboxTimer = null;
  }

  await drainOutbox().catch(() => {});
};
