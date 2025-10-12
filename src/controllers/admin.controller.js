import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import User from "../models/user.model.js";
import Plan from "../models/plan.model.js";
import Booking from "../models/booking.model.js";
import Contact from "../models/contact.model.js";
import { Course } from "../models/course.model.js";
import { getRevenueStatistics } from "../services/revenue.service.js";
import mongoose from "mongoose";
import Review from "../models/review.model.js";
import Gallery from "../models/gallery.model.js";
import Revenue from "../models/revenue.model.js";
import Order from "../models/order.model.js";

// Get admin dashboard
export const getDashboard = asyncHandler(async (req, res) => {
    const adminId = req.session.userId;
    
    // Get admin details
    const admin = await User.findById(adminId);
    
    if (!admin || admin.role !== "admin") {
        throw new ApiError(403, "Access denied");
    }
    
    // Get stats
    const userCount = await User.countDocuments({ role: "user" });
    const trainerCount = await User.countDocuments({ role: "trainer" });
    const pendingTrainerCount = await User.countDocuments({ 
        role: "trainer", 
        status: "pending" 
    });
    const planCount = await Plan.countDocuments();
    
    // Find all users with enrolled courses to count sessions
    const usersWithCourses = await User.find({ 
        role: "user",
        "enrolledCourses.0": { $exists: true } // Only users with at least one enrolled course
    }).populate("enrolledCourses.course");
    
    // Count total sessions from enrolled courses
    let sessionCount = 0;
    usersWithCourses.forEach(user => {
        if (user.enrolledCourses && user.enrolledCourses.length > 0) {
            user.enrolledCourses.forEach(enrollment => {
                if (enrollment.status === "active" && enrollment.course) {
                    // Each course has a schedule with multiple day/time slots
                    sessionCount += enrollment.course && enrollment.course.schedule ? enrollment.course.schedule.length : 0;
                }
            });
        }
    });
    
    const bookingCount = sessionCount;
    
    // Get recent users (registrations)
    const recentUsers = await User.find()
        .sort({ createdAt: -1 })
        .limit(5);

    // Get recent course enrollments
    const recentEnrollments = await User.aggregate([
        { $match: { "enrolledCourses.0": { $exists: true } } },
        { $unwind: "$enrolledCourses" },
        { $sort: { "enrolledCourses.enrolledAt": -1 } },
        { $limit: 5 },
        {
            $lookup: {
                from: "courses",
                localField: "enrolledCourses.course",
                foreignField: "_id",
                as: "courseDetails"
            }
        },
        {
            $project: {
                _id: 1,
                name: 1,
                email: 1,
                role: 1,
                status: 1,
                enrollmentId: "$enrolledCourses._id",
                courseId: "$enrolledCourses.course",
                courseName: { $ifNull: [{ $arrayElemAt: ["$courseDetails.name", 0] }, "Unknown Course"] },
                enrolledAt: "$enrolledCourses.enrolledAt",
                activityType: { $literal: "enrollment" }
            }
        }
    ]);

    // Get recent reviews
    const recentReviews = await Review.find()
        .populate("user", "name email role status")
        .populate("course", "name")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean()
        .then(reviews => reviews.filter(review => review.user && review.course).map(review => ({
            _id: review.user._id,
            name: review.user.name,
            email: review.user.email,
            role: review.user.role,
            status: review.user.status,
            reviewId: review._id,
            courseId: review.course._id,
            courseName: review.course.name,
            rating: review.rating,
            enrolledAt: review.createdAt,
            activityType: "review"
        })));

    // Get recent gallery uploads
    const recentUploads = await Gallery.find()
        .populate("uploadedBy", "name email role status")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean()
        .then(uploads => uploads.filter(upload => upload.uploadedBy).map(upload => ({
            _id: upload.uploadedBy._id,
            name: upload.uploadedBy.name,
            email: upload.uploadedBy.email,
            role: upload.uploadedBy.role,
            status: upload.uploadedBy.status,
            galleryId: upload._id,
            title: upload.title,
            category: upload.category,
            enrolledAt: upload.createdAt,
            activityType: "gallery"
        })));

    // Format the recent registrations to match the activity format
    const registrationActivities = recentUsers.map(user => ({
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        enrolledAt: user.createdAt,
        activityType: "registration"
    }));

    // Combine all activities and sort by date (newest first)
    const recentActivities = [...registrationActivities, ...recentEnrollments, ...recentReviews, ...recentUploads]
        .filter(activity => activity && activity._id) // Filter out any null or invalid activities
        .sort((a, b) => new Date(b.enrolledAt) - new Date(a.enrolledAt))
        .slice(0, 5); // Get only the 5 most recent activities

    // Get pending trainers
    const pendingTrainers = await User.find({ 
        role: "trainer", 
        status: "pending" 
    })
    .sort({ createdAt: -1 });
    
    // Get recent contact messages
    const recentMessages = await Contact.find()
        .sort({ createdAt: -1 })
        .limit(5);
    
    // Get all trainers for filter dropdown
    const trainers = await User.find({
        role: "trainer",
        status: "active"
    }).select("name");
    
    // Get weekly bookings
    // Get the current date and calculate the start and end of the week
    const today = new Date();
    const currentDay = today.getDay(); // 0 for Sunday, 1 for Monday, etc.
    
    // Calculate the start of the week (Monday)
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1));
    startOfWeek.setHours(0, 0, 0, 0);
    
    // Calculate the end of the week (Sunday)
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    
    // Fetch all bookings for the current week
    const weeklyBookings = await Booking.find({
        bookingDate: {
            $gte: startOfWeek,
            $lte: endOfWeek
        },
        status: { $in: ["pending", "confirmed"] }
    })
    .populate("user", "name")
    .populate("trainer", "name")
    .populate("course", "name")
    .sort({ bookingDate: 1, startTime: 1 });
    
    // Format the bookings for display
    const formattedWeeklyBookings = weeklyBookings
        .filter(booking => booking && booking.user && booking.trainer)
        .map(booking => {
            // Get the day of the week
            const bookingDate = new Date(booking.bookingDate);
            const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
            const dayOfWeek = days[bookingDate.getDay()];
            
            return {
                _id: booking._id,
                userName: booking.user.name,
                trainerName: booking.trainer.name,
                courseName: booking.courseName ? booking.courseName.toLowerCase() : "Unknown Course",
                day: dayOfWeek,
                startTime: booking.startTime,
                endTime: booking.endTime,
                status: booking.status
            };
        });
    
    res.render("pages/adminDashboard", {
        title: "Admin Dashboard - FitSync",
        stats: {
            userCount,
            trainerCount,
            pendingTrainerCount,
            planCount,
            bookingCount
        },
        recentUsers,
        recentActivities, // Pass the combined activities
        pendingTrainers,
        recentMessages,
        weeklyBookings: formattedWeeklyBookings,
        trainers,
        isLoggedIn: true,
        userRole: req.session.userRole,
        userId: req.session.userId,
    });
});

