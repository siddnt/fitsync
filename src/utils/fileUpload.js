import path from "path";

const providerLabel = "local";

// Function to get public URL for an uploaded file
// Note: Multer storage and file filtering are centralized in middlewares/multer.middleware.js
export const getFileUrl = (filename) => {
    // Our static mapping in app.js serves /uploads from src/storage/uploads
    // Here we assume gallery uploads are saved under src/storage/uploads
    // and optionally within a gallery subfolder depending on the storage config.
    // Keep just the filename by default; adjust if you later store under a subfolder.
    const base = "/uploads";
    // If filename accidentally includes a path, normalize to use it as-is under /uploads
    const normalized = filename?.replace(/^\\+|^\/+/, "");
    return path.posix.join(base, normalized || "");
};

// Backwards-compatible helper that mimics the old Cloudinary uploader contract.
// We now store files locally and simply return the public URL produced by getFileUrl.
export const uploadOnCloudinary = async (absolutePath) => {
    if (!absolutePath) {
        return null;
    }

    const fileName = path.basename(absolutePath);

    return {
        url: getFileUrl(fileName),
        provider: providerLabel,
        fileName,
    };
};