import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import session from "express-session";
import flash from "connect-flash";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import dotenv from "dotenv";
import { errorHandler } from "./middlewares/error.middleware.js";
import { checkLoginStatus } from "./middlewares/auth.middleware.js";
import { ApiError } from "./utils/ApiError.js";
import { ApiResponse } from "./utils/ApiResponse.js";
import createAdminUser from "./scripts/createAdminUser.js";
import initializeCourses from "./scripts/initializeCourses.js";
import initializeProducts from "./scripts/initializeProducts.js";
import initializeReviews from "./scripts/initializeReviews.js";

// Load environment variables
dotenv.config();

// Import routes
import mainRoutes from "./routes/index.routes.js";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import profileRoutes from "./routes/profile.routes.js";
import trainerRoutes from "./routes/trainer.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import bookingRoutes from "./routes/booking.routes.js";
import planRoutes from "./routes/plan.routes.js";
import courseRoutes from "./routes/course.routes.js";
import reviewRoutes from "./routes/review.routes.js";
import galleryRoutes from "./routes/gallery.routes.js";
import shopRoutes from "./routes/shop.routes.js";
import cartRoutes from "./routes/cart.routes.js";
import orderRoutes from "./routes/order.routes.js";
import paymentsRoutes from "./routes/payments.routes.js";

// Import custom middleware
import { verifyJWT, authorizeRoles } from "./middlewares/auth.middleware.js";

// Create Express app
const app = express();

// Set up __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // limit each IP to 500 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false
});

// Middleware
app.use(limiter);
app.use(cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:4000",
    credentials: true
}));
// Stripe webhook needs raw body, so handle that path before JSON parser
// Capture raw body for Stripe webhook signature verification. Important: this must be before express.json()
app.post(
    "/payments/webhook",
    (req, res, next) => next(),
    express.raw({ type: "application/json" }),
    (req, res, next) => {
        req.rawBody = req.body; // buffer
        next();
    }
);
app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(cookieParser());
app.use(session({
    secret: process.env.SESSION_SECRET || "yourSecretKey",
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === "production",
        maxAge: 24 * 60 * 60 * 1000 // 1 day
    }
}));
app.use(flash());

// Add flash messages to all views
app.use((req, res, next) => {
    res.locals.flashMessage = req.flash('success')[0] || req.flash('error')[0];
    res.locals.flashType = req.flash('success').length > 0 ? 'success' : 'error';
    next();
});

// Set up static files directory
app.use(express.static(path.join(rootDir, "public")));
app.use("/uploads", express.static(path.join(__dirname, "../src/storage/uploads")));

// Configure EJS as the template engine
app.set("view engine", "ejs");
app.set("views", path.join(rootDir, "views"));

// Authentication middleware for templates
app.use(checkLoginStatus);

// Routes
app.use("/", mainRoutes);
app.use("/auth", authRoutes);
app.use("/user", userRoutes);
app.use("/profile", profileRoutes);
app.use("/plans", planRoutes);
app.use("/bookings", bookingRoutes);
app.use("/courses", courseRoutes);
app.use("/reviews", reviewRoutes);
app.use("/gallery", galleryRoutes);
app.use("/shop", shopRoutes);
app.use("/api/shop", shopRoutes);
app.use("/api/shop/cart", cartRoutes);
app.use("/cart", cartRoutes);
app.use("/orders", orderRoutes);
app.use("/payments", paymentsRoutes);

// Create a session auth middleware
const checkSessionAuth = (requiredRole) => {
    return (req, res, next) => {
        if (!req.session || !req.session.userId) {
            return res.redirect('/auth/login');
        }
        
        if (requiredRole && req.session.userRole !== requiredRole) {
            return res.status(403).render('pages/error', {
                title: 'Access Denied - FitSync',
                statusCode: 403,
                message: 'You do not have permission to access this page.'
            });
        }
        
        next();
    };
};

// Protected routes - Using separate middleware chains for browser vs API
// For trainer routes
const trainerRouter = express.Router();
app.use("/trainer", trainerRouter);

// Apply authentication middleware based on request type
trainerRouter.use((req, res, next) => {
    const acceptsHtml = req.accepts(['html', 'json']) === 'html';
    
    if (acceptsHtml) {
        // For browser requests, use session auth
        checkSessionAuth('trainer')(req, res, next);
    } else {
        // For API requests, use JWT auth
        verifyJWT(req, res, (err) => {
            if (err) return next(err);
            authorizeRoles('trainer')(req, res, next);
        });
    }
});

// Mount the actual trainer routes after authentication
trainerRouter.use('/', trainerRoutes);

// For admin routes
const adminRouter = express.Router();
app.use("/admin", adminRouter);

// Apply authentication middleware based on request type
adminRouter.use((req, res, next) => {
    const acceptsHtml = req.accepts(['html', 'json']) === 'html';
    
    if (acceptsHtml) {
        // For browser requests, use session auth
        checkSessionAuth('admin')(req, res, next);
    } else {
        // For API requests, use JWT auth
        verifyJWT(req, res, (err) => {
            if (err) return next(err);
            authorizeRoles('admin')(req, res, next);
        });
    }
});

// Mount the actual admin routes after authentication
adminRouter.use('/', adminRoutes);

// 404 handler
app.all("*", (req, res, next) => {
    const err = new ApiError(404, `Route ${req.originalUrl} not found`);
    
    // Determine request type
    const acceptsHtml = req.accepts(['html', 'json', 'text']) === 'html';
    
    if (acceptsHtml) {
        // For HTML requests, render error page
        return res.status(404).render('pages/error', {
            title: 'Page Not Found - FitSync',
            statusCode: 404,
            message: `The page ${req.originalUrl} could not be found.`
        });
    } else {
        // For API requests, return JSON
        return res.status(404).json(
            new ApiResponse(404, null, `Route ${req.originalUrl} not found`)
        );
    }
});

// Error handler
app.use(errorHandler);

// Initialize the database with required data
const initializeDatabase = async () => {
    try {
        // Create admin user
        await createAdminUser();
        
        // Initialize courses
        await initializeCourses();
        
        // Initialize products
        await initializeProducts();
        
        // Initialize reviews
        await initializeReviews();
    } catch (error) {
        console.error("Error initializing database:", error);
    }
};

// Call the initialization function except during tests
if (process.env.NODE_ENV !== 'test') {
    initializeDatabase();
}

export default app; 