// Get users list
export const getUsers = asyncHandler(async (req, res) => {
    const { status, sort, page = 1, limit = 10 } = req.query;
    
    // Build query - only show members (users with role 'user')
    const query = { role: "user" };
    if (status) query.status = status;
    
    // Count total users
    const totalUsers = await User.countDocuments(query);
    
    // Sort options
    let sortOption = { createdAt: -1 }; // Default sort
    if (sort === "name") sortOption = { name: 1 };
    if (sort === "oldest") sortOption = { createdAt: 1 };
    
    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get users
    const users = await User.find(query)
        .populate({
            path: "enrolledCourses.course",
            select: "name"
        })
        .sort(sortOption)
        .skip(skip)
        .limit(parseInt(limit));
    
    res.render("pages/adminUsers", {
        title: "Manage Users - FitSync",
        users,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(totalUsers / parseInt(limit)),
            totalUsers
        },
        filters: { status, sort },
        isLoggedIn: true,
        userRole: req.session.userRole,
        userId: req.session.userId,
    });
});

// Get user details
export const getUserDetails = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    
    // Get user
    const user = await User.findById(userId);
    
    if (!user) {
        throw new ApiError(404, "User not found");
    }
    
    // Get user's plans if they're a trainer
    let plans = [];
    if (user.role === "trainer") {
        plans = await Plan.find({ creator: userId });
    }
    
    // Get user's bookings
    const bookings = await Booking.find({
        $or: [
            { user: userId },
            { trainer: userId }
        ]
    })
    .populate("user", "name")
    .populate("trainer", "name")
    .sort({ startTime: -1 });
    
    res.render("pages/editProfile", {
        title: `${user.name} - FitSync Admin`,
        user,
        plans,
        bookings,
        isAdmin: true,
        isLoggedIn: true,
        userRole: req.session.userRole,
        userId: req.session.userId,
    });
});

