import { Course } from "../models/course.model.js";
// Import User model - Supporting both default and named export
import User, { User as UserNamed } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
// Import the revenue service
import { recordCourseRevenue } from "../services/revenue.service.js";

// Render the courses page with course and trainer data
export const getCoursesPage = asyncHandler(async (req, res) => {
    try {
        // Get all active courses
        const courses = await Course.find({ isActive: true });
        
        if (!courses || courses.length === 0) {
            console.log("No active courses found");
        } else {
            console.log(`Found ${courses.length} active courses`);
        }
        
        // Get all active trainers
        const trainers = await User.find({ 
            role: "trainer", 
            status: "active" 
        }).populate('trainerCourses.course').select("name email profilePicture bio specializations trainerCourses");
        
        if (!trainers || trainers.length === 0) {
            console.log("No active trainers found");
        } else {
            console.log(`Found ${trainers.length} active trainers`);
            // Log which courses each trainer is registered for
            trainers.forEach(trainer => {
                const registeredCourses = trainer.trainerCourses
                    .filter(tc => tc.status === 'active' && tc.course)
                    .map(tc => tc.course.name || tc.course._id);
                console.log(`Trainer ${trainer.name} registered for courses: ${registeredCourses.join(', ') || 'none'}`);
            });
        }
        
        // Create course specific trainer maps to easily access in template
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
        
        // Render the template with data
        return res.render("pages/courses", {
            title: "Our Courses - FitSync",
            courses: courses || [],
            trainers: trainers || [],
            courseTrainers: courseTrainers || {},
            error: null
        });
    } catch (error) {
        console.error("Error fetching courses page data:", error);
        return res.render("pages/courses", {
            title: "Our Courses - FitSync",
            courses: [],
            trainers: [],
            courseTrainers: {},
            error: "Failed to load courses. Please try again later."
        });
    }
});

// Get all courses
export const getAllCourses = asyncHandler(async (req, res) => {
    const courses = await Course.find({ isActive: true });
    
    return res
        .status(200)
        .json(new ApiResponse(200, courses, "Courses fetched successfully"));
});

// Get course by ID
export const getCourseById = asyncHandler(async (req, res) => {
    const { courseId } = req.params;
    
    const course = await Course.findById(courseId);
    
    if (!course) {
        throw new ApiError(404, "Course not found");
    }
    
    return res
        .status(200)
        .json(new ApiResponse(200, course, "Course fetched successfully"));
});

// Get trainers for a course
export const getCourseTrainers = asyncHandler(async (req, res) => {
    const { courseId } = req.params;
    
    // Log the courseId being requested
    console.log("Fetching trainers for course ID:", courseId);
    
    try {
        // Check if the course exists
        const course = await Course.findById(courseId);
        if (!course) {
            return res.status(404).json(
                new ApiResponse(404, null, "Course not found")
            );
        }

        // Find trainers for this course using aggregation to better handle relationships
        const trainers = await User.aggregate([
            {
                $match: {
                    role: "trainer",
                    status: "active"
                }
            },
            {
                $addFields: {
                    trainerCoursesFiltered: {
                        $filter: {
                            input: "$trainerCourses",
                            as: "course",
                            cond: {
                                $and: [
                                    { $eq: ["$$course.status", "active"] },
                                    { $eq: [{ $toString: "$$course.course" }, courseId.toString()] }
                                ]
                            }
                        }
                    }
                }
            },
            {
                $match: {
                    "trainerCoursesFiltered.0": { $exists: true }
                }
            },
            {
                $project: {
                    _id: 1,
                    name: 1,
                    email: 1,
                    profilePicture: 1,
                    bio: 1
                }
            }
        ]);

        // Fallback to regular query if aggregation doesn't work
        if (!trainers || trainers.length === 0) {
            console.log("No trainers found with aggregation, trying regular query");
            const regularTrainers = await User.find({
                role: "trainer",
                status: "active",
                "trainerCourses.course": courseId,
                "trainerCourses.status": "active"
            }).select("name email profilePicture bio");
            
            console.log(`Found ${regularTrainers.length} trainers with regular query`);
            
            return res
                .status(200)
                .json(new ApiResponse(200, regularTrainers, "Course trainers fetched successfully"));
        }
        
        console.log(`Found ${trainers.length} trainers with aggregation`);
        
        return res
            .status(200)
            .json(new ApiResponse(200, trainers, "Course trainers fetched successfully"));
    } catch (error) {
        console.error("Error fetching trainers:", error);
        return res
            .status(500)
            .json(new ApiResponse(500, null, "Failed to fetch trainers"));
    }
});

