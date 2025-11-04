import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import Booking from "../models/booking.model.js";
import User from "../models/user.model.js";
import { getPlanById } from "../config/plans.config.js";

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

// Main bookings page - redirect based on user role
router.get("/", asyncHandler(async (req, res) => {
    const userId = req.session.userId;
    const userRole = req.session.userRole;
    
    if (userRole === "user") {
        return res.redirect("/user/bookings");
    } else if (userRole === "trainer") {
        return res.redirect("/trainer/bookings");
    } else if (userRole === "admin") {
        return res.redirect("/admin/bookings");
    } else {
        throw new ApiError(403, "Access denied");
    }
}));

// Handle plan booking
router.get("/plan/:planId", asyncHandler(async (req, res) => {
    const userId = req.session.userId;
    const { planId } = req.params;
    
    try {
        // Get plan from static config
        const plan = getPlanById(planId);
        
        if (!plan) {
            return res.render("pages/error", {
                title: "Plan not found - FitSync",
                statusCode: 404,
                message: "The requested fitness plan could not be found. Please return to the courses page and try again."
            });
        }
        
        // Get available trainers
        const trainers = await User.find({ 
            role: "trainer",
            status: "active"
        }).select("name profilePicture specializations rating");
        
        res.render("pages/booking", {
            title: "Book Session - FitSync",
            plan,
            trainers,
            isLoggedIn: true,
            userRole: req.session.userRole,
            userId: req.session.userId
        });
    } catch (error) {
        return res.render("pages/error", {
            title: "Error - FitSync",
            statusCode: 500,
            message: error.message || "An error occurred while processing your request."
        });
    }
}));

// Process booking submission
router.post("/plan/:planId", asyncHandler(async (req, res) => {
    const userId = req.session.userId;
    const { planId } = req.params;
    const { trainerId, startDate, startTime, notes } = req.body;
    
    // Validate input
    if (!trainerId || !startDate || !startTime) {
        throw new ApiError(400, "Required fields are missing");
    }
    
    try {
        // Get plan from static config
        const plan = getPlanById(planId);
        
        if (!plan) {
            throw new ApiError(404, "Plan not found");
        }
        
        // Combine date and time
        const startDateTime = new Date(`${startDate}T${startTime}`);
        if (isNaN(startDateTime.getTime())) {
            throw new ApiError(400, "Invalid date or time format");
        }
        
        // Create booking
        const booking = await Booking.create({
            user: userId,
            trainer: trainerId,
            planId: planId, // Store as string ID reference to static plan
            startTime: startDateTime,
            endTime: new Date(startDateTime.getTime() + 60 * 60 * 1000), // 1 hour session
            status: "pending",
            notes: notes || "",
            planTitle: plan.title
        });
        
        // Update user's enrolled plans in User model
        await User.findByIdAndUpdate(userId, {
            $addToSet: {
                enrolledPlans: {
                    plan: planId, // String ID
                    enrolledAt: new Date(),
                    status: "active"
                }
            }
        });
        
        return res.redirect("/user/bookings?success=Booking submitted successfully");
    } catch (error) {
        return res.render("pages/error", {
            title: "Error - FitSync",
            statusCode: 500,
            message: error.message || "An error occurred while processing your booking request."
        });
    }
}));

// Get booking details
router.get("/:bookingId", asyncHandler(async (req, res) => {
    const userId = req.session.userId;
    const { bookingId } = req.params;
    
    // Get user
    const user = await User.findById(userId);
    
    if (!user) {
        throw new ApiError(404, "User not found");
    }
    
    // Build query based on user role
    const query = { _id: bookingId };
    if (user.role === "user") {
        query.user = userId;
    } else if (user.role === "trainer") {
        query.trainer = userId;
    }
    
    // Get booking
    const booking = await Booking.findOne(query)
        .populate("user", "name profilePicture email contactNumber")
        .populate("trainer", "name profilePicture email contactNumber specializations");
    
    if (!booking) {
        throw new ApiError(404, "Booking not found");
    }
    
    // Get plan details from config
    const plan = getPlanById(booking.planId);
    
    res.render("pages/booking-details", {
        title: "Booking Details - FitSync",
        booking,
        plan,
        userRole: user.role,
        isLoggedIn: true,
        userId: req.session.userId
    });
}));

// Update booking (shared between user and trainer)
router.post("/:bookingId", asyncHandler(async (req, res) => {
    const userId = req.session.userId;
    const { bookingId } = req.params;
    const { status, notes, cancellationReason, sessionFeedback } = req.body;
    
    // Get user
    const user = await User.findById(userId);
    
    if (!user) {
        throw new ApiError(404, "User not found");
    }
    
    // Build query based on user role
    const query = { _id: bookingId };
    if (user.role === "user") {
        query.user = userId;
    } else if (user.role === "trainer") {
        query.trainer = userId;
    }
    
    // Get booking
    const booking = await Booking.findOne(query);
    
    if (!booking) {
        throw new ApiError(404, "Booking not found");
    }
    
    // Apply updates based on role and input
    if (user.role === "trainer" && status) {
        booking.status = status;
    } else if (user.role === "user" && status === "cancelled") {
        booking.status = "cancelled";
        if (cancellationReason) booking.cancellationReason = cancellationReason;
    }
    
    if (notes) booking.notes = notes;
    
    // Add session feedback if provided (user only)
    if (user.role === "user" && sessionFeedback && sessionFeedback.rating) {
        booking.sessionFeedback = {
            rating: parseInt(sessionFeedback.rating),
            comment: sessionFeedback.comment || "",
            createdAt: new Date()
        };
    }
    
    await booking.save();
    
    // Handle API or form submission
    if (req.headers['content-type'] === 'application/json') {
        return res.status(200).json(
            new ApiResponse(200, { booking }, "Booking updated successfully")
        );
    } else {
        // Redirect based on role
        if (user.role === "trainer") {
            return res.redirect("/trainer/bookings");
        } else {
            return res.redirect("/user/bookings");
        }
    }
}));

export default router; 