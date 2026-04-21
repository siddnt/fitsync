import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import morgan from "morgan";
import { rateLimit } from "express-rate-limit";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";
import dotenv from "dotenv";
import swaggerUi from "swagger-ui-express";
import { errorHandler } from "./middlewares/error.middleware.js";
import { ApiResponse } from "./utils/ApiResponse.js";
import apiRouter from "./api/routes/index.js";
import { createOpenApiSpec, swaggerUiOptions } from "./docs/openapi.js";

dotenv.config();

// Create Express app
const app = express();

// Render and other reverse proxies forward proto/host headers.
app.set("trust proxy", 1);

// Set up __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false
});

app.use(limiter);

// Security headers (CSP disabled for React SPA compatibility)
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

// HTTP request logging
const logsDir = path.join(rootDir, "src", "logs");
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
const accessLogStream = fs.createWriteStream(path.join(logsDir, "access.log"), { flags: "a" });
app.use(morgan("combined", { stream: accessLogStream }));
app.use(morgan("dev"));

const corsOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173,http://localhost:4173").split(",").map((origin) => origin.trim());

const resolvePublicBaseUrl = (req) => {
    const explicitBaseUrl = process.env.PUBLIC_BASE_URL?.trim();
    if (explicitBaseUrl) {
        return explicitBaseUrl.replace(/\/+$/, "");
    }

    const forwardedProto = req.get("x-forwarded-proto")?.split(",")?.[0]?.trim();
    const forwardedHost = req.get("x-forwarded-host")?.split(",")?.[0]?.trim();
    const protocol = forwardedProto || req.protocol || "http";
    const host = forwardedHost || req.get("host");

    if (!host) {
        return undefined;
    }

    return `${protocol}://${host}`;
};

app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin || corsOrigins.includes(origin)) {
                return callback(null, origin);
            }
            return callback(new Error("Not allowed by CORS"));
        },
        credentials: true
    })
);

app.use(express.json({
    limit: "1mb",
    verify: (req, _res, buf) => {
        if (req.originalUrl.startsWith("/api/payments/webhook")) {
            req.rawBody = buf;
        }
    }
}));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());

app.use(express.static(path.join(rootDir, "public")));
app.use("/uploads", express.static(path.join(rootDir, "src/storage/uploads")));

app.get("/api/docs.json", (req, res) => {
    const baseUrl = resolvePublicBaseUrl(req);
    return res.status(200).json(createOpenApiSpec(baseUrl));
});

app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(null, swaggerUiOptions));

app.use("/api", apiRouter);

app.get("/", (_req, res) => {
    return res.status(200).json(new ApiResponse(200, { service: "FitSync API" }, "Service is running"));
});

app.get("/payments/cancelled", (_req, res) => {
    return res.status(200).json(new ApiResponse(200, null, "Payment cancelled"));
});

app.get("/payments/success", (req, res) => {
    return res.status(200).json(
        new ApiResponse(200, { sessionId: req.query.session_id || null }, "Payment success")
    );
});

app.use((req, res) => {
    return res.status(404).json(new ApiResponse(404, null, `Route ${req.originalUrl} not found`));
});

app.use(errorHandler);

export default app; 
