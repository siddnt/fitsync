import { performance } from 'node:perf_hooks';

const SLOW_QUERY_THRESHOLD_MS = Number(process.env.SLOW_QUERY_THRESHOLD_MS ?? 75);
const MAX_SLOW_QUERY_SAMPLES = Number(process.env.MAX_SLOW_QUERY_SAMPLES ?? 25);

const metrics = {
  startedAt: new Date().toISOString(),
  cache: {
    states: {},
    providers: {},
    invalidations: 0,
    invalidatedKeys: 0,
    loadCount: 0,
    loadDurationMsTotal: 0,
    loadDurationMsMax: 0,
  },
  search: {
    providers: {},
    totalRequests: 0,
    totalHits: 0,
    durationMsTotal: 0,
    durationMsMax: 0,
    sync: {
      queued: 0,
      processed: 0,
      failed: 0,
      queueDepth: 0,
      queueHighWaterMark: 0,
      lastProcessedAt: null,
      lastError: null,
    },
  },
  queries: {
    total: 0,
    durationMsTotal: 0,
    durationMsMax: 0,
    slowThresholdMs: SLOW_QUERY_THRESHOLD_MS,
    byOperation: {},
    slowSamples: [],
  },
  requests: {
    total: 0,
    durationMsTotal: 0,
    durationMsMax: 0,
    byRoute: {},
  },
  httpCache: {
    freshResponses: 0,
    notModifiedResponses: 0,
  },
};

let queryInstrumentationApplied = false;

const incrementBucket = (bucket, key, amount = 1) => {
  if (!key) {
    return;
  }

  bucket[key] = (bucket[key] ?? 0) + amount;
};

const sanitizePayload = (payload, maxLength = 280) => {
  if (payload === undefined || payload === null) {
    return null;
  }

  try {
    const serialized = JSON.stringify(payload);
    return serialized.length > maxLength ? `${serialized.slice(0, maxLength)}...` : serialized;
  } catch (_error) {
    return '[unserializable]';
  }
};

const pushSlowSample = (sample) => {
  metrics.queries.slowSamples.unshift(sample);
  if (metrics.queries.slowSamples.length > MAX_SLOW_QUERY_SAMPLES) {
    metrics.queries.slowSamples.length = MAX_SLOW_QUERY_SAMPLES;
  }
};

export const recordCacheEvent = ({ state, provider }) => {
  incrementBucket(metrics.cache.states, state ?? 'unknown');
  incrementBucket(metrics.cache.providers, provider ?? 'unknown');
};

export const recordCacheLoad = ({ provider, durationMs }) => {
  metrics.cache.loadCount += 1;
  metrics.cache.loadDurationMsTotal += durationMs;
  metrics.cache.loadDurationMsMax = Math.max(metrics.cache.loadDurationMsMax, durationMs);
  incrementBucket(metrics.cache.providers, provider ?? 'unknown');
};

export const recordCacheInvalidation = ({ invalidatedKeys = 0 } = {}) => {
  metrics.cache.invalidations += 1;
  metrics.cache.invalidatedKeys += invalidatedKeys;
};

export const recordSearchEvent = ({ provider, durationMs = 0, totalHits = 0 }) => {
  metrics.search.totalRequests += 1;
  metrics.search.totalHits += Number(totalHits) || 0;
  metrics.search.durationMsTotal += durationMs;
  metrics.search.durationMsMax = Math.max(metrics.search.durationMsMax, durationMs);
  incrementBucket(metrics.search.providers, provider ?? 'unknown');
};

export const recordSearchSyncEvent = ({ state, queueDepth, error } = {}) => {
  if (typeof queueDepth === 'number' && Number.isFinite(queueDepth)) {
    metrics.search.sync.queueDepth = Math.max(0, queueDepth);
    metrics.search.sync.queueHighWaterMark = Math.max(
      metrics.search.sync.queueHighWaterMark,
      metrics.search.sync.queueDepth,
    );
  }

  if (state === 'queued') {
    metrics.search.sync.queued += 1;
  }

  if (state === 'processed') {
    metrics.search.sync.processed += 1;
    metrics.search.sync.lastProcessedAt = new Date().toISOString();
  }

  if (state === 'failed') {
    metrics.search.sync.failed += 1;
  }

  if (error) {
    metrics.search.sync.lastError = error?.message ?? String(error);
  }
};

