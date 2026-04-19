import request from 'supertest';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import app from '../src/app.js';
import connectDB from '../src/db/index.js';
import User from '../src/models/user.model.js';

dotenv.config({ path: '.env' });

const uniqueEmail = () =>
  `user+${Date.now()}_${Math.random().toString(36).slice(2)}@fitsync.test`;

describe('User profile endpoints', () => {
  let accessToken;
  let userId;
  const email = uniqueEmail();
  const password = 'Profile1234!';

  beforeAll(async () => {
    await connectDB();

    const res = await request(app).post('/api/auth/register').send({
      firstName: 'Profile',
      lastName: 'Tester',
      email,
      password,
      role: 'trainee',
    });

    accessToken = res.body.data?.accessToken;
    userId = res.body.data?.user?.id;
  });

  afterAll(async () => {
    if (userId) {
      await User.findByIdAndDelete(userId);
    }
    await mongoose.connection.close();
  });

  // ─── GET profile ─────────────────────────────────────────
  describe('GET /api/users/profile', () => {
    it('returns 401 without token', async () => {
      const res = await request(app).get('/api/users/profile');
      expect(res.status).toBe(401);
    });

    it('returns profile for authenticated user', async () => {
      const res = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.email).toBe(email.toLowerCase());
      expect(res.body.data.firstName).toBe('Profile');
      expect(res.body.data.lastName).toBe('Tester');
      expect(res.body.data.role).toBe('trainee');
    });
  });

  // ─── PATCH profile ────────────────────────────────────────
  describe('PATCH /api/users/profile', () => {
    it('returns 401 without token', async () => {
      const res = await request(app)
        .patch('/api/users/profile')
        .send({ bio: 'updated' });
      expect(res.status).toBe(401);
    });

    it('updates basic fields', async () => {
      const res = await request(app)
        .patch('/api/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          bio: 'Test bio update',
          age: 25,
          gender: 'male',
          height: 180,
          weight: 75,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.bio).toBe('Test bio update');
      expect(res.body.data.age).toBe(25);
      expect(res.body.data.height).toBe(180);
    });

    it('updates nested profile fields', async () => {
      const res = await request(app)
        .patch('/api/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          profile: JSON.stringify({
            headline: 'Fitness enthusiast',
            about: 'Love lifting weights',
            location: 'Hyderabad',
          }),
        });

      expect(res.status).toBe(200);
      expect(res.body.data.profile.headline).toBe('Fitness enthusiast');
    });
  });
});
