import dotenv from "dotenv";
import connectDB from "./db/index.js";
import app from "./app.js";

// Environment variables
dotenv.config({
    path: "./.env"
});

// Import routes
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import trainerRoutes from "./routes/trainer.routes.js";
import profileRoutes from "./routes/profile.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import courseRoutes from "./routes/course.routes.js";
import indexRoutes from "./routes/index.routes.js";

// Uncaught exception handler
process.on("uncaughtException", (err) => {
    console.log("UNCAUGHT EXCEPTION! 💥 Shutting down...");
    console.log(err.name, err.message);
    process.exit(1);
});

// Connect to database
connectDB()
    .then(() => {
        // Start the server
        const PORT = process.env.PORT || 4000;
        
        const server = app.listen(PORT, () => {
            console.log(`Server is running at http://localhost:${PORT}`);
        });

        // Unhandled rejection handler
        process.on("unhandledRejection", (err) => {
            console.log("UNHANDLED REJECTION! 💥 Shutting down...");
            console.log(err.name, err.message);
            server.close(() => {
                process.exit(1);
            });
        });

        // SIGTERM handler
        process.on("SIGTERM", () => {
            console.log("👋 SIGTERM RECEIVED. Shutting down gracefully");
            server.close(() => {
                console.log("💥 Process terminated!");
            });
        });

        // API Routes
        app.use("/", indexRoutes);
        app.use("/auth", authRoutes);
        app.use("/user", userRoutes);
        app.use("/trainer", trainerRoutes);
        app.use("/profile", profileRoutes);
        app.use("/admin", adminRoutes);
        app.use("/course", courseRoutes);
    })
    .catch((err) => {
        console.error("MONGODB connection FAILED 💥", err);
        process.exit(1);
    }); 