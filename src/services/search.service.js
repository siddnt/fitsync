import { performance } from 'node:perf_hooks';
import { Queue, QueueEvents, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { Meilisearch } from 'meilisearch';
import Gym from '../models/gym.model.js';
import Product from '../models/product.model.js';
import { recordSearchEvent, recordSearchSyncEvent } from './observability.service.js';

const SEARCH_HOST = process.env.MEILISEARCH_HOST?.trim() || null;
const SEARCH_API_KEY = process.env.MEILISEARCH_API_KEY?.trim() || undefined;
const REDIS_URL = process.env.REDIS_URL?.trim() || null;
const GYM_INDEX_UID = process.env.MEILISEARCH_GYM_INDEX ?? 'fitsync_gyms';
const PRODUCT_INDEX_UID = process.env.MEILISEARCH_PRODUCT_INDEX ?? 'fitsync_products';
const SEARCH_BOOTSTRAP_ON_STARTUP = String(process.env.SEARCH_BOOTSTRAP_ON_STARTUP ?? 'true').toLowerCase() !== 'false';
const SEARCH_SYNC_FLUSH_INTERVAL_MS = Number(process.env.SEARCH_SYNC_FLUSH_INTERVAL_MS ?? 1000);
const SEARCH_SYNC_MAX_QUEUE_ITEMS = Number(process.env.SEARCH_SYNC_MAX_QUEUE_ITEMS ?? 1000);
const SEARCH_SYNC_QUEUE_NAME = process.env.SEARCH_SYNC_QUEUE_NAME ?? 'fitsync-search-sync';

let client = null;
let initialized = false;
let ready = false;
let lastError = null;
let initializePromise = null;
let searchSyncTimer = null;
let inFlightSearchFlush = null;
let bullQueue = null;
let bullWorker = null;
let bullQueueEvents = null;
let bullQueueConnection = null;
let bullWorkerConnection = null;
let bullEventsConnection = null;
let bullReady = false;
let bullQueueDepth = 0;

const searchSyncQueue = new Map();

const normalizeString = (value) => String(value ?? '').trim();
const normalizeToken = (value) => normalizeString(value).toLowerCase();

const toTimestamp = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
};

const isIndexMissingError = (error) =>
  ['index_not_found', 'index_not_found_error'].includes(error?.code)
  || String(error?.message ?? '').toLowerCase().includes('index');

const getSearchClient = () => {
  if (!client && SEARCH_HOST) {
    client = new Meilisearch({
      host: SEARCH_HOST,
      apiKey: SEARCH_API_KEY,
    });
  }

  return client;
};

const waitForTask = async (task) => {
  if (!task?.taskUid || !getSearchClient()) {
    return;
  }

  await getSearchClient().waitForTask(task.taskUid);
};

const ensureIndex = async (uid, primaryKey, settings) => {
  const searchClient = getSearchClient();
  if (!searchClient) {
    return null;
  }

  try {
    await searchClient.getIndex(uid);
  } catch (error) {
    if (!isIndexMissingError(error)) {
      throw error;
    }

    const task = await searchClient.createIndex(uid, { primaryKey });
    await waitForTask(task);
  }

  const index = searchClient.index(uid);
  const settingsTask = await index.updateSettings(settings);
  await waitForTask(settingsTask);
  return index;
};

const mapGymSearchDocument = (gym) => ({
  id: String(gym._id),
  name: gym.name,
  description: gym.description ?? '',
  tags: gym.tags ?? [],
  amenities: gym.amenities ?? [],
  keyFeatures: gym.keyFeatures ?? [],
  city: gym.location?.city ?? '',
  cityNormalized: normalizeToken(gym.location?.city),
  postalCode: gym.location?.postalCode ?? '',
  postalCodeNormalized: normalizeToken(gym.location?.postalCode),
  state: gym.location?.state ?? '',
  ownerName: [gym.owner?.firstName, gym.owner?.lastName].filter(Boolean).join(' ').trim() || gym.owner?.name || '',
  status: gym.status,
  isPublished: Boolean(gym.isPublished),
  sponsorshipStatus: gym.sponsorship?.status ?? 'none',
  sponsorshipRank: gym.sponsorship?.status === 'active' ? 1 : 0,
  impressions: Number(gym.analytics?.impressions ?? 0),
  createdAtTs: toTimestamp(gym.createdAt),
  updatedAtTs: toTimestamp(gym.updatedAt),
  amenitiesNormalized: (gym.amenities ?? []).map(normalizeToken),
});

