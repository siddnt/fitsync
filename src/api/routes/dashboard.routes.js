import { Router } from 'express';
import {
  getAdminGyms,
  getAdminGymDetail,
  getAdminMarketplace,
  getAdminOverview,
  getAdminRevenue,
  getAdminUsers,
  getAdminInsights,
  getAdminMemberships,
  getAdminUserDetail,
  getAdminProducts,
  getAdminProductBuyers,
  getAdminReviews,
  getAdminSubscriptions,
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
import { verifyJWT, authorizeRoles } from '../../middlewares/auth.middleware.js';
import { cacheMiddleware } from '../../middlewares/cache.middleware.js';

const router = Router();

router.use(verifyJWT);

// ── Trainee ────────────────────────────────────────────────────────────────
// Cache key includes the full URL (?page=1&limit=10 etc.) so each page is cached separately.
router.get('/trainee/overview',  authorizeRoles('trainee', 'member'), cacheMiddleware('trainee-overview',  180), getTraineeOverview);
router.get('/trainee/progress',  authorizeRoles('trainee', 'member'), cacheMiddleware('trainee-progress',  300), getTraineeProgress);
router.get('/trainee/diet',      authorizeRoles('trainee', 'member'), cacheMiddleware('trainee-diet',      300), getTraineeDiet);
router.get('/trainee/orders',    authorizeRoles('trainee', 'member'), cacheMiddleware('trainee-orders',     60), getTraineeOrders);
router.post('/trainee/feedback', authorizeRoles('trainee', 'member'), submitTrainerFeedback); // mutation — no cache

// ── Gym Owner ──────────────────────────────────────────────────────────────
router.get('/gym-owner/overview',      authorizeRoles('gym-owner'), cacheMiddleware('gymowner-overview',      180), getGymOwnerOverview);
router.get('/gym-owner/gyms',          authorizeRoles('gym-owner'), cacheMiddleware('gymowner-gyms',          180), getGymOwnerGyms);
router.get('/gym-owner/subscriptions', authorizeRoles('gym-owner'), cacheMiddleware('gymowner-subscriptions', 120), getGymOwnerSubscriptions);
router.get('/gym-owner/sponsorships',  authorizeRoles('gym-owner'), cacheMiddleware('gymowner-sponsorships',  300), getGymOwnerSponsorship);
router.get('/gym-owner/analytics',     authorizeRoles('gym-owner'), cacheMiddleware('gymowner-analytics',     300), getGymOwnerAnalytics);
router.get('/gym-owner/roster',        authorizeRoles('gym-owner'), cacheMiddleware('gymowner-roster',        180), getGymOwnerRoster);

// ── Trainer ────────────────────────────────────────────────────────────────
router.get('/trainer/overview',  authorizeRoles('trainer'), cacheMiddleware('trainer-overview',  180), getTrainerOverview);
router.get('/trainer/trainees',  authorizeRoles('trainer'), cacheMiddleware('trainer-trainees',  180), getTrainerTrainees);
router.get('/trainer/updates',   authorizeRoles('trainer'), cacheMiddleware('trainer-updates',   120), getTrainerUpdates);
router.get('/trainer/feedback',  authorizeRoles('trainer'), cacheMiddleware('trainer-feedback',  120), getTrainerFeedbackInbox);

// ── Admin ──────────────────────────────────────────────────────────────────
// Ordered by read frequency and how often data changes.
// Each paginated list uses URL-keyed cache, so page 1 and page 2 are separate entries.
router.get('/admin/overview',               authorizeRoles('admin'), cacheMiddleware('admin-overview',       120), getAdminOverview);
router.get('/admin/users',                  authorizeRoles('admin'), cacheMiddleware('admin-users',          120), getAdminUsers);
router.get('/admin/gyms',                   authorizeRoles('admin'), cacheMiddleware('admin-gyms',           180), getAdminGyms);
router.get('/admin/gyms/:gymId',            authorizeRoles('admin'), cacheMiddleware('admin-gym-detail',     300), getAdminGymDetail);
router.get('/admin/revenue',                authorizeRoles('admin'), cacheMiddleware('admin-revenue',         300), getAdminRevenue);
router.get('/admin/marketplace',            authorizeRoles('admin'), cacheMiddleware('admin-marketplace',     60), getAdminMarketplace);
router.get('/admin/insights',               authorizeRoles('admin'), cacheMiddleware('admin-insights',        300), getAdminInsights);
router.get('/admin/memberships',            authorizeRoles('admin'), cacheMiddleware('admin-memberships',     180), getAdminMemberships);
router.get('/admin/users/:userId',          authorizeRoles('admin'), cacheMiddleware('admin-user-detail',    180), getAdminUserDetail);
router.get('/admin/products',               authorizeRoles('admin'), cacheMiddleware('admin-products',        120), getAdminProducts);
router.get('/admin/products/:productId',    authorizeRoles('admin'), cacheMiddleware('admin-product-buyers', 180), getAdminProductBuyers);
router.get('/admin/reviews',                authorizeRoles('admin'), cacheMiddleware('admin-reviews',         300), getAdminReviews);
router.get('/admin/subscriptions',          authorizeRoles('admin'), cacheMiddleware('admin-subscriptions',   300), getAdminSubscriptions);

// ── Manager ────────────────────────────────────────────────────────────────
router.get('/manager/overview',    authorizeRoles('manager'), cacheMiddleware('manager-overview',    180), getManagerOverview);
router.get('/manager/sellers',     authorizeRoles('manager'), cacheMiddleware('manager-sellers',     120), getManagerSellers);
router.get('/manager/gym-owners',  authorizeRoles('manager'), cacheMiddleware('manager-gym-owners', 120), getManagerGymOwners);

export default router;
