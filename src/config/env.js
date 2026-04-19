import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

const PROFILE_FILES = {
  app: ['.env.local', '.env'],
  test: ['.env.test.local', '.env.test'],
  ops: ['.env.report.local', '.env.report', '.env.ops.local', '.env.ops'],
};

const PROFILE_DEFAULTS = {
  app: {},
  test: {
    DISABLE_DB_RECONNECT: 'true',
    MONGODB_URI: 'mongodb://127.0.0.1:27017/fitsync_test',
    REDIS_URL: 'redis://127.0.0.1:6379',
    MEILISEARCH_HOST: 'http://127.0.0.1:7700',
    MEILISEARCH_API_KEY: 'fitsync-meili-key',
    JWT_SECRET: 'test-jwt-secret',
    REFRESH_TOKEN_SECRET: 'test-refresh-secret',
    STRIPE_PUBLISHABLE_KEY: 'pk_test_dummy',
    STRIPE_SECRET_KEY: 'sk_test_dummy',
    STRIPE_WEBHOOK_SECRET: 'whsec_dummy',
    UPI_DUMMY_MODE: 'true',
    DEMO_UPI_ID: 'fitsync.demo@upi',
    DEMO_UPI_NAME: 'FitSync Demo',
  },
  ops: {
    DISABLE_DB_RECONNECT: 'true',
    NODE_ENV: 'review',
    PORT: '4000',
    MONGODB_URI: 'mongodb://127.0.0.1:27017/fitsync',
    REDIS_URL: 'redis://127.0.0.1:6379',
    MEILISEARCH_HOST: 'http://127.0.0.1:7700',
    MEILISEARCH_API_KEY: 'fitsync-meili-key',
    JWT_SECRET: 'review-jwt-secret',
    REFRESH_TOKEN_SECRET: 'review-refresh-secret',
    STRIPE_PUBLISHABLE_KEY: 'pk_test_dummy',
    STRIPE_SECRET_KEY: 'sk_test_dummy',
    STRIPE_WEBHOOK_SECRET: 'whsec_dummy',
    CORS_ORIGIN: 'http://localhost:5173,http://localhost:8080,http://localhost:4000',
    CLIENT_BASE_URL: 'http://localhost:8080',
    FRONTEND_URL: 'http://localhost:8080',
    BACKEND_URL: 'http://localhost:4000',
  },
};

const PROFILE_FORCE_OVERRIDE = new Set(['test', 'ops']);

let loadedProfile = null;

const resolveExistingFiles = (files = []) =>
  files
    .map((file) => path.resolve(file))
    .filter((resolvedPath) => fs.existsSync(resolvedPath));

const detectProfile = () => {
  const explicitProfile = String(process.env.FITSYNC_ENV_PROFILE || '').trim().toLowerCase();
  if (explicitProfile) {
    return explicitProfile;
  }

  if (process.env.NODE_ENV === 'test') {
    return 'test';
  }

  const entryFile = path.basename(process.argv[1] || '');
  if ([
    'analyzeQueryPlans.js',
    'benchmarkCache.js',
    'loadTestPerformance.js',
    'syncSearchIndexes.js',
  ].includes(entryFile)) {
    return 'ops';
  }

  return 'app';
};

export const loadEnvironment = () => {
  if (loadedProfile) {
    return {
      profile: loadedProfile,
      loadedFiles: resolveExistingFiles(PROFILE_FILES[loadedProfile] ?? []),
    };
  }

  const profile = detectProfile();
  const envFiles = PROFILE_FILES[profile] ?? PROFILE_FILES.app;
  const loadedFiles = [];
  const shouldOverride = PROFILE_FORCE_OVERRIDE.has(profile);

  Object.entries(PROFILE_DEFAULTS[profile] ?? {}).forEach(([key, value]) => {
    if (shouldOverride || process.env[key] === undefined) {
      process.env[key] = value;
    }
  });

  envFiles.forEach((file) => {
    const resolvedPath = path.resolve(file);
    if (!fs.existsSync(resolvedPath)) {
      return;
    }

    dotenv.config({ path: resolvedPath, override: shouldOverride });
    loadedFiles.push(resolvedPath);
  });

  loadedProfile = profile;
  return { profile, loadedFiles };
};
