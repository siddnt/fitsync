import { Router } from "express";
import {
    getCourseReviews,
    getTopCourseReviews,
    createReview,
    // updateReview,
    // deleteReview,
    getUserReviews
} from "../controllers/review.controller.js";

const router = Router();

// Middleware to check if user is logged in
const isLoggedIn = (req, res, next) => {
    if (!req.session || !req.session.userId) {
        return res.redirect("/auth/login");
    }
    next();
};

// Public routes (accessible without login)
router.get("/course/:courseId", getCourseReviews);
router.get("/course/:courseId/top", getTopCourseReviews);

// Protected routes (require login)
router.post("/create", isLoggedIn, createReview);
// router.put("/:reviewId", isLoggedIn, updateReview);
// router.delete("/:reviewId", isLoggedIn, deleteReview);
router.get("/user", isLoggedIn, getUserReviews);

export default router; 