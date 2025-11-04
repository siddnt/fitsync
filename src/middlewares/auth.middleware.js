import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import Contact from "../models/contact.model.js";

export const verifyJWT = asyncHandler(async (req, res, next) => {
    try {
        // Get token from cookie or authorization header
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");
        
        if (!token) {
            throw new ApiError(401, "Unauthorized request");
        }
        
        // Verify token
        const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
        
        // Find user
        const user = await User.findById(decodedToken?._id).select("-password -refreshToken");
        
        if (!user) {
            throw new ApiError(401, "Invalid access token");
        }
        
        // Add user to request
        req.user = user;
        next();
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid access token");
    }
});

// Middleware to check user roles
export const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            throw new ApiError(401, "Unauthorized request");
        }
        
        if (!roles.includes(req.user.role)) {
            throw new ApiError(403, `Role: ${req.user.role} is not allowed to access this resource`);
        }
        
        next();
    };
};

// Session-based guard for server-rendered pages (uses req.session)
// Example: app.use('/user', requireSessionRole('user'))
export const requireSessionRole = (requiredRole) => {
    return (req, res, next) => {
        if (!req.session || !req.session.userId) {
            return res.redirect("/auth/login");
        }

        if (requiredRole && req.session.userRole !== requiredRole) {
            return res.status(403).render("pages/error", {
                title: "Access Denied - FitSync",
                statusCode: 403,
                message: "You do not have permission to access this page.",
            });
        }

        next();
    };
};

// Simple session-based guards for APIs/pages that expect 401/403 via error handler
export const isAuthenticated = (req, res, next) => {
    if (!req.session || !req.session.userId) {
        throw new ApiError(401, "Please login to access this resource");
    }
    next();
};

export const isAdmin = (req, res, next) => {
    if (!req.session || !req.session.userId || req.session.userRole !== 'admin') {
        throw new ApiError(403, "Access denied. Admin privileges required");
    }
    next();
};

// Middleware to check session-based login
export const checkLoginStatus = asyncHandler(async (req, res, next) => {
    res.locals.isLoggedIn = !!req.session.userId;
    res.locals.userRole = req.session.userRole;
    res.locals.userName = req.session.userName;
    
    // If user is admin, check for new messages
    if (req.session.userRole === 'admin') {
        const newMessageCount = await Contact.countDocuments({ status: 'new' });
        res.locals.newMessageCount = newMessageCount;
    }
    
    next();
}); 