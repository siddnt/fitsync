import "./config/bootstrapEnv.js";
import connectDB from "./db/index.js";
import app from "./app.js";
import { closeCache, initializeCache } from "./services/cache.service.js";
import { startGymImpressionFlushLoop, stopGymImpressionFlushLoop } from "./services/gymImpression.service.js";
import { startOutboxWorker, stopOutboxWorker } from "./services/outbox.service.js";
import { initializeSearch, startSearchSyncWorker, stopSearchSyncWorker } from "./services/search.service.js";

process.on("uncaughtException", (err) => {
    console.log("UNCAUGHT EXCEPTION! Shutting down...");
    console.log(err.name, err.message);
    process.exit(1);
});

connectDB()
    .then(() => initializeCache())
    .then(() => initializeSearch())
    .then(() => {
        startGymImpressionFlushLoop();
        startOutboxWorker();
        startSearchSyncWorker();
        const PORT = process.env.PORT || 4000;

        const server = app.listen(PORT, () => {
            console.log(`Server is running at http://localhost:${PORT}`);
        });

        process.on("unhandledRejection", (err) => {
            console.log("UNHANDLED REJECTION! Shutting down...");
            console.log(err.name, err.message);
            server.close(() => {
                stopGymImpressionFlushLoop()
                    .catch((error) => {
                        console.error("Gym impression flush shutdown failed", error);
                    })
                    .finally(() => {
                        stopSearchSyncWorker()
                            .catch((error) => {
                                console.error("Search sync shutdown failed", error);
                            })
                            .finally(() => {
                                stopOutboxWorker()
                                    .catch((error) => {
                                        console.error("Outbox shutdown failed", error);
                                    })
                                    .finally(() => {
                                        closeCache().finally(() => process.exit(1));
                                    });
                            });
                    });
            });
        });

        process.on("SIGTERM", () => {
            console.log("SIGTERM received. Shutting down gracefully");
            server.close(() => {
                stopGymImpressionFlushLoop()
                    .catch((error) => {
                        console.error("Gym impression flush shutdown failed", error);
                    })
                    .finally(() => {
                        stopSearchSyncWorker()
                            .catch((error) => {
                                console.error("Search sync shutdown failed", error);
                            })
                            .finally(() => {
                                stopOutboxWorker()
                                    .catch((error) => {
                                        console.error("Outbox shutdown failed", error);
                                    })
                                    .finally(() => {
                                        closeCache().catch((error) => {
                                            console.error("Cache shutdown failed", error);
                                        });
                                        console.log("Process terminated");
                                    });
                            });
                    });
            });
        });
    })
    .catch((err) => {
        console.error("Startup failed", err);
        process.exit(1);
    });
