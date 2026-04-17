import { jest } from '@jest/globals';
import Contact from '../src/models/contact.model.js';
import Order from '../src/models/order.model.js';
import {
  apiCall,
  ctx,
  runId,
  setupControllerSmoke,
  teardownControllerSmoke,
  trackId,
} from './helpers/controllerSmoke.fixture.js';

jest.setTimeout(180000);

beforeAll(async () => {
  await setupControllerSmoke();
});

afterAll(async () => {
  await teardownControllerSmoke();
});

const buildShippingAddress = (suffix) => ({
  firstName: 'Guard',
  lastName: 'Buyer',
  email: `${runId}.${suffix}@fitsync.dev`,
  phone: '9999999999',
  address: '123 Guardrail Street',
  city: 'Mumbai',
  state: 'MH',
  zipCode: '400001',
});

const createMarketplaceOrderForGuardrail = async (suffix, quantity = 1) => {
  const res = await apiCall('post', '/api/marketplace/orders', { token: ctx.tokens.trainee }).send({
    items: [{ productId: String(ctx.products.main._id), quantity }],
    shippingAddress: buildShippingAddress(suffix),
    paymentMethod: 'Cash on Delivery',
  });

  expect(res.status).toBe(201);

  const orderId = String(res.body?.data?.order?.id);
  trackId('orders', orderId);

  const storedOrder = await Order.findById(orderId).lean();
  return {
    orderId,
    itemId: String(storedOrder?.orderItems?.[0]?._id),
  };
};

describe('Controller guardrails', () => {
  describe('Contact access control', () => {
    it('PATCH /api/contact/:id/status forbids managers from updating tickets assigned to someone else', async () => {
      const contact = await Contact.create({
        name: `${runId} Locked Contact`,
        email: `${runId}.locked-contact@fitsync.dev`,
        subject: `${runId} locked ticket`,
        category: 'technical',
        priority: 'high',
        message: 'Manager should not be able to update this ticket.',
        status: 'in-progress',
        assignedTo: ctx.users.admin._id,
      });
      trackId('contacts', contact._id);

      const res = await apiCall('patch', `/api/contact/${contact._id}/status`, {
        token: ctx.tokens.manager,
      }).send({ status: 'responded' });

      expect(res.status).toBe(403);
    });

    it('PATCH /api/contact/:id/assign forbids managers from claiming tickets assigned to someone else', async () => {
      const contact = await Contact.create({
        name: `${runId} Assigned Elsewhere`,
        email: `${runId}.assigned-elsewhere@fitsync.dev`,
        subject: `${runId} assigned elsewhere`,
        category: 'billing',
        priority: 'high',
        message: 'Manager should not be able to steal this ticket.',
        status: 'in-progress',
        assignedTo: ctx.users.admin._id,
      });
      trackId('contacts', contact._id);

      const res = await apiCall('patch', `/api/contact/${contact._id}/assign`, {
        token: ctx.tokens.manager,
      }).send({
        assignedTo: String(ctx.users.manager._id),
        status: 'in-progress',
      });

      expect(res.status).toBe(403);
    });
  });

  describe('Marketplace guardrails', () => {
    it('POST /api/marketplace/checkout/create-session preserves inventory validation errors', async () => {
      const res = await apiCall('post', '/api/marketplace/checkout/create-session', {
        token: ctx.tokens.trainee,
      }).send({
        items: [{ productId: String(ctx.products.main._id), quantity: 999 }],
        shippingAddress: buildShippingAddress('checkout-unavailable'),
      });

      expect(res.status).toBe(400);
      expect(res.body?.message ?? '').toContain('unavailable');
    });

    it('GET /api/marketplace/seller/orders returns tracking and return metadata for seller items', async () => {
      const { orderId } = await createMarketplaceOrderForGuardrail('seller-order-shape');

      const res = await apiCall('get', '/api/marketplace/seller/orders', {
        token: ctx.tokens.seller,
      });

      expect(res.status).toBe(200);

      const order = (res.body?.data?.orders ?? []).find((entry) => String(entry.id) === orderId);
      expect(order).toBeDefined();
      expect(order?.items?.[0]).toEqual(expect.objectContaining({
        tracking: null,
        returnRequest: expect.objectContaining({ status: 'none' }),
      }));
    });

    it('PATCH /api/marketplace/seller/orders/:orderId/items/:itemId/tracking rejects backward status changes', async () => {
      const { orderId, itemId } = await createMarketplaceOrderForGuardrail('tracking-transition');

      const advanceRes = await apiCall('patch', `/api/marketplace/seller/orders/${orderId}/items/${itemId}/tracking`, {
        token: ctx.tokens.seller,
      }).send({
        carrier: 'BlueDart',
        trackingNumber: `${runId}-tracking-guardrail`,
        trackingUrl: 'https://example.com/track',
        status: 'in-transit',
      });

      expect(advanceRes.status).toBe(200);
      expect(advanceRes.body?.data?.order?.items?.[0]?.tracking).toEqual(expect.objectContaining({
        carrier: 'BlueDart',
        trackingNumber: `${runId}-tracking-guardrail`,
        status: 'in-transit',
      }));

      const settleRes = await apiCall('patch', `/api/marketplace/seller/orders/${orderId}/settle`, {
        token: ctx.tokens.seller,
      }).send({});
      expect(settleRes.status).toBe(200);

      const regressionRes = await apiCall(
        'patch',
        `/api/marketplace/seller/orders/${orderId}/items/${itemId}/tracking`,
        { token: ctx.tokens.seller },
      ).send({
        carrier: 'BlueDart',
        trackingNumber: `${runId}-tracking-regression`,
        trackingUrl: 'https://example.com/track/regression',
        status: 'preparing',
      });

      expect(regressionRes.status).toBe(400);
      expect(regressionRes.body?.message ?? '').toContain('move forward');
    });

    it('PATCH /api/marketplace/seller/orders/:orderId/items/:itemId/return rejects refunds without a return request', async () => {
      const { orderId, itemId } = await createMarketplaceOrderForGuardrail('return-without-request');

      const res = await apiCall(
        'patch',
        `/api/marketplace/seller/orders/${orderId}/items/${itemId}/return`,
        { token: ctx.tokens.seller },
      ).send({
        decision: 'refunded',
        note: `${runId} should fail without request`,
      });

      expect(res.status).toBe(400);
      expect(res.body?.message ?? '').toContain('pending return request');
    });
  });
});
