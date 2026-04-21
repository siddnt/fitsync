/**
 * Redis Cache Benchmark (Role-aware)
 * ----------------------------------
 * Benchmarks all cache-enabled GET endpoints across public + dashboard routes.
 *
 * Usage:
 *   node src/scripts/benchmark-redis.js
 *
 * Optional env vars:
 *   API_BASE_URL=http://localhost:4000
 *   BENCH_PASSWORD=Benchmark123!
 *   BENCH_WARM_RUNS=3
 */

const BASE = process.env.API_BASE_URL || 'http://localhost:4000';
const BENCH_PASSWORD = process.env.BENCH_PASSWORD || 'Benchmark123!';
const WARM_RUNS = Math.max(2, Number(process.env.BENCH_WARM_RUNS) || 3);
const REQUEST_TIMEOUT_MS = 20000;

const BENCHMARK_ENDPOINTS = [
  { name: 'Gyms listing', role: 'public', buildPath: () => '/api/gyms?page=1&limit=10' },
  { name: 'Gym reviews', role: 'public', buildPath: (ctx) => (ctx.gymId ? `/api/gyms/${ctx.gymId}/reviews?limit=10` : null) },
  { name: 'Gym detail', role: 'public', buildPath: (ctx) => (ctx.gymId ? `/api/gyms/${ctx.gymId}` : null) },
  { name: 'Marketplace listing', role: 'public', buildPath: () => '/api/marketplace/products?page=1&pageSize=12' },
  { name: 'Marketplace product', role: 'public', buildPath: (ctx) => (ctx.productId ? `/api/marketplace/products/${ctx.productId}` : null) },

  { name: 'Trainee overview', role: 'trainee', buildPath: () => '/api/dashboards/trainee/overview' },
  { name: 'Trainee progress', role: 'trainee', buildPath: () => '/api/dashboards/trainee/progress' },
  { name: 'Trainee diet', role: 'trainee', buildPath: () => '/api/dashboards/trainee/diet' },
  { name: 'Trainee orders', role: 'trainee', buildPath: () => '/api/dashboards/trainee/orders?page=1&limit=10' },

  { name: 'Gym owner overview', role: 'gym-owner', buildPath: () => '/api/dashboards/gym-owner/overview' },
  { name: 'Gym owner gyms', role: 'gym-owner', buildPath: () => '/api/dashboards/gym-owner/gyms' },
  { name: 'Gym owner subscriptions', role: 'gym-owner', buildPath: () => '/api/dashboards/gym-owner/subscriptions?page=1&limit=10' },
  { name: 'Gym owner sponsorships', role: 'gym-owner', buildPath: () => '/api/dashboards/gym-owner/sponsorships' },
  { name: 'Gym owner analytics', role: 'gym-owner', buildPath: () => '/api/dashboards/gym-owner/analytics' },
  { name: 'Gym owner roster', role: 'gym-owner', buildPath: () => '/api/dashboards/gym-owner/roster' },

  { name: 'Trainer overview', role: 'trainer', buildPath: () => '/api/dashboards/trainer/overview' },
  { name: 'Trainer trainees', role: 'trainer', buildPath: () => '/api/dashboards/trainer/trainees' },
  { name: 'Trainer updates', role: 'trainer', buildPath: () => '/api/dashboards/trainer/updates' },
  { name: 'Trainer feedback', role: 'trainer', buildPath: () => '/api/dashboards/trainer/feedback' },

  { name: 'Admin overview', role: 'admin', buildPath: () => '/api/dashboards/admin/overview' },
  { name: 'Admin users', role: 'admin', buildPath: () => '/api/dashboards/admin/users?page=1&limit=10' },
  { name: 'Admin gyms', role: 'admin', buildPath: () => '/api/dashboards/admin/gyms?page=1&limit=10' },
  { name: 'Admin gym detail', role: 'admin', buildPath: (ctx) => (ctx.adminGymId ? `/api/dashboards/admin/gyms/${ctx.adminGymId}` : null) },
  { name: 'Admin revenue', role: 'admin', buildPath: () => '/api/dashboards/admin/revenue' },
  { name: 'Admin marketplace', role: 'admin', buildPath: () => '/api/dashboards/admin/marketplace?page=1&limit=10' },
  { name: 'Admin insights', role: 'admin', buildPath: () => '/api/dashboards/admin/insights' },
  { name: 'Admin memberships', role: 'admin', buildPath: () => '/api/dashboards/admin/memberships?page=1&limit=10' },
  { name: 'Admin user detail', role: 'admin', buildPath: (ctx) => (ctx.adminUserId ? `/api/dashboards/admin/users/${ctx.adminUserId}` : null) },
  { name: 'Admin products', role: 'admin', buildPath: () => '/api/dashboards/admin/products?page=1&limit=10' },
  { name: 'Admin product buyers', role: 'admin', buildPath: (ctx) => (ctx.adminProductId ? `/api/dashboards/admin/products/${ctx.adminProductId}` : null) },
  { name: 'Admin reviews', role: 'admin', buildPath: () => '/api/dashboards/admin/reviews?page=1&limit=10' },
  { name: 'Admin subscriptions', role: 'admin', buildPath: () => '/api/dashboards/admin/subscriptions?page=1&limit=10' },

  { name: 'Manager overview', role: 'manager', buildPath: () => '/api/dashboards/manager/overview' },
  { name: 'Manager sellers', role: 'manager', buildPath: () => '/api/dashboards/manager/sellers?page=1&limit=10' },
  { name: 'Manager gym owners', role: 'manager', buildPath: () => '/api/dashboards/manager/gym-owners?page=1&limit=10' },

  { name: 'Contact messages', role: 'admin', buildPath: () => '/api/contact?page=1&limit=10' },
];

