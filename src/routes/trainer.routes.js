import { Router } from "express";
import {
    getDashboard,
    getProfile,
    updateProfile,
    // getPlans,
    // createPlan,
    // getPlan,
    // updatePlan,
    // deletePlan,
    // getBookings,
    // updateBookingStatus
} from "../controllers/trainer.controller.js";
import { requireSessionRole } from "../middlewares/auth.middleware.js";

const router = Router();

// Apply shared middleware to ensure the user is a logged-in trainer (session-based)
router.use(requireSessionRole("trainer"));

// Dashboard
router.get("/dashboard", getDashboard);

// Profile
router.get("/profile", getProfile);
router.post("/profile", updateProfile);

// Plans
// router.get("/plans", getPlans);
// router.post("/plans", createPlan);
// router.get("/plans/:planId", getPlan);
// router.post("/plans/:planId", updatePlan);
// router.post("/plans/:planId/delete", deletePlan);

// Bookings
// router.get("/bookings", getBookings);
// router.post("/bookings/:bookingId", updateBookingStatus);
// router.get("/bookings/confirm/:bookingId", (req, res) => {
//     req.body = { status: "confirmed" };
//     updateBookingStatus(req, res);
// });
// router.get("/bookings/cancel/:bookingId", (req, res) => {
//     req.body = { status: "cancelled" };
//     updateBookingStatus(req, res);
// });
// router.get("/bookings/complete/:bookingId", (req, res) => {
//     req.body = { status: "completed" };
//     updateBookingStatus(req, res);
// });

export default router; 