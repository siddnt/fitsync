import { Router } from "express";
import { getGalleryPage, uploadImage, deleteImage } from "../controllers/gallery.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { requireSessionRole, isAuthenticated } from "../middlewares/auth.middleware.js";

const router = Router();

// Middleware to check if user is logged in
// Use shared session-based guard from auth middleware
const isLoggedIn = requireSessionRole();

// Public routes
router.get("/", getGalleryPage);

// Protected routes
// For HTML form submissions, redirect to login when not logged in
router.post("/upload", isLoggedIn, upload.single("image"), uploadImage);
// For API/AJAX deletion, return 401 JSON when not authenticated
router.delete("/:imageId", isAuthenticated, deleteImage);
// For non-JS form submissions (HTML), use session guard with redirect
router.get("/delete/:imageId", isLoggedIn, deleteImage);

export default router; 