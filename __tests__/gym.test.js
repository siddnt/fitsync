import request from 'supertest';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import app from '../src/app.js';
import connectDB from '../src/db/index.js';

dotenv.config({ path: '.env' });

describe('Gym endpoints', () => {
  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  // ─── Public gym listing ──────────────────────────────────
  describe('GET /api/gyms', () => {
    it('returns paginated gym list', async () => {
      const res = await request(app).get('/api/gyms?page=1&limit=5');
      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data.gyms)).toBe(true);
      expect(res.body.data.pagination).toBeDefined();
      expect(res.body.data.pagination).toHaveProperty('total');
      expect(res.body.data.pagination).toHaveProperty('page');
      expect(res.body.data.pagination).toHaveProperty('totalPages');
    });

    it('supports search query', async () => {
      const res = await request(app).get('/api/gyms?search=fitness&page=1&limit=5');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.gyms)).toBe(true);
    });

    it('supports city filter', async () => {
      const res = await request(app).get('/api/gyms?city=Hyderabad&page=1&limit=5');
      expect(res.status).toBe(200);
    });
  });

  // ─── Get gym by ID ───────────────────────────────────────
  describe('GET /api/gyms/:gymId', () => {
    it('returns 400 for invalid ObjectId', async () => {
      const res = await request(app).get('/api/gyms/invalid-id');
      expect(res.status).toBe(400);
    });

    it('returns 404 for non-existent gym', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app).get(`/api/gyms/${fakeId}`);
      expect(res.status).toBe(404);
    });
  });

  // ─── Create gym requires auth ────────────────────────────
  describe('POST /api/gyms', () => {
    it('returns 401 without authentication', async () => {
      const res = await request(app).post('/api/gyms').send({
        name: 'Unauthorized Gym',
        location: { city: 'Test' },
      });
      expect(res.status).toBe(401);
    });
  });

  // ─── Gym reviews ─────────────────────────────────────────
  describe('GET /api/gyms/:gymId/reviews', () => {
    it('returns 400 for invalid gym ID', async () => {
      const res = await request(app).get('/api/gyms/not-a-valid-id/reviews');
      expect(res.status).toBe(400);
    });
  });

  // ─── Gym gallery ─────────────────────────────────────────
  describe('GET /api/gyms/:gymId/gallery', () => {
    it('returns 400 for invalid gym ID', async () => {
      const res = await request(app).get('/api/gyms/bad-id/gallery');
      expect(res.status).toBe(400);
    });
  });

  // ─── Impressions ─────────────────────────────────────────
  describe('POST /api/gyms/:gymId/impressions', () => {
    it('returns 400 for invalid gym ID', async () => {
      const res = await request(app).post('/api/gyms/invalid/impressions');
      expect(res.status).toBe(400);
    });
  });
});
