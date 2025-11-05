import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";
import dotenv from "dotenv";
import { errorHandler } from "./middlewares/error.middleware.js";
import apiRoutes from "./api/routes/index.js";
import { ApiError } from "./utils/ApiError.js";
import createAdminUser from "./scripts/createAdminUser.js";

// Load environment variables
dotenv.config();


// Create Express app
const app = express();

// Set up __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const clientDistPath = path.join(rootDir, "client", "dist");

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // limit each IP to 500 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false
});

// Middleware
app.use(limiter);

const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173,http://localhost:4000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

app.use(cors({
    origin(origin, callback) {
        const isLocalhostOrigin = origin && /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);

        if (!origin || allowedOrigins.includes(origin) || isLocalhostOrigin) {
            return callback(null, true);
        }
        return callback(new Error("Not allowed by CORS"));
    },
    credentials: true
}));
// Stripe webhook needs raw body, so handle that path before JSON parser
// Capture raw body for Stripe webhook signature verification. Important: this must be before express.json()
app.post(
    "/payments/webhook",
    express.raw({ type: "application/json" }),
    (req, _res, next) => {
        req.rawBody = req.body;
        next();
    }
);
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(cookieParser());
app.use("/uploads", express.static(path.join(__dirname, "../src/storage/uploads")));

if (fs.existsSync(clientDistPath)) {
    app.use("/assets", express.static(path.join(clientDistPath, "assets")));
    app.use(express.static(clientDistPath));
}

app.use("/api", apiRoutes);

// Legacy payment result routes kept for backward compatibility with existing clients/tests
app.get("/payments/cancelled", (_req, res) => {
    return res.status(200).json({
        status: "cancelled",
        message: "Checkout session was cancelled."
    });
});

app.get("/payments/success", (req, res) => {
    const sessionId = req.query.session_id ?? null;
    return res.status(200).json({
        status: "success",
        sessionId,
        message: "Checkout completed successfully."
    });
});

if (fs.existsSync(clientDistPath)) {
    app.get("*", (req, res, next) => {
        if (req.path.startsWith("/api") || req.method !== "GET") {
            return next();
        }

        return res.sendFile(path.join(clientDistPath, "index.html"));
    });
}

app.use((req, _res, next) => {
    next(new ApiError(404, `Route ${req.originalUrl} not found`));
});

app.use(errorHandler);

const initializeDatabase = async () => {
    try {
    await createAdminUser();
    } catch (error) {
        console.error("Error initializing database:", error);
    }
};

if (process.env.NODE_ENV !== 'test') {
    initializeDatabase();
}

export default app; 