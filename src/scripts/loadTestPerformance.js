import '../config/bootstrapEnv.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import autocannon from 'autocannon';
import mongoose from 'mongoose';
import connectDB from '../db/index.js';
import app from '../app.js';
import { closeCache, initializeCache } from '../services/cache.service.js';
import { initializeSearch, stopSearchSyncWorker } from '../services/search.service.js';

const REPORT_DIR = path.resolve('docs');
const JSON_REPORT_PATH = path.join(REPORT_DIR, 'load-test-report.json');
const MARKDOWN_REPORT_PATH = path.join(REPORT_DIR, 'load-test-report.md');

const LOAD_DURATION_SECONDS = Number(process.env.LOAD_TEST_DURATION_SECONDS ?? 8);
const LOAD_CONNECTIONS = Number(process.env.LOAD_TEST_CONNECTIONS ?? 20);
const LOAD_PIPELINING = Number(process.env.LOAD_TEST_PIPELINING ?? 1);

const targets = [
  {
    name: 'Gym catalogue uncached',
    path: '/api/gyms?page=1&limit=12',
    headers: { 'x-cache-mode': 'bypass', 'x-load-test-mode': 'true' },
  },
  {
    name: 'Gym catalogue cached',
    path: '/api/gyms?page=1&limit=12',
    headers: { 'x-load-test-mode': 'true' },
  },
  {
    name: 'Marketplace catalogue uncached',
    path: '/api/marketplace/products?page=1&pageSize=12',
    headers: { 'x-cache-mode': 'bypass', 'x-load-test-mode': 'true' },
  },
  {
    name: 'Marketplace catalogue cached',
    path: '/api/marketplace/products?page=1&pageSize=12',
    headers: { 'x-load-test-mode': 'true' },
  },
];

const formatNumber = (value, digits = 2) => Number(Number(value ?? 0).toFixed(digits));

const runAutocannon = (options) =>
  new Promise((resolve, reject) => {
    const instance = autocannon(options, (error, result) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(result);
    });

    instance.on('error', reject);
  });

const parsePercentileKey = (key) => {
  if (!key?.startsWith('p')) {
    return null;
  }

  const rawValue = key.slice(1).replace('_', '.');
  const numericValue = Number(rawValue);
  return Number.isFinite(numericValue) ? numericValue : null;
};

const percentile = (bucket, targetPercentile) => {
  if (!bucket || typeof bucket !== 'object') {
    return 0;
  }

  const exactKey = `p${String(targetPercentile).replace('.', '_')}`;
  const exactValue = bucket[exactKey];

  if (typeof exactValue === 'number') {
    return exactValue;
  }

  const percentileEntries = Object.entries(bucket)
    .map(([key, value]) => ({
      percentile: parsePercentileKey(key),
      value,
    }))
    .filter((entry) => entry.percentile !== null && typeof entry.value === 'number')
    .sort((left, right) => left.percentile - right.percentile);

  if (!percentileEntries.length) {
    return 0;
  }

  const lower = [...percentileEntries]
    .reverse()
    .find((entry) => entry.percentile <= targetPercentile) ?? percentileEntries[0];
  const upper = percentileEntries.find((entry) => entry.percentile >= targetPercentile)
    ?? percentileEntries[percentileEntries.length - 1];

  if (lower.percentile === upper.percentile) {
    return lower.value;
  }

  const ratio = (targetPercentile - lower.percentile) / (upper.percentile - lower.percentile);
  return lower.value + ((upper.value - lower.value) * ratio);
};

const toScenarioResult = (target, result) => ({
  name: target.name,
  path: target.path,
  durationSeconds: LOAD_DURATION_SECONDS,
  connections: LOAD_CONNECTIONS,
  pipelining: LOAD_PIPELINING,
  requestsAverage: formatNumber(result.requests.average),
  requestsP95: formatNumber(percentile(result.requests, 95)),
  latencyAverageMs: formatNumber(result.latency.average),
  latencyP95Ms: formatNumber(percentile(result.latency, 95)),
  throughputAverageBytes: formatNumber(result.throughput.average),
  non2xx: result.non2xx ?? 0,
  errors: result.errors ?? 0,
  timeouts: result.timeouts ?? 0,
});

