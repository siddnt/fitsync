import request from 'supertest';
import app from '../src/app.js';

describe('API documentation endpoints', () => {
  it('serves the OpenAPI document', async () => {
    const res = await request(app).get('/api/docs/openapi.json');

    expect(res.status).toBe(200);
    expect(res.body?.openapi).toBe('3.1.0');
    expect(res.body?.paths?.['/api/marketplace/products']).toBeDefined();
    expect(res.body?.paths?.['/api/gyms']).toBeDefined();
    expect(res.body?.paths?.['/api/system/metrics']).toBeDefined();
    expect(res.body?.paths?.['/api/system/metrics/prometheus']).toBeDefined();
  });

  it('serves the Swagger UI shell', async () => {
    const res = await request(app).get('/api/docs');

    expect(res.status).toBe(200);
    expect(res.text).toContain('SwaggerUIBundle');
    expect(res.text).toContain('/api/docs/openapi.json');
  });
});
