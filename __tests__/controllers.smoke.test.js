import { jest } from '@jest/globals';
import Order from '../src/models/order.model.js';
import TrainerAssignment from '../src/models/trainerAssignment.model.js';
import TrainerProgress from '../src/models/trainerProgress.model.js';
import {
  apiCall,
  buildFutureSlot,
  ctx,
  exportExpectations,
  flushTrackedGymImpressions,
  runId,
  setupControllerSmoke,
  teardownControllerSmoke,
  trackId,
  withHeaders,
} from './helpers/controllerSmoke.fixture.js';
import request from 'supertest';
import app from '../src/app.js';

jest.setTimeout(180000);

beforeAll(async () => {
  await setupControllerSmoke();
});

afterAll(async () => {
  await teardownControllerSmoke();
});

describe('Controller route smoke coverage', () => {
  describe('System routes', () => {
    it('GET /api/system/health returns service health', async () => {
      const res = await apiCall('get', '/api/system/health');

      expect(res.status).toBe(200);
      expect(res.body?.status).toBe('ok');
      expect(res.body?.cache).toBeDefined();
      expect(res.body?.search).toBeDefined();
    });

    it('GET /api/system/metrics returns observability metrics', async () => {
      const res = await apiCall('get', '/api/system/metrics');

      expect(res.status).toBe(200);
      expect(res.body?.status).toBe('ok');
      expect(res.body?.metrics).toBeDefined();
    });

    it('GET /api/system/metrics/prometheus returns Prometheus text output', async () => {
      const res = await apiCall('get', '/api/system/metrics/prometheus');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/plain');
      expect(res.text).toContain('# HELP fitsync_process_started_at_seconds');
    });
  });

  describe('Auth routes', () => {
    it('POST /api/auth/register creates a user', async () => {
      const agent = request.agent(app);
      const res = await withHeaders(agent.post('/api/auth/register')).send({
        firstName: 'Route',
        lastName: 'Register',
        email: `${runId}.auth.register@fitsync.dev`,
        password: 'Test1234!',
        role: 'trainee',
      });

      expect(res.status).toBe(201);
      expect(res.body?.data?.accessToken).toBeDefined();
      ctx.auth.agent = agent;
      ctx.auth.userId = String(res.body?.data?.user?.id);
      ctx.auth.accessToken = res.body?.data?.accessToken;
      trackId('users', ctx.auth.userId);
    });

    it('POST /api/auth/login authenticates the registered user', async () => {
      const res = await withHeaders(ctx.auth.agent.post('/api/auth/login')).send({
        email: `${runId}.auth.register@fitsync.dev`,
        password: 'Test1234!',
      });

      expect(res.status).toBe(200);
      expect(res.body?.data?.accessToken).toBeDefined();
      ctx.auth.accessToken = res.body?.data?.accessToken;
    });

    it('POST /api/auth/refresh refreshes the access token', async () => {
      const res = await withHeaders(ctx.auth.agent.post('/api/auth/refresh')).send();
      expect(res.status).toBe(200);
      expect(res.body?.data?.accessToken).toBeDefined();
    });

    it('GET /api/auth/me returns the current user', async () => {
      const res = await apiCall('get', '/api/auth/me', { token: ctx.auth.accessToken });
      expect(res.status).toBe(200);
      expect(String(res.body?.data?.id)).toBe(String(ctx.auth.userId));
    });

    it('POST /api/auth/logout clears the refresh token cookie', async () => {
      const res = await withHeaders(ctx.auth.agent.post('/api/auth/logout')).send();
      expect(res.status).toBe(204);
    });
  });

  describe('Gym routes', () => {
    it('GET /api/gyms lists gyms', async () => {
      const res = await apiCall('get', '/api/gyms?page=1&limit=10&city=Mumbai');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body?.data?.gyms)).toBe(true);
    });

    it('POST /api/gyms creates a gym for the owner', async () => {
      const res = await apiCall('post', '/api/gyms', { token: ctx.tokens.owner }).send({
        name: `${runId} Route Created Gym`,
        description: 'Created through route',
        location: {
          address: 'Route Created Address',
          city: 'Mumbai',
          state: 'MH',
          postalCode: '400002',
        },
        amenities: ['Yoga', 'Cafe'],
        keyFeatures: ['Recovery zone'],
        pricing: {
          monthlyMrp: 3000,
          monthlyPrice: 2400,
          currency: 'INR',
          membershipPlans: [{
            code: 'monthly',
            label: 'Monthly',
            durationMonths: 1,
            mrp: 3000,
            price: 2400,
            currency: 'INR',
          }],
        },
        subscription: { planCode: 'listing-1m' },
      });

      expect(res.status).toBe(201);
      expect(res.body?.data?.gym?.name).toBe(`${runId} Route Created Gym`);
      ctx.gyms.createdViaRoute = { _id: String(res.body?.data?.gym?.id) };
      trackId('gyms', ctx.gyms.createdViaRoute._id);
    });

    it('GET /api/gyms/:gymId/trainers lists active trainers for a gym', async () => {
      const res = await apiCall('get', `/api/gyms/${ctx.gyms.main._id}/trainers`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body?.data?.trainers)).toBe(true);
      expect(res.body?.data?.trainers.some((trainer) => String(trainer.id) === String(ctx.users.trainer._id))).toBe(true);
    });

    it('GET /api/gyms/:gymId/memberships/me returns the current trainee membership', async () => {
      const res = await apiCall('get', `/api/gyms/${ctx.gyms.main._id}/memberships/me`, { token: ctx.tokens.trainee });
      expect(res.status).toBe(200);
      expect(String(res.body?.data?.membership?.id)).toBe(String(ctx.memberships.main._id));
    });

    it('POST /api/gyms/:gymId/memberships joins a gym for a trainee', async () => {
      const res = await apiCall('post', `/api/gyms/${ctx.gyms.main._id}/memberships`, { token: ctx.tokens.traineeJoin }).send({
        trainerId: String(ctx.users.trainer._id),
        planCode: 'monthly',
        paymentReference: `${runId}-join-trainee`,
        autoRenew: true,
      });

      expect(res.status).toBe(201);
      ctx.memberships.joined = { _id: String(res.body?.data?.membership?.id) };
      trackId('memberships', ctx.memberships.joined._id);
    });

    it('DELETE /api/gyms/:gymId/memberships/:membershipId leaves a gym membership', async () => {
      const res = await apiCall(
        'delete',
        `/api/gyms/${ctx.gyms.main._id}/memberships/${ctx.memberships.joined._id}`,
        { token: ctx.tokens.traineeJoin },
      );

      expect(res.status).toBe(200);
      expect(res.body?.data?.membership?.status).toBe('cancelled');
    });

    it('POST /api/gyms/:gymId/reviews creates a gym review', async () => {
      const res = await apiCall('post', `/api/gyms/${ctx.gyms.main._id}/reviews`, { token: ctx.tokens.trainee }).send({
        rating: 5,
        comment: `${runId} gym review comment`,
      });

      expect(res.status).toBe(200);
      expect(res.body?.data?.review?.comment).toContain(runId);
    });

    it('GET /api/gyms/:gymId/reviews lists gym reviews', async () => {
      const res = await apiCall('get', `/api/gyms/${ctx.gyms.main._id}/reviews?limit=10`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body?.data?.reviews)).toBe(true);
    });

    it('GET /api/gyms/:gymId fetches a gym detail', async () => {
      const res = await apiCall('get', `/api/gyms/${ctx.gyms.main._id}`);
      expect(res.status).toBe(200);
      expect(String(res.body?.data?.gym?.id)).toBe(String(ctx.gyms.main._id));
    });

    it('POST /api/gyms/:gymId/impressions records an impression', async () => {
      const res = await apiCall('post', `/api/gyms/${ctx.gyms.main._id}/impressions`).send({ viewerId: `${runId}-viewer` });
      expect(res.status).toBe(204);
    });

    it('POST /api/gyms/:gymId/opens records a gym open', async () => {
      const res = await apiCall('post', `/api/gyms/${ctx.gyms.main._id}/opens`).send({ viewerId: `${runId}-viewer` });
      expect(res.status).toBe(204);
      await flushTrackedGymImpressions();
    });

    it('PUT /api/gyms/:gymId updates a gym', async () => {
      const res = await apiCall('put', `/api/gyms/${ctx.gyms.main._id}`, { token: ctx.tokens.owner }).send({
        description: `${runId} updated gym description`,
        tags: ['updated', 'qa'],
      });

      expect(res.status).toBe(200);
      expect(res.body?.data?.gym?.description).toContain(runId);
    });
  });

  describe('Owner routes', () => {
    it('GET /api/owner/monetisation/options lists monetisation options', async () => {
      const res = await apiCall('get', '/api/owner/monetisation/options', { token: ctx.tokens.owner });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body?.data?.listingPlans)).toBe(true);
      expect(Array.isArray(res.body?.data?.sponsorshipPackages)).toBe(true);
    });

    it('GET /api/owner/trainers/requests lists pending trainer requests', async () => {
      const res = await apiCall('get', '/api/owner/trainers/requests', { token: ctx.tokens.owner });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body?.data?.requests)).toBe(true);
    });

    it('POST /api/owner/trainers/requests/:assignmentId/approve approves a trainer request', async () => {
      const res = await apiCall(
        'post',
        `/api/owner/trainers/requests/${ctx.assignments.approve._id}/approve`,
        { token: ctx.tokens.owner },
      ).send({});

      expect(res.status).toBe(200);
      const assignment = await TrainerAssignment.findById(ctx.assignments.approve._id).lean();
      expect(assignment?.status).toBe('active');
    });

    it('POST /api/owner/trainers/requests/:assignmentId/decline declines a trainer request', async () => {
      const res = await apiCall(
        'post',
        `/api/owner/trainers/requests/${ctx.assignments.decline._id}/decline`,
        { token: ctx.tokens.owner },
      ).send({});

      expect(res.status).toBe(200);
    });

    it('POST /api/owner/subscriptions/checkout activates a listing subscription', async () => {
      const res = await apiCall('post', '/api/owner/subscriptions/checkout', { token: ctx.tokens.owner }).send({
        gymId: String(ctx.gyms.secondary._id),
        planCode: 'listing-3m',
      });

      expect(res.status).toBe(201);
      expect(res.body?.data?.subscription?.planCode).toBe('listing-3m');
    });

    it('POST /api/owner/sponsorships/purchase activates a sponsorship package', async () => {
      const res = await apiCall('post', '/api/owner/sponsorships/purchase', { token: ctx.tokens.owner }).send({
        gymId: String(ctx.gyms.main._id),
        tier: 'gold',
      });

      expect(res.status).toBe(200);
      expect(res.body?.data?.sponsorship?.tier).toBe('gold');
    });

    it('DELETE /api/owner/memberships/:membershipId removes a gym member', async () => {
      const res = await apiCall('delete', `/api/owner/memberships/${ctx.memberships.remove._id}`, {
        token: ctx.tokens.owner,
      });

      expect(res.status).toBe(200);
    });

    it('DELETE /api/owner/trainers/:assignmentId removes a trainer from a gym', async () => {
      const res = await apiCall('delete', `/api/owner/trainers/${ctx.assignments.remove._id}`, {
        token: ctx.tokens.owner,
      });

      expect(res.status).toBe(200);
    });
  });

  describe('Trainer and booking routes', () => {
    const bookingSlot = buildFutureSlot(2);
    ctx.bookingSlot = bookingSlot;

    it('PUT /api/trainer/availability upserts trainer availability', async () => {
      const res = await apiCall('put', '/api/trainer/availability', { token: ctx.tokens.trainer }).send({
        gymId: String(ctx.gyms.main._id),
        timezone: 'Asia/Calcutta',
        notes: `${runId} availability notes`,
        slots: [{
          dayOfWeek: bookingSlot.dayOfWeek,
          startTime: bookingSlot.startTime,
          endTime: bookingSlot.endTime,
          capacity: bookingSlot.capacity,
          locationLabel: bookingSlot.locationLabel,
          sessionType: bookingSlot.sessionType,
        }],
      });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body?.data?.availability?.slots)).toBe(true);
    });

    it('GET /api/trainer/availability/me returns the trainer availability', async () => {
      const res = await apiCall('get', '/api/trainer/availability/me', { token: ctx.tokens.trainer });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body?.data?.availability)).toBe(true);
    });

    it('GET /api/trainer/:trainerId/availability returns public trainer availability', async () => {
      const res = await apiCall('get', `/api/trainer/${ctx.users.trainer._id}/availability?gymId=${ctx.gyms.main._id}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body?.data?.availability)).toBe(true);
    });

    it('POST /api/trainer/trainees/:traineeId/attendance logs attendance', async () => {
      const res = await apiCall('post', `/api/trainer/trainees/${ctx.users.trainee._id}/attendance`, {
        token: ctx.tokens.trainer,
      }).send({ status: 'present', notes: `${runId} attendance` });

      expect(res.status).toBe(201);
      expect(res.body?.data?.attendance?.status).toBe('present');
    });

    it('POST /api/trainer/trainees/:traineeId/progress records a progress metric', async () => {
      const res = await apiCall('post', `/api/trainer/trainees/${ctx.users.trainee._id}/progress`, {
        token: ctx.tokens.trainer,
      }).send({ metric: 'Bench Press', value: 80, unit: 'kg' });

      expect(res.status).toBe(201);
      expect(res.body?.data?.metric?.metric).toBe('Bench Press');
    });

    it('PUT /api/trainer/trainees/:traineeId/diet upserts a diet plan', async () => {
      const res = await apiCall('put', `/api/trainer/trainees/${ctx.users.trainee._id}/diet`, {
        token: ctx.tokens.trainer,
      }).send({
        weekOf: new Date().toISOString(),
        meals: {
          breakfast: { item: 'Oats', calories: 320, protein: 18, fat: 8 },
          lunch: { item: 'Rice and chicken', calories: 520, protein: 35, fat: 12 },
        },
        notes: `${runId} diet`,
      });

      expect(res.status).toBe(200);
    });

    it('POST /api/trainer/trainees/:traineeId/feedback adds trainee feedback', async () => {
      const res = await apiCall('post', `/api/trainer/trainees/${ctx.users.trainee._id}/feedback`, {
        token: ctx.tokens.trainer,
      }).send({ message: `${runId} trainer feedback`, category: 'progress' });

      expect(res.status).toBe(201);
      expect(res.body?.data?.feedback?.message).toContain(runId);
    });

    it('PATCH /api/trainer/feedback/:feedbackId/review marks feedback reviewed', async () => {
      const progress = await TrainerProgress.findOne({
        trainer: ctx.users.trainer._id,
        trainee: ctx.users.trainee._id,
      }).lean();
      const feedbackId = String(progress?.feedback?.[0]?._id);
      const res = await apiCall('patch', `/api/trainer/feedback/${feedbackId}/review`, { token: ctx.tokens.trainer }).send({});

      expect(res.status).toBe(200);
    });

    it('GET /api/bookings/slots lists available booking slots', async () => {
      const res = await apiCall(
        'get',
        `/api/bookings/slots?gymId=${ctx.gyms.main._id}&trainerId=${ctx.users.trainer._id}&days=7`,
        { token: ctx.tokens.trainee },
      );

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body?.data?.slots)).toBe(true);
    });

    it('POST /api/bookings creates a booking request', async () => {
      const res = await apiCall('post', '/api/bookings', { token: ctx.tokens.trainee }).send({
        gymId: String(ctx.gyms.main._id),
        trainerId: String(ctx.users.trainer._id),
        bookingDate: bookingSlot.dateString,
        availabilitySlotKey: bookingSlot.availabilitySlotKey,
        notes: `${runId} booking note`,
        type: 'in-person',
      });

      expect(res.status).toBe(201);
      ctx.bookings = { main: { _id: String(res.body?.data?.booking?.id) } };
      trackId('bookings', ctx.bookings.main._id);
    });

    it('GET /api/bookings/me lists trainee bookings', async () => {
      const res = await apiCall('get', '/api/bookings/me', { token: ctx.tokens.trainee });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body?.data?.bookings)).toBe(true);
    });

    it('PATCH /api/bookings/:bookingId/status confirms a booking as the trainer', async () => {
      const res = await apiCall('patch', `/api/bookings/${ctx.bookings.main._id}/status`, {
        token: ctx.tokens.trainer,
      }).send({ status: 'confirmed' });

      expect(res.status).toBe(200);
      expect(res.body?.data?.booking?.status).toBe('confirmed');
    });
  });

  describe('Marketplace routes', () => {
    it('GET /api/marketplace/products lists the marketplace catalogue', async () => {
      const res = await apiCall('get', '/api/marketplace/products?page=1&pageSize=10&category=supplements');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body?.data?.products)).toBe(true);
    });

    it('GET /api/marketplace/products/:productId fetches a marketplace product', async () => {
      const res = await apiCall('get', `/api/marketplace/products/${ctx.products.main._id}`);
      expect(res.status).toBe(200);
      expect(String(res.body?.data?.product?.id)).toBe(String(ctx.products.main._id));
    });

    it('POST /api/marketplace/orders creates a marketplace order', async () => {
      const res = await apiCall('post', '/api/marketplace/orders', { token: ctx.tokens.trainee }).send({
        items: [{ productId: String(ctx.products.main._id), quantity: 1 }],
        shippingAddress: {
          firstName: 'Smoke',
          lastName: 'Buyer',
          email: 'buyer@example.com',
          phone: '9999999999',
          address: 'Buyer Street 1',
          city: 'Mumbai',
          state: 'MH',
          zipCode: '400001',
        },
        paymentMethod: 'Cash on Delivery',
      });

      expect(res.status).toBe(201);
      ctx.marketplaceOrderId = String(res.body?.data?.order?.id);
      trackId('orders', ctx.marketplaceOrderId);
      const storedOrder = await Order.findById(ctx.marketplaceOrderId).lean();
      ctx.marketplaceOrderItemId = String(storedOrder?.orderItems?.[0]?._id);
      expect(ctx.marketplaceOrderItemId).toBeTruthy();
    });

    it('POST /api/marketplace/checkout/create-session validates payload before Stripe', async () => {
      const res = await apiCall('post', '/api/marketplace/checkout/create-session', { token: ctx.tokens.trainee }).send({
        items: [],
      });
      expect(res.status).toBe(400);
    });

    it('GET /api/marketplace/checkout/order/:sessionId returns 404 for an unknown checkout session', async () => {
      const res = await apiCall('get', '/api/marketplace/checkout/order/cs_test_unknown', {
        token: ctx.tokens.trainee,
      });
      expect(res.status).toBe(404);
    });

    it('POST /api/marketplace/webhook/stripe rejects an invalid Stripe signature', async () => {
      const res = await apiCall('post', '/api/marketplace/webhook/stripe')
        .set('stripe-signature', 'invalid')
        .send({ id: 'evt_invalid' });
      expect(res.status).toBe(400);
    });

    it('GET /api/marketplace/seller/products lists seller products', async () => {
      const res = await apiCall('get', '/api/marketplace/seller/products', { token: ctx.tokens.seller });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body?.data?.products)).toBe(true);
    });

    it('POST /api/marketplace/seller/products validates seller product creation without an image', async () => {
      const res = await apiCall('post', '/api/marketplace/seller/products', { token: ctx.tokens.seller }).field({
        name: `${runId} No Image Product`,
        description: 'Missing image',
        mrp: '999',
        price: '899',
        category: 'supplements',
        stock: '3',
      });

      expect(res.status).toBe(400);
    });

    it('PUT /api/marketplace/seller/products/:productId updates a seller product', async () => {
      const res = await apiCall('put', `/api/marketplace/seller/products/${ctx.products.update._id}`, {
        token: ctx.tokens.seller,
      }).field({
        name: `${runId} Resistance Band Updated`,
        description: 'Updated seller product',
        price: '850',
        stock: '12',
        category: 'equipment',
        status: 'available',
      });

      expect(res.status).toBe(200);
      expect(res.body?.data?.product?.name).toContain('Updated');
    });

    it('DELETE /api/marketplace/seller/products/:productId deletes a seller product', async () => {
      const res = await apiCall('delete', `/api/marketplace/seller/products/${ctx.products.delete._id}`, {
        token: ctx.tokens.seller,
      });
      expect(res.status).toBe(200);
    });

    it('GET /api/marketplace/seller/orders lists seller orders', async () => {
      const res = await apiCall('get', '/api/marketplace/seller/orders', { token: ctx.tokens.seller });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body?.data?.orders)).toBe(true);
    });

    it('PATCH /api/marketplace/seller/orders/:orderId/items/:itemId/tracking updates tracking', async () => {
      const res = await apiCall(
        'patch',
        `/api/marketplace/seller/orders/${ctx.marketplaceOrderId}/items/${ctx.marketplaceOrderItemId}/tracking`,
        { token: ctx.tokens.seller },
      ).send({
        carrier: 'BlueDart',
        trackingNumber: `${runId}-track-001`,
        trackingUrl: 'https://example.com/track',
        status: 'in-transit',
      });

      expect(res.status).toBe(200);
    });

    it('PATCH /api/marketplace/seller/orders/:orderId/items/:itemId/status advances an order item status', async () => {
      const res = await apiCall(
        'patch',
        `/api/marketplace/seller/orders/${ctx.marketplaceOrderId}/items/${ctx.marketplaceOrderItemId}/status`,
        { token: ctx.tokens.seller },
      ).send({
        status: 'out-for-delivery',
        note: `${runId} status update`,
      });

      expect(res.status).toBe(200);
    });

    it('PATCH /api/marketplace/seller/orders/:orderId/settle settles the seller order', async () => {
      const res = await apiCall('patch', `/api/marketplace/seller/orders/${ctx.marketplaceOrderId}/settle`, {
        token: ctx.tokens.seller,
      }).send({});

      expect(res.status).toBe(200);
    });

    it('POST /api/marketplace/orders/:orderId/items/:itemId/return requests a return', async () => {
      const res = await apiCall(
        'post',
        `/api/marketplace/orders/${ctx.marketplaceOrderId}/items/${ctx.marketplaceOrderItemId}/return`,
        { token: ctx.tokens.trainee },
      ).send({ reason: `${runId} return reason` });

      expect(res.status).toBe(200);
    });

    it('PATCH /api/marketplace/seller/orders/:orderId/items/:itemId/return reviews a return request', async () => {
      const res = await apiCall(
        'patch',
        `/api/marketplace/seller/orders/${ctx.marketplaceOrderId}/items/${ctx.marketplaceOrderItemId}/return`,
        { token: ctx.tokens.seller },
      ).send({ decision: 'approved', note: `${runId} return approved` });

      expect(res.status).toBe(200);
    });

    it('POST /api/marketplace/products/:productId/reviews creates a product review', async () => {
      const res = await apiCall('post', `/api/marketplace/products/${ctx.products.main._id}/reviews`, {
        token: ctx.tokens.trainee,
      }).send({
        orderId: ctx.marketplaceOrderId,
        rating: 5,
        title: `${runId} product review`,
        comment: 'Delivered and reviewed',
      });

      expect(res.status).toBe(201);
      expect(res.body?.data?.reviewId).toBeDefined();
    });
  });

  describe('User routes', () => {
    it('GET /api/users/profile fetches the current user profile', async () => {
      const res = await apiCall('get', '/api/users/profile', { token: ctx.tokens.trainee });
      expect(res.status).toBe(200);
      expect(String(res.body?.data?.id)).toBe(String(ctx.users.trainee._id));
    });

    it('PATCH /api/users/profile updates the current user profile', async () => {
      const res = await apiCall('patch', '/api/users/profile', { token: ctx.tokens.trainee }).send({
        bio: `${runId} updated trainee bio`,
        profile: {
          headline: `${runId} trainee headline`,
          about: `${runId} trainee about`,
          location: 'Mumbai',
        },
      });

      expect(res.status).toBe(200);
      expect(res.body?.data?.bio).toContain(runId);
    });

    it('GET /api/users/notifications lists user notifications', async () => {
      const res = await apiCall('get', '/api/users/notifications', { token: ctx.tokens.trainee });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body?.data?.notifications)).toBe(true);
      ctx.notifications.traineeIds = res.body?.data?.notifications?.slice(0, 3).map((item) => String(item.id ?? item._id)) ?? [];
    });

    it('PATCH /api/users/notifications/read marks notifications as read', async () => {
      const res = await apiCall('patch', '/api/users/notifications/read', { token: ctx.tokens.trainee }).send({
        ids: ctx.notifications.traineeIds,
      });
      expect(res.status).toBe(200);
    });

    it('GET /api/users/recommendations returns gym and product recommendations', async () => {
      const res = await apiCall('get', '/api/users/recommendations', { token: ctx.tokens.trainee });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body?.data?.gyms)).toBe(true);
      expect(Array.isArray(res.body?.data?.products)).toBe(true);
    });
  });

  describe('Dashboard routes', () => {
    it('POST /api/dashboards/trainee/feedback submits trainee feedback to a trainer', async () => {
      const res = await apiCall('post', '/api/dashboards/trainee/feedback', { token: ctx.tokens.trainee }).send({
        trainerId: String(ctx.users.trainer._id),
        message: `${runId} trainee dashboard feedback`,
      });

      expect(res.status).toBe(201);
      expect(res.body?.data?.feedback?.message).toContain(runId);
    });

    const dashboardCases = [
      { label: '/api/dashboards/trainee/overview', buildPath: () => '/api/dashboards/trainee/overview', token: 'trainee' },
      { label: '/api/dashboards/trainee/progress', buildPath: () => '/api/dashboards/trainee/progress', token: 'trainee' },
      { label: '/api/dashboards/trainee/diet', buildPath: () => '/api/dashboards/trainee/diet', token: 'trainee' },
      { label: '/api/dashboards/trainee/orders', buildPath: () => '/api/dashboards/trainee/orders', token: 'trainee' },
      { label: '/api/dashboards/gym-owner/overview', buildPath: () => '/api/dashboards/gym-owner/overview', token: 'owner' },
      { label: '/api/dashboards/gym-owner/gyms', buildPath: () => '/api/dashboards/gym-owner/gyms', token: 'owner' },
      { label: '/api/dashboards/gym-owner/subscriptions', buildPath: () => '/api/dashboards/gym-owner/subscriptions', token: 'owner' },
      { label: '/api/dashboards/gym-owner/sponsorships', buildPath: () => '/api/dashboards/gym-owner/sponsorships', token: 'owner' },
      { label: '/api/dashboards/gym-owner/analytics', buildPath: () => '/api/dashboards/gym-owner/analytics', token: 'owner' },
      { label: '/api/dashboards/gym-owner/roster', buildPath: () => '/api/dashboards/gym-owner/roster', token: 'owner' },
      { label: '/api/dashboards/trainer/overview', buildPath: () => '/api/dashboards/trainer/overview', token: 'trainer' },
      { label: '/api/dashboards/trainer/trainees', buildPath: () => '/api/dashboards/trainer/trainees', token: 'trainer' },
      { label: '/api/dashboards/trainer/updates', buildPath: () => '/api/dashboards/trainer/updates', token: 'trainer' },
      { label: '/api/dashboards/trainer/feedback', buildPath: () => '/api/dashboards/trainer/feedback', token: 'trainer' },
      { label: '/api/dashboards/admin/overview', buildPath: () => '/api/dashboards/admin/overview', token: 'admin' },
      { label: '/api/dashboards/admin/users', buildPath: () => '/api/dashboards/admin/users', token: 'admin' },
      { label: '/api/dashboards/admin/users/:userId', buildPath: () => `/api/dashboards/admin/users/${ctx.users.pendingSeller._id}`, token: 'admin' },
      { label: '/api/dashboards/admin/gyms', buildPath: () => '/api/dashboards/admin/gyms', token: 'admin' },
      { label: '/api/dashboards/admin/gyms/:gymId', buildPath: () => `/api/dashboards/admin/gyms/${ctx.gyms.main._id}`, token: 'admin' },
      { label: '/api/dashboards/admin/revenue', buildPath: () => '/api/dashboards/admin/revenue', token: 'admin' },
      { label: '/api/dashboards/admin/marketplace', buildPath: () => '/api/dashboards/admin/marketplace', token: 'admin' },
      { label: '/api/dashboards/admin/insights', buildPath: () => '/api/dashboards/admin/insights', token: 'admin' },
      { label: '/api/dashboards/manager/overview', buildPath: () => '/api/dashboards/manager/overview', token: 'manager' },
    ];

    test.each(dashboardCases)('GET $label', async ({ buildPath, token }) => {
      const res = await apiCall('get', buildPath(), { token: ctx.tokens[token] });
      expect(res.status).toBe(200);
      expect(res.body?.data).toBeDefined();
    });

    it('GET /api/dashboards/gym-owner/sponsorships/export exports a sponsorship report', async () => {
      const res = await apiCall(
        'get',
        `/api/dashboards/gym-owner/sponsorships/export?gymId=${ctx.gyms.main._id}&format=pdf`,
        { token: ctx.tokens.owner },
      );
      exportExpectations(res, 'pdf');
    });

    it('GET /api/dashboards/gym-owner/memberships/export exports a memberships report', async () => {
      const res = await apiCall(
        'get',
        `/api/dashboards/gym-owner/memberships/export?gymId=${ctx.gyms.main._id}&format=csv`,
        { token: ctx.tokens.owner },
      );
      exportExpectations(res, 'csv');
    });

    it('GET /api/dashboards/admin/revenue/export exports an admin revenue report', async () => {
      const res = await apiCall('get', '/api/dashboards/admin/revenue/export?format=csv', {
        token: ctx.tokens.admin,
      });
      exportExpectations(res, 'csv');
    });
  });

  describe('Contact and communications routes', () => {
    it('POST /api/contact submits a contact form', async () => {
      const res = await apiCall('post', '/api/contact').send({
        name: `${runId} Contact User`,
        email: `${runId}.contact@fitsync.dev`,
        subject: `${runId} Support request`,
        category: 'technical',
        priority: 'high',
        gymId: String(ctx.gyms.main._id),
        message: 'Support issue details',
      });

      expect(res.status).toBe(201);
      ctx.contactId = String(res.body?.data?._id ?? res.body?.data?.id);
      trackId('contacts', ctx.contactId);
    });

    it('GET /api/contact lists contact messages for the manager', async () => {
      const res = await apiCall('get', '/api/contact', { token: ctx.tokens.manager });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body?.data)).toBe(true);
    });

    it('PATCH /api/contact/:id/status updates a contact message status', async () => {
      const res = await apiCall('patch', `/api/contact/${ctx.contactId}/status`, { token: ctx.tokens.admin }).send({
        status: 'responded',
        internalNotes: `${runId} internal note`,
      });
      expect(res.status).toBe(200);
    });

    it('PATCH /api/contact/:id/assign assigns a contact message', async () => {
      const res = await apiCall('patch', `/api/contact/${ctx.contactId}/assign`, { token: ctx.tokens.admin }).send({
        assignedTo: String(ctx.users.manager._id),
        status: 'in-progress',
      });
      expect(res.status).toBe(200);
    });

    it('POST /api/contact/:id/reply replies to a contact message', async () => {
      const res = await apiCall('post', `/api/contact/${ctx.contactId}/reply`, { token: ctx.tokens.manager }).send({
        message: `${runId} support reply`,
        closeAfterReply: false,
      });
      expect(res.status).toBe(200);
    });

    it('GET /api/communications/recipients lists communication recipients', async () => {
      const res = await apiCall('get', '/api/communications/recipients', { token: ctx.tokens.owner });
      expect(res.status).toBe(200);
      expect(res.body?.data?.recipients).toBeDefined();
    });

    it('POST /api/communications creates an internal conversation', async () => {
      const res = await apiCall('post', '/api/communications', { token: ctx.tokens.owner }).send({
        recipientId: String(ctx.users.manager._id),
        subject: `${runId} Internal Thread`,
        body: 'Initial owner message',
        gymId: String(ctx.gyms.main._id),
      });

      expect(res.status).toBe(201);
      ctx.conversationId = String(res.body?.data?._id);
      trackId('conversations', ctx.conversationId);
    });

    it('GET /api/communications lists internal conversations', async () => {
      const res = await apiCall('get', '/api/communications', { token: ctx.tokens.owner });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body?.data)).toBe(true);
    });

    it('POST /api/communications/:id/reply replies to an internal conversation', async () => {
      const res = await apiCall('post', `/api/communications/${ctx.conversationId}/reply`, {
        token: ctx.tokens.manager,
      }).send({ body: `${runId} manager reply` });

      expect(res.status).toBe(200);
    });
  });

  describe('Admin routes', () => {
    it('GET /api/admin/audit-logs lists audit history', async () => {
      const res = await apiCall('get', `/api/admin/audit-logs?actor=${ctx.users.owner._id}&limit=50`, {
        token: ctx.tokens.admin,
      });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body?.data?.logs)).toBe(true);
    });

    it('GET /api/admin/audit-logs/export exports audit logs', async () => {
      const res = await apiCall('get', `/api/admin/audit-logs/export?actor=${ctx.users.owner._id}&format=pdf`, {
        token: ctx.tokens.admin,
      });
      exportExpectations(res, 'pdf');
    });

    it('GET /api/admin/settings/toggles returns admin toggles', async () => {
      const res = await apiCall('get', '/api/admin/settings/toggles', { token: ctx.tokens.admin });
      expect(res.status).toBe(200);
      expect(res.body?.data?.adminToggles).toBeDefined();
    });

    it('PATCH /api/admin/settings/toggles updates admin toggles', async () => {
      const res = await apiCall('patch', '/api/admin/settings/toggles', { token: ctx.tokens.admin }).send({
        toggles: { marketplaceEnabled: false, autoApproveTrainers: true },
      });
      expect(res.status).toBe(200);
    });

    it('PATCH /api/admin/users/:userId/status updates a user status', async () => {
      const res = await apiCall('patch', `/api/admin/users/${ctx.users.pendingSeller._id}/status`, {
        token: ctx.tokens.admin,
      }).send({ status: 'active' });
      expect(res.status).toBe(200);
    });

    it('DELETE /api/admin/users/:userId deletes a user account', async () => {
      const res = await apiCall('delete', `/api/admin/users/${ctx.users.deleteTarget._id}`, {
        token: ctx.tokens.admin,
      });
      expect(res.status).toBe(200);
    });

    it('DELETE /api/admin/gyms/:gymId deletes a gym listing', async () => {
      const res = await apiCall('delete', `/api/admin/gyms/${ctx.gyms.deleteTarget._id}`, {
        token: ctx.tokens.admin,
      });
      expect(res.status).toBe(200);
    });
  });
});