const mapProductSearchDocument = (product) => ({
  id: String(product._id),
  name: product.name,
  description: product.description ?? '',
  category: product.category,
  sellerName: [product.seller?.firstName, product.seller?.lastName].filter(Boolean).join(' ').trim()
    || product.seller?.name
    || '',
  status: product.status,
  isPublished: Boolean(product.isPublished),
  stock: Number(product.stock ?? 0),
  price: Number(product.price ?? 0),
  createdAtTs: toTimestamp(product.createdAt),
  updatedAtTs: toTimestamp(product.updatedAt),
  totalSold: Number(product.metrics?.sales?.totalSold ?? 0),
  averageRating: Number(product.metrics?.reviews?.averageRating ?? 0),
});

const syncDocuments = async (uid, documents = []) => {
  if (!ready || !documents.length) {
    return;
  }

  const task = await getSearchClient().index(uid).addDocuments(documents);
  await waitForTask(task);
};

const deleteDocument = async (uid, id) => {
  if (!ready || !id) {
    return;
  }

  const task = await getSearchClient().index(uid).deleteDocument(String(id));
  await waitForTask(task);
};

const bootstrapIndex = async (uid, documents = []) => {
  if (!ready) {
    return;
  }

  const index = getSearchClient().index(uid);
  const deleteTask = await index.deleteAllDocuments();
  await waitForTask(deleteTask);

  if (documents.length) {
    await syncDocuments(uid, documents);
  }
};

const getTaskKey = ({ entity, action, id }) => [entity, action, id].join(':');

const getQueueLimit = () =>
  Number.isFinite(SEARCH_SYNC_MAX_QUEUE_ITEMS) && SEARCH_SYNC_MAX_QUEUE_ITEMS > 0
    ? SEARCH_SYNC_MAX_QUEUE_ITEMS
    : 1000;

const getFlushIntervalMs = () =>
  Number.isFinite(SEARCH_SYNC_FLUSH_INTERVAL_MS) && SEARCH_SYNC_FLUSH_INTERVAL_MS > 0
    ? SEARCH_SYNC_FLUSH_INTERVAL_MS
    : 1000;

const canUseBullMq = () =>
  Boolean(SEARCH_HOST && REDIS_URL && process.env.NODE_ENV !== 'test');

const buildBullConnection = () =>
  new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

const enqueueSearchSyncTask = ({ entity, action, id }) => {
  const normalizedId = normalizeString(id);
  if (!entity || !action || !normalizedId) {
    return { queued: false, queueDepth: bullReady ? bullQueueDepth : searchSyncQueue.size };
  }

  const taskKey = getTaskKey({ entity, action, id: normalizedId });
  if (!searchSyncQueue.has(taskKey) && searchSyncQueue.size >= getQueueLimit()) {
    recordSearchSyncEvent({
      state: 'failed',
      queueDepth: searchSyncQueue.size,
      error: new Error('Search sync queue is full'),
    });

    return { queued: false, queueDepth: searchSyncQueue.size };
  }

  searchSyncQueue.set(taskKey, {
    entity,
    action,
    id: normalizedId,
    queuedAt: Date.now(),
  });

  recordSearchSyncEvent({ state: 'queued', queueDepth: searchSyncQueue.size });

  return {
    queued: true,
    queueDepth: searchSyncQueue.size,
  };
};

