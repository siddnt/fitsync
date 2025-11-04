import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import Plan from "../models/plan.model.js";
import User from "../models/user.model.js";

const router = Router();

// Get all plans
router.get("/", asyncHandler(async (req, res) => {
    const { category, level, sort } = req.query;
    
    // Build filter
    const filter = { isActive: true };
    if (category) filter.category = category;
    if (level) filter.level = level;
    
    // Build sort
    let sortOption = {};
    if (sort === "price-asc") sortOption = { price: 1 };
    else if (sort === "price-desc") sortOption = { price: -1 };
    else if (sort === "newest") sortOption = { createdAt: -1 };
    else if (sort === "popular") sortOption = { enrollmentCount: -1 };
    else sortOption = { createdAt: -1 }; // Default sort
    
    // Get plans
    const plans = await Plan.find(filter)
        .sort(sortOption)
        .populate("creator", "name profilePicture");
    
    // Get all categories and levels for filters
    const categories = await Plan.distinct("category");
    const levels = await Plan.distinct("level");
    
    res.render("plans", {
        title: "Fitness Plans - FitSync",
        plans,
        categories,
        levels,
        filters: { category, level, sort }
    });
}));

// Get plan details
router.get("/:planId", asyncHandler(async (req, res) => {
    const { planId } = req.params;
    
    // Get plan
    const plan = await Plan.findOne({
        _id: planId,
        isActive: true
    }).populate("creator", "name profilePicture bio specializations");
    
    if (!plan) {
        throw new ApiError(404, "Plan not found");
    }
    
    // Check if user is logged in and already enrolled
    let isEnrolled = false;
    if (req.session && req.session.userId) {
        const user = await User.findById(req.session.userId);
        isEnrolled = user?.enrolledPlans?.some(
            enrollment => enrollment.plan.toString() === planId
        );
    }
    
    res.render("plan-detail", {
        title: `${plan.title} - FitSync`,
        plan,
        isEnrolled
    });
}));

export default router; 