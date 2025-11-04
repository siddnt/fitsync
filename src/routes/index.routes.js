import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import User from "../models/user.model.js";
import { Course } from "../models/course.model.js";
import { submitContactForm } from "../controllers/contact.controller.js";
import mongoose from "mongoose";
import Cart from "../models/cart.model.js";

const router = Router();

// Home page route
router.get("/", asyncHandler(async (req, res) => {
    // Get courses
    const courses = await Course.find({ isActive: true });
    
    // Get top trainers
    const topTrainers = await User.find({ 
        role: "trainer", 
        status: "active" 
    })
    .limit(4)
    .select("name specializations profilePicture");
    
    res.render("pages/home", {
        title: "FitSync - Your Fitness Journey Starts Here",
        featuredPlans: courses, // Use courses instead of static plans
        topTrainers
    });
}));

// About page
router.get("/about", (req, res) => {
    res.render("pages/about", {
        title: "About Us - FitSync"
    });
});

/* Gallery route has been moved to dedicated gallery.routes.js */

// Contact page
router.get("/contact", (req, res) => {
    res.render("pages/contact", {
        title: "Contact Us - FitSync"
    });
});

// Contact form submission
router.post("/contact", submitContactForm);

// Courses listing page
router.get("/courses", asyncHandler(async (req, res) => {
    try {
        // Get all courses
        const courses = await Course.find({ isActive: true });
        
        // Get trainers for each course
        const trainers = await User.find({
            role: "trainer",
            status: "active"
        })
        .populate('trainerCourses.course')
        .select("name email profilePicture bio specializations trainerCourses");
        
        // Create course specific trainer maps
        const courseTrainers = {};
        
        if (courses && Array.isArray(courses)) {
            courses.forEach(course => {
                if (course && course._id) {
                    courseTrainers[course._id.toString()] = trainers.filter(trainer => 
                        trainer && trainer.trainerCourses && 
                        Array.isArray(trainer.trainerCourses) &&
                        trainer.trainerCourses.some(tc => 
                            tc && tc.status === 'active' && 
                            tc.course && tc.course._id && 
                            tc.course._id.toString() === course._id.toString()
                        )
                    );
                }
            });
        }
        
        // Get top reviews for each course
        const courseReviews = {};
        try {
            // Only attempt if Review model exists
            const Review = mongoose.model('Review');
            
            // For each course, get top 3 reviews
            for (const course of courses) {
                if (course && course._id) {
                    const courseId = course._id.toString();
                    const reviews = await Review.find({ course: courseId })
                        .populate("user", "name")
                        .sort({ rating: -1, createdAt: -1 })
                        .limit(3);
                    
                    courseReviews[courseId] = reviews;
                }
            }
        } catch (error) {
            console.log("Reviews not available yet:", error.message);
        }
        
        res.render("pages/courses", {
            title: "Fitness Courses - FitSync",
            courses: courses || [], // Pass courses instead of plans
            trainers: trainers || [],
            courseTrainers: courseTrainers || {},
            courseReviews: courseReviews || {},
            isLoggedIn: !!req.session.userId,
            userId: req.session.userId,
            userRole: req.session.userRole
        });
    } catch (error) {
        console.error("Error loading courses page:", error);
        res.status(500).render("pages/error", {
            title: "Error - FitSync",
            message: "Failed to load courses. Please try again later.",
            statusCode: 500,
            stack: process.env.NODE_ENV === 'development' ? error.stack : null,
            isLoggedIn: !!req.session.userId,
            userId: req.session.userId, 
            userRole: req.session.userRole
        });
    }
}));

// Add a route for /plans that redirects to /courses
router.get("/plans", asyncHandler(async (req, res) => {
    return res.redirect("/courses");
}));

// User weekly schedule page
router.get("/schedule", asyncHandler(async (req, res) => {
    try {
        // Require login
        if (!req.session.userId) {
            return res.redirect("/auth/login?returnTo=/schedule");
        }
        
        // Get the user
        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.redirect("/auth/login");
        }
        
        // Get weekly schedule
        const schedule = await user.getWeeklySchedule();
        
        res.render("pages/schedule", {
            title: "My Weekly Schedule - FitSync",
            schedule,
            isLoggedIn: true,
            userId: req.session.userId,
            userRole: req.session.userRole,
            userName: user.name
        });
    } catch (error) {
        console.error("Error loading schedule page:", error);
        res.status(500).render("pages/error", {
            title: "Error - FitSync",
            message: "Failed to load schedule. Please try again later.",
            statusCode: 500,
            stack: process.env.NODE_ENV === 'development' ? error.stack : null,
            isLoggedIn: !!req.session.userId,
            userId: req.session.userId, 
            userRole: req.session.userRole
        });
    }
}));

// Trainers listing page
router.get("/trainers", asyncHandler(async (req, res) => {
    try {
        const { course } = req.query;
        
        // Get trainers based on course filter if provided
        let trainersQuery = {
            role: "trainer", 
            status: "active"
        };
        
        if (course) {
            trainersQuery["trainerCourses.course"] = course;
            trainersQuery["trainerCourses.status"] = "active";
        }
        
        let trainers = await User.find(trainersQuery)
            .select("name specializations profilePicture bio trainerCourses")
            .populate("trainerCourses.course", "name");
        
        // Get all courses for filters
        const courses = await Course.find({ isActive: true }).select("name");
        
        res.render("pages/trainers", {
            title: "Our Trainers - FitSync",
            trainers,
            courses,
            filters: { course },
            isLoggedIn: !!req.session.userId,
            userId: req.session.userId,
            userRole: req.session.userRole
        });
    } catch (error) {
        console.error("Error loading trainers page:", error);
        res.status(500).render("pages/error", {
            title: "Error - FitSync",
            message: "Failed to load trainers. Please try again later.",
            statusCode: 500,
            stack: process.env.NODE_ENV === 'development' ? error.stack : null,
            isLoggedIn: !!req.session.userId,
            userId: req.session.userId, 
            userRole: req.session.userRole
        });
    }
}));

// Checkout page route
router.get("/checkout", asyncHandler(async (req, res) => {
    // Require login
    if (!req.session.userId) {
        return res.redirect("/auth/login?returnTo=/checkout");
    }
    
    try {
        // Get the user's cart
        const cart = await Cart.findOne({ user: req.session.userId }).populate('items.product');
        
        // If cart is empty, redirect to shop page
        if (!cart || !cart.items || cart.items.length === 0) {
            return res.redirect('/shop');
        }
        
        res.render("pages/checkout", {
            title: "Checkout - FitSync",
            cart,
            isLoggedIn: true,
            userId: req.session.userId,
            userRole: req.session.userRole
        });
    } catch (error) {
        console.error("Error loading checkout page:", error);
        res.status(500).render("pages/error", {
            title: "Error - FitSync",
            message: "Failed to load checkout page. Please try again later.",
            statusCode: 500,
            isLoggedIn: !!req.session.userId,
            userId: req.session.userId, 
            userRole: req.session.userRole
        });
    }
}));

export default router; 