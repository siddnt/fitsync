import { Router } from 'express';
import { verifyJWT, authorizeRoles } from '../../middlewares/auth.middleware.js';
import {
  checkoutListingSubscription,
  getMonetisationOptions,
  purchaseSponsorship,
} from '../controllers/monetisation.controller.js';
import {
  listTrainerRequests,
  approveTrainerRequest,
  declineTrainerRequest,
} from '../controllers/owner.controller.js';

const router = Router();

router.use(verifyJWT, authorizeRoles('gym-owner', 'admin'));

router.get('/monetisation/options', getMonetisationOptions);
router.post('/subscriptions/checkout', checkoutListingSubscription);
router.post('/sponsorships/purchase', purchaseSponsorship);
router.get('/trainers/requests', listTrainerRequests);
router.post('/trainers/requests/:assignmentId/approve', approveTrainerRequest);
router.post('/trainers/requests/:assignmentId/decline', declineTrainerRequest);

export default router;