// Update user status
export const updateUserStatus = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { status } = req.body;
    
    // Find user
    const user = await User.findById(userId);
    
    if (!user) {
        throw new ApiError(404, "User not found");
    }
    
    // Update status
    user.status = status;
    await user.save();
    
    // Handle API or form submission
    if (req.headers['content-type'] === 'application/json') {
        return res.status(200).json(
            new ApiResponse(200, user, "User status updated successfully")
        );
    } else {
        return res.redirect(`/admin/users/${userId}?success=User status updated successfully`);
    }
});

// Get plans list
export const getPlans = asyncHandler(async (req, res) => {
    const { category, level, creator, isActive, sort, page = 1, limit = 10 } = req.query;
    
    // Build query
    const query = {};
    if (category) query.category = category;
    if (level) query.level = level;
    if (creator) query.creator = creator;
    if (isActive !== undefined) query.isActive = isActive === 'true';
    
    // Count total plans
    const totalPlans = await Plan.countDocuments(query);
    
    // Sort options
    let sortOption = { createdAt: -1 }; // Default sort
    if (sort === "title") sortOption = { title: 1 };
    if (sort === "price-asc") sortOption = { price: 1 };
    if (sort === "price-desc") sortOption = { price: -1 };
    if (sort === "popular") sortOption = { enrollmentCount: -1 };
    
    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get plans
    const plans = await Plan.find(query)
        .populate("creator", "name")
        .sort(sortOption)
        .skip(skip)
        .limit(parseInt(limit));
    
    // Get categories and levels for filters
    const categories = await Plan.distinct("category");
    const levels = await Plan.distinct("level");
    
    // Get trainers for filter
    const trainers = await User.find({ role: "trainer" })
        .select("name")
        .sort({ name: 1 });
    
    res.render("pages/courses", {
        title: "Manage Plans - FitSync",
        plans,
        categories,
        levels,
        trainers,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(totalPlans / parseInt(limit)),
            totalPlans
        },
        filters: { category, level, creator, isActive, sort },
        isAdmin: true,
        isLoggedIn: true,
        userRole: req.session.userRole,
        userId: req.session.userId,
    });
});

// Get bookings list
export const getBookings = asyncHandler(async (req, res) => {
    const { status, user, trainer, startDate, endDate, sort, page = 1, limit = 10 } = req.query;
    
    // Build query
    const query = {};
    if (status) query.status = status;
    if (user) query.user = user;
    if (trainer) query.trainer = trainer;
    
    // Date range filter
    if (startDate || endDate) {
        query.startTime = {};
        if (startDate) query.startTime.$gte = new Date(startDate);
        if (endDate) query.startTime.$lte = new Date(endDate);
    }
    
    // Count total bookings
    const totalBookings = await Booking.countDocuments(query);
    
    // Sort options
    let sortOption = { startTime: -1 }; // Default sort
    if (sort === "date-asc") sortOption = { startTime: 1 };
    if (sort === "date-desc") sortOption = { startTime: -1 };
    if (sort === "status") sortOption = { status: 1 };
    
    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get bookings
    const bookings = await Booking.find(query)
        .populate("user", "name")
        .populate("trainer", "name")
        .sort(sortOption)
        .skip(skip)
        .limit(parseInt(limit));
    
    // Get users and trainers for filters
    const users = await User.find({ role: "user" })
        .select("name")
        .sort({ name: 1 });
        
    const trainers = await User.find({ role: "trainer" })
        .select("name")
        .sort({ name: 1 });
    
    res.render("pages/adminBookings", {
        title: "Manage Bookings - FitSync",
        bookings,
        users,
        trainers,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(totalBookings / parseInt(limit)),
            totalBookings
        },
        filters: { status, user, trainer, startDate, endDate, sort },
        isAdmin: true,
        isLoggedIn: true,
        userRole: req.session.userRole,
        userId: req.session.userId,
    });
});

