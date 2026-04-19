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
  deleteManagerProduct,
} from '../controllers/manager.controller.js';
import {
  getAdminUserDetail,
  getAdminProducts,
  getAdminGymDetail,
  getAdminProductBuyers,
} from '../controllers/dashboard.controller.js';

const router = Router();

router.use(verifyJWT, authorizeRoles('manager'));

router.get('/pending', getPendingApprovals);
router.patch('/users/:userId/approve', approveUser);
router.delete('/users/:userId/reject', rejectUser);

router.get('/sellers', getSellers);
router.patch('/sellers/:userId/status', updateSellerStatus);
router.delete('/sellers/:userId', deleteSeller);

router.get('/gym-owners', getGymOwners);
router.patch('/gym-owners/:userId/status', updateGymOwnerStatus);
router.delete('/gym-owners/:userId', deleteGymOwner);

router.get('/users/:userId', getAdminUserDetail);

router.get('/gyms', getManagerGyms);
router.get('/gyms/:gymId', getAdminGymDetail);
router.delete('/gyms/:gymId', deleteManagerGym);

router.get('/marketplace', getManagerMarketplace);
router.get('/products', getAdminProducts);
router.get('/products/:productId', getAdminProductBuyers);
router.delete('/products/:productId', deleteManagerProduct);

export default router;
