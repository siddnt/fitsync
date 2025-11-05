import request from 'supertest';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import app from '../src/app.js';
import connectDB from '../src/db/index.js';
import User from '../src/models/user.model.js';
import Gym from '../src/models/gym.model.js';

dotenv.config({ path: '.env' });

const randomEmail = () => `qa+${Date.now()}_${Math.random().toString(16).slice(2)}@fitsync.dev`;

describe('API wiring smoke tests', () => {
  let connection;
  const createdUserIds = [];

  beforeAll(async () => {
    connection = await connectDB();
  });

  afterAll(async () => {
    if (createdUserIds.length) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }

    await mongoose.connection.close();
  });

  it('GET /api/system/health responds with ok', async () => {
    const res = await request(app).get('/api/system/health');
    expect(res.status).toBe(200);
    expect(res.body?.status).toBe('ok');
  });

  it('POST /api/auth/register creates a user', async () => {
    const email = randomEmail();
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        firstName: 'QA',
        lastName: 'User',
        email,
        password: 'Test1234!',
        role: 'trainee',
      });

    expect(res.status).toBe(201);
    expect(res.body?.data?.user?.email).toBe(email.toLowerCase());
    expect(res.body?.data?.accessToken).toBeDefined();

    const userId = res.body?.data?.user?.id;
    if (userId) {
      createdUserIds.push(userId);
    }
  });

  it('POST /api/auth/login authenticates existing user', async () => {
    const email = randomEmail();
    const password = 'Test1234!';

    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({ firstName: 'Login', lastName: 'User', email, password });

    expect(registerRes.status).toBe(201);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email, password });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body?.data?.accessToken).toBeDefined();

    const userId = registerRes.body?.data?.user?.id;
    if (userId) {
      createdUserIds.push(userId);
    }
  });

  it('GET /api/gyms returns a payload even without data', async () => {
    const res = await request(app).get('/api/gyms?page=1&limit=5');

    expect(res.status).toBe(200);
    expect(res.body?.data).toBeDefined();
    expect(Array.isArray(res.body?.data?.gyms)).toBe(true);
    expect(res.body?.data?.pagination).toBeDefined();
  });

  it('POST /api/gyms requires authentication', async () => {
    const res = await request(app)
      .post('/api/gyms')
      .send({ name: 'Unauth Gym', location: { city: 'Mumbai' } });

    expect(res.status).toBe(401);
  });

  it('POST /api/gyms allows gym owner to create a gym', async () => {
    const ownerEmail = randomEmail();
    const password = 'Test1234!';

    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        firstName: 'Owner',
        lastName: 'Gym',
        email: ownerEmail,
        password,
        role: 'gym-owner',
        profile: { headline: 'Owner QA' },
      });

    expect(registerRes.status).toBe(201);

    const { accessToken, user } = registerRes.body?.data ?? {};
    expect(accessToken).toBeDefined();
    expect(user?.id).toBeDefined();

    if (user?.id) {
      createdUserIds.push(user.id);
    }

    const gymRes = await request(app)
      .post('/api/gyms')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'QA Fitness Center',
        description: 'Automated test gym',
        location: { city: 'Pune', addressLine1: '123 Test Lane' },
        amenities: ['Weights', 'Cardio'],
        pricing: { mrp: 1500, discounted: 1200 },
      });

    expect(gymRes.status).toBe(201);
    expect(gymRes.body?.data?.gym?.name).toBe('QA Fitness Center');

    const gymId = gymRes.body?.data?.gym?.id;
    if (gymId) {
      await Gym.findByIdAndDelete(gymId);
    }
  });
});
