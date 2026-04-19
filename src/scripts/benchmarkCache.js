import '../config/bootstrapEnv.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import { performance } from 'node:perf_hooks';
import request from 'supertest';
import app from '../app.js';
import connectDB from '../db/index.js';
import {
  clearAllCache,
  closeCache,
  getCacheStatus,
  initializeCache,
} from '../services/cache.service.js';

const REPORT_DIR = path.resolve('docs');
const JSON_REPORT_PATH = path.join(REPORT_DIR, 'redis-cache-report.json');
const MARKDOWN_REPORT_PATH = path.join(REPORT_DIR, 'redis-cache-report.md');

const endpoints = [
  { name: 'Gym catalogue', path: '/api/gyms?page=1&limit=12' },
  { name: 'Marketplace catalogue', path: '/api/marketplace/products?page=1&pageSize=12' },
];

const average = (values) => values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);

const formatMs = (value) => Number(value.toFixed(2));

const measureRequest = async (agent, url, headers = {}) => {
  const startedAt = performance.now();
  const response = await agent.get(url).set(headers);
  const elapsed = performance.now() - startedAt;

  return {
    elapsedMs: elapsed,
    cacheState: response.headers['x-cache'] ?? 'UNKNOWN',
    cacheProvider: response.headers['x-cache-provider'] ?? 'none',
    statusCode: response.statusCode,
  };
};

const runBenchmark = async (agent, target) => {
  await clearAllCache();

  const bypassSamples = [];
  for (let iteration = 0; iteration < 8; iteration += 1) {
    // eslint-disable-next-line no-await-in-loop
    const sample = await measureRequest(agent, target.path, { 'x-cache-mode': 'bypass' });
    bypassSamples.push(sample.elapsedMs);
  }

  await clearAllCache();
  await measureRequest(agent, target.path);

  const cachedSamples = [];
  const cacheStates = [];
  const cacheProviders = [];

  for (let iteration = 0; iteration < 8; iteration += 1) {
    // eslint-disable-next-line no-await-in-loop
    const sample = await measureRequest(agent, target.path);
    cachedSamples.push(sample.elapsedMs);
    cacheStates.push(sample.cacheState);
    cacheProviders.push(sample.cacheProvider);
  }

  const bypassAvg = average(bypassSamples);
  const cachedAvg = average(cachedSamples);
  const improvement = bypassAvg > 0 ? ((bypassAvg - cachedAvg) / bypassAvg) * 100 : 0;

  return {
    endpoint: target,
    bypassAverageMs: formatMs(bypassAvg),
    cachedAverageMs: formatMs(cachedAvg),
    improvementPercent: formatMs(improvement),
    cacheStates,
    cacheProviders,
  };
};

const toMarkdown = (report) => {
  const lines = [
    '# Redis Cache Benchmark',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    `Cache provider during benchmark: ${report.cache.provider}`,
    '',
    '| Endpoint | Avg without cache (ms) | Avg cached (ms) | Improvement |',
    '| --- | ---: | ---: | ---: |',
  ];

  report.results.forEach((result) => {
    lines.push(
      `| ${result.endpoint.name} | ${result.bypassAverageMs} | ${result.cachedAverageMs} | ${result.improvementPercent}% |`,
    );
  });

  lines.push('');
  lines.push('Notes:');
  lines.push('- Warm runs were executed after a single priming request.');
  lines.push('- Use `X-Cache: HIT` and `X-Cache-Provider` headers during review to demonstrate cache behaviour live.');

  return lines.join('\n');
};

const main = async () => {
  await fs.mkdir(REPORT_DIR, { recursive: true });
  await connectDB();
  await initializeCache();

  const cacheStatus = getCacheStatus();
  if (cacheStatus.provider !== 'redis') {
    throw new Error('Redis cache benchmark requires a live Redis connection. Start Redis and ensure REDIS_URL resolves before running this command.');
  }

  const agent = request(app);
  const results = [];

  for (const target of endpoints) {
    // eslint-disable-next-line no-await-in-loop
    results.push(await runBenchmark(agent, target));
  }

  const report = {
    generatedAt: new Date().toISOString(),
    cache: getCacheStatus(),
    results,
  };

  await fs.writeFile(JSON_REPORT_PATH, JSON.stringify(report, null, 2));
  await fs.writeFile(MARKDOWN_REPORT_PATH, toMarkdown(report));

  await closeCache();
  await mongoose.connection.close();

  console.log(`Cache benchmark written to ${JSON_REPORT_PATH}`);
  process.exit(0);
};

main().catch(async (error) => {
  console.error('Cache benchmark failed', error);
  await closeCache().catch(() => {});
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});
