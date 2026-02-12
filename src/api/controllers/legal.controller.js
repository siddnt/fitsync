/**
 * LEGAL COMPLIANCE CONTROLLER
 * 
 * Handles terms of service and privacy policy acceptance tracking
 * Essential for GDPR, CCPA, and other legal compliance requirements
 */

import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import User from '../../models/user.model.js';

// Current versions - Update these when terms or privacy policy changes
const CURRENT_TERMS_VERSION = '1.0';
const CURRENT_PRIVACY_VERSION = '1.0';

/**
 * ===== PHASE 1: ACCEPT TERMS OF SERVICE =====
 * 
 * Records user acceptance of terms with version tracking
 * 
 * Flow:
 * 1. Verify user is authenticated (verifyJWT middleware)
 * 2. Get current terms version and acceptance timestamp
 * 3. Record IP address for audit trail
 * 4. Update user record with acceptance details
 * 
 * Benefits:
 * - Legal protection for the platform
 * - Proof of user consent
 * - Audit trail for disputes
 * - Compliance with consumer protection laws
 */
export const acceptTerms = asyncHandler(async (req, res) => {
    const { version = CURRENT_TERMS_VERSION } = req.body;
    const userId = req.user._id;
    
    // Get client IP address for audit trail
    const clientIP = req.ip || req.connection.remoteAddress;
    
    // Update user with terms acceptance
    const user = await User.findByIdAndUpdate(
        userId,
        {
            'legal.termsAccepted': true,
            'legal.termsVersion': version,
            'legal.termsAcceptedAt': new Date(),
            'legal.acceptanceIP': clientIP
        },
        { new: true, select: '-password -refreshToken' }
    );
    
    if (!user) {
        throw new ApiError(404, 'User not found');
    }
    
    // Log acceptance for audit purposes
    console.log({
        timestamp: new Date().toISOString(),
        userId: user._id,
        email: user.email,
        action: 'terms_accepted',
        version,
        ip: clientIP
    });
    
    return res.status(200).json(
        new ApiResponse(200, {
            termsAccepted: user.legal.termsAccepted,
            version: user.legal.termsVersion,
            acceptedAt: user.legal.termsAcceptedAt
        }, 'Terms of service accepted successfully')
    );
});

/**
 * ===== PHASE 1: ACCEPT PRIVACY POLICY =====
 * 
 * Records user acceptance of privacy policy with version tracking
 * Similar to terms acceptance but for privacy policy
 */
export const acceptPrivacy = asyncHandler(async (req, res) => {
    const { version = CURRENT_PRIVACY_VERSION } = req.body;
    const userId = req.user._id;
    
    const clientIP = req.ip || req.connection.remoteAddress;
    
    const user = await User.findByIdAndUpdate(
        userId,
        {
            'legal.privacyAccepted': true,
            'legal.privacyVersion': version,
            'legal.privacyAcceptedAt': new Date(),
            'legal.acceptanceIP': clientIP
        },
        { new: true, select: '-password -refreshToken' }
    );
    
    if (!user) {
        throw new ApiError(404, 'User not found');
    }
    
    console.log({
        timestamp: new Date().toISOString(),
        userId: user._id,
        email: user.email,
        action: 'privacy_accepted',
        version,
        ip: clientIP
    });
    
    return res.status(200).json(
        new ApiResponse(200, {
            privacyAccepted: user.legal.privacyAccepted,
            version: user.legal.privacyVersion,
            acceptedAt: user.legal.privacyAcceptedAt
        }, 'Privacy policy accepted successfully')
    );
});

/**
 * ===== CHECK IF USER NEEDS TO ACCEPT TERMS/PRIVACY =====
 * 
 * Determines if user needs to re-accept terms/privacy
 * This happens when:
 * - User has never accepted
 * - Version has been updated since last acceptance
 * 
 * Frontend can call this to show acceptance modal/page
 */
export const checkLegalStatus = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select('legal role');
    
    if (!user) {
        throw new ApiError(404, 'User not found');
    }
    
    // Admins do not need to accept legal documents
    if (user.role === 'admin') {
        return res.status(200).json(
            new ApiResponse(200, {
                needsTermsAcceptance: false,
                needsPrivacyAcceptance: false,
                currentTermsVersion: CURRENT_TERMS_VERSION,
                currentPrivacyVersion: CURRENT_PRIVACY_VERSION,
                userTermsVersion: user.legal?.termsVersion || null,
                userPrivacyVersion: user.legal?.privacyVersion || null,
                termsAcceptedAt: user.legal?.termsAcceptedAt || null,
                privacyAcceptedAt: user.legal?.privacyAcceptedAt || null
            }, 'Legal status retrieved successfully')
        );
    }

    // For new users, legal field might be empty, so set defaults
    const userLegal = user.legal || {};
    
    const needsTermsAcceptance = !userLegal.termsAccepted || 
                                 userLegal.termsVersion !== CURRENT_TERMS_VERSION;
    
    const needsPrivacyAcceptance = !userLegal.privacyAccepted || 
                                   userLegal.privacyVersion !== CURRENT_PRIVACY_VERSION;
    
    // Log for debugging
    console.log({
        timestamp: new Date().toISOString(),
        userId: req.user._id,
        action: 'check_legal_status',
        userLegal,
        needsTermsAcceptance,
        needsPrivacyAcceptance,
        currentTermsVersion: CURRENT_TERMS_VERSION,
        currentPrivacyVersion: CURRENT_PRIVACY_VERSION
    });
    
    return res.status(200).json(
        new ApiResponse(200, {
            needsTermsAcceptance,
            needsPrivacyAcceptance,
            currentTermsVersion: CURRENT_TERMS_VERSION,
            currentPrivacyVersion: CURRENT_PRIVACY_VERSION,
            userTermsVersion: userLegal.termsVersion || null,
            userPrivacyVersion: userLegal.privacyVersion || null,
            termsAcceptedAt: userLegal.termsAcceptedAt || null,
            privacyAcceptedAt: userLegal.privacyAcceptedAt || null
        }, 'Legal status retrieved successfully')
    );
});

/**
 * ===== GET CURRENT LEGAL DOCUMENT VERSIONS =====
 * 
 * Public endpoint to get current terms and privacy versions
 * Frontend can use this to determine if user needs to re-accept
 */
export const getLegalVersions = asyncHandler(async (req, res) => {
    return res.status(200).json(
        new ApiResponse(200, {
            termsVersion: CURRENT_TERMS_VERSION,
            privacyVersion: CURRENT_PRIVACY_VERSION
        }, 'Current legal document versions')
    );
});