const enqueueSearchSyncTaskWithBull = async ({ entity, action, id }) => {
  const normalizedId = normalizeString(id);
  if (!entity || !action || !normalizedId) {
    return { queued: false, queueDepth: bullQueueDepth };
  }

  if (!bullReady || !bullQueue) {
    return enqueueSearchSyncTask({ entity, action, id: normalizedId });
  }

  const taskKey = getTaskKey({ entity, action, id: normalizedId });
  const existingJob = await bullQueue.getJob(taskKey);
  if (existingJob) {
    const state = await existingJob.getState();
    if (['waiting', 'active', 'delayed', 'prioritized'].includes(state)) {
      recordSearchSyncEvent({ queueDepth: bullQueueDepth });
      return { queued: true, queueDepth: bullQueueDepth };
    }
  }

  await bullQueue.add(action, { entity, action, id: normalizedId }, {
    jobId: taskKey,
    removeOnComplete: true,
    removeOnFail: 100,
  });

  bullQueueDepth += 1;
  recordSearchSyncEvent({ state: 'queued', queueDepth: bullQueueDepth });

  return {
    queued: true,
    queueDepth: bullQueueDepth,
  };
};

export const initializeSearch = async () => {
  if (ready) {
    return getSearchStatus();
  }

  if (!SEARCH_HOST) {
    return getSearchStatus();
  }

  if (initializePromise) {
    await initializePromise;
    return getSearchStatus();
  }

  initializePromise = (async () => {
    initialized = true;

    try {
      await Promise.all([
        ensureIndex(GYM_INDEX_UID, 'id', {
          searchableAttributes: ['name', 'description', 'tags', 'amenities', 'keyFeatures', 'city', 'postalCode', 'ownerName'],
          filterableAttributes: ['status', 'isPublished', 'cityNormalized', 'postalCodeNormalized', 'amenitiesNormalized', 'sponsorshipStatus'],
          sortableAttributes: ['sponsorshipRank', 'impressions', 'createdAtTs', 'updatedAtTs'],
        }),
        ensureIndex(PRODUCT_INDEX_UID, 'id', {
          searchableAttributes: ['name', 'description', 'category', 'sellerName'],
          filterableAttributes: ['isPublished', 'category', 'status', 'stock', 'price'],
          sortableAttributes: ['price', 'createdAtTs', 'updatedAtTs', 'totalSold', 'averageRating'],
        }),
      ]);

      ready = true;
      lastError = null;

      if (SEARCH_BOOTSTRAP_ON_STARTUP) {
        const [gyms, products] = await Promise.all([
          Gym.find({ status: 'active', isPublished: true })
            .select('name description tags amenities keyFeatures location owner status isPublished sponsorship analytics createdAt updatedAt')
            .populate({ path: 'owner', select: 'name firstName lastName' })
            .lean(),
          Product.find({ isPublished: true })
            .select('name description category seller status isPublished stock price metrics createdAt updatedAt')
            .populate({ path: 'seller', select: 'name firstName lastName' })
            .lean(),
        ]);

        await Promise.all([
          bootstrapIndex(GYM_INDEX_UID, gyms.map(mapGymSearchDocument)),
          bootstrapIndex(PRODUCT_INDEX_UID, products.map(mapProductSearchDocument)),
        ]);
      }
    } catch (error) {
      lastError = error;
      ready = false;
      initialized = false;
    } finally {
      initializePromise = null;
    }
  })();

  await initializePromise;
  return getSearchStatus();
};

export const getSearchStatus = () => ({
  provider: ready ? 'meilisearch' : 'disabled',
  configured: Boolean(SEARCH_HOST),
  ready,
  lastError: lastError?.message ?? null,
  queue: {
    provider: bullReady ? 'bullmq' : (searchSyncTimer ? 'memory' : 'disabled'),
    depth: bullReady ? bullQueueDepth : searchSyncQueue.size,
    running: Boolean(bullWorker || searchSyncTimer || inFlightSearchFlush),
    flushIntervalMs: getFlushIntervalMs(),
    maxQueueItems: getQueueLimit(),
  },
});

