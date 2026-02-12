/**
 * LEGAL ROUTES
 * 
 * Handles terms of service and privacy policy acceptance tracking
 * Part of Phase 1 implementation for legal compliance
 */

import { Router } from 'express';
import {
    acceptTerms,
    acceptPrivacy,
    checkLegalStatus,
    getLegalVersions
} from '../controllers/legal.controller.js';
import { verifyJWT } from '../../middlewares/auth.middleware.js';

const router = Router();

// ===== PUBLIC ROUTES =====
// Get current terms and privacy versions (no auth required)
router.get('/versions', getLegalVersions);

// ===== PROTECTED ROUTES =====
// All routes below require authentication

// Accept terms of service
// POST /api/legal/terms/accept
// Body: { version: "1.0" } (optional, defaults to current version)
router.post('/terms/accept', verifyJWT, acceptTerms);

// Accept privacy policy
// POST /api/legal/privacy/accept
// Body: { version: "1.0" } (optional, defaults to current version)
router.post('/privacy/accept', verifyJWT, acceptPrivacy);

// Check if user needs to accept terms/privacy
// GET /api/legal/status
// Returns: needsTermsAcceptance, needsPrivacyAcceptance, versions, etc.
router.get('/status', verifyJWT, checkLegalStatus);

export default router;
