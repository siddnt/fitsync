import Stripe from 'stripe';
import { ApiError } from '../utils/ApiError.js';

const STRIPE_API_VERSION = '2023-10-16';

let stripeClient = null;

const isTestEnvironment = () => process.env.NODE_ENV === 'test';

const getStripeSecretKey = () => {
  const key = process.env.STRIPE_SECRET_KEY;
  return typeof key === 'string' ? key.trim() : '';
};

const ensureStripeClient = () => {
  if (stripeClient) {
    return stripeClient;
  }

  const stripeSecretKey = getStripeSecretKey();
  if (!stripeSecretKey) {
    if (isTestEnvironment()) {
      return null;
    }
    throw new ApiError(503, 'Stripe is not configured. Set STRIPE_SECRET_KEY.');
  }

  stripeClient = new Stripe(stripeSecretKey, { apiVersion: STRIPE_API_VERSION });
  return stripeClient;
};

const createMockCheckoutSession = () => {
  const id = `cs_test_${Date.now()}`;
  return {
    id,
    url: `https://checkout.stripe.com/c/pay/${id}`,
    payment_status: 'unpaid',
    metadata: {},
    payment_intent: null,
  };
};

export const createStripeCheckoutSession = async (payload) => {
  const stripe = ensureStripeClient();
  if (!stripe) {
    return createMockCheckoutSession();
  }
  return stripe.checkout.sessions.create(payload);
};

export const retrieveStripeCheckoutSession = async (sessionId, options = {}) => {
  const stripe = ensureStripeClient();
  if (!stripe) {
    return {
      id: sessionId,
      payment_status: 'paid',
      metadata: {},
      payment_intent: null,
    };
  }

  return stripe.checkout.sessions.retrieve(sessionId, options);
};