const average = (values) => {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const median = (values) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
};

const formatMs = (value) => `${value.toFixed(2)} ms`;

const appendQuery = (path, key, value) => {
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
};

const safeJson = async (response) => {
  try {
    return await response.json();
  } catch (_error) {
    return null;
  }
};

const requestWithTiming = async (path, { method = 'GET', token, body } = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const startedAt = performance.now();

  try {
    const response = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    return {
      ok: response.ok,
      status: response.status,
      elapsedMs: performance.now() - startedAt,
      cache: response.headers.get('x-cache') || 'N/A',
      json: await safeJson(response),
    };
  } catch (error) {
    clearTimeout(timeout);
    return {
      ok: false,
      status: 0,
      elapsedMs: performance.now() - startedAt,
      cache: 'N/A',
      json: null,
      error: error.message,
    };
  }
};

const registerRoleUser = async (role) => {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const email = `bench_${role}_${suffix}@example.com`;
  const payload = {
    firstName: 'Bench',
    lastName: role,
    email,
    password: BENCH_PASSWORD,
    role,
  };

  const response = await requestWithTiming('/api/auth/register', { method: 'POST', body: payload });

  if (!response.ok) {
    throw new Error(`Failed to register ${role}: ${response.status}`);
  }

  const user = response.json?.data?.user;
  const token = response.json?.data?.accessToken;

  if (!user?.id || !token) {
    throw new Error(`Unexpected auth payload for ${role}.`);
  }

  return {
    role,
    userId: user.id,
    status: user.status,
    token,
    email,
  };
};

const activateRoleIfNeeded = async (session, adminToken) => {
  if (!session || session.status === 'active' || !adminToken) {
    return;
  }

  const response = await requestWithTiming(`/api/admin/users/${session.userId}/status`, {
    method: 'PATCH',
    token: adminToken,
    body: { status: 'active' },
  });

  if (response.ok) {
    session.status = 'active';
  }
};

const bootstrapSessions = async () => {
  const sessions = {};

  sessions.admin = await registerRoleUser('admin');
  sessions.trainee = await registerRoleUser('trainee');
  sessions['gym-owner'] = await registerRoleUser('gym-owner');
  sessions.trainer = await registerRoleUser('trainer');
  sessions.manager = await registerRoleUser('manager');

  await Promise.all([
    activateRoleIfNeeded(sessions['gym-owner'], sessions.admin.token),
    activateRoleIfNeeded(sessions.trainer, sessions.admin.token),
    activateRoleIfNeeded(sessions.manager, sessions.admin.token),
  ]);

  return sessions;
};