const buildComparisons = (results = []) => {
  const gymUncached = results.find((entry) => entry.name === 'Gym catalogue uncached');
  const gymCached = results.find((entry) => entry.name === 'Gym catalogue cached');
  const marketplaceUncached = results.find((entry) => entry.name === 'Marketplace catalogue uncached');
  const marketplaceCached = results.find((entry) => entry.name === 'Marketplace catalogue cached');

  const compare = (label, uncached, cached) => {
    if (!uncached || !cached) {
      return null;
    }

    const latencyImprovement = uncached.latencyAverageMs > 0
      ? ((uncached.latencyAverageMs - cached.latencyAverageMs) / uncached.latencyAverageMs) * 100
      : 0;

    const throughputGain = uncached.requestsAverage > 0
      ? ((cached.requestsAverage - uncached.requestsAverage) / uncached.requestsAverage) * 100
      : 0;

    return {
      label,
      averageLatencyImprovementPercent: formatNumber(latencyImprovement),
      requestThroughputGainPercent: formatNumber(throughputGain),
    };
  };

  return [
    compare('Gym catalogue', gymUncached, gymCached),
    compare('Marketplace catalogue', marketplaceUncached, marketplaceCached),
  ].filter(Boolean);
};

const toMarkdown = (report) => {
  const lines = [
    '# Load Test Report',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    `Duration per scenario: ${report.settings.durationSeconds}s`,
    `Connections: ${report.settings.connections}`,
    `Pipelining: ${report.settings.pipelining}`,
    '',
    '| Scenario | Avg req/s | p95 req/s | Avg latency (ms) | p95 latency (ms) | Non-2xx | Errors |',
    '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
  ];

  report.results.forEach((result) => {
    lines.push(
      `| ${result.name} | ${result.requestsAverage} | ${result.requestsP95} | ${result.latencyAverageMs} | ${result.latencyP95Ms} | ${result.non2xx} | ${result.errors} |`,
    );
  });

  if (report.comparisons.length) {
    lines.push('');
    lines.push('| Comparison | Avg latency improvement | Throughput gain |');
    lines.push('| --- | ---: | ---: |');
    report.comparisons.forEach((entry) => {
      lines.push(
        `| ${entry.label} | ${entry.averageLatencyImprovementPercent}% | ${entry.requestThroughputGainPercent}% |`,
      );
    });
  }

  lines.push('');
  lines.push('Notes:');
  lines.push('- Uncached scenarios send `X-Cache-Mode: bypass` to measure raw backend path performance.');
  lines.push('- Cached scenarios reuse the same public endpoints without bypass headers.');
  lines.push('- Use this report together with `docs/redis-cache-report.md` and `docs/query-plan-report.md` during review.');

  return lines.join('\n');
};

const main = async () => {
  await fs.mkdir(REPORT_DIR, { recursive: true });
  await connectDB();
  await initializeCache();
  await initializeSearch();

  const server = await new Promise((resolve) => {
    const startedServer = app.listen(0, () => resolve(startedServer));
  });

  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const results = [];

    for (const target of targets) {
      // eslint-disable-next-line no-await-in-loop
      const result = await runAutocannon({
        url: `${baseUrl}${target.path}`,
        connections: LOAD_CONNECTIONS,
        duration: LOAD_DURATION_SECONDS,
        pipelining: LOAD_PIPELINING,
        headers: target.headers,
      });

      results.push(toScenarioResult(target, result));
    }

    const report = {
      generatedAt: new Date().toISOString(),
      settings: {
        durationSeconds: LOAD_DURATION_SECONDS,
        connections: LOAD_CONNECTIONS,
        pipelining: LOAD_PIPELINING,
      },
      results,
      comparisons: buildComparisons(results),
    };

    await fs.writeFile(JSON_REPORT_PATH, JSON.stringify(report, null, 2));
    await fs.writeFile(MARKDOWN_REPORT_PATH, toMarkdown(report));

    console.log(`Load test report written to ${JSON_REPORT_PATH}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
    await stopSearchSyncWorker().catch(() => {});
    await closeCache().catch(() => {});
    await mongoose.connection.close().catch(() => {});
  }

  process.exit(0);
};

main().catch(async (error) => {
  console.error('Load test failed', error);
  await stopSearchSyncWorker().catch(() => {});
  await closeCache().catch(() => {});
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
