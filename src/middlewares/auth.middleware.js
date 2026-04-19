import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

const extractToken = (req) =>
    req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");

const resolveRequestUser = async (token) => {
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decodedToken?._id).select("-password -refreshToken");

    if (!user) {
        throw new ApiError(401, "Invalid access token");
    }

    return user;
};

export const verifyJWT = asyncHandler(async (req, res, next) => {
    try {
        const token = extractToken(req);

        if (!token) {
            throw new ApiError(401, "Unauthorized request");
        }

        req.user = await resolveRequestUser(token);
        next();
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid access token");
    }
});

export const optionalVerifyJWT = asyncHandler(async (req, res, next) => {
    try {
        const token = extractToken(req);

        if (!token) {
            return next();
        }

        req.user = await resolveRequestUser(token);
        return next();
    } catch (_error) {
        return next();
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