const resolveBenchmarkContext = async (tokens, sessions) => {
  const context = {
    gymId: null,
    productId: null,
    adminGymId: null,
    adminProductId: null,
    adminUserId: sessions.trainee?.userId ?? sessions.admin?.userId ?? null,
  };

  const [gymList, productList] = await Promise.all([
    requestWithTiming('/api/gyms?page=1&limit=1'),
    requestWithTiming('/api/marketplace/products?page=1&pageSize=1'),
  ]);

  context.gymId = gymList.json?.data?.gyms?.[0]?.id ?? null;
  context.productId = productList.json?.data?.products?.[0]?.id ?? null;

  const [adminGyms, adminProducts] = await Promise.all([
    requestWithTiming('/api/dashboards/admin/gyms?page=1&limit=1', { token: tokens.admin }),
    requestWithTiming('/api/dashboards/admin/products?page=1&limit=1', { token: tokens.admin }),
  ]);

  context.adminGymId = context.gymId ?? adminGyms.json?.data?.gyms?.[0]?.id ?? null;
  context.adminProductId = context.productId ?? adminProducts.json?.data?.products?.[0]?.id ?? null;

  return context;
};

const benchmarkEndpoint = async (spec, tokens, context, index) => {
  const path = spec.buildPath(context);
  if (!path) {
    return {
      name: spec.name,
      role: spec.role,
      status: 'skipped',
      reason: 'missing dynamic id',
    };
  }

  const token = spec.role === 'public' ? null : tokens[spec.role];
  if (spec.role !== 'public' && !token) {
    return {
      name: spec.name,
      role: spec.role,
      status: 'skipped',
      reason: 'missing auth token',
    };
  }

  let benchPath = appendQuery(path, '__bench', `${Date.now()}_${index}_${Math.random().toString(36).slice(2, 7)}`);
  let cold = await requestWithTiming(benchPath, { token });

  if (cold.cache === 'HIT') {
    benchPath = appendQuery(path, '__bench', `${Date.now()}_${index}_retry`);
    cold = await requestWithTiming(benchPath, { token });
  }

  if (!cold.ok) {
    return {
      name: spec.name,
      role: spec.role,
      path,
      status: 'error',
      reason: cold.error || `cold request failed (${cold.status})`,
    };
  }

  const warmRuns = [];
  for (let runIndex = 0; runIndex < WARM_RUNS; runIndex += 1) {
    // eslint-disable-next-line no-await-in-loop
    const warm = await requestWithTiming(benchPath, { token });
    warmRuns.push(warm);
  }

  const warmFailure = warmRuns.find((entry) => !entry.ok);
  if (warmFailure) {
    return {
      name: spec.name,
      role: spec.role,
      path,
      status: 'error',
      reason: warmFailure.error || `warm request failed (${warmFailure.status})`,
    };
  }

  const warmTimes = warmRuns.map((entry) => entry.elapsedMs);
  const warmHits = warmRuns.filter((entry) => entry.cache === 'HIT').length;
  const warmAvg = average(warmTimes);
  const warmMedian = median(warmTimes);
  const improvementPct = cold.elapsedMs > 0
    ? ((cold.elapsedMs - warmAvg) / cold.elapsedMs) * 100
    : 0;

  return {
    name: spec.name,
    role: spec.role,
    path,
    status: 'tested',
    coldMs: cold.elapsedMs,
    coldCache: cold.cache,
    warmAvgMs: warmAvg,
    warmMedianMs: warmMedian,
    warmCaches: warmRuns.map((entry) => entry.cache),
    warmHitRate: warmHits / warmRuns.length,
    improvementPct,
  };
};

