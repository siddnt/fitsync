import { jest } from '@jest/globals';
import {
  buildCacheKey,
  clearAllCache,
  consumeBufferedCounters,
  getOrSetCache,
  incrementBufferedCounter,
  invalidateCacheByTags,
} from '../src/services/cache.service.js';

describe('cache service', () => {
  beforeEach(async () => {
    await clearAllCache();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('builds stable cache keys for equivalent query objects', () => {
    const a = buildCacheKey('gyms:list', { page: 1, limit: 10, search: 'mumbai' });
    const b = buildCacheKey('gyms:list', { search: 'mumbai', limit: 10, page: 1 });

    expect(a).toBe(b);
  });

  it('reuses cached payloads until invalidated', async () => {
    const loader = jest.fn(async () => ({ ok: true }));

    const first = await getOrSetCache(
      { key: 'cache:test', ttlSeconds: 60, tags: ['group:test'] },
      loader,
    );
    const second = await getOrSetCache(
      { key: 'cache:test', ttlSeconds: 60, tags: ['group:test'] },
      loader,
    );

    expect(first.meta.state).toBe('miss');
    expect(second.meta.state).toBe('hit');
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('invalidates cached payloads by tag', async () => {
    const loader = jest.fn(async () => ({ value: loader.mock.calls.length }));

    await getOrSetCache({ key: 'cache:tagged', ttlSeconds: 60, tags: ['group:one'] }, loader);
    await invalidateCacheByTags(['group:one']);
    const third = await getOrSetCache({ key: 'cache:tagged', ttlSeconds: 60, tags: ['group:one'] }, loader);

    expect(third.meta.state).toBe('miss');
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('coalesces concurrent cache misses for the same key', async () => {
    const loader = jest.fn(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ ok: true }), 25);
        }),
    );

    const [first, second, third] = await Promise.all([
      getOrSetCache({ key: 'cache:shared', ttlSeconds: 60, tags: ['group:shared'] }, loader),
      getOrSetCache({ key: 'cache:shared', ttlSeconds: 60, tags: ['group:shared'] }, loader),
      getOrSetCache({ key: 'cache:shared', ttlSeconds: 60, tags: ['group:shared'] }, loader),
    ]);

    expect(first.value).toEqual({ ok: true });
    expect(second.value).toEqual({ ok: true });
    expect(third.value).toEqual({ ok: true });
    expect(loader).toHaveBeenCalledTimes(1);
    expect([first.meta.state, second.meta.state, third.meta.state].sort()).toEqual(['coalesced', 'coalesced', 'miss']);
  });

  it('serves stale entries while revalidating in the background', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-04-14T00:00:00.000Z'));

    const loader = jest.fn(async () => ({ version: loader.mock.calls.length }));

    const first = await getOrSetCache(
      {
        key: 'cache:stale',
        ttlSeconds: 1,
        staleWhileRevalidateSeconds: 10,
        tags: ['group:stale'],
      },
      loader,
    );

    jest.setSystemTime(new Date('2026-04-14T00:00:02.000Z'));

    const stale = await getOrSetCache(
      {
        key: 'cache:stale',
        ttlSeconds: 1,
        staleWhileRevalidateSeconds: 10,
        tags: ['group:stale'],
      },
      loader,
    );

    await Promise.resolve();

    const refreshed = await getOrSetCache(
      {
        key: 'cache:stale',
        ttlSeconds: 1,
        staleWhileRevalidateSeconds: 10,
        tags: ['group:stale'],
      },
      loader,
    );

    expect(first.meta.state).toBe('miss');
    expect(stale.meta.state).toBe('stale');
    expect(stale.value).toEqual({ version: 1 });
    expect(refreshed.value).toEqual({ version: 2 });
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('buffers and consumes counters atomically', async () => {
    await incrementBufferedCounter('gym-impressions', 'gym-a', 1);
    await incrementBufferedCounter('gym-impressions', 'gym-a', 2);
    await incrementBufferedCounter('gym-impressions', 'gym-b', 4);

    const firstDrain = await consumeBufferedCounters('gym-impressions');
    const secondDrain = await consumeBufferedCounters('gym-impressions');

    expect(firstDrain).toEqual({ 'gym-a': 3, 'gym-b': 4 });
    expect(secondDrain).toEqual({});
  });
});
