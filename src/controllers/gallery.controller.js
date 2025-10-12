import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import Gallery from "../models/gallery.model.js";
import User from "../models/user.model.js";
import { Course } from "../models/course.model.js";
import { getFileUrl } from "../utils/fileUpload.js";

// Get gallery page with all public images
export const getGalleryPage = asyncHandler(async (req, res) => {
    const images = await Gallery.getPublicImages();
    
    // Group images by category
    const categorizedImages = {
        course: [],
        event: [],
        facility: [],
        other: []
    };
    
    images.forEach(image => {
        categorizedImages[image.category].push(image);
    });
    
    // Get all courses for the upload form
    const courses = await Course.find({ isActive: true }).select("name");
    
    res.render("pages/gallery", {
        title: "Gallery - FitSync",
        images,
        categorizedImages,
        courses,
        isLoggedIn: !!req.session.userId,
        userRole: req.session.userRole,
        userId: req.session.userId,
        canUpload: await canUserUpload(req.session.userId)
    });
});

// Upload new image
export const uploadImage = asyncHandler(async (req, res) => {
    const userId = req.session.userId;
    
    // Check if user can upload
    if (!(await canUserUpload(userId))) {
        throw new ApiError(403, "You must be enrolled in at least one course, a trainer, or an admin to upload images");
    }
    
    // Validate file exists
    if (!req.file) {
        throw new ApiError(400, "Please upload an image file");
    }
    
    // Get request data
    const { title, description, category, courseId } = req.body;
    
    // Validate required fields
    if (!title) {
        throw new ApiError(400, "Image title is required");
    }
    
    // Get file path
    const imageUrl = getFileUrl(req.file.filename);
    
    // Create gallery entry
    const galleryItem = await Gallery.create({
        title,
        description: description || "",
        imageUrl,
        uploadedBy: userId,
        category: category || "other",
        course: courseId || null,
        isPublic: true
    });
    
    // Redirect to the gallery page with success message
    return res.redirect("/gallery?success=Image uploaded successfully");
});

// Delete image
export const deleteImage = asyncHandler(async (req, res) => {
    const { imageId } = req.params;
    const userId = req.session.userId;
    
    // Find the image
    const image = await Gallery.findById(imageId);
    if (!image) {
        throw new ApiError(404, "Image not found");
    }
    
    // Check if user is authorized to delete
    const isAdmin = req.session.userRole === "admin";
    const isOwner = image.uploadedBy.toString() === userId;
    
    if (!isAdmin && !isOwner) {
        throw new ApiError(403, "You don't have permission to delete this image");
    }
    
    // Delete the image
    await Gallery.findByIdAndDelete(imageId);
    
    // Handle API request
    if (req.headers['accept'] === 'application/json' || 
        req.headers['content-type'] === 'application/json' ||
        req.headers['x-requested-with'] === 'XMLHttpRequest') {
        return res.status(200).json(
            new ApiResponse(200, {}, "Image deleted successfully")
        );
    }
    
    // Handle form submission
    return res.redirect("/gallery?success=Image deleted successfully");
});

// Helper function to check if a user can upload images
async function canUserUpload(userId) {
    if (!userId) return false;
    
    const user = await User.findById(userId);
    if (!user) return false;
    
    // Admins and trainers can always upload
    if (user.role === "admin" || user.role === "trainer") {
        return true;
    }
    
    // Regular users need to be enrolled in at least one active course
    if (user.role === "user") {
        const hasActiveEnrollment = user.enrolledCourses?.some(enrollment => 
            enrollment.status === "active" && 
            new Date(enrollment.endDate) >= new Date()
        );
        
        return hasActiveEnrollment || false;
    }
    
    return false;
} 