import { Router } from 'express';
import { listGyms, getGymById, recordImpression, createGym, updateGym } from '../controllers/gym.controller.js';
import { joinGym, leaveGym, getMyGymMembership, listGymTrainers } from '../controllers/gymMembership.controller.js';
import { verifyJWT, authorizeRoles } from '../../middlewares/auth.middleware.js';

const router = Router();

router.get('/', listGyms);
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
router.get('/:gymId', getGymById);
router.post('/:gymId/impressions', recordImpression);
router.put('/:gymId', verifyJWT, authorizeRoles('gym-owner', 'admin'), updateGym);

export default router;