export const recordQueryEvent = ({
  model,
  collection,
  operation,
  durationMs = 0,
  payload,
}) => {
  metrics.queries.total += 1;
  metrics.queries.durationMsTotal += durationMs;
  metrics.queries.durationMsMax = Math.max(metrics.queries.durationMsMax, durationMs);

  const operationKey = [collection ?? model ?? 'unknown', operation ?? 'query'].join('.');
  incrementBucket(metrics.queries.byOperation, operationKey);

  if (durationMs >= SLOW_QUERY_THRESHOLD_MS) {
    pushSlowSample({
      recordedAt: new Date().toISOString(),
      model: model ?? null,
      collection: collection ?? null,
      operation: operation ?? 'query',
      durationMs: Number(durationMs.toFixed(2)),
      payload: sanitizePayload(payload),
    });
  }
};

export const recordRequestEvent = ({
  method,
  route,
  statusCode,
  durationMs = 0,
}) => {
  metrics.requests.total += 1;
  metrics.requests.durationMsTotal += durationMs;
  metrics.requests.durationMsMax = Math.max(metrics.requests.durationMsMax, durationMs);

  const key = [method ?? 'GET', route ?? 'unknown', statusCode ?? 200].join(' ');
  incrementBucket(metrics.requests.byRoute, key);
};

export const recordHttpCacheEvent = ({ fresh = false, notModified = false } = {}) => {
  if (fresh) {
    metrics.httpCache.freshResponses += 1;
  }
  if (notModified) {
    metrics.httpCache.notModifiedResponses += 1;
  }
};

export const getObservabilitySnapshot = () => ({
  ...metrics,
  generatedAt: new Date().toISOString(),
  cache: {
    ...metrics.cache,
    averageLoadDurationMs: metrics.cache.loadCount
      ? Number((metrics.cache.loadDurationMsTotal / metrics.cache.loadCount).toFixed(2))
      : 0,
  },
  search: {
    ...metrics.search,
    averageDurationMs: metrics.search.totalRequests
      ? Number((metrics.search.durationMsTotal / metrics.search.totalRequests).toFixed(2))
      : 0,
  },
  queries: {
    ...metrics.queries,
    averageDurationMs: metrics.queries.total
      ? Number((metrics.queries.durationMsTotal / metrics.queries.total).toFixed(2))
      : 0,
  },
  requests: {
    ...metrics.requests,
    averageDurationMs: metrics.requests.total
      ? Number((metrics.requests.durationMsTotal / metrics.requests.total).toFixed(2))
      : 0,
  },
});

export const resetObservabilityMetrics = () => {
  metrics.startedAt = new Date().toISOString();
  metrics.cache = {
    states: {},
    providers: {},
    invalidations: 0,
    invalidatedKeys: 0,
    loadCount: 0,
    loadDurationMsTotal: 0,
    loadDurationMsMax: 0,
  };
  metrics.search = {
    providers: {},
    totalRequests: 0,
    totalHits: 0,
    durationMsTotal: 0,
    durationMsMax: 0,
    sync: {
      queued: 0,
      processed: 0,
      failed: 0,
      queueDepth: 0,
      queueHighWaterMark: 0,
      lastProcessedAt: null,
      lastError: null,
    },
  };
  metrics.queries = {
    total: 0,
    durationMsTotal: 0,
    durationMsMax: 0,
    slowThresholdMs: SLOW_QUERY_THRESHOLD_MS,
    byOperation: {},
    slowSamples: [],
  };
  metrics.requests = {
    total: 0,
    durationMsTotal: 0,
    durationMsMax: 0,
    byRoute: {},
  };
  metrics.httpCache = {
    freshResponses: 0,
    notModifiedResponses: 0,
  };
};

const escapePrometheusLabel = (value) =>
  String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');

const appendMetricLine = (lines, name, value, labels = null) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return;
  }

  if (labels && Object.keys(labels).length) {
    const renderedLabels = Object.entries(labels)
      .map(([label, labelValue]) => `${label}="${escapePrometheusLabel(labelValue)}"`)
      .join(',');

    lines.push(`${name}{${renderedLabels}} ${numericValue}`);
    return;
  }

  lines.push(`${name} ${numericValue}`);
};