// Register as trainer for a course
export const registerAsCourseTrainer = asyncHandler(async (req, res) => {
    const { courseId } = req.params;
    // Get userId from session instead of JWT
    const userId = req.session.userId || req.user?._id;
    
    if (!userId) {
        return res.status(401).json(
            new ApiResponse(401, null, "Authentication required")
        );
    }
    
    console.log(`Registering trainer (${userId}) for course (${courseId})`);
    
    try {
        // Check if the course exists
        const course = await Course.findById(courseId);
        if (!course) {
            return res.status(404).json(
                new ApiResponse(404, null, "Course not found")
            );
        }
        
        // Check if user is a trainer
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json(
                new ApiResponse(404, null, "User not found")
            );
        }
        
        if (user.role !== "trainer") {
            return res.status(403).json(
                new ApiResponse(403, null, "Only trainers can register to teach courses")
            );
        }
        
        // Check if trainer is already registered for this course
        const alreadyRegistered = user.trainerCourses.some(tc => {
            // Handle case where tc.course might be an ObjectId or string
            const tcCourseStr = tc.course ? tc.course.toString() : '';
            const courseIdStr = courseId ? courseId.toString() : '';
            
            return tcCourseStr === courseIdStr && tc.status === "active";
        });
        
        if (alreadyRegistered) {
            return res.status(400).json(
                new ApiResponse(400, null, "You are already registered to teach this course")
            );
        }
        
        // Add the course to trainer's courses
        user.trainerCourses.push({
            course: courseId,
            status: "active"
        });
        
        await user.save();
        
        console.log(`Trainer ${userId} successfully registered for course ${courseId}`);
        
        return res.status(200).json(
            new ApiResponse(200, {}, "Successfully registered as trainer for the course")
        );
    } catch (error) {
        console.error("Error registering trainer:", error);
        return res.status(500).json(
            new ApiResponse(500, null, "Failed to register as trainer: " + error.message)
        );
    }
});

// Enroll in a course (deprecated direct path; enrollment now occurs post-payment via Stripe)
export const enrollInCourse = asyncHandler(async (req, res) => {
    const { courseId, trainerId } = req.body;
    // Get userId from JWT or session
    const userId = req.user?._id || req.session?.userId;
    const userRole = req.user?.role || req.session?.userRole;
    
    if (!userId) {
        return res.status(401).json(
            new ApiResponse(401, null, "Authentication required")
        );
    }
    
    // Verify user role - only regular users (trainees) can enroll
    if (userRole !== "user") {
        return res.status(403).json(
            new ApiResponse(403, null, "Only trainees can enroll in courses")
        );
    }
    
    // Check if the course exists
    const course = await Course.findById(courseId);
    if (!course) {
        return res.status(404).json(
            new ApiResponse(404, null, "Course not found")
        );
    }
    
    // Check if the trainer exists and can teach this course
    const trainer = await User.findById(trainerId);
    if (!trainer) {
        return res.status(404).json(
            new ApiResponse(404, null, "Trainer not found")
        );
    }
    
    const canTeach = await trainer.canTeachCourse(courseId);
    if (!canTeach) {
        return res.status(400).json(
            new ApiResponse(400, null, "This trainer is not registered to teach this course")
        );
    }
    
    // Check if user is already enrolled in this course
    const user = await User.findById(userId);
    if (!user) {
        return res.status(404).json(
            new ApiResponse(404, null, "User not found")
        );
    }
    
    const isEnrolled = user.isEnrolledInCourse(courseId);
    if (isEnrolled) {
        return res.status(400).json(
            new ApiResponse(400, null, "You are already enrolled in this course")
        );
    }
    
    // Calculate enrollment dates (4 weeks from now)
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 28); // 4 weeks
    
    // Add the course to user's enrolled courses
    user.enrolledCourses.push({
        course: courseId,
        trainer: trainerId,
        status: "active",
        startDate,
        endDate
    });
    
    // Also add the user to the trainer's clients
    trainer.trainerClients.push({
        user: userId,
        course: courseId,
        status: "active",
        startDate,
        endDate
    });
    
    // Direct enrollment is disabled; instruct to use Stripe
    return res.status(400).json(new ApiResponse(400, null, "Payment required: start Stripe checkout for enrollment"));
});

// Renew course enrollment for another 4 weeks
export const renewCourseEnrollment = asyncHandler(async (req, res) => {
    const { enrollmentId } = req.params;
    // Support both JWT and session-based auth
    const userId = req.user?._id || req.session?.userId;
    
    const user = await User.findById(userId);
    if (!user) {
        throw new ApiError(404, "User not found");
    }
    
    // Find the enrollment
    const enrollment = user.enrolledCourses.id(enrollmentId);
    if (!enrollment) {
        throw new ApiError(404, "Enrollment not found");
    }
    
    // Check if enrollment is active
    if (enrollment.status !== "active") {
        throw new ApiError(400, "Cannot renew a cancelled or completed enrollment");
    }
    
    // Get the trainer to update their records too
    const trainer = await User.findById(enrollment.trainer);
    if (!trainer) {
        throw new ApiError(404, "Trainer not found");
    }
    
    // Store the course ID for revenue recording
    const courseId = enrollment.course;
    
    // Renew the enrollment for the user
    try {
        await user.renewCourseEnrollment(enrollmentId);
        
        // Get the updated enrollment
        const updatedEnrollment = user.enrolledCourses.id(enrollmentId);
        
        // Now find and update the corresponding entry in the trainer's clients
        const trainerClientEntry = trainer.trainerClients.find(
            client => 
                client.user.toString() === userId.toString() && 
                client.course.toString() === enrollment.course.toString() &&
                client.status === "active"
        );
        
        if (trainerClientEntry) {
            // Update the trainer's client record with new dates
            trainerClientEntry.endDate = updatedEnrollment.endDate;
            await trainer.save();
        }
        
        // Record revenue for this renewal
        try {
            await recordCourseRevenue(
                courseId, 
                userId, 
                "renewal", 
                `Course renewal by ${user.name || userId}`
            );
        } catch (error) {
            console.error("Error recording renewal revenue:", error);
            // Continue with enrollment renewal even if revenue recording fails
        }
        
        return res
            .status(200)
            .json(new ApiResponse(200, {
                enrollmentPeriod: {
                    startDate: updatedEnrollment.startDate,
                    endDate: updatedEnrollment.endDate
                }
            }, "Course enrollment renewed successfully for 4 more weeks"));
    } catch (error) {
        throw new ApiError(500, error.message || "Failed to renew enrollment");
    }
});

