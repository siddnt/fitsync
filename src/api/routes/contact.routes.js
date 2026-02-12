import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { rateLimit } from 'express-rate-limit';
import {
    submitContactForm,
    getContactMessages,
    updateMessageStatus,
} from '../controllers/contact.controller.js';
import { verifyJWT, authorizeRoles } from '../../middlewares/auth.middleware.js';

const router = Router();

// ===== PHASE 1: REQUEST VALIDATION MIDDLEWARE =====
// Purpose: Validate incoming form data to ensure quality and prevent malicious input
// Benefits: Prevents spam, malformed data, SQL injection, XSS attacks
const validateContactForm = [
    body('name')
        .trim()
        .notEmpty().withMessage('Name is required')
        .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters')
        .escape(), // Prevents XSS attacks
    
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Please provide a valid email address')
        .normalizeEmail(), // Standardizes email format
    
    body('subject')
        .trim()
        .notEmpty().withMessage('Subject is required')
        .isLength({ min: 5, max: 200 }).withMessage('Subject must be between 5 and 200 characters')
        .escape(),
    
    body('message')
        .trim()
        .notEmpty().withMessage('Message is required')
        .isLength({ min: 10, max: 5000 }).withMessage('Message must be between 10 and 5000 characters')
        .escape()
];

// Validation Error Handler
// Purpose: Check if validation passed and return errors if not
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            success: false,
            message: 'Validation failed',
            errors: errors.array().map(err => ({
                field: err.path,
                message: err.msg
            }))
        });
    }
    next();
};

// ===== PHASE 1: RATE LIMITING MIDDLEWARE =====
// Purpose: Prevent spam and abuse by limiting submissions per IP address
// Benefits: Protects server resources, reduces spam, prevents DoS attacks
const contactLimiter = rateLimit({
    windowMs: 30 * 60 * 1000,  // 30 minute time window
    max: 5,                     // Maximum 5 requests per hour per IP
    skipSuccessfulRequests: false, // Count both successful and failed requests
    standardHeaders: true,      // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false,       // Disable deprecated `X-RateLimit-*` headers
    message: {
        success: false,
        message: 'Too many contact form submissions from this IP. Please try again after an hour.',
        retryAfter: '1 hour'
    },
    // Skip rate limiting for admin users (if authenticated)
    skip: (req) => {
        // If user is authenticated and is an admin, skip rate limiting
        return req.user?.role === 'admin';
    }
});

// ===== ROUTES =====
// Public route - Submit contact form with validation and rate limiting
router.route('/').post(
    contactLimiter,              // Step 1: Check rate limit
    validateContactForm,         // Step 2: Validate input data
    handleValidationErrors,      // Step 3: Handle validation errors
    submitContactForm            // Step 4: Process form submission
);

// Admin routes - View and manage contact messages
router.route('/').get(verifyJWT, authorizeRoles('admin'), getContactMessages);
router.route('/:id/status').patch(verifyJWT, authorizeRoles('admin'), updateMessageStatus);

export default router;
