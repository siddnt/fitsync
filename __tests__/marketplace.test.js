import request from 'supertest';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import app from '../src/app.js';
import connectDB from '../src/db/index.js';

dotenv.config({ path: '.env' });

describe('Marketplace endpoints', () => {
  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  // ─── Product catalogue ────────────────────────────────────
  describe('GET /api/marketplace/products', () => {
    it('returns paginated product list', async () => {
      const res = await request(app).get('/api/marketplace/products?page=1&pageSize=10');
      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(Array.isArray(res.body.data.products)).toBe(true);
      expect(res.body.data.pagination).toBeDefined();
    });

    it('supports category filter', async () => {
      const res = await request(app).get('/api/marketplace/products?category=supplements');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.products)).toBe(true);
    });

    it('supports search', async () => {
      const res = await request(app).get('/api/marketplace/products?search=protein');
      expect(res.status).toBe(200);
    });

    it('supports sorting options', async () => {
      for (const sort of ['priceLow', 'priceHigh', 'newest', 'featured']) {
        const res = await request(app).get(`/api/marketplace/products?sort=${sort}`);
        expect(res.status).toBe(200);
      }
    });

    it('supports price range filter', async () => {
      const res = await request(app).get('/api/marketplace/products?minPrice=100&maxPrice=5000');
      expect(res.status).toBe(200);
    });

    it('supports inStock filter', async () => {
      const res = await request(app).get('/api/marketplace/products?inStock=true');
      expect(res.status).toBe(200);
    });
  });

  // ─── Single product ───────────────────────────────────────
  describe('GET /api/marketplace/products/:productId', () => {
    it('returns 400 for invalid product ID', async () => {
      const res = await request(app).get('/api/marketplace/products/bad-id');
      expect(res.status).toBe(400);
    });

    it('returns 404 for non-existent product', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app).get(`/api/marketplace/products/${fakeId}`);
      expect(res.status).toBe(404);
    });
  });

  // ─── Create order (auth required) ────────────────────────
  describe('POST /api/marketplace/orders', () => {
    it('returns 401 without authentication', async () => {
      const res = await request(app).post('/api/marketplace/orders').send({
        items: [{ productId: new mongoose.Types.ObjectId(), quantity: 1 }],
        shippingAddress: {},
      });
      expect(res.status).toBe(401);
    });
  });

  // ─── Seller endpoints require auth ───────────────────────
  describe('Seller endpoints', () => {
    it('GET /api/marketplace/seller/products returns 401', async () => {
      const res = await request(app).get('/api/marketplace/seller/products');
      expect(res.status).toBe(401);
    });

    it('GET /api/marketplace/seller/orders returns 401', async () => {
      const res = await request(app).get('/api/marketplace/seller/orders');
      expect(res.status).toBe(401);
    });
  });
});
