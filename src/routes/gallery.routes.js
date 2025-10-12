import { Router } from "express";
import { getGalleryPage, uploadImage, deleteImage } from "../controllers/gallery.controller.js";
import { upload } from "../utils/fileUpload.js";

const router = Router();

// Middleware to check if user is logged in
const isLoggedIn = (req, res, next) => {
    if (!req.session || !req.session.userId) {
        if (req.headers['accept'] === 'application/json' || 
            req.headers['content-type'] === 'application/json' ||
            req.headers['x-requested-with'] === 'XMLHttpRequest') {
            return res.status(401).json({
                success: false,
                message: "You must be logged in to perform this action"
            });
        }
        return res.redirect("/auth/login?returnTo=/gallery");
    }
    next();
};

// Public routes
router.get("/", getGalleryPage);

// Protected routes
router.post("/upload", isLoggedIn, upload.single("image"), uploadImage);
router.delete("/:imageId", isLoggedIn, deleteImage);
router.get("/delete/:imageId", isLoggedIn, deleteImage); // For non-JS form submissions

export default router; 