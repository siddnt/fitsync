import { Router } from 'express';
import {
  acceptTerms,
  acceptPrivacy,
  checkLegalStatus,
  getLegalVersions,
} from '../controllers/legal.controller.js';
import { verifyJWT } from '../../middlewares/auth.middleware.js';

const router = Router();

/**
 * LEGAL ACCEPTANCE ROUTES
 * 
 * These routes handle legal document acceptance (Terms & Privacy Policy)
 * Required for GDPR, CCPA, and other compliance requirements
 */

// Public route - Get current legal document versions
router.get('/versions', getLegalVersions);

// Protected routes - Require authentication
router.post('/terms/accept', verifyJWT, acceptTerms);
router.post('/privacy/accept', verifyJWT, acceptPrivacy);
router.get('/status', verifyJWT, checkLegalStatus);

export default router;