const syncGymSearchDocumentNow = async (gym) => {
  await initializeSearch();
  if (!ready || !gym?._id) {
    return;
  }

  if (gym.status !== 'active' || !gym.isPublished) {
    await deleteGymSearchDocumentNow(gym._id);
    return;
  }

  await syncDocuments(GYM_INDEX_UID, [mapGymSearchDocument(gym)]);
};

const syncGymSearchDocumentByIdNow = async (gymId) => {
  await initializeSearch();
  if (!ready || !gymId) {
    return;
  }

  const gym = await Gym.findById(gymId)
    .select('name description tags amenities keyFeatures location owner status isPublished sponsorship analytics createdAt updatedAt')
    .populate({ path: 'owner', select: 'name firstName lastName' })
    .lean();

  if (!gym) {
    await deleteGymSearchDocumentNow(gymId);
    return;
  }

  await syncGymSearchDocumentNow(gym);
};

const deleteGymSearchDocumentNow = async (gymId) => {
  await initializeSearch();
  await deleteDocument(GYM_INDEX_UID, gymId);
};

const syncProductSearchDocumentNow = async (product) => {
  await initializeSearch();
  if (!ready || !product?._id) {
    return;
  }

  if (!product.isPublished) {
    await deleteProductSearchDocumentNow(product._id);
    return;
  }

  await syncDocuments(PRODUCT_INDEX_UID, [mapProductSearchDocument(product)]);
};

const syncProductSearchDocumentByIdNow = async (productId) => {
  await initializeSearch();
  if (!ready || !productId) {
    return;
  }

  const product = await Product.findById(productId)
    .select('name description category seller status isPublished stock price metrics createdAt updatedAt')
    .populate({ path: 'seller', select: 'name firstName lastName' })
    .lean();

  if (!product) {
    await deleteProductSearchDocumentNow(productId);
    return;
  }

  await syncProductSearchDocumentNow(product);
};

const deleteProductSearchDocumentNow = async (productId) => {
  await initializeSearch();
  await deleteDocument(PRODUCT_INDEX_UID, productId);
};

const processSearchSyncTask = async (task) => {
  if (task.entity === 'gym' && task.action === 'upsert') {
    await syncGymSearchDocumentByIdNow(task.id);
    return;
  }

  if (task.entity === 'gym' && task.action === 'delete') {
    await deleteGymSearchDocumentNow(task.id);
    return;
  }

  if (task.entity === 'product' && task.action === 'upsert') {
    await syncProductSearchDocumentByIdNow(task.id);
    return;
  }

  if (task.entity === 'product' && task.action === 'delete') {
    await deleteProductSearchDocumentNow(task.id);
  }
};

const initializeBullMq = async () => {
  if (!canUseBullMq()) {
    return false;
  }

  if (bullReady && bullQueue && bullWorker && bullQueueEvents) {
    return true;
  }

  try {
    if (!bullQueueConnection) {
      bullQueueConnection = buildBullConnection();
    }
    if (!bullWorkerConnection) {
      bullWorkerConnection = buildBullConnection();
    }
    if (!bullEventsConnection) {
      bullEventsConnection = buildBullConnection();
    }

    if (!bullQueue) {
      bullQueue = new Queue(SEARCH_SYNC_QUEUE_NAME, {
        connection: bullQueueConnection,
        defaultJobOptions: {
          removeOnComplete: true,
          removeOnFail: 100,
        },
      });
    }

    if (!bullWorker) {
      bullWorker = new Worker(
        SEARCH_SYNC_QUEUE_NAME,
        async (job) => {
          await processSearchSyncTask(job.data);
        },
        {
          connection: bullWorkerConnection,
          concurrency: 2,
        },
      );

      bullWorker.on('completed', () => {
        bullQueueDepth = Math.max(0, bullQueueDepth - 1);
        recordSearchSyncEvent({ state: 'processed', queueDepth: bullQueueDepth });
      });

      bullWorker.on('failed', (_job, error) => {
        bullQueueDepth = Math.max(0, bullQueueDepth - 1);
        lastError = error;
        recordSearchSyncEvent({ state: 'failed', queueDepth: bullQueueDepth, error });
      });

      bullWorker.on('error', (error) => {
        lastError = error;
        bullReady = false;
      });
    }

    if (!bullQueueEvents) {
      bullQueueEvents = new QueueEvents(SEARCH_SYNC_QUEUE_NAME, {
        connection: bullEventsConnection,
      });
    }

    await Promise.all([
      bullQueue.waitUntilReady(),
      bullWorker.waitUntilReady(),
      bullQueueEvents.waitUntilReady(),
    ]);

    bullQueueDepth = await bullQueue.count();
    bullReady = true;
    recordSearchSyncEvent({ queueDepth: bullQueueDepth });
    return true;
  } catch (error) {
    lastError = error;
    bullReady = false;
    console.error('BullMQ search sync initialization failed', error);
    return false;
  }
};