// Get user's weekly schedule
export const getUserSchedule = asyncHandler(async (req, res) => {
    // Support both JWT and session-based auth
    const userId = req.user?._id || req.session?.userId;
    
    const user = await User.findById(userId);
    if (!user) {
        throw new ApiError(404, "User not found");
    }
    
    // Get the user's weekly schedule
    const schedule = await user.getWeeklySchedule();
    
    return res
        .status(200)
        .json(new ApiResponse(200, schedule, "User schedule fetched successfully"));
});

// Get user's enrollments
export const getUserEnrollments = asyncHandler(async (req, res) => {
    // Support both JWT and session-based auth
    const userId = req.user?._id || req.session?.userId;
    
    const user = await User.findById(userId)
        .populate("enrolledCourses.course", "name description image")
        .populate("enrolledCourses.trainer", "name");
    
    if (!user) {
        throw new ApiError(404, "User not found");
    }
    
    const now = new Date();
    
    // Format enrollment data for the response
    const enrollments = user.enrolledCourses.map(enrollment => {
        const isExpired = now > enrollment.endDate;
        const daysLeft = isExpired ? 0 : Math.ceil((enrollment.endDate - now) / (1000 * 60 * 60 * 24));
        
        return {
            id: enrollment._id,
            course: enrollment.course,
            trainer: enrollment.trainer,
            status: enrollment.status,
            startDate: enrollment.startDate,
            endDate: enrollment.endDate,
            isExpired,
            daysLeft
        };
    });
    
    return res
        .status(200)
        .json(new ApiResponse(200, enrollments, "User enrollments fetched successfully"));
});

// Cancel course enrollment
export const cancelCourseEnrollment = asyncHandler(async (req, res) => {
    const { enrollmentId } = req.params;
    // Support both JWT and session-based auth
    const userId = req.user?._id || req.session?.userId;
    
    const user = await User.findById(userId);
    if (!user) {
        throw new ApiError(404, "User not found");
    }
    
    // Find the enrollment
    const enrollment = user.enrolledCourses.id(enrollmentId);
    if (!enrollment) {
        throw new ApiError(404, "Enrollment not found");
    }
    
    // Get the trainer to update their records too
    const trainer = await User.findById(enrollment.trainer);
    if (!trainer) {
        throw new ApiError(404, "Trainer not found");
    }
    
    // Update enrollment status
    enrollment.status = "cancelled";
    
    // Also update the corresponding entry in the trainer's clients
    const trainerClientEntry = trainer.trainerClients.find(
        client => 
            client.user.toString() === userId.toString() && 
            client.course.toString() === enrollment.course.toString() &&
            client.status === "active"
    );
    
    if (trainerClientEntry) {
        trainerClientEntry.status = "cancelled";
        await trainer.save();
    }
    
    await user.save();
    
    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Course enrollment cancelled successfully"));
});

// Render the trainer registration page
export const getTrainerRegistrationPage = asyncHandler(async (req, res) => {
    try {
        // Get all active courses
        const courses = await Course.find({ isActive: true });
        
        // Get trainer's current registered courses
        const trainerId = req.session?.userId || req.user?._id;
        const trainer = await User.findById(trainerId)
            .populate("trainerCourses.course", "name description schedule");
        
        if (!trainer || trainer.role !== "trainer") {
            return res.status(403).render("pages/error", {
                title: "Access Denied - FitSync",
                statusCode: 403,
                message: "Only trainers can register to teach courses"
            });
        }
        
        // Create a map of courses the trainer is already registered for
        const registeredCourses = {};
        trainer.trainerCourses.forEach(registration => {
            if (registration.course && registration.status === "active") {
                registeredCourses[registration.course._id.toString()] = true;
            }
        });
        
        // Render the trainer registration page
        return res.render("pages/trainer-registration", {
            title: "Register to Teach Courses - FitSync",
            courses,
            trainer,
            registeredCourses
        });
    } catch (error) {
        console.error("Error fetching trainer registration page:", error);
        return res.render("pages/error", {
            title: "Error - FitSync",
            statusCode: 500,
            message: "Failed to load trainer registration page. Please try again later."
        });
    }
}); 