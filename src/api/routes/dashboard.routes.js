import { Router } from 'express';
import {
  getAdminGyms,
  getAdminMarketplace,
  getAdminOverview,
  getAdminOpsStatus,
  getAdminRevenue,
  getAdminUsers,
  getAdminUserDetails,
  getAdminGymDetails,
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
  getTrainerFeedbackInbox,
  getTraineeDiet,
  getTraineeOrders,
  getTraineeOverview,
  getTraineeProgress,
  submitTrainerFeedback,
  getManagerOverview,
  getManagerSellers,
  getManagerGymOwners,
} from '../controllers/dashboard.controller.js';
import {
  exportAdminRevenueReport,
  exportGymOwnerMembershipsReport,
  exportGymOwnerSponsorshipsReport,
} from '../controllers/report.controller.js';
import { verifyJWT, authorizeRoles } from '../../middlewares/auth.middleware.js';

const router = Router();

router.use(verifyJWT);

router.get('/trainee/overview', authorizeRoles('trainee', 'member'), getTraineeOverview);
router.get('/trainee/progress', authorizeRoles('trainee', 'member'), getTraineeProgress);
router.get('/trainee/diet', authorizeRoles('trainee', 'member'), getTraineeDiet);
router.get('/trainee/orders', authorizeRoles('trainee', 'member'), getTraineeOrders);
router.post('/trainee/feedback', authorizeRoles('trainee', 'member'), submitTrainerFeedback);

router.get('/gym-owner/overview', authorizeRoles('gym-owner'), getGymOwnerOverview);
router.get('/gym-owner/gyms', authorizeRoles('gym-owner'), getGymOwnerGyms);
router.get('/gym-owner/subscriptions', authorizeRoles('gym-owner'), getGymOwnerSubscriptions);
router.get('/gym-owner/sponsorships', authorizeRoles('gym-owner'), getGymOwnerSponsorship);
router.get('/gym-owner/sponsorships/export', authorizeRoles('gym-owner'), exportGymOwnerSponsorshipsReport);
router.get('/gym-owner/analytics', authorizeRoles('gym-owner'), getGymOwnerAnalytics);
router.get('/gym-owner/memberships/export', authorizeRoles('gym-owner'), exportGymOwnerMembershipsReport);
router.get('/gym-owner/roster', authorizeRoles('gym-owner'), getGymOwnerRoster);

router.get('/trainer/overview', authorizeRoles('trainer'), getTrainerOverview);
router.get('/trainer/trainees', authorizeRoles('trainer'), getTrainerTrainees);
router.get('/trainer/updates', authorizeRoles('trainer'), getTrainerUpdates);
router.get('/trainer/feedback', authorizeRoles('trainer'), getTrainerFeedbackInbox);

router.get('/admin/overview', authorizeRoles('admin'), getAdminOverview);
router.get('/admin/users', authorizeRoles('admin'), getAdminUsers);
router.get('/admin/users/:userId', authorizeRoles('admin'), getAdminUserDetails);
router.get('/admin/gyms', authorizeRoles('admin'), getAdminGyms);
router.get('/admin/gyms/:gymId', authorizeRoles('admin'), getAdminGymDetails);
router.get('/admin/revenue', authorizeRoles('admin'), getAdminRevenue);
router.get('/admin/revenue/export', authorizeRoles('admin'), exportAdminRevenueReport);
router.get('/admin/marketplace', authorizeRoles('admin'), getAdminMarketplace);
router.get('/admin/insights', authorizeRoles('admin'), getAdminInsights);
router.get('/admin/ops', authorizeRoles('admin'), getAdminOpsStatus);

router.get('/manager/overview', authorizeRoles('manager'), getManagerOverview);
router.get('/manager/sellers', authorizeRoles('manager'), getManagerSellers);
router.get('/manager/gym-owners', authorizeRoles('manager'), getManagerGymOwners);

export default router;