export const flushSearchSyncQueue = async () => {
  if (inFlightSearchFlush) {
    return inFlightSearchFlush;
  }

  inFlightSearchFlush = (async () => {
    const tasks = Array.from(searchSyncQueue.values());
    searchSyncQueue.clear();
    recordSearchSyncEvent({ queueDepth: searchSyncQueue.size });

    if (!tasks.length) {
      return { processed: 0, failed: 0 };
    }

    let processed = 0;
    let failed = 0;

    for (const task of tasks) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await processSearchSyncTask(task);
        processed += 1;
        recordSearchSyncEvent({ state: 'processed', queueDepth: searchSyncQueue.size });
      } catch (error) {
        failed += 1;
        lastError = error;
        recordSearchSyncEvent({ state: 'failed', queueDepth: searchSyncQueue.size, error });
        console.error('Search sync task failed', error);
      }
    }

    return { processed, failed };
  })().finally(() => {
    inFlightSearchFlush = null;
  });

  return inFlightSearchFlush;
};

export const startSearchSyncWorker = () => {
  if (process.env.NODE_ENV === 'test' || !SEARCH_HOST) {
    return Promise.resolve(null);
  }

  return initializeBullMq().then((initializedBull) => {
    if (initializedBull) {
      return bullWorker;
    }

    if (searchSyncTimer) {
      return searchSyncTimer;
    }

    searchSyncTimer = setInterval(() => {
      flushSearchSyncQueue().catch((error) => {
        lastError = error;
        recordSearchSyncEvent({ state: 'failed', queueDepth: searchSyncQueue.size, error });
        console.error('Search sync flush failed', error);
      });
    }, getFlushIntervalMs());

    if (typeof searchSyncTimer.unref === 'function') {
      searchSyncTimer.unref();
    }

    return searchSyncTimer;
  });
};

export const stopSearchSyncWorker = async () => {
  if (searchSyncTimer) {
    clearInterval(searchSyncTimer);
    searchSyncTimer = null;
  }

  const memoryFlush = await flushSearchSyncQueue();

  if (bullQueueEvents) {
    await bullQueueEvents.close().catch(() => {});
    bullQueueEvents = null;
  }

  if (bullWorker) {
    await bullWorker.close().catch(() => {});
    bullWorker = null;
  }

  if (bullQueue) {
    await bullQueue.close().catch(() => {});
    bullQueue = null;
  }

  if (bullEventsConnection) {
    await bullEventsConnection.quit().catch(() => {});
    bullEventsConnection = null;
  }

  if (bullWorkerConnection) {
    await bullWorkerConnection.quit().catch(() => {});
    bullWorkerConnection = null;
  }

  if (bullQueueConnection) {
    await bullQueueConnection.quit().catch(() => {});
    bullQueueConnection = null;
  }

  bullReady = false;
  bullQueueDepth = 0;
  recordSearchSyncEvent({ queueDepth: bullQueueDepth });

  return memoryFlush;
};

