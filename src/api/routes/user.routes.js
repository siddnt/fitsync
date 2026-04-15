import { Router } from 'express';
import {
  updateProfile,
  getProfile,
  getMyNotifications,
  markMyNotificationsRead,
  getMyRecommendations,
} from '../controllers/user.controller.js';
import { verifyJWT } from '../../middlewares/auth.middleware.js';
import { upload } from '../../middlewares/multer.middleware.js';

const router = Router();

// Protected routes
router.get('/profile', verifyJWT, getProfile);
router.patch('/profile', verifyJWT, upload.single('profilePicture'), updateProfile);
router.get('/notifications', verifyJWT, getMyNotifications);
router.patch('/notifications/read', verifyJWT, markMyNotificationsRead);
router.get('/recommendations', verifyJWT, getMyRecommendations);

export default router;
