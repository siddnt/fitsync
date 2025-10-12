import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import Review from "../models/review.model.js";
import User from "../models/user.model.js";
import { Course } from "../models/course.model.js";

// Get all reviews for a course
export const getCourseReviews = asyncHandler(async (req, res) => {
    const { courseId } = req.params;
    
    console.log(`DEBUG: Getting all reviews for course ${courseId}`);
    console.log(`DEBUG: Auth info - User logged in: ${!!req.session.userId}, Role: ${req.session.userRole || 'none'}`);
    
    try {
        // Validate course exists
        const course = await Course.findById(courseId);
        if (!course) {
            console.log(`DEBUG: Course ${courseId} not found`);
            throw new ApiError(404, "Course not found");
        }
        
        // Get reviews with user details
        const reviews = await Review.find({ course: courseId })
            .populate("user", "name profilePicture")
            .sort({ createdAt: -1 })
            .limit(20);
        
        console.log(`DEBUG: Found ${reviews.length} reviews for course ${courseId}`);
        
        res.status(200).json(
            new ApiResponse(200, reviews, "Reviews fetched successfully")
        );
    } catch (error) {
        console.error("ERROR LOG: ", error);
        // If this is a CastError (invalid ObjectId), return a 400 error
        if (error.name === 'CastError' && error.kind === 'ObjectId') {
            return res.status(400).json(
                new ApiResponse(400, null, "Invalid course ID format")
            );
        }
        throw error;
    }
});

// Get top reviews for a course (for course details page)
export const getTopCourseReviews = asyncHandler(async (req, res) => {
    const { courseId } = req.params;
    const limit = req.query.limit || 3;
    
    console.log(`DEBUG: Getting top reviews for course ${courseId} with limit ${limit}`);
    console.log(`DEBUG: Auth info - User logged in: ${!!req.session.userId}, Role: ${req.session.userRole || 'none'}`);
    
    try {
        // Validate course exists
        const course = await Course.findById(courseId);
        if (!course) {
            console.log(`DEBUG: Course ${courseId} not found`);
            throw new ApiError(404, "Course not found");
        }
        
        // Get top reviews sorted by rating (highest first)
        const reviews = await Review.find({ course: courseId })
            .populate("user", "name profilePicture")
            .sort({ rating: -1, createdAt: -1 })
            .limit(parseInt(limit));
        
        console.log(`DEBUG: Found ${reviews.length} reviews for course ${courseId}`);
        
        return res.status(200).json(
            new ApiResponse(200, reviews, "Top reviews fetched successfully")
        );
    } catch (error) {
        console.error("ERROR LOG: ", error);
        // If this is a CastError (invalid ObjectId), return a 400 error
        if (error.name === 'CastError' && error.kind === 'ObjectId') {
            return res.status(400).json(
                new ApiResponse(400, null, "Invalid course ID format")
            );
        }
        throw error;
    }
});

// Create new review
export const createReview = asyncHandler(async (req, res) => {
    const { courseId, rating, comment } = req.body;
    const userId = req.session.userId;
    
    // Validate inputs
    if (!courseId || !rating || !comment) {
        throw new ApiError(400, "CourseId, rating, and comment are required");
    }
    
    // Validate rating
    if (rating < 1 || rating > 5) {
        throw new ApiError(400, "Rating must be between 1 and 5");
    }
    
    // Validate course exists
    const course = await Course.findById(courseId);
    if (!course) {
        throw new ApiError(404, "Course not found");
    }
    
    // Check if user is enrolled in this course
    const user = await User.findById(userId);
    if (!user) {
        throw new ApiError(404, "User not found");
    }
    
    const isEnrolled = user.enrolledCourses.some(enrollment => 
        enrollment.course.toString() === courseId && 
        enrollment.status === "active"
    );
    
    if (!isEnrolled) {
        throw new ApiError(403, "You can only review courses you are enrolled in");
    }
    
    // Check if user has already reviewed this course
    const existingReview = await Review.findOne({
        user: userId,
        course: courseId
    });
    
    if (existingReview) {
        throw new ApiError(400, "You have already reviewed this course");
    }
    
    // Create review
    const review = await Review.create({
        user: userId,
        course: courseId,
        rating: parseInt(rating),
        comment
    });
    
    // Check if this is an API request by looking for the Accept header or X-Requested-With
    const isApiRequest = req.headers['accept'] === 'application/json' || 
                         req.headers['content-type'] === 'application/json' ||
                         req.headers['x-requested-with'] === 'XMLHttpRequest';
    
    if (isApiRequest) {
        return res.status(201).json(
            new ApiResponse(201, review, "Review created successfully")
        );
    }
    
    // Handle form submission
    return res.redirect(`/user/dashboard?success=Review submitted successfully`);
});

// Update review
export const updateReview = asyncHandler(async (req, res) => {
    const { reviewId } = req.params;
    const { rating, comment } = req.body;
    const userId = req.session.userId;
    
    // Validate inputs
    if (!rating && !comment) {
        throw new ApiError(400, "Rating or comment must be provided");
    }
    
    // Validate rating if provided
    if (rating && (rating < 1 || rating > 5)) {
        throw new ApiError(400, "Rating must be between 1 and 5");
    }
    
    // Get review
    const review = await Review.findById(reviewId);
    if (!review) {
        throw new ApiError(404, "Review not found");
    }
    
    // Check if user owns this review
    if (review.user.toString() !== userId) {
        throw new ApiError(403, "You can only update your own reviews");
    }
    
    // Update review
    if (rating) review.rating = parseInt(rating);
    if (comment) review.comment = comment;
    
    await review.save();
    
    // Check if this is an API request
    const isApiRequest = req.headers['accept'] === 'application/json' || 
                         req.headers['content-type'] === 'application/json' ||
                         req.headers['x-requested-with'] === 'XMLHttpRequest';
    
    if (isApiRequest) {
        return res.status(200).json(
            new ApiResponse(200, review, "Review updated successfully")
        );
    }
    
    // Handle form submission
    return res.redirect(`/user/dashboard?success=Review updated successfully`);
});

// Delete review
export const deleteReview = asyncHandler(async (req, res) => {
    const { reviewId } = req.params;
    const userId = req.session.userId;
    
    // Get review
    const review = await Review.findById(reviewId);
    if (!review) {
        throw new ApiError(404, "Review not found");
    }
    
    // Check if user owns this review
    if (review.user.toString() !== userId) {
        throw new ApiError(403, "You can only delete your own reviews");
    }
    
    // Delete review
    await review.remove();
    
    // Check if this is an API request
    const isApiRequest = req.headers['accept'] === 'application/json' || 
                         req.headers['content-type'] === 'application/json' ||
                         req.headers['x-requested-with'] === 'XMLHttpRequest';
    
    if (isApiRequest) {
        return res.status(200).json(
            new ApiResponse(200, {}, "Review deleted successfully")
        );
    }
    
    // Handle form submission
    return res.redirect(`/user/dashboard?success=Review deleted successfully`);
});

// Get user reviews (for user dashboard)
export const getUserReviews = asyncHandler(async (req, res) => {
    const userId = req.session.userId;
    
    // Get user reviews with course details
    const reviews = await Review.find({ user: userId })
        .populate("course", "name")
        .sort({ createdAt: -1 });
    
    return res.status(200).json(
        new ApiResponse(200, reviews, "User reviews fetched successfully")
    );
}); 