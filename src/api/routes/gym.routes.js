import { Router } from 'express';
import { listGyms, getGymById, recordImpression, createGym, updateGym } from '../controllers/gym.controller.js';
import { joinGym, leaveGym, getMyGymMembership, listGymTrainers } from '../controllers/gymMembership.controller.js';
import { verifyJWT, authorizeRoles } from '../../middlewares/auth.middleware.js';
import {
	requireActiveUser,
	validateGymListQuery,
	validateObjectIdParam,
} from '../../middlewares/gym.middleware.js';

const router = Router();
router.use(verifyJWT);
const validateGymIdParam = validateObjectIdParam('gymId', 'Gym id');
const validateMembershipIdParam = validateObjectIdParam('membershipId', 'Membership id');

router.get('/', requireActiveUser, validateGymListQuery, listGyms);
router.post('/', authorizeRoles('gym-owner', 'admin'), createGym);
router.get('/:gymId/trainers', requireActiveUser, validateGymIdParam, listGymTrainers);
router.get(
	'/:gymId/memberships/me',
	requireActiveUser,
	validateGymIdParam,
	authorizeRoles('trainee', 'trainer'),
	getMyGymMembership,
);
router.post('/:gymId/memberships', requireActiveUser, validateGymIdParam, authorizeRoles('trainee', 'trainer'), joinGym);
router.delete(
	'/:gymId/memberships/:membershipId',
	requireActiveUser,
	validateGymIdParam,
	validateMembershipIdParam,
	authorizeRoles('trainee', 'trainer', 'gym-owner', 'admin'),
	leaveGym,
);
router.get('/:gymId', requireActiveUser, validateGymIdParam, getGymById);
router.post('/:gymId/impressions', requireActiveUser, validateGymIdParam, recordImpression);
router.put('/:gymId', requireActiveUser, validateGymIdParam, authorizeRoles('gym-owner', 'admin'), updateGym);

export default router;
