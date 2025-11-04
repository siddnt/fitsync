import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import User from "../models/user.model.js";
import Plan from "../models/plan.model.js";
import Booking from "../models/booking.model.js";
import { getPlanById } from "../config/plans.config.js";
import mongoose from "mongoose";

// Get user dashboard
export const getDashboard = asyncHandler(async (req, res) => {
    const userId = req.session.userId;
    
    // Get user details with populated course data
    const user = await User.findById(userId)
        .populate({
            path: "enrolledCourses.course",
            select: "name description image price schedule"
        })
        .populate({
            path: "enrolledCourses.trainer",
            select: "name email profilePicture"
        });
    
    if (!user) {
        throw new ApiError(404, "User not found");
    }
    
    // Get user's active bookings
    const activeBookings = await Booking.find({ 
        user: userId,
        status: { $in: ["pending", "confirmed"] },
        startTime: { $gte: new Date() }
    })
    .sort({ startTime: 1 })
    .populate("trainer", "name");
    
    // Enhance enrolled plans with static plan data
    const enrolledPlans = [];
    if (user.enrolledPlans && user.enrolledPlans.length > 0) {
        user.enrolledPlans.forEach(enrollment => {
            // Get the static plan data
            const planId = enrollment.plan.toString();
            const plan = getPlanById(planId);
            
            if (plan) {
                enrolledPlans.push({
                    plan: plan,
                    enrolledAt: enrollment.enrolledAt,
                    status: enrollment.status
                });
            }
        });
    }
    
    // Process enrolled courses
    const now = new Date();
    const enrolledCourses = user.enrolledCourses
        .map(enrollment => {
            const isActive = enrollment.status === "active" && 
                            enrollment.startDate <= now &&
                            enrollment.endDate >= now;
                           
            const daysLeft = isActive ? 
                Math.ceil((enrollment.endDate - now) / (1000 * 60 * 60 * 24)) : 0;
                
            return {
                ...enrollment.toObject(),
                isActive,
                daysLeft,
                courseName: enrollment.course?.name || "Unknown Course",
                courseImage: enrollment.course?.image || "default.jpg",
                courseSchedule: enrollment.course?.schedule || [],
                trainerName: enrollment.trainer?.name || "No trainer assigned"
            };
        })
        .filter(enrollment => enrollment.status !== "cancelled");
    
    // Get user's reviews (if any)
    let userReviews = [];
    try {
        // Check if Review model is available (this requires the Review model to be loaded)
        const Review = mongoose.model('Review');
        userReviews = await Review.find({ user: userId })
            .populate("course", "name")
            .sort({ createdAt: -1 });
    } catch (error) {
        console.log("Reviews not available yet:", error.message);
    }
    
    res.render("pages/userDashboard", {
        title: "User Dashboard - FitSync",
        user: {
            ...user.toObject(),
            enrolledPlans
        },
        enrolledCourses,
        activeBookings,
        userReviews,
        isLoggedIn: true,
        userRole: req.session.userRole,
        userId: req.session.userId
    });
});

// Get user profile page
export const getProfile = asyncHandler(async (req, res) => {
    const userId = req.session.userId;
    
    // Get user details
    const user = await User.findById(userId);
    
    if (!user) {
        throw new ApiError(404, "User not found");
    }
    
    res.render("pages/editProfile", {
        title: "My Profile - FitSync",
        user,
        success: req.query.success || null,
        error: req.query.error || null
    });
});

// Update user profile
export const updateProfile = asyncHandler(async (req, res) => {
    const userId = req.session.userId;
    const {
        name,
        email,
        bio,
        contactNumber,
        address,
        height,
        weight,
        age,
        gender,
        fitnessGoals = []
    } = req.body;
    
    // Convert fitnessGoals to array if it's a string
    const goalsArray = Array.isArray(fitnessGoals) 
        ? fitnessGoals 
        : fitnessGoals.split(',').map(goal => goal.trim());
    
    // Find user
    const user = await User.findById(userId);
    if (!user) {
        throw new ApiError(404, "User not found");
    }
    
    // Update fields
    if (name) user.name = name;
    if (email) user.email = email;
    if (bio) user.bio = bio;
    if (contactNumber) user.contactNumber = contactNumber;
    if (address) user.address = address;
    if (height) user.height = height;
    if (weight) user.weight = weight;
    if (age) user.age = age;
    if (gender) user.gender = gender;
    if (goalsArray.length > 0) user.fitnessGoals = goalsArray;
    
    // Save user
    await user.save();
    
    // Handle API or form submission
    if (req.headers['content-type'] === 'application/json') {
        return res.status(200).json(
            new ApiResponse(200, user, "Profile updated successfully")
        );
    } else {
        return res.redirect("/user/profile?success=Profile updated successfully");
    }
});

// // Get user's enrolled plans
// export const getEnrolledPlans = asyncHandler(async (req, res) => {
//     const userId = req.session.userId;
    
