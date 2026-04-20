import dotenv from "dotenv";
import connectDB from "./db/index.js";
import app from "./app.js";
import { initRedis } from "./services/redis.service.js";
import { initSolr } from "./services/solr.service.js";

// Environment variables
dotenv.config({
    path: "./.env"
});


// Uncaught exception handler
process.on("uncaughtException", (err) => {
    console.log("UNCAUGHT EXCEPTION! 💥 Shutting down...");
    console.log(err.name, err.message);
    process.exit(1);
});

// Connect to database
connectDB()
    .then(() => {
        // Initialise Redis cache (non-blocking, app works without it)
        initRedis();
        initSolr();

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

    })
    .catch((err) => {
        console.error("MONGODB connection FAILED 💥", err);
        process.exit(1);
    }); 