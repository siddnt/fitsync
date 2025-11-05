import { Router } from 'express';
import { listGyms, getGymById, recordImpression, createGym, updateGym } from '../controllers/gym.controller.js';
import { verifyJWT, authorizeRoles } from '../../middlewares/auth.middleware.js';

const router = Router();

router.get('/', listGyms);
router.get('/:gymId', getGymById);
router.post('/:gymId/impressions', recordImpression);
router.post('/', verifyJWT, authorizeRoles('gym-owner', 'admin'), createGym);
router.put('/:gymId', verifyJWT, authorizeRoles('gym-owner', 'admin'), updateGym);

export default router;