//     // Get user with enrolled plans
//     const user = await User.findById(userId)
//         .populate({
//             path: "enrolledPlans.plan",
//             populate: {
//                 path: "creator",
//                 select: "name"
//             }
//         });
    
//     if (!user) {
//         throw new ApiError(404, "User not found");
//     }
    
//     res.render("pages/courses", {
//         title: "My Plans - FitSync",
//         enrolledPlans: user.enrolledPlans,
//         isUser: true
//     });
// });

// // Enroll in a plan
// export const enrollInPlan = asyncHandler(async (req, res) => {
//     const userId = req.session.userId;
//     const { planId } = req.params;
    
//     // Find plan
//     const plan = await Plan.findById(planId);
//     if (!plan) {
//         throw new ApiError(404, "Plan not found");
//     }
    
//     // Check if plan is active
//     if (!plan.isActive) {
//         throw new ApiError(400, "This plan is currently unavailable");
//     }
    
//     // Find user
//     const user = await User.findById(userId);
//     if (!user) {
//         throw new ApiError(404, "User not found");
//     }
    
//     // Check if already enrolled
//     const isEnrolled = user.enrolledPlans.some(
//         enrollment => enrollment.plan.toString() === planId
//     );
    
//     if (isEnrolled) {
//         throw new ApiError(400, "Already enrolled in this plan");
//     }
    
//     // Add to enrolled plans
//     user.enrolledPlans.push({
//         plan: planId,
//         enrolledAt: new Date(),
//         status: "active"
//     });
    
//     await user.save();
    
//     // Increment enrollment count
//     plan.enrollmentCount += 1;
//     await plan.save();
    
//     // Handle API or form submission
//     if (req.headers['content-type'] === 'application/json') {
//         return res.status(200).json(
//             new ApiResponse(200, { plan }, "Successfully enrolled in plan")
//         );
//     } else {
//         return res.redirect("/user/plans");
//     }
// });

// Get user's bookings
// export const getBookings = asyncHandler(async (req, res) => {
//     const userId = req.session.userId;
    
//     // Get user's bookings
//     const bookings = await Booking.find({ user: userId })
//         .sort({ startTime: -1 })
//         .populate("trainer", "name profilePicture");
    
//     // Separate upcoming and past bookings
//     const now = new Date();
//     const upcomingBookings = bookings.filter(booking => 
//         new Date(booking.startTime) > now && 
//         booking.status !== "cancelled"
//     );
    
//     const pastBookings = bookings.filter(booking => 
//         new Date(booking.startTime) <= now || 
//         booking.status === "cancelled"
//     );
    
//     res.render("pages/user-bookings", {
//         title: "My Bookings - FitSync",
//         upcomingBookings,
//         pastBookings,
//         isUser: true,
//         isLoggedIn: true,
//         userRole: req.session.userRole,
//         userId: req.session.userId
//     });
// });

// // Create new booking
// export const createBooking = asyncHandler(async (req, res) => {
//     const userId = req.session.userId;
//     const { trainerId, planId, startDate, startTime, notes } = req.body;
    
//     // Validate trainer exists
//     const trainer = await User.findOne({ 
//         _id: trainerId,
//         role: "trainer",
//         status: "active"
//     });
    
//     if (!trainer) {
//         throw new ApiError(404, "Trainer not found or not available");
//     }
    
//     // Get plan from static config
//     const plan = getPlanById(planId);
//     if (!plan) {
//         throw new ApiError(404, "Plan not found");
//     }
    
//     // Combine date and time for startTime
//     const startDateTime = new Date(`${startDate}T${startTime}`);
//     if (isNaN(startDateTime.getTime())) {
//         throw new ApiError(400, "Invalid date or time format");
//     }
    
//     // Calculate endTime (1 hour session)
//     const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);
    
//     // Check if booking is in the past
//     if (startDateTime <= new Date()) {
//         throw new ApiError(400, "Cannot book sessions in the past");
//     }
    
//     // Check for conflicts
//     const conflictingBookings = await Booking.find({
//         trainer: trainerId,
//         status: { $nin: ["cancelled"] },
//         $or: [
//             {
//                 startTime: { $lt: endDateTime },
//                 endTime: { $gt: startDateTime }
//             }
//         ]
//     });
    
//     if (conflictingBookings.length > 0) {
//         throw new ApiError(400, "This time slot is already booked");
//     }
    
//     // Create booking
//     const booking = await Booking.create({
//         user: userId,
//         trainer: trainerId,
//         planId: planId,
//         planTitle: plan.title,
//         startTime: startDateTime,
//         endTime: endDateTime,
//         notes: notes || "",
//         status: "pending"
//     });
    
//     // Add the plan to user's enrolled plans if not already enrolled
//     await User.findByIdAndUpdate(
//         userId,
//         {
//             $addToSet: {
//                 enrolledPlans: {
//                     plan: planId,
//                     enrolledAt: new Date(),
//                     status: "active"
//                 }
//             }
//         }
//     );
    
