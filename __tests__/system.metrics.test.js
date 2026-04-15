import request from 'supertest';
import app from '../src/app.js';

describe('system metrics endpoint', () => {
  it('serves health metadata including cache, search, and observability metrics', async () => {
    const res = await request(app).get('/api/system/metrics');

    expect(res.status).toBe(200);
    expect(res.body?.status).toBe('ok');
    expect(res.body?.cache?.provider).toBeDefined();
    expect(res.body?.search?.provider).toBeDefined();
    expect(res.body?.metrics?.cache).toBeDefined();
    expect(res.body?.metrics?.queries).toBeDefined();
    expect(res.body?.metrics?.requests).toBeDefined();
  });

  it('serves Prometheus-compatible plaintext metrics', async () => {
    const res = await request(app).get('/api/system/metrics/prometheus');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.text).toContain('fitsync_process_started_at_seconds');
    expect(res.text).toContain('fitsync_cache_events_total');
    expect(res.text).toContain('fitsync_search_sync_queue_depth');
  });
});
