import path from 'path';
import { promises as fs } from 'fs';
import { v2 as cloudinary } from 'cloudinary';

const LOCAL_PROVIDER = 'local';
const CLOUDINARY_PROVIDER = 'cloudinary';

let cloudinaryConfigured = false;

const configureFromUrl = (rawUrl) => {
    if (!rawUrl) {
        return false;
    }

    const trimmedUrl = rawUrl.trim();
    if (!trimmedUrl) {
        return false;
    }

    try {
        const parsed = new URL(trimmedUrl);
        const cloudName = parsed.hostname;
        const apiKey = decodeURIComponent(parsed.username ?? '');
        const apiSecret = decodeURIComponent(parsed.password ?? '');

        if (!cloudName || !apiKey || !apiSecret) {
            return false;
        }

        cloudinary.config({
            cloud_name: cloudName,
            api_key: apiKey,
            api_secret: apiSecret,
            secure: true,
        });

        cloudinaryConfigured = true;
        return true;
    } catch (error) {
        // If URL parsing fails, return false so we can try other config shapes.
        return false;
    }
};

const cleanupLocalFile = async (filePath) => {
    if (!filePath) {
        return;
    }

    try {
        await fs.unlink(filePath);
    } catch (error) {
        if (error?.code !== 'ENOENT') {
            console.error('Failed to remove temporary upload', error);
        }
    }
};

const configureCloudinary = () => {
    if (cloudinaryConfigured) {
        return true;
    }

    try {
        if (configureFromUrl(process.env.CLOUDINARY_URL)) {
            return true;
        }

        const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
        const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
        const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

        if (cloudName && apiKey && apiSecret) {
            cloudinary.config({
                cloud_name: cloudName,
                api_key: apiKey,
                api_secret: apiSecret,
                secure: true,
            });
            cloudinaryConfigured = true;
            return true;
        }
    } catch (error) {
        console.error('Cloudinary configuration failed', error);
    }

    return false;
};

// Function to get public URL for an uploaded file
// Note: Multer storage and file filtering are centralized in middlewares/multer.middleware.js
export const getFileUrl = (filename) => {
    const base = '/uploads';
    const normalized = filename?.replace(/^\\+|^\/+/, '');
    return path.posix.join(base, normalized || '');
};

// Upload helper that prefers Cloudinary when configured and falls back to local storage.
export const uploadOnCloudinary = async (absolutePath, options = {}) => {
    if (!absolutePath) {
        return null;
    }

    const fileName = path.basename(absolutePath);
    const fallback = {
        url: getFileUrl(fileName),
        provider: LOCAL_PROVIDER,
        fileName,
    };

    const useCloudinary = configureCloudinary();
    if (!useCloudinary) {
        return fallback;
    }

    const folder = options.folder ?? process.env.CLOUDINARY_UPLOAD_FOLDER ?? 'fitsync';
    const resourceType = options.resourceType ?? 'image';

    try {
        const uploadResult = await cloudinary.uploader.upload(absolutePath, {
            folder,
            resource_type: resourceType,
            overwrite: false,
            unique_filename: true,
        });

        await cleanupLocalFile(absolutePath);

        return {
            url: uploadResult.secure_url ?? uploadResult.url,
            provider: CLOUDINARY_PROVIDER,
            fileName: uploadResult.public_id,
            publicId: uploadResult.public_id,
            format: uploadResult.format,
            bytes: uploadResult.bytes,
            width: uploadResult.width,
            height: uploadResult.height,
            folder: uploadResult.folder ?? folder,
        };
    } catch (error) {
        await cleanupLocalFile(absolutePath);
        console.error('Cloudinary upload failed', error);
        throw error;
    }
};