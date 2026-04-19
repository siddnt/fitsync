import request from 'supertest';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import app from '../src/app.js';
import connectDB from '../src/db/index.js';
import User from '../src/models/user.model.js';

dotenv.config({ path: '.env' });

const uniqueEmail = () =>
  `auth+${Date.now()}_${Math.random().toString(36).slice(2)}@fitsync.test`;

describe('Auth controller', () => {
  const cleanupIds = [];

  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    if (cleanupIds.length) {
      await User.deleteMany({ _id: { $in: cleanupIds } });
    }
    await mongoose.connection.close();
  });

  // ─── Register ─────────────────────────────────────────────
  describe('POST /api/auth/register', () => {
    it('creates a user and returns tokens', async () => {
      const email = uniqueEmail();
      const res = await request(app).post('/api/auth/register').send({
        firstName: 'Test',
        lastName: 'User',
        email,
        password: 'Secure1234!',
        role: 'trainee',
      });

      expect(res.status).toBe(201);
      expect(res.body.data.user.email).toBe(email.toLowerCase());
      expect(res.body.data.accessToken).toBeDefined();
      if (res.body.data.user.id) cleanupIds.push(res.body.data.user.id);
    });

    it('rejects duplicate email', async () => {
      const email = uniqueEmail();
      const first = await request(app).post('/api/auth/register').send({
        firstName: 'Dup',
        email,
        password: 'Secure1234!',
      });
      expect(first.status).toBe(201);
      if (first.body.data?.user?.id) cleanupIds.push(first.body.data.user.id);

      const second = await request(app).post('/api/auth/register').send({
        firstName: 'Dup',
        email,
        password: 'Secure1234!',
      });
      expect(second.status).toBe(409);
    });

    it('rejects missing email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ firstName: 'NoEmail', password: 'Secure1234!' });
      expect(res.status).toBe(400);
    });

    it('rejects missing password', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ firstName: 'NoPwd', email: uniqueEmail() });
      expect(res.status).toBe(400);
    });

    it('registers gym-owner with pending status', async () => {
      const email = uniqueEmail();
      const res = await request(app).post('/api/auth/register').send({
        firstName: 'Owner',
        email,
        password: 'Secure1234!',
        role: 'gym-owner',
      });
      expect(res.status).toBe(201);
      expect(res.body.data.user.status).toBe('pending');
      if (res.body.data.user.id) cleanupIds.push(res.body.data.user.id);
    });
  });

  // ─── Login ────────────────────────────────────────────────
  describe('POST /api/auth/login', () => {
    const loginEmail = uniqueEmail();
    const loginPassword = 'LoginPwd123!';

    beforeAll(async () => {
      const r = await request(app).post('/api/auth/register').send({
        firstName: 'Login',
        email: loginEmail,
        password: loginPassword,
      });
      if (r.body.data?.user?.id) cleanupIds.push(r.body.data.user.id);
    });

    it('authenticates valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: loginEmail, password: loginPassword });
      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.email).toBe(loginEmail.toLowerCase());
    });

    it('rejects wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: loginEmail, password: 'WrongPassword' });
      expect(res.status).toBe(401);
    });

    it('rejects non-existent email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nobody@fitsync.test', password: 'anything' });
      expect(res.status).toBe(404);
    });

    it('rejects missing fields', async () => {
      const res = await request(app).post('/api/auth/login').send({});
      expect(res.status).toBe(400);
    });
  });

  // ─── Refresh Token ────────────────────────────────────────
  describe('POST /api/auth/refresh', () => {
    it('returns 401 when no token is provided', async () => {
      const res = await request(app).post('/api/auth/refresh').send({});
      expect(res.status).toBe(401);
    });
  });

  // ─── Logout ───────────────────────────────────────────────
  describe('POST /api/auth/logout', () => {
    it('returns 204 even without a cookie', async () => {
      const res = await request(app).post('/api/auth/logout');
      expect(res.status).toBe(204);
    });
  });
});
