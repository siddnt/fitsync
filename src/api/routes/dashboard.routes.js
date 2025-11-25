import { Router } from 'express';
import {
  getAdminGyms,
  getAdminMarketplace,
  getAdminOverview,
  getAdminRevenue,
  getAdminUsers,
  getAdminInsights,
  getGymOwnerAnalytics,
  getGymOwnerGyms,
  getGymOwnerOverview,
  getGymOwnerSponsorship,
  getGymOwnerSubscriptions,
  getGymOwnerRoster,
  getTrainerOverview,
  getTrainerTrainees,
  getTrainerUpdates,
  getTraineeDiet,
  getTraineeOrders,
  getTraineeOverview,
  getTraineeProgress,
} from '../controllers/dashboard.controller.js';
import { verifyJWT, authorizeRoles } from '../../middlewares/auth.middleware.js';

const router = Router();

router.use(verifyJWT);

router.get('/trainee/overview', authorizeRoles('trainee', 'member'), getTraineeOverview);
router.get('/trainee/progress', authorizeRoles('trainee', 'member'), getTraineeProgress);
router.get('/trainee/diet', authorizeRoles('trainee', 'member'), getTraineeDiet);
router.get('/trainee/orders', authorizeRoles('trainee', 'member'), getTraineeOrders);

router.get('/gym-owner/overview', authorizeRoles('gym-owner'), getGymOwnerOverview);
router.get('/gym-owner/gyms', authorizeRoles('gym-owner'), getGymOwnerGyms);
router.get('/gym-owner/subscriptions', authorizeRoles('gym-owner'), getGymOwnerSubscriptions);
router.get('/gym-owner/sponsorships', authorizeRoles('gym-owner'), getGymOwnerSponsorship);
router.get('/gym-owner/analytics', authorizeRoles('gym-owner'), getGymOwnerAnalytics);
router.get('/gym-owner/roster', authorizeRoles('gym-owner'), getGymOwnerRoster);

router.get('/trainer/overview', authorizeRoles('trainer'), getTrainerOverview);
router.get('/trainer/trainees', authorizeRoles('trainer'), getTrainerTrainees);
router.get('/trainer/updates', authorizeRoles('trainer'), getTrainerUpdates);

router.get('/admin/overview', authorizeRoles('admin'), getAdminOverview);
router.get('/admin/users', authorizeRoles('admin'), getAdminUsers);
router.get('/admin/gyms', authorizeRoles('admin'), getAdminGyms);
router.get('/admin/revenue', authorizeRoles('admin'), getAdminRevenue);
router.get('/admin/marketplace', authorizeRoles('admin'), getAdminMarketplace);
router.get('/admin/insights', authorizeRoles('admin'), getAdminInsights);

export default router;
