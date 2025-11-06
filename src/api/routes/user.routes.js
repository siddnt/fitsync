import { Router } from 'express';
import { updateProfile, getProfile } from '../controllers/user.controller.js';
import { verifyJWT } from '../../middlewares/auth.middleware.js';
import { upload } from '../../middlewares/multer.middleware.js';

const router = Router();

// Protected routes
router.get('/profile', verifyJWT, getProfile);
router.patch('/profile', verifyJWT, upload.single('profilePicture'), updateProfile);

export default router;
