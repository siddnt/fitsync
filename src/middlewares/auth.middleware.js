import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

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
        
        // Block suspended/deactivated users from all authenticated endpoints
        if (user.status === 'suspended') {
            throw new ApiError(403, 'Your account has been deactivated by an administrator. Please contact support.');
        }

        // Add user to request
        req.user = user;
        next();
    } catch (error) {
        // Re-throw ApiErrors as-is (preserves status codes like 403 for suspension)
        if (error instanceof ApiError) {
            throw error;
        }
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
