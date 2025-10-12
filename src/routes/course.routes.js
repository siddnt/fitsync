import { Router } from "express";
import { verifyJWT, authorizeRoles } from "../middlewares/auth.middleware.js";
import {
    getAllCourses,
    getCourseById,
    registerAsCourseTrainer,
    enrollInCourse,
    getCourseTrainers,
    getUserSchedule,
    cancelCourseEnrollment,
    renewCourseEnrollment,
    getUserEnrollments,
    getCoursesPage,
    getTrainerRegistrationPage
} from "../controllers/course.controller.js";

const router = Router();

// Create a session auth middleware
const checkSessionAuth = (requiredRole) => {
    return (req, res, next) => {
        if (!req.session || !req.session.userId) {
            return res.redirect('/auth/login');
        }
        
        if (requiredRole && req.session.userRole !== requiredRole) {
            return res.status(403).render('pages/error', {
                title: 'Access Denied - FitSync',
                statusCode: 403,
                message: 'You do not have permission to access this page.'
            });
        }
        
        next();
    };
};

// Flexible auth middleware that supports both JWT and session
const flexibleAuth = (requiredRole) => {
    return (req, res, next) => {
        // Check if XHR request or API request
        const isApiRequest = req.xhr || 
                           req.headers['content-type'] === 'application/json' ||
                           req.headers['accept'] === 'application/json';
        
        // For API requests, use JWT
        if (isApiRequest) {
            // If already authenticated via JWT, just check role
            if (req.user) {
                if (requiredRole && req.user.role !== requiredRole) {
                    return res.status(403).json({
                        success: false,
                        message: `Role ${req.user.role} is not allowed to access this resource`
                    });
                }
                return next();
            }
            
            // If session exists, add user to req.user
            if (req.session && req.session.userId) {
                req.user = {
                    _id: req.session.userId,
                    role: req.session.userRole
                };
                
                if (requiredRole && req.session.userRole !== requiredRole) {
                    return res.status(403).json({
                        success: false,
                        message: `Role ${req.session.userRole} is not allowed to access this resource`
                    });
                }
                return next();
            }
            
            // Try JWT auth
            return verifyJWT(req, res, (err) => {
                if (err) {
                    return res.status(401).json({
                        success: false,
                        message: "Unauthorized request"
                    });
                }
                
                if (requiredRole && req.user.role !== requiredRole) {
                    return res.status(403).json({
                        success: false,
                        message: `Role ${req.user.role} is not allowed to access this resource`
                    });
                }
                next();
            });
        } 
        // For browser requests, use session
        else {
            if (!req.session || !req.session.userId) {
                return res.redirect('/auth/login');
            }
            
            if (requiredRole && req.session.userRole !== requiredRole) {
                return res.status(403).render('pages/error', {
                    title: 'Access Denied - FitSync',
                    statusCode: 403,
                    message: 'You do not have permission to access this page.'
                });
            }
            
            next();
        }
    };
};

// View routes (renders templates)
router.get("/", getCoursesPage);
router.get("/trainer-registration", checkSessionAuth("trainer"), getTrainerRegistrationPage);

// API routes (returns JSON)
// Public API routes
router.get("/api/courses", getAllCourses);
router.get("/api/courses/:courseId", getCourseById);
router.get("/api/courses/:courseId/trainers", getCourseTrainers);

// Protected API routes - require login
// Enrollment is handled post-payment via Stripe webhook; direct enroll endpoint disabled
router.get("/api/user/schedule", flexibleAuth(), getUserSchedule);
router.get("/api/user/enrollments", flexibleAuth(), getUserEnrollments);
router.post("/api/enrollment/:enrollmentId/cancel", flexibleAuth(), cancelCourseEnrollment);
router.post("/api/enrollment/:enrollmentId/renew", flexibleAuth(), renewCourseEnrollment);

// Trainer routes that support both session and JWT auth
router.post("/api/courses/:courseId/register-trainer", flexibleAuth("trainer"), registerAsCourseTrainer);

export default router; 