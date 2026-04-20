import { Router } from 'express';
import { verifySession } from '../controllers/payment.controller.js';
import { verifyJWT } from '../../middlewares/auth.middleware.js';

const router = Router();

// Endpoint for verifying stripe session and returning receipt URL
router.post('/verify-session', verifyJWT, verifySession);

export default router;