//     // Handle API or form submission
//     if (req.headers['content-type'] === 'application/json') {
//         return res.status(201).json(
//             new ApiResponse(201, { booking }, "Booking created successfully")
//         );
//     } else {
//         return res.redirect("/user/dashboard?success=Booking created successfully");
//     }
// });

// Cancel booking
// export const cancelBooking = asyncHandler(async (req, res) => {
//     const userId = req.session.userId;
//     const { bookingId } = req.params;
//     const { cancellationReason } = req.body;
    
//     // Find booking
//     const booking = await Booking.findOne({
//         _id: bookingId,
//         user: userId,
//         status: { $nin: ["cancelled", "completed"] }
//     });
    
//     if (!booking) {
//         throw new ApiError(404, "Booking not found or cannot be cancelled");
//     }
    
//     // Check if booking is in the future
//     if (new Date(booking.startTime) <= new Date()) {
//         throw new ApiError(400, "Cannot cancel past or ongoing bookings");
//     }
    
//     // Update booking
//     booking.status = "cancelled";
//     booking.cancellationReason = cancellationReason || "Cancelled by user";
//     await booking.save();
    
//     // Handle API or form submission
//     if (req.headers['content-type'] === 'application/json') {
//         return res.status(200).json(
//             new ApiResponse(200, { booking }, "Booking cancelled successfully")
//         );
//     } else {
//         return res.redirect("/user/bookings");
//     }
// });

// Get bookings form
// export const getBookingForm = asyncHandler(async (req, res) => {
//     const userId = req.session.userId;
//     const { planId } = req.params;
    
//     try {
//         // Get plan from static config
//         const plan = getPlanById(planId);
        
//         if (!plan) {
//             return res.render("pages/error", {
//                 title: "Plan not found - FitSync",
//                 statusCode: 404,
//                 message: "The requested fitness plan could not be found. Please return to the courses page and try again."
//             });
//         }
        
//         // Get available trainers
//         const trainers = await User.find({ 
//             role: "trainer",
//             status: "active"
//         }).select("name profilePicture specializations rating");
        
//         res.render("pages/booking", {
//             title: "Book Session - FitSync",
//             plan,
//             trainers,
//             isLoggedIn: true,
//             userRole: req.session.userRole,
//             userId: req.session.userId
//         });
//     } catch (error) {
//         console.error("Error loading booking form:", error);
//         return res.render("pages/error", {
//             title: "Error - FitSync",
//             statusCode: 500,
//             message: error.message || "An error occurred while processing your request."
//         });
//     }
// });

// Cancel enrollment
// export const cancelEnrollment = asyncHandler(async (req, res) => {
//     const userId = req.session.userId;
//     const { planId } = req.params;
    
//     // Find user
//     const user = await User.findById(userId);
//     if (!user) {
//         throw new ApiError(404, "User not found");
//     }
    
//     // Check if enrolled - handle both string plan IDs and plan objects
//     const enrollmentIndex = user.enrolledPlans.findIndex(
//         enrollment => {
//             const enrollmentPlanId = enrollment.plan.toString();
//             // Directly compare with planId for string case
//             if (enrollmentPlanId === planId) {
//                 return true;
//             }
            
//             // Try to handle case when the id is stored in plan.id
//             return false;
//         }
//     );
    
//     if (enrollmentIndex === -1) {
//         // Try to find the plan in the static plans
//         const staticPlan = getPlanById(planId);
//         if (!staticPlan) {
//             throw new ApiError(400, "Not enrolled in this plan");
//         }
        
//         // Search again using the static plan's ID
//         const enrollmentIndex = user.enrolledPlans.findIndex(
//             enrollment => enrollment.plan.toString() === staticPlan.id
//         );
        
//         if (enrollmentIndex === -1) {
//             throw new ApiError(400, "Not enrolled in this plan");
//         } else {
//             // Remove from enrolled plans
//             user.enrolledPlans.splice(enrollmentIndex, 1);
//         }
//     } else {
//         // Remove from enrolled plans if found
//         user.enrolledPlans.splice(enrollmentIndex, 1);
//     }
    
//     await user.save();
    
//     // Decrement enrollment count in the plan if it exists in database
//     try {
//         const databasePlan = await Plan.findById(planId);
//         if (databasePlan) {
//             databasePlan.enrollmentCount = Math.max(0, databasePlan.enrollmentCount - 1);
//             await databasePlan.save();
//         }
//     } catch (error) {
//         console.error("Error updating plan enrollment count:", error);
//         // Continue even if there's an error updating the plan
//     }
    
//     // Handle API or form submission
//     if (req.headers['content-type'] === 'application/json') {
//         return res.status(200).json(
//             new ApiResponse(200, {}, "Successfully unenrolled from plan")
//         );
//     } else {
//         return res.redirect("/user/dashboard?success=Successfully unenrolled from plan");
//     }
// }); 