export const syncGymSearchDocument = async (gym) =>
  enqueueSearchSyncTaskWithBull({ entity: 'gym', action: 'upsert', id: gym?._id });

export const syncGymSearchDocumentById = async (gymId) =>
  enqueueSearchSyncTaskWithBull({ entity: 'gym', action: 'upsert', id: gymId });

export const deleteGymSearchDocument = async (gymId) =>
  enqueueSearchSyncTaskWithBull({ entity: 'gym', action: 'delete', id: gymId });

export const syncProductSearchDocument = async (product) =>
  enqueueSearchSyncTaskWithBull({ entity: 'product', action: 'upsert', id: product?._id });

export const syncProductSearchDocumentById = async (productId) =>
  enqueueSearchSyncTaskWithBull({ entity: 'product', action: 'upsert', id: productId });

export const deleteProductSearchDocument = async (productId) =>
  enqueueSearchSyncTaskWithBull({ entity: 'product', action: 'delete', id: productId });

const executeSearch = async (indexUid, query, options = {}) => {
  await initializeSearch();
  if (!ready) {
    return { ids: [], total: 0, provider: 'disabled' };
  }

  const startedAt = performance.now();
  const result = await getSearchClient().index(indexUid).search(query, {
    ...options,
    attributesToRetrieve: ['id'],
  });
  const durationMs = performance.now() - startedAt;

  recordSearchEvent({
    provider: 'meilisearch',
    durationMs,
    totalHits: result.estimatedTotalHits ?? result.hits?.length ?? 0,
  });

  return {
    ids: (result.hits ?? []).map((hit) => String(hit.id)),
    total: result.estimatedTotalHits ?? result.totalHits ?? result.hits?.length ?? 0,
    provider: 'meilisearch',
  };
};

const escapeFilterValue = (value) => String(value).replace(/"/g, '\\"');

export const searchGymIndex = async (query, {
  city,
  amenities = [],
  offset = 0,
  limit = 20,
} = {}) => {
  const filters = ['status = "active"', 'isPublished = true'];

  if (city) {
    const locationToken = escapeFilterValue(normalizeToken(city));
    filters.push(`(cityNormalized = "${locationToken}" OR postalCodeNormalized = "${locationToken}")`);
  }

  amenities.filter(Boolean).forEach((amenity) => {
    filters.push(`amenitiesNormalized = "${escapeFilterValue(normalizeToken(amenity))}"`);
  });

  return executeSearch(GYM_INDEX_UID, query, {
    filter: filters,
    sort: ['sponsorshipRank:desc', 'impressions:desc', 'createdAtTs:desc'],
    offset,
    limit,
  });
};

export const searchProductIndex = async (query, {
  category,
  minPrice,
  maxPrice,
  inStock = false,
  sort = 'featured',
  offset = 0,
  limit = 24,
} = {}) => {
  const filters = ['isPublished = true'];

  if (category && category !== 'all') {
    filters.push(`category = "${escapeFilterValue(category)}"`);
  }
  if (Number.isFinite(minPrice)) {
    filters.push(`price >= ${minPrice}`);
  }
  if (Number.isFinite(maxPrice)) {
    filters.push(`price <= ${maxPrice}`);
  }
  if (inStock) {
    filters.push('status = "available"');
    filters.push('stock > 0');
  }

  const sortMap = {
    priceLow: ['price:asc', 'updatedAtTs:desc'],
    priceHigh: ['price:desc', 'updatedAtTs:desc'],
    newest: ['createdAtTs:desc'],
    featured: ['updatedAtTs:desc'],
  };

  return executeSearch(PRODUCT_INDEX_UID, query, {
    filter: filters,
    sort: sortMap[sort] ?? sortMap.featured,
    offset,
    limit,
  });
};

export const syncSearchIndexes = async () => {
  initialized = false;
  ready = false;
  lastError = null;
  return initializeSearch();
};
