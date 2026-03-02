import { Router } from 'express';
import { verifyJWT, authorizeRoles } from '../../middlewares/auth.middleware.js';
import {
  getPendingApprovals,
  approveUser,
  rejectUser,
  getSellers,
  updateSellerStatus,
  deleteSeller,
  getGymOwners,
  updateGymOwnerStatus,
  deleteGymOwner,
  getManagerGyms,
  deleteManagerGym,
  getManagerMarketplace,
} from '../controllers/manager.controller.js';

const router = Router();

router.use(verifyJWT, authorizeRoles('manager'));

// Pending approvals
router.get('/pending', getPendingApprovals);
router.patch('/users/:userId/approve', approveUser);
router.delete('/users/:userId/reject', rejectUser);

// Sellers CRUD
router.get('/sellers', getSellers);
router.patch('/sellers/:userId/status', updateSellerStatus);
router.delete('/sellers/:userId', deleteSeller);

// Gym Owners CRUD
router.get('/gym-owners', getGymOwners);
router.patch('/gym-owners/:userId/status', updateGymOwnerStatus);
router.delete('/gym-owners/:userId', deleteGymOwner);

// Gyms oversight
router.get('/gyms', getManagerGyms);
router.delete('/gyms/:gymId', deleteManagerGym);

// Marketplace oversight
router.get('/marketplace', getManagerMarketplace);

export default router;
