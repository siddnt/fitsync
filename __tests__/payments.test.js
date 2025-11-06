import request from 'supertest';
import app from '../src/app.js';

// Simple smoke tests for routes wiring

describe('Payments routes wiring', () => {
  it('GET /payments/cancelled should render 200', async () => {
    const res = await request(app).get('/payments/cancelled');
    expect(res.status).toBe(200);
  });

  it('GET /payments/success without session should render 200', async () => {
    const res = await request(app).get('/payments/success?session_id=fake');
    expect(res.status).toBe(200);
  });
});
