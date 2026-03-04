import { Router } from 'express';
import {
  createOwnerListingCheckoutSession,
  createOwnerSponsorshipCheckoutSession,
  createGymCreationCheckoutSession,
  createMembershipCheckoutSession,
  createMarketplaceCheckoutSession,
  createMarketplacePaymentIntent,
  createMarketplaceUpiSession,
  confirmMarketplaceUpiPayment,
  confirmPayment,
  confirmOwnerPayment,
  getStripeConfig,
  stripeWebhook,
} from '../controllers/payments.controller.js';
import { verifyJWT, authorizeRoles } from '../../middlewares/auth.middleware.js';

const router = Router();

router.get('/config', getStripeConfig);
router.post('/webhook', stripeWebhook);

router.use(verifyJWT);

router.post('/confirm', confirmPayment);
router.post('/owner/confirm', authorizeRoles('gym-owner', 'admin'), confirmOwnerPayment);

router.post('/owner/gyms/checkout-session', authorizeRoles('gym-owner', 'admin'), createGymCreationCheckoutSession);
router.post(
  '/owner/subscriptions/checkout-session',
  authorizeRoles('gym-owner', 'admin'),
  createOwnerListingCheckoutSession,
);
router.post(
  '/owner/sponsorships/checkout-session',
  authorizeRoles('gym-owner', 'admin'),
  createOwnerSponsorshipCheckoutSession,
);
router.post('/memberships/checkout-session', authorizeRoles('trainee', 'trainer'), createMembershipCheckoutSession);
router.post('/marketplace/checkout-session', authorizeRoles('user', 'trainee'), createMarketplaceCheckoutSession);
router.post('/marketplace/payment-intent', authorizeRoles('user', 'trainee'), createMarketplacePaymentIntent);
router.post('/marketplace/upi/session', authorizeRoles('user', 'trainee'), createMarketplaceUpiSession);
router.post('/marketplace/upi/confirm', authorizeRoles('user', 'trainee'), confirmMarketplaceUpiPayment);

export default router;
