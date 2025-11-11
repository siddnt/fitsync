import { Router } from 'express';
import { verifyJWT, authorizeRoles } from '../../middlewares/auth.middleware.js';
import {
	deleteUserAccount,
	deleteGymListing,
	getAdminToggles,
	updateAdminToggles,
	updateUserStatus,
} from '../controllers/admin.controller.js';

const router = Router();

router.use(verifyJWT, authorizeRoles('admin'));

router.delete('/users/:userId', deleteUserAccount);
router.patch('/users/:userId/status', updateUserStatus);
router.delete('/gyms/:gymId', deleteGymListing);
router.get('/settings/toggles', getAdminToggles);
router.patch('/settings/toggles', updateAdminToggles);

export default router;
