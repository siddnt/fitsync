import { Router } from 'express';
import { verifyJWT, authorizeRoles } from '../../middlewares/auth.middleware.js';
import {
  checkoutListingSubscription,
  getMonetisationOptions,
  purchaseSponsorship,
} from '../controllers/monetisation.controller.js';

const router = Router();

router.use(verifyJWT, authorizeRoles('gym-owner', 'admin'));

router.get('/monetisation/options', getMonetisationOptions);
router.post('/subscriptions/checkout', checkoutListingSubscription);
router.post('/sponsorships/purchase', purchaseSponsorship);

export default router;
