import { Router } from 'express';
import { verifyJWT } from '../../middlewares/auth.middleware.js';
import { handleStripeWebhook } from '../controllers/marketplace.controller.js';
import { getPaymentCheckoutSessionResult } from '../controllers/payment.controller.js';

const router = Router();

router.get('/checkout/:sessionId', verifyJWT, getPaymentCheckoutSessionResult);
router.post('/webhook/stripe', handleStripeWebhook);

export default router;