// Approve trainer
export const approveTrainer = asyncHandler(async (req, res) => {
    const { trainerId } = req.params;
    
    // Find trainer
    const trainer = await User.findById(trainerId);
    
    if (!trainer || trainer.role !== "trainer") {
        throw new ApiError(404, "Trainer not found");
    }
    
    // Update status
    trainer.status = "active";
    await trainer.save();
    
    return res.redirect("/admin/dashboard?message=Trainer approved successfully");
});

// Reject trainer
export const rejectTrainer = asyncHandler(async (req, res) => {
    const { trainerId } = req.params;
    
    // Find trainer
    const trainer = await User.findById(trainerId);
    
    if (!trainer || trainer.role !== "trainer") {
        throw new ApiError(404, "Trainer not found");
    }
    
    // Update status
    trainer.status = "rejected";
    await trainer.save();
    
    return res.redirect("/admin/dashboard?message=Trainer rejected");
});

// Toggle trainer status (active/inactive)
export const toggleTrainerStatus = asyncHandler(async (req, res) => {
    const { trainerId } = req.params;
    
    // Find trainer
    const trainer = await User.findById(trainerId);
    
    if (!trainer || trainer.role !== "trainer") {
        throw new ApiError(404, "Trainer not found");
    }
    
    // Toggle status
    trainer.status = trainer.status === "active" ? "inactive" : "active";
    await trainer.save();
    
    const message = trainer.status === "active" 
        ? "Trainer activated successfully" 
        : "Trainer deactivated successfully";
    
    return res.redirect("/admin/dashboard?message=" + message);
});

// Get trainers list
export const getTrainers = asyncHandler(async (req, res) => {
    const { status, sort, page = 1, limit = 10, message } = req.query;
    
    // Build query - only show trainers
    const query = { role: "trainer" };
    if (status) query.status = status;
    
    // Count total trainers
    const totalTrainers = await User.countDocuments(query);
    
    // Sort options
    let sortOption = { createdAt: -1 }; // Default sort
    if (sort === "name") sortOption = { name: 1 };
    if (sort === "oldest") sortOption = { createdAt: 1 };
    
    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get trainers with their courses
    const trainers = await User.find(query)
        .populate({
            path: "trainerCourses.course",
            select: "name"
        })
        .sort(sortOption)
        .skip(skip)
        .limit(parseInt(limit));
    
    res.render("pages/adminTrainers", {
        title: "Manage Trainers - FitSync",
        trainers,
        message: message || null,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(totalTrainers / parseInt(limit)),
            totalTrainers
        },
        filters: { status, sort },
        isLoggedIn: true,
        userRole: req.session.userRole,
        userId: req.session.userId,
    });
});

// Delete user
export const deleteUser = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { trainerId } = req.params;
    
    // Determine which ID to use (userId or trainerId)
    const id = userId || trainerId;
    
    // Find user
    const user = await User.findById(id);
    
    if (!user) {
        throw new ApiError(404, "User not found");
    }
    
    // Delete associated bookings
    await Booking.deleteMany({
        $or: [
            { user: id },
            { trainer: id }
        ]
    });
    
    // If user is trainer, delete their plans
    if (user.role === "trainer") {
        await Plan.deleteMany({ creator: id });
    }
    
    // Delete user
    await User.findByIdAndDelete(id);
    
    // Redirect with success message based on user role
    if (user.role === "trainer") {
        return res.redirect("/admin/trainers?message=Trainer deleted successfully");
    } else {
        return res.redirect("/admin/users?message=User deleted successfully");
    }
});

