import request from 'supertest';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import app from '../src/app.js';
import connectDB from '../src/db/index.js';
import User from '../src/models/user.model.js';

dotenv.config({ path: '.env' });

const uniqueEmail = () =>
  `dash+${Date.now()}_${Math.random().toString(36).slice(2)}@fitsync.test`;

describe('Dashboard endpoints', () => {
  let traineeToken;
  let traineeId;
  let ownerToken;
  let ownerId;

  beforeAll(async () => {
    await connectDB();

    // Create trainee
    const traineeRes = await request(app).post('/api/auth/register').send({
      firstName: 'Dash',
      lastName: 'Trainee',
      email: uniqueEmail(),
      password: 'Dashboard123!',
      role: 'trainee',
    });
    traineeToken = traineeRes.body.data?.accessToken;
    traineeId = traineeRes.body.data?.user?.id;

    // Create gym-owner
    const ownerRes = await request(app).post('/api/auth/register').send({
      firstName: 'Dash',
      lastName: 'Owner',
      email: uniqueEmail(),
      password: 'Dashboard123!',
      role: 'gym-owner',
    });
    ownerToken = ownerRes.body.data?.accessToken;
    ownerId = ownerRes.body.data?.user?.id;
  });

  afterAll(async () => {
    const ids = [traineeId, ownerId].filter(Boolean);
    if (ids.length) {
      await User.deleteMany({ _id: { $in: ids } });
    }
    await mongoose.connection.close();
  });

  // ─── Trainee dashboard ────────────────────────────────────
  describe('GET /api/dashboards/trainee/overview', () => {
    it('returns 401 without token', async () => {
      const res = await request(app).get('/api/dashboards/trainee/overview');
      expect(res.status).toBe(401);
    });

    it('returns overview for trainee', async () => {
      const res = await request(app)
        .get('/api/dashboards/trainee/overview')
        .set('Authorization', `Bearer ${traineeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });
  });

  describe('GET /api/dashboards/trainee/progress', () => {
    it('returns progress data for trainee', async () => {
      const res = await request(app)
        .get('/api/dashboards/trainee/progress')
        .set('Authorization', `Bearer ${traineeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });
  });

  describe('GET /api/dashboards/trainee/diet', () => {
    it('returns diet data for trainee', async () => {
      const res = await request(app)
        .get('/api/dashboards/trainee/diet')
        .set('Authorization', `Bearer ${traineeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });
  });

  describe('GET /api/dashboards/trainee/orders', () => {
    it('returns orders for trainee', async () => {
      const res = await request(app)
        .get('/api/dashboards/trainee/orders')
        .set('Authorization', `Bearer ${traineeToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });
  });

  // ─── Gym owner dashboard (pending status may block) ──────
  describe('GET /api/dashboards/owner/overview', () => {
    it('returns 401 without token', async () => {
      const res = await request(app).get('/api/dashboards/owner/overview');
      expect(res.status).toBe(401);
    });
  });
});