export const buildPrometheusMetrics = ({ cacheStatus = {}, searchStatus = {} } = {}) => {
  const snapshot = getObservabilitySnapshot();
  const lines = [
    '# HELP fitsync_process_started_at_seconds Unix timestamp when FitSync metrics collection started.',
    '# TYPE fitsync_process_started_at_seconds gauge',
  ];

  appendMetricLine(lines, 'fitsync_process_started_at_seconds', Math.floor(new Date(snapshot.startedAt).getTime() / 1000));

  lines.push('# HELP fitsync_cache_events_total Cache lookup events grouped by state.');
  lines.push('# TYPE fitsync_cache_events_total counter');
  Object.entries(snapshot.cache.states).forEach(([state, value]) => {
    appendMetricLine(lines, 'fitsync_cache_events_total', value, { state });
  });

  lines.push('# HELP fitsync_cache_provider_events_total Cache events grouped by provider.');
  lines.push('# TYPE fitsync_cache_provider_events_total counter');
  Object.entries(snapshot.cache.providers).forEach(([provider, value]) => {
    appendMetricLine(lines, 'fitsync_cache_provider_events_total', value, { provider });
  });

  lines.push('# HELP fitsync_cache_invalidations_total Cache invalidation operations.');
  lines.push('# TYPE fitsync_cache_invalidations_total counter');
  appendMetricLine(lines, 'fitsync_cache_invalidations_total', snapshot.cache.invalidations);

  lines.push('# HELP fitsync_cache_invalidated_keys_total Cache keys removed by invalidation.');
  lines.push('# TYPE fitsync_cache_invalidated_keys_total counter');
  appendMetricLine(lines, 'fitsync_cache_invalidated_keys_total', snapshot.cache.invalidatedKeys);

  lines.push('# HELP fitsync_cache_loads_total Cache loader executions.');
  lines.push('# TYPE fitsync_cache_loads_total counter');
  appendMetricLine(lines, 'fitsync_cache_loads_total', snapshot.cache.loadCount);

  lines.push('# HELP fitsync_cache_load_duration_ms Cache loader duration in milliseconds.');
  lines.push('# TYPE fitsync_cache_load_duration_ms gauge');
  appendMetricLine(lines, 'fitsync_cache_load_duration_ms_sum', snapshot.cache.loadDurationMsTotal);
  appendMetricLine(lines, 'fitsync_cache_load_duration_ms_max', snapshot.cache.loadDurationMsMax);
  appendMetricLine(lines, 'fitsync_cache_load_duration_ms_avg', snapshot.cache.averageLoadDurationMs);

  lines.push('# HELP fitsync_search_requests_total Search requests grouped by provider.');
  lines.push('# TYPE fitsync_search_requests_total counter');
  Object.entries(snapshot.search.providers).forEach(([provider, value]) => {
    appendMetricLine(lines, 'fitsync_search_requests_total', value, { provider });
  });

  lines.push('# HELP fitsync_search_hits_total Total hits returned by search providers.');
  lines.push('# TYPE fitsync_search_hits_total counter');
  appendMetricLine(lines, 'fitsync_search_hits_total', snapshot.search.totalHits);

  lines.push('# HELP fitsync_search_duration_ms Search request duration in milliseconds.');
  lines.push('# TYPE fitsync_search_duration_ms gauge');
  appendMetricLine(lines, 'fitsync_search_duration_ms_sum', snapshot.search.durationMsTotal);
  appendMetricLine(lines, 'fitsync_search_duration_ms_max', snapshot.search.durationMsMax);
  appendMetricLine(lines, 'fitsync_search_duration_ms_avg', snapshot.search.averageDurationMs);

  lines.push('# HELP fitsync_search_sync_jobs_total Search sync queue jobs grouped by state.');
  lines.push('# TYPE fitsync_search_sync_jobs_total counter');
  appendMetricLine(lines, 'fitsync_search_sync_jobs_total', snapshot.search.sync.queued, { state: 'queued' });
  appendMetricLine(lines, 'fitsync_search_sync_jobs_total', snapshot.search.sync.processed, { state: 'processed' });
  appendMetricLine(lines, 'fitsync_search_sync_jobs_total', snapshot.search.sync.failed, { state: 'failed' });

  lines.push('# HELP fitsync_search_sync_queue_depth Pending jobs in the async search sync queue.');
  lines.push('# TYPE fitsync_search_sync_queue_depth gauge');
  appendMetricLine(lines, 'fitsync_search_sync_queue_depth', snapshot.search.sync.queueDepth);
  appendMetricLine(lines, 'fitsync_search_sync_queue_high_watermark', snapshot.search.sync.queueHighWaterMark);

  lines.push('# HELP fitsync_queries_total Mongo query and aggregate executions.');
  lines.push('# TYPE fitsync_queries_total counter');
  appendMetricLine(lines, 'fitsync_queries_total', snapshot.queries.total);

  lines.push('# HELP fitsync_query_operations_total Query executions grouped by collection and operation.');
  lines.push('# TYPE fitsync_query_operations_total counter');
  Object.entries(snapshot.queries.byOperation).forEach(([operation, value]) => {
    appendMetricLine(lines, 'fitsync_query_operations_total', value, { operation });
  });

  lines.push('# HELP fitsync_query_duration_ms Mongo query duration in milliseconds.');
  lines.push('# TYPE fitsync_query_duration_ms gauge');
  appendMetricLine(lines, 'fitsync_query_duration_ms_sum', snapshot.queries.durationMsTotal);
  appendMetricLine(lines, 'fitsync_query_duration_ms_max', snapshot.queries.durationMsMax);
  appendMetricLine(lines, 'fitsync_query_duration_ms_avg', snapshot.queries.averageDurationMs);
  appendMetricLine(lines, 'fitsync_query_slow_samples', snapshot.queries.slowSamples.length);

  lines.push('# HELP fitsync_requests_total HTTP requests grouped by route.');
  lines.push('# TYPE fitsync_requests_total counter');
  Object.entries(snapshot.requests.byRoute).forEach(([route, value]) => {
    appendMetricLine(lines, 'fitsync_requests_total', value, { route });
  });

  lines.push('# HELP fitsync_request_duration_ms HTTP request duration in milliseconds.');
  lines.push('# TYPE fitsync_request_duration_ms gauge');
  appendMetricLine(lines, 'fitsync_request_duration_ms_sum', snapshot.requests.durationMsTotal);
  appendMetricLine(lines, 'fitsync_request_duration_ms_max', snapshot.requests.durationMsMax);
  appendMetricLine(lines, 'fitsync_request_duration_ms_avg', snapshot.requests.averageDurationMs);

  lines.push('# HELP fitsync_http_cache_responses_total HTTP cache responses grouped by type.');
  lines.push('# TYPE fitsync_http_cache_responses_total counter');
  appendMetricLine(lines, 'fitsync_http_cache_responses_total', snapshot.httpCache.freshResponses, { state: 'fresh' });
  appendMetricLine(lines, 'fitsync_http_cache_responses_total', snapshot.httpCache.notModifiedResponses, { state: 'not_modified' });

  lines.push('# HELP fitsync_cache_provider_info Current cache provider information.');
  lines.push('# TYPE fitsync_cache_provider_info gauge');
  appendMetricLine(lines, 'fitsync_cache_provider_info', 1, {
    provider: cacheStatus.provider ?? 'unknown',
    redis_ready: String(Boolean(cacheStatus.redisReady)),
  });

  lines.push('# HELP fitsync_search_provider_info Current search provider information.');
  lines.push('# TYPE fitsync_search_provider_info gauge');
  appendMetricLine(lines, 'fitsync_search_provider_info', 1, {
    provider: searchStatus.provider ?? 'disabled',
    configured: String(Boolean(searchStatus.configured)),
    ready: String(Boolean(searchStatus.ready)),
  });

  return `${lines.join('\n')}\n`;
};