// Get all sessions from enrolled courses
export const getSessions = asyncHandler(async (req, res) => {
    try {
        // Get all trainers for dropdown
        const trainers = await User.find({
            role: "trainer",
            status: "active"
        }).select("name");
        
        // Get all users (trainees) for dropdown
        const trainees = await User.find({
            role: "user",
            status: "active"
        }).select("name");
        
        // Find all users with enrolled courses
        const users = await User.find({ 
            role: "user",
            "enrolledCourses.0": { $exists: true } // Only users with at least one enrolled course
        }).populate("enrolledCourses.course").populate("enrolledCourses.trainer");
        
        // Extract sessions from user enrollments
        const sessions = [];
        let sessionCounter = 1;
        
        users.forEach(user => {
            if (user.enrolledCourses && user.enrolledCourses.length > 0) {
                user.enrolledCourses.forEach(enrollment => {
                    if (enrollment.status === "active" && enrollment.course && enrollment.trainer) {
                        // Each course has a schedule with multiple day/time slots
                        if (enrollment.course.schedule && Array.isArray(enrollment.course.schedule)) {
                            enrollment.course.schedule.forEach(scheduleItem => {
                                sessions.push({
                                    _id: `session-${sessionCounter++}`,
                                    userName: user.name,
                                    userId: user._id.toString(),
                                    trainerName: enrollment.trainer.name,
                                    trainerId: enrollment.trainer._id.toString(),
                                    courseName: enrollment.course.name.toLowerCase(),
                                    courseId: enrollment.course._id.toString(),
                                    day: scheduleItem.day,
                                    startTime: scheduleItem.startTime,
                                    endTime: scheduleItem.endTime,
                                    date: new Date().toLocaleDateString() // Using current date as placeholder
                                });
                            });
                        }
                    }
                });
            }
        });
        
        // Apply filtering
        const { day, trainer, trainee, course, sort = "day" } = req.query;
        
        let filteredSessions = [...sessions];
        
        if (day) {
            filteredSessions = filteredSessions.filter(session => session.day === day.toLowerCase());
        }
        
        if (trainer) {
            filteredSessions = filteredSessions.filter(session => session.trainerId === trainer);
        }
        
        if (trainee) {
            filteredSessions = filteredSessions.filter(session => session.userId === trainee);
        }
        
        if (course) {
            filteredSessions = filteredSessions.filter(session => 
                session.courseName.toLowerCase() === course.toLowerCase()
            );
        }
        
        // Sort the sessions
        const dayOrder = {
            "monday": 1,
            "tuesday": 2,
            "wednesday": 3,
            "thursday": 4,
            "friday": 5,
            "saturday": 6,
            "sunday": 7
        };
        
        if (sort === "day") {
            filteredSessions.sort((a, b) => dayOrder[a.day] - dayOrder[b.day]);
        } else if (sort === "trainer") {
            filteredSessions.sort((a, b) => a.trainerName.localeCompare(b.trainerName));
        } else if (sort === "trainee") {
            filteredSessions.sort((a, b) => a.userName.localeCompare(b.userName));
        } else if (sort === "course") {
            filteredSessions.sort((a, b) => a.courseName.localeCompare(b.courseName));
        } else if (sort === "time") {
            filteredSessions.sort((a, b) => a.startTime.localeCompare(b.startTime));
        }
        
        // Render the sessions page
        res.render("pages/adminSessions", {
            title: "All Sessions - FitSync Admin",
            sessions: filteredSessions,
            trainers,
            trainees,
            filters: { day, trainer, trainee, course, sort },
            totalSessions: filteredSessions.length,
            isAdmin: true,
            isLoggedIn: true,
            userRole: req.session.userRole,
            userId: req.session.userId,
        });
    } catch (error) {
        console.error("Error in getSessions:", error);
        res.status(500).render("pages/error", {
            message: "Failed to load sessions. Please try again.",
            error: process.env.NODE_ENV === "development" ? error : {}
        });
    }
});