const printSummary = (results) => {
  const tested = results.filter((result) => result.status === 'tested');
  const skipped = results.filter((result) => result.status === 'skipped');
  const errors = results.filter((result) => result.status === 'error');

  console.log('\n' + '='.repeat(120));
  console.log('SUMMARY');
  console.log('='.repeat(120));
  console.log(`Total endpoints: ${results.length}`);
  console.log(`Tested:          ${tested.length}`);
  console.log(`Skipped:         ${skipped.length}`);
  console.log(`Errors:          ${errors.length}`);

  if (tested.length) {
    const averageCold = average(tested.map((item) => item.coldMs));
    const averageWarm = average(tested.map((item) => item.warmAvgMs));
    const averageGain = average(tested.map((item) => item.improvementPct));
    const averageHitRate = average(tested.map((item) => item.warmHitRate * 100));

    console.log(`Average cold:    ${formatMs(averageCold)}`);
    console.log(`Average warm:    ${formatMs(averageWarm)}`);
    console.log(`Average gain:    ${averageGain.toFixed(2)}%`);
    console.log(`Warm HIT rate:   ${averageHitRate.toFixed(2)}%`);
  }

  console.log('\n' + '-'.repeat(120));
  console.log(
    'Endpoint'.padEnd(30)
    + 'Role'.padEnd(12)
    + 'Cold'.padEnd(12)
    + 'Warm(avg)'.padEnd(12)
    + 'Improvement'.padEnd(14)
    + 'Warm HITs'.padEnd(12)
    + 'Status',
  );
  console.log('-'.repeat(120));

  results.forEach((result) => {
    if (result.status === 'tested') {
      const warmHits = `${Math.round(result.warmHitRate * WARM_RUNS)}/${WARM_RUNS}`;
      console.log(
        result.name.slice(0, 29).padEnd(30)
        + result.role.padEnd(12)
        + formatMs(result.coldMs).padEnd(12)
        + formatMs(result.warmAvgMs).padEnd(12)
        + `${result.improvementPct.toFixed(2)}%`.padEnd(14)
        + warmHits.padEnd(12)
        + 'OK',
      );
      return;
    }

    console.log(
      result.name.slice(0, 29).padEnd(30)
      + result.role.padEnd(12)
      + '-'.padEnd(12)
      + '-'.padEnd(12)
      + '-'.padEnd(14)
      + '-'.padEnd(12)
      + `${result.status.toUpperCase()}: ${result.reason}`,
    );
  });
  console.log('-'.repeat(120));

  const lowGain = tested
    .filter((entry) => entry.improvementPct < 20)
    .sort((a, b) => a.improvementPct - b.improvementPct);

  if (lowGain.length) {
    console.log('\nEndpoints with low warm-cache improvement (< 20%):');
    lowGain.forEach((entry) => {
      const warmCacheProfile = entry.warmCaches.join(',');
      console.log(
        `- ${entry.name} (${entry.role}) => ${entry.improvementPct.toFixed(2)}% | cold=${entry.coldCache} | warm=${warmCacheProfile}`,
      );
    });
  }
};

const run = async () => {
  console.log('='.repeat(120));
  console.log('FitSync Redis Cache Benchmark (all cache-enabled endpoints)');
  console.log('='.repeat(120));
  console.log(`Target:      ${BASE}`);
  console.log(`Warm runs:   ${WARM_RUNS}`);
  console.log(`Timestamp:   ${new Date().toISOString()}`);
  console.log('='.repeat(120));

  const sessions = await bootstrapSessions();
  const tokens = Object.fromEntries(
    Object.entries(sessions).map(([role, session]) => [role, session.token]),
  );

  const context = await resolveBenchmarkContext(tokens, sessions);

  const results = [];
  for (let index = 0; index < BENCHMARK_ENDPOINTS.length; index += 1) {
    const endpoint = BENCHMARK_ENDPOINTS[index];
    // eslint-disable-next-line no-await-in-loop
    const result = await benchmarkEndpoint(endpoint, tokens, context, index + 1);
    results.push(result);

    if (result.status === 'tested') {
      console.log(
        `[OK] ${result.name} | cold=${formatMs(result.coldMs)} | warm(avg)=${formatMs(result.warmAvgMs)} | gain=${result.improvementPct.toFixed(2)}% | warmHIT=${Math.round(result.warmHitRate * WARM_RUNS)}/${WARM_RUNS}`,
      );
    } else {
      console.log(`[${result.status.toUpperCase()}] ${result.name} | ${result.reason}`);
    }
  }

  printSummary(results);
};

run().catch((error) => {
  console.error('Benchmark failed:', error.message);
  process.exitCode = 1;
});
