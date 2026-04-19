import {
  cacheGet,
  cacheSet,
  cacheDel,
  initRedis,
  isReady,
  flushAll,
} from '../src/services/redis.service.js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

describe('Redis cache service', () => {
  beforeAll(() => {
    initRedis();
  });

  afterAll(async () => {
    // Clean up any test keys
    if (isReady()) {
      await cacheDel('test:unit:1', 'test:unit:2', 'test:unit:json');
    }
  });

  it('isReady() returns true when credentials are configured', () => {
    // If env vars are set, redis should be ready
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      expect(isReady()).toBe(true);
    } else {
      expect(isReady()).toBe(false);
    }
  });

  it('can set and get a string value', async () => {
    if (!isReady()) return;

    await cacheSet('test:unit:1', 'hello', 60);
    const value = await cacheGet('test:unit:1');

    // Upstash stores JSON.stringify'd values; cacheGet returns parsed
    expect(value).toBeDefined();
    expect(typeof value === 'string' ? value : JSON.stringify(value)).toContain('hello');
  });

  it('can set and get a JSON object', async () => {
    if (!isReady()) return;

    const data = { name: 'FitSync', version: 1, features: ['cache', 'gym'] };
    await cacheSet('test:unit:json', data, 60);
    const value = await cacheGet('test:unit:json');

    expect(value).toBeDefined();
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    expect(parsed.name).toBe('FitSync');
    expect(parsed.features).toContain('cache');
  });

  it('returns null for non-existent keys', async () => {
    if (!isReady()) return;

    const value = await cacheGet('test:non_existent_key_999');
    expect(value).toBeNull();
  });

  it('can delete keys', async () => {
    if (!isReady()) return;

    await cacheSet('test:unit:2', 'to-delete', 60);
    await cacheDel('test:unit:2');
    const value = await cacheGet('test:unit:2');
    expect(value).toBeNull();
  });
});