// Get revenue data by course and shop
export const getRevenueData = asyncHandler(async (req, res) => {
    try {
        // Get all courses with their prices
        const courses = await Course.find({ isActive: true }).select("_id name price");
        
        // Get all users with enrolled courses
        const users = await User.find({ 
            "enrolledCourses.0": { $exists: true } 
        }).populate("enrolledCourses.course", "name price");
        
        // Calculate revenue by course
        const revenueByCourse = {};
        
        // Initialize revenue with 0 for all courses
        courses.forEach(course => {
            revenueByCourse[course._id.toString()] = {
                _id: course._id,
                courseName: course.name,
                totalAmount: 0
            };
        });
        
        // Calculate revenue from user enrollments
        users.forEach(user => {
            if (user.enrolledCourses && user.enrolledCourses.length > 0) {
                user.enrolledCourses.forEach(enrollment => {
                    if (enrollment.course && enrollment.status === "active") {
                        const courseId = enrollment.course._id.toString();
                        if (revenueByCourse[courseId]) {
                            // Add course price to revenue
                            revenueByCourse[courseId].totalAmount += enrollment.course.price || 0;
                        }
                    }
                });
            }
        });
        
        // Convert to array format
        const courseRevenue = Object.values(revenueByCourse);
        
        // Get all orders for shop revenue
        const Order = mongoose.model("Order");
        const orders = await Order.find({
            status: { $ne: "Cancelled" } // Exclude cancelled orders
        }).populate({
            path: "orderItems.product",
            select: "name category"
        });
        
        // Calculate revenue by product category
        const revenueByCategory = {};
        
        // Process orders
        orders.forEach(order => {
            if (order.orderItems && order.orderItems.length > 0) {
                order.orderItems.forEach(item => {
                    const category = item.product?.category || "Other";
                    
                    if (!revenueByCategory[category]) {
                        revenueByCategory[category] = {
                            category: category,
                            totalAmount: 0
                        };
                    }
                    
                    // Add item total to category revenue
                    revenueByCategory[category].totalAmount += (item.price * item.quantity);
                });
            }
        });
        
        // Convert to array format
        const shopRevenue = Object.values(revenueByCategory);
        
        // Calculate total revenue
        const totalCourseRevenue = courseRevenue.reduce((sum, course) => sum + course.totalAmount, 0);
        const totalShopRevenue = shopRevenue.reduce((sum, category) => sum + category.totalAmount, 0);
        const totalRevenue = totalCourseRevenue + totalShopRevenue;
        
        // Log the calculated revenue data
        console.log("Revenue data calculated:", courseRevenue);
        
        return res.status(200).json({
            success: true,
            data: {
                courseRevenue: courseRevenue,
                shopRevenue: shopRevenue,
                totalRevenue: {
                    courseRevenue: totalCourseRevenue,
                    shopRevenue: totalShopRevenue,
                    total: totalRevenue
                }
            }
        });
    } catch (error) {
        console.error("Error fetching revenue data:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch revenue data"
        });
    }
}); 

