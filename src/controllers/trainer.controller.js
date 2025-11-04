import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import User from "../models/user.model.js";
import Plan from "../models/plan.model.js";
import Booking from "../models/booking.model.js";

// Get trainer dashboard
export const getDashboard = asyncHandler(async (req, res) => {
    const trainerId = req.session?.userId;
    if (!trainerId) {
        // Session guard should normally prevent this for HTML requests
        return res.redirect("/auth/login");
    }
    
    // Get trainer details
    const trainer = await User.findById(trainerId);
    
    if (!trainer || trainer.role !== "trainer") {
        throw new ApiError(403, "Access denied");
    }
    
    // Get trainer's weekly schedule 
    const schedule = await trainer.getWeeklySchedule();
    
    // Prepare weekly schedule in a tabular format
    const weeklySchedule = [];
    
    // Define days order for sorting
    const dayOrder = {
        "monday": 1,
        "tuesday": 2,
        "wednesday": 3,
        "thursday": 4,
        "friday": 5,
        "saturday": 6,
        "sunday": 7
    };
    
    // Helper function to format time for sorting
    function timeToMinutes(timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    }
    
    // Flatten schedule into an array with day information
    const allSessions = [];
    
    Object.entries(schedule).forEach(([day, sessions]) => {
        sessions.forEach(session => {
            allSessions.push({
                ...session, // spread operator to include session details
                day
            });
        });
    });
    
    // Sort by day and time
    const sortedSessions = allSessions.sort((a, b) => {
        // First sort by day
        const dayDiff = dayOrder[a.day] - dayOrder[b.day];
        if (dayDiff !== 0) return dayDiff;
        
        // Then sort by time
        return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
    });
    
    // Add to weekly schedule with serial numbers
    sortedSessions.forEach((session, index) => {
        weeklySchedule.push({
            sno: index + 1,
            day: session.day.charAt(0).toUpperCase() + session.day.slice(1),
            time: `${session.startTime} - ${session.endTime}`,
            course: session.courseName
        });
    });
    
    // Get trainer's clients
    let clients = [];
    try {
        clients = await trainer.getTrainerClients();
    } catch (e) {
        clients = [];
    }
    
    // Get upcoming bookings
    const upcomingBookings = await Booking.find({
        trainer: trainerId,
        status: { $in: ["pending", "confirmed"] },
        startTime: { $gte: new Date() }
    })
    .sort({ startTime: 1 })
    .populate("user", "name profilePicture");
    
    // Format today's schedule
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todayBookings = upcomingBookings.filter(booking => {
        const bookingDate = new Date(booking.startTime);
        return bookingDate >= today && bookingDate < tomorrow;
    });
    
    const formattedSchedule = todayBookings.map(booking => ({
        time: new Date(booking.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        client: booking.user.name,
        program: booking.planTitle || "Custom Session",
        id: booking._id
    }));
    
    // Get total stats
    const totalBookings = await Booking.countDocuments({ trainer: trainerId });
    const pendingBookings = await Booking.countDocuments({ 
        trainer: trainerId, 
        status: "pending" 
    });
    const completedBookings = await Booking.countDocuments({ 
        trainer: trainerId, 
        status: "completed" 
    });
    
    // Calculate sessions from weekly schedule
    // Get today's day of the week (lowercase)
    const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayWeekday = daysOfWeek[new Date().getDay()];
    
    // Count sessions from the weekly schedule
    const todaySessionsCount = weeklySchedule.filter(
        session => session.day.toLowerCase() === todayWeekday
    ).length;
    
    // Total sessions count from the weekly schedule
    const totalSessionsCount = weeklySchedule.length;
    
    // Final output with enhanced stats
    res.render("pages/trainerDashboard", {
        title: "Trainer Dashboard - FitSync",
        userName: trainer.name,
        todaySchedule: formattedSchedule,
        weeklySchedule: weeklySchedule,
        clients: clients,
        stats: {
            totalBookings: totalSessionsCount, // Use weekly schedule count instead of bookings
            todayBookings: todaySessionsCount, // Use today's sessions from weekly schedule
            pendingBookings,
            completedBookings,
            clientCount: clients.length
        },
        isLoggedIn: true,
        userRole: req.session.userRole,
        userId: req.session.userId
    });
});

// Get trainer profile page
export const getProfile = asyncHandler(async (req, res) => {
    const trainerId = req.session.userId;
    
    // Get trainer details
    const trainer = await User.findById(trainerId);
    
    if (!trainer || trainer.role !== "trainer") {
        throw new ApiError(403, "Access denied");
    }
    
    res.render("pages/editProfile", {
        title: "Trainer Profile - FitSync",
        user: trainer,
        success: req.query.success || null,
        error: req.query.error || null
    });
});

// Update trainer profile
export const updateProfile = asyncHandler(async (req, res) => {
    const trainerId = req.session.userId;
    const {
        name,
        email,
        bio,
        contactNumber,
        address,
        specializations = []
    } = req.body;
    
    // Convert specializations to array if it's a string
    const specializationsArray = Array.isArray(specializations) 
        ? specializations 
        : specializations.split(',').map(spec => spec.trim());
    
    // Find trainer
    const trainer = await User.findById(trainerId);
    if (!trainer || trainer.role !== "trainer") {
        throw new ApiError(403, "Access denied");
    }
    
    // Update fields
    if (name) trainer.name = name;
    if (email) trainer.email = email;
    if (bio) trainer.bio = bio;
    if (contactNumber) trainer.contactNumber = contactNumber;
    if (address) trainer.address = address;
    if (specializationsArray.length > 0) trainer.specializations = specializationsArray;
    
    // Save trainer
    await trainer.save();
    
    // Handle API or form submission
    if (req.headers['content-type'] === 'application/json') {
        return res.status(200).json(
            new ApiResponse(200, trainer, "Profile updated successfully")
        );
    } else {
        return res.redirect("/trainer/profile?success=Profile updated successfully");
    }
});

// Empty upload profile picture function to maintain compatibility with imports
export const uploadProfilePicture = asyncHandler(async (req, res) => {
    // This function is kept empty as profile picture functionality is removed
    return res.redirect("/trainer/profile?message=Profile picture functionality is disabled");
});

// Get trainer's plans
// export const getPlans = asyncHandler(async (req, res) => {
//     const trainerId = req.session.userId;
    
//     // Get plans
//     const plans = await Plan.find({ creator: trainerId })
//         .sort({ createdAt: -1 });
    
//     res.render("pages/courses", {
//         title: "My Fitness Plans - FitSync",
//         plans,
//         isTrainer: true
//     });
// });

// Create new plan
// export const createPlan = asyncHandler(async (req, res) => {
//     const trainerId = req.session.userId;
//     const {
//         title,
//         description,
//         price,
//         duration,
//         durationUnit,
//         level,
//         category,
//         workouts = []
//     } = req.body;
    
//     // Validation
//     if (!title || !description || price === undefined || !duration || !category) {
//         throw new ApiError(400, "Required fields are missing");
//     }
    
//     // Create plan
//     const plan = await Plan.create({
//         title,
//         description,
//         price: Number(price),
//         duration: {
//             value: Number(duration),
//             unit: durationUnit || "months"
//         },
//         level: level || "all",
//         category,
//         creator: trainerId,
//         workouts: workouts || []
//     });
    
//     // Handle API or form submission
//     if (req.headers['content-type'] === 'application/json') {
//         return res.status(201).json(
//             new ApiResponse(201, plan, "Plan created successfully")
//         );
//     } else {
//         return res.redirect("/trainer/plans");
//     }
// });

// // Get plan details
// export const getPlan = asyncHandler(async (req, res) => {
//     const trainerId = req.session.userId;
//     const { planId } = req.params;
    
//     // Get plan
//     const plan = await Plan.findOne({
//         _id: planId,
//         creator: trainerId
//     });
    
//     if (!plan) {
//         throw new ApiError(404, "Plan not found");
//     }
    
//     res.render("pages/courses", {
//         title: `${plan.title} - FitSync`,
//         plan,
//         isTrainer: true
//     });
// });

// // Update plan
// export const updatePlan = asyncHandler(async (req, res) => {
//     const trainerId = req.session.userId;
//     const { planId } = req.params;
//     const {
//         title,
//         description,
//         price,
//         duration,
//         durationUnit,
//         level,
//         category,
//         isActive,
//         workouts = []
//     } = req.body;
    
//     // Get plan
//     const plan = await Plan.findOne({
//         _id: planId,
//         creator: trainerId
//     });
    
//     if (!plan) {
//         throw new ApiError(404, "Plan not found");
//     }
    
//     // Update fields
//     if (title) plan.title = title;
//     if (description) plan.description = description;
//     if (price !== undefined) plan.price = Number(price);
//     if (duration) {
//         plan.duration.value = Number(duration);
//         if (durationUnit) plan.duration.unit = durationUnit;
//     }
//     if (level) plan.level = level;
//     if (category) plan.category = category;
//     if (isActive !== undefined) plan.isActive = isActive === 'true' || isActive === true;
//     if (workouts.length > 0) plan.workouts = workouts;
    
//     // Save plan
//     await plan.save();
    
//     // Handle API or form submission
//     if (req.headers['content-type'] === 'application/json') {
//         return res.status(200).json(
//             new ApiResponse(200, plan, "Plan updated successfully")
//         );
//     } else {
//         return res.redirect(`/trainer/plans/${planId}?success=Plan updated successfully`);
//     }
// });

// // Delete plan
// export const deletePlan = asyncHandler(async (req, res) => {
//     const trainerId = req.session.userId;
//     const { planId } = req.params;
    
//     // Get plan
//     const plan = await Plan.findOne({
//         _id: planId,
//         creator: trainerId
//     });
    
//     if (!plan) {
//         throw new ApiError(404, "Plan not found");
//     }
    
//     // Check if anyone is enrolled
//     if (plan.enrollmentCount > 0) {
//         // Set to inactive instead of deleting
//         plan.isActive = false;
//         await plan.save();
//     } else {
//         // Delete plan if no enrollments
//         await Plan.findByIdAndDelete(planId);
//     }
    
//     // Handle API or form submission
//     if (req.headers['content-type'] === 'application/json') {
//         return res.status(200).json(
//             new ApiResponse(200, {}, "Plan deleted successfully")
//         );
//     } else {
//         return res.redirect("/trainer/plans");
//     }
// });

// // Get trainer's bookings
// export const getBookings = asyncHandler(async (req, res) => {
//     const trainerId = req.session.userId;
    
//     // Get bookings
//     const bookings = await Booking.find({ trainer: trainerId })
//         .sort({ startTime: -1 })
//         .populate("user", "name profilePicture");
    
//     // Separate upcoming and past bookings
//     const now = new Date();
//     const pendingBookings = bookings.filter(booking => 
//         booking.status === "pending"
//     );
    
//     const upcomingBookings = bookings.filter(booking => 
//         new Date(booking.startTime) > now && 
//         booking.status === "confirmed"
//     );
    
//     const pastBookings = bookings.filter(booking => 
//         new Date(booking.startTime) <= now || 
//         booking.status === "cancelled"
//     );
    
//     res.render("pages/trainer-bookings", {
//         title: "My Bookings - FitSync",
//         pendingBookings,
//         upcomingBookings,
//         pastBookings,
//         isTrainer: true,
//         isLoggedIn: true,
//         userRole: req.session.userRole,
//         userId: req.session.userId
//     });
// });

// // Update booking status
// export const updateBookingStatus = asyncHandler(async (req, res) => {
//     const trainerId = req.session.userId;
//     const { bookingId } = req.params;
//     const { status, notes } = req.body;
    
//     // Validate status
//     if (!status || !["pending", "confirmed", "cancelled", "completed"].includes(status)) {
//         throw new ApiError(400, "Invalid status");
//     }
    
//     // Find booking
//     const booking = await Booking.findOne({
//         _id: bookingId,
//         trainer: trainerId
//     });
    
//     if (!booking) {
//         throw new ApiError(404, "Booking not found");
//     }
    
//     // Update booking
//     booking.status = status;
//     if (notes) booking.notes = notes;
//     await booking.save();
    
//     // Handle API or form submission
//     if (req.headers['content-type'] === 'application/json') {
//         return res.status(200).json(
//             new ApiResponse(200, { booking }, "Booking updated successfully")
//         );
//     } else {
//         return res.redirect("/trainer/bookings?success=Booking status updated successfully");
//     }
// }); 