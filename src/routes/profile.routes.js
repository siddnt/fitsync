import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import User from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";

const router = Router();

// Middleware to check if user is logged in
const isLoggedIn = (req, res, next) => {
    if (!req.session || !req.session.userId) {
        return res.redirect("/auth/login");
    }
    next();
};

// Apply middleware to all routes
router.use(isLoggedIn);

// Profile route that redirects based on user role
router.get("/", asyncHandler(async (req, res) => {
    const userId = req.session.userId;
    
    // Get user
    const user = await User.findById(userId);
    
    if (!user) {
        throw new ApiError(404, "User not found");
    }
    
    // Redirect based on role
    if (user.role === "admin") {
        return res.redirect("/admin/dashboard");
    } else if (user.role === "trainer") {
        return res.redirect("/trainer/profile");
    } else {
        return res.redirect("/user/profile");
    }
}));

export default router; 