export const requestMetricsMiddleware = (req, res, next) => {
  const startedAt = performance.now();

  res.on('finish', () => {
    const route = req.route?.path
      ? `${req.baseUrl || ''}${req.route.path}`
      : req.originalUrl.split('?')[0];

    recordRequestEvent({
      method: req.method,
      route,
      statusCode: res.statusCode,
      durationMs: performance.now() - startedAt,
    });
  });

  next();
};

export const initializeQueryMetrics = (mongooseInstance) => {
  if (queryInstrumentationApplied) {
    return;
  }

  queryInstrumentationApplied = true;

  const originalQueryExec = mongooseInstance.Query.prototype.exec;
  mongooseInstance.Query.prototype.exec = async function patchedQueryExec(...args) {
    const startedAt = performance.now();

    try {
      return await originalQueryExec.apply(this, args);
    } finally {
      recordQueryEvent({
        model: this.model?.modelName,
        collection: this.model?.collection?.name,
        operation: this.op,
        durationMs: performance.now() - startedAt,
        payload: this.getFilter?.() ?? this.getQuery?.(),
      });
    }
  };

  const originalAggregateExec = mongooseInstance.Aggregate.prototype.exec;
  mongooseInstance.Aggregate.prototype.exec = async function patchedAggregateExec(...args) {
    const startedAt = performance.now();

    try {
      return await originalAggregateExec.apply(this, args);
    } finally {
      recordQueryEvent({
        model: this._model?.modelName,
        collection: this._model?.collection?.name,
        operation: 'aggregate',
        durationMs: performance.now() - startedAt,
        payload: this.pipeline?.(),
      });
    }
  };
};
