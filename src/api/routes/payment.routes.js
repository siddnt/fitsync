import { Router } from 'express';
import {
  createCheckoutSession,
  getPaymentSession,
  handleWebhook,
  createGymMembershipCheckout,
  createGymListingCheckout,
} from '../controllers/payment.controller.js';
import { verifyJWT } from '../../middlewares/auth.middleware.js';

const router = Router();

// Create Stripe checkout session (protected route)
router.post('/create-checkout-session', verifyJWT, createCheckoutSession);

// Create gym membership checkout session (protected route)
router.post('/gym-membership/checkout', verifyJWT, createGymMembershipCheckout);

// Create gym listing subscription checkout session (protected route)
router.post('/gym-listing/checkout', verifyJWT, createGymListingCheckout);

// Get payment session details (protected route)
router.get('/session/:sessionId', verifyJWT, getPaymentSession);

// Webhook is handled directly in app.js at /payments/webhook
// because it needs raw body parsing

export default router;
