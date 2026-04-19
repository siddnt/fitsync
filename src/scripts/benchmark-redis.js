/**
 * Redis Cache Performance Benchmark
 * -----------------------------------
 * Measures response times with and without Redis caching.
 * Run:  node src/scripts/benchmark-redis.js
 *
 * Requires the server to be running locally (npm run dev).
 */

const BASE = process.env.API_BASE_URL || 'http://localhost:4000';

const endpoints = [
  { name: 'Gym Listing', path: '/api/gyms?page=1&limit=10' },
  { name: 'Marketplace Catalogue', path: '/api/marketplace/products?page=1&pageSize=12' },
  { name: 'System Health', path: '/api/system/health' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const measure = async (url) => {
  const start = performance.now();
  const res = await fetch(url);
  const elapsed = performance.now() - start;
  const cacheHeader = res.headers.get('x-cache') || 'N/A';
  return { elapsed: Math.round(elapsed * 100) / 100, status: res.status, cache: cacheHeader };
};

const run = async () => {
  console.log('='.repeat(72));
  console.log('  FitSync — Redis Cache Performance Benchmark');
  console.log('='.repeat(72));
  console.log(`  Target: ${BASE}`);
  console.log(`  Date:   ${new Date().toISOString()}`);
  console.log('='.repeat(72));
  console.log();

  const results = [];

  for (const ep of endpoints) {
    const url = `${BASE}${ep.path}`;
    console.log(`► ${ep.name}  (${ep.path})`);

    // 1st request — expected MISS (populates cache)
    const first = await measure(url);
    console.log(`  1st request (cold):  ${first.elapsed} ms  [X-Cache: ${first.cache}]`);

    await sleep(200);

    // 2nd request — expected HIT (from cache)
    const second = await measure(url);
    console.log(`  2nd request (warm):  ${second.elapsed} ms  [X-Cache: ${second.cache}]`);

    const improvement = first.elapsed > 0
      ? Math.round(((first.elapsed - second.elapsed) / first.elapsed) * 100)
      : 0;

    console.log(`  Improvement:         ${improvement}%`);
    console.log();

    results.push({
      endpoint: ep.name,
      path: ep.path,
      coldMs: first.elapsed,
      warmMs: second.elapsed,
      coldCache: first.cache,
      warmCache: second.cache,
      improvementPct: improvement,
    });
  }

  console.log('='.repeat(72));
  console.log('  SUMMARY TABLE');
  console.log('='.repeat(72));
  console.log(
    'Endpoint'.padEnd(28) +
    'Cold (ms)'.padEnd(12) +
    'Warm (ms)'.padEnd(12) +
    'Improvement'.padEnd(14) +
    'Cache Hit'
  );
  console.log('-'.repeat(72));

  for (const r of results) {
    console.log(
      r.endpoint.padEnd(28) +
      String(r.coldMs).padEnd(12) +
      String(r.warmMs).padEnd(12) +
      `${r.improvementPct}%`.padEnd(14) +
      (r.warmCache === 'HIT' ? '✅ YES' : '❌ NO')
    );
  }

  console.log('-'.repeat(72));

  const avgCold = Math.round(results.reduce((s, r) => s + r.coldMs, 0) / results.length);
  const avgWarm = Math.round(results.reduce((s, r) => s + r.warmMs, 0) / results.length);
  const avgImprovement = Math.round(results.reduce((s, r) => s + r.improvementPct, 0) / results.length);

  console.log(
    'AVERAGE'.padEnd(28) +
    String(avgCold).padEnd(12) +
    String(avgWarm).padEnd(12) +
    `${avgImprovement}%`.padEnd(14)
  );
  console.log('='.repeat(72));
  console.log();
  console.log('Benchmark complete. Copy the table above into your report.');
};

run().catch(console.error);
