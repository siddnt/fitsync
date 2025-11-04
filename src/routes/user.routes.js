import { Router } from "express";
import {
    getDashboard,
    getProfile,
    updateProfile,
    // getEnrolledPlans,
    // enrollInPlan,
    // cancelEnrollment,
    // getBookings,
    // createBooking,
    // cancelBooking,
    // getBookingForm
} from "../controllers/user.controller.js";
import { requireSessionRole } from "../middlewares/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

// Apply shared session-role middleware to all routes in this router
router.use(requireSessionRole("user"));

// Dashboard
router.get("/dashboard", getDashboard);

// Profile
router.get("/profile", getProfile);
router.post("/profile", updateProfile);

// Plans
// router.get("/plans", getEnrolledPlans);
// router.post("/plans/enroll/:planId", enrollInPlan);
// router.get("/plans/unenroll/:planId", cancelEnrollment);

// Bookings
// router.get("/bookings", getBookings);
// router.post("/bookings", createBooking);
// router.post("/bookings/:bookingId/cancel", cancelBooking);

// Booking form for specific plan
// router.get("/book/:planId", getBookingForm);

export default router;