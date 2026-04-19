import { Router } from 'express';
import {
	listGyms,
	getGymById,
	recordImpression,
	createGym,
	updateGym,
	submitGymReview,
	listGymReviews,
	uploadGymGalleryPhoto,
	getGymGallery,
} from '../controllers/gym.controller.js';
import { joinGym, leaveGym, getMyGymMembership, listGymTrainers } from '../controllers/gymMembership.controller.js';
import { verifyJWT, authorizeRoles } from '../../middlewares/auth.middleware.js';
import { upload } from '../../middlewares/multer.middleware.js';
import { cacheMiddleware } from '../../middlewares/cache.middleware.js';

const router = Router();

router.get('/', cacheMiddleware('gyms', 300), listGyms);
router.post('/', verifyJWT, authorizeRoles('gym-owner', 'admin'), createGym);
router.get('/:gymId/trainers', listGymTrainers);
router.get(
	'/:gymId/memberships/me',
	verifyJWT,
	authorizeRoles('trainee', 'trainer'),
	getMyGymMembership,
);
router.post('/:gymId/memberships', verifyJWT, authorizeRoles('trainee', 'trainer'), joinGym);
router.delete(
	'/:gymId/memberships/:membershipId',
	verifyJWT,
	authorizeRoles('trainee', 'trainer', 'gym-owner', 'admin'),
	leaveGym,
);
router.post(
	'/:gymId/reviews',
	verifyJWT,
	authorizeRoles('trainee'),
	submitGymReview,
);
router.get('/:gymId/reviews', cacheMiddleware('gym-reviews', 300), listGymReviews);
router.get('/:gymId/gallery', getGymGallery);
router.post(
	'/:gymId/gallery',
	verifyJWT,
	authorizeRoles('gym-owner', 'trainee', 'admin'),
	upload.single('photo'),
	uploadGymGalleryPhoto,
);
router.get('/:gymId', cacheMiddleware('gym-detail', 300), getGymById);
router.post('/:gymId/impressions', recordImpression);
router.put('/:gymId', verifyJWT, authorizeRoles('gym-owner', 'admin'), updateGym);

export default router;