// Admin analytics API: sales timeseries, demographics, trainer overlaps
export const getAnalyticsData = asyncHandler(async (req, res) => {
    try {
        // 1) Time helpers
        const startOfDay = (d) => {
            const x = new Date(d);
            x.setHours(0, 0, 0, 0);
            return x;
        };
        const endOfDay = (d) => {
            const x = new Date(d);
            x.setHours(23, 59, 59, 999);
            return x;
        };

        // 2) Weekly (Mon-Sun of current week)
        const today = new Date();
        const currentDay = today.getDay(); // 0=Sun ... 6=Sat
        const monday = new Date(today);
        monday.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1));
        monday.setHours(0, 0, 0, 0);

        const weekDays = [
            new Date(monday),
            new Date(monday.getTime() + 1 * 86400000),
            new Date(monday.getTime() + 2 * 86400000),
            new Date(monday.getTime() + 3 * 86400000),
            new Date(monday.getTime() + 4 * 86400000),
            new Date(monday.getTime() + 5 * 86400000),
            new Date(monday.getTime() + 6 * 86400000)
        ];
        const weekLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

        const weeklyCourse = [];
        const weeklyShop = [];
        for (let i = 0; i < 7; i++) {
            const dayStart = startOfDay(weekDays[i]);
            const dayEnd = endOfDay(weekDays[i]);

            // Course revenue (exclude shop/refund)
            const courseSumAgg = await Revenue.aggregate([
                { $match: { createdAt: { $gte: dayStart, $lte: dayEnd }, type: { $in: ["enrollment", "renewal", "other"] } } },
                { $group: { _id: null, total: { $sum: "$amount" } } }
            ]);
            const courseSum = courseSumAgg.length ? courseSumAgg[0].total : 0;

            // Shop revenue (prefer Revenue type 'shop'; if none, fallback to Order totals)
            const shopSumAgg = await Revenue.aggregate([
                { $match: { createdAt: { $gte: dayStart, $lte: dayEnd }, type: "shop" } },
                { $group: { _id: null, total: { $sum: "$amount" } } }
            ]);
            let shopSum = shopSumAgg.length ? shopSumAgg[0].total : 0;
            if (shopSum === 0) {
                const orderAgg = await Order.aggregate([
                    { $match: { createdAt: { $gte: dayStart, $lte: dayEnd }, status: { $ne: "Cancelled" } } },
                    { $group: { _id: null, total: { $sum: "$total" } } }
                ]);
                shopSum = orderAgg.length ? orderAgg[0].total : 0;
            }

            weeklyCourse.push(courseSum);
            weeklyShop.push(shopSum);
        }

        // 3) Monthly (last 12 months, inclusive of current month)
        const monthLabels = [];
        const monthlyCourse = [];
        const monthlyShop = [];
        const now = new Date();
        for (let i = 11; i >= 0; i--) {
            const firstDay = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const lastDay = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

            // Label like 'Oct 2025' but short month
            monthLabels.push(firstDay.toLocaleString("en-US", { month: "short" }));

            const courseAgg = await Revenue.aggregate([
                { $match: { createdAt: { $gte: firstDay, $lte: endOfDay(lastDay) }, type: { $in: ["enrollment", "renewal", "other"] } } },
                { $group: { _id: null, total: { $sum: "$amount" } } }
            ]);
            const courseTotal = courseAgg.length ? courseAgg[0].total : 0;

            const shopAgg = await Revenue.aggregate([
                { $match: { createdAt: { $gte: firstDay, $lte: endOfDay(lastDay) }, type: "shop" } },
                { $group: { _id: null, total: { $sum: "$amount" } } }
            ]);
            let shopTotal = shopAgg.length ? shopAgg[0].total : 0;
            if (shopTotal === 0) {
                const orderAgg = await Order.aggregate([
                    { $match: { createdAt: { $gte: firstDay, $lte: endOfDay(lastDay) }, status: { $ne: "Cancelled" } } },
                    { $group: { _id: null, total: { $sum: "$total" } } }
                ]);
                shopTotal = orderAgg.length ? orderAgg[0].total : 0;
            }

            monthlyCourse.push(courseTotal);
            monthlyShop.push(shopTotal);
        }

        // 4) Totals
        const totalCourseAgg = await Revenue.aggregate([
            { $match: { type: { $in: ["enrollment", "renewal", "other"] } } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);
        const totalCourse = totalCourseAgg.length ? totalCourseAgg[0].total : 0;

        let totalShop;
        const totalShopAgg = await Revenue.aggregate([
            { $match: { type: "shop" } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);
        totalShop = totalShopAgg.length ? totalShopAgg[0].total : 0;
        if (totalShop === 0) {
            const orderAgg = await Order.aggregate([
                { $match: { status: { $ne: "Cancelled" } } },
                { $group: { _id: null, total: { $sum: "$total" } } }
            ]);
            totalShop = orderAgg.length ? orderAgg[0].total : 0;
        }

        // 5) Demographics: gender and age histogram (only users)
        const genderCountsAgg = await User.aggregate([
            { $match: { role: "user" } },
            { $group: { _id: { $toLower: { $ifNull: ["$gender", "unknown"] } }, count: { $sum: 1 } } }
        ]);
        const genderCounts = { male: 0, female: 0, other: 0, unknown: 0 };
        genderCountsAgg.forEach(g => {
            if (g._id === "male" || g._id === "m") genderCounts.male += g.count;
            else if (g._id === "female" || g._id === "f") genderCounts.female += g.count;
            else if (g._id && g._id !== "unknown") genderCounts.other += g.count;
            else genderCounts.unknown += g.count;
        });

        // Age histogram bins
        const ageBins = ["0-17", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"];
        const ageCounts = [0, 0, 0, 0, 0, 0, 0];
        const ages = await User.find({ role: "user", age: { $ne: null } }).select("age");
        ages.forEach(({ age }) => {
            const n = Number(age);
            if (!Number.isFinite(n)) return;
            if (n <= 17) ageCounts[0]++;
            else if (n <= 24) ageCounts[1]++;
            else if (n <= 34) ageCounts[2]++;
            else if (n <= 44) ageCounts[3]++;
            else if (n <= 54) ageCounts[4]++;
            else if (n <= 64) ageCounts[5]++;
            else ageCounts[6]++;
        });

        // 6) Trainer-course overlaps (Venn) for yoga, zumba, strength training
        const courses = await Course.find({ name: { $in: ["yoga", "zumba", "strength training"] } }).select("_id name");
        const idByName = Object.fromEntries(courses.map(c => [c.name, c._id.toString()]));
        const trainers = await User.find({ role: "trainer", status: "active" })
            .populate("trainerCourses.course", "name")
            .select("trainerCourses");

        const setYoga = new Set();
        const setZumba = new Set();
        const setStrength = new Set();
        trainers.forEach(t => {
            (t.trainerCourses || []).forEach(reg => {
                const cname = reg.course?.name;
                if (!cname) return;
                const tid = t._id.toString();
                if (cname === "yoga") setYoga.add(tid);
                if (cname === "zumba") setZumba.add(tid);
                if (cname === "strength training") setStrength.add(tid);
            });
        });

        const interSize = (a, b) => {
            let count = 0;
            a.forEach(v => { if (b.has(v)) count++; });
            return count;
        };
        const inter3Size = (a, b, c) => {
            let count = 0;
            a.forEach(v => { if (b.has(v) && c.has(v)) count++; });
            return count;
        };

        const vennData = [
            { sets: ["Yoga"], size: setYoga.size },
            { sets: ["Zumba"], size: setZumba.size },
            { sets: ["Strength"], size: setStrength.size },
            { sets: ["Yoga", "Zumba"], size: interSize(setYoga, setZumba) },
            { sets: ["Yoga", "Strength"], size: interSize(setYoga, setStrength) },
            { sets: ["Zumba", "Strength"], size: interSize(setZumba, setStrength) },
            { sets: ["Yoga", "Zumba", "Strength"], size: inter3Size(setYoga, setZumba, setStrength) }
        ];

        return res.status(200).json({
            success: true,
            data: {
                sales: {
                    weekly: { labels: weekLabels, course: weeklyCourse, shop: weeklyShop },
                    monthly: { labels: monthLabels, course: monthlyCourse, shop: monthlyShop },
                    totals: { course: totalCourse, shop: totalShop, total: totalCourse + totalShop }
                },
                demographics: {
                    gender: genderCounts,
                    ageHistogram: { bins: ageBins, counts: ageCounts }
                },
                trainerVenn: vennData
            }
        });
    } catch (error) {
        console.error("Error in getAnalyticsData:", error);
        return res.status(500).json({ success: false, message: "Failed to fetch analytics" });
    }
});