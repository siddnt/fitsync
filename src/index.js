import dotenv from "dotenv";
import connectDB from "./db/index.js";
import app from "./app.js";
import { autoCancelUnconfirmedCodOrders } from "./api/controllers/marketplace.controller.js";

dotenv.config({
    path: "./.env"
});

process.on("uncaughtException", (err) => {
    console.log("UNCAUGHT EXCEPTION! Shutting down...");
    console.log(err.name, err.message);
    process.exit(1);
});

const isCodAutoCancelEnabled = () =>
    !["false", "0", "no", "off"].includes(
        String(process.env.COD_AUTO_CANCEL_ENABLED ?? "true").trim().toLowerCase()
    );

const resolveCodAutoCancelIntervalMs = () =>
    Math.max(
        15000,
        Number.parseInt(process.env.COD_AUTO_CANCEL_INTERVAL_MS || "60000", 10) || 60000
    );

connectDB()
    .then(() => {
        const PORT = process.env.PORT || 4000;
        const codAutoCancelEnabled = isCodAutoCancelEnabled();
        const codAutoCancelIntervalMs = resolveCodAutoCancelIntervalMs();
        let codAutoCancelRunning = false;
        let codAutoCancelTimer = null;

        const runCodAutoCancelSweep = async () => {
            if (!codAutoCancelEnabled || codAutoCancelRunning) {
                return;
            }

            codAutoCancelRunning = true;
            try {
                const result = await autoCancelUnconfirmedCodOrders();
                if (result?.canceled) {
                    console.log(`[COD] Auto-canceled ${result.canceled} unconfirmed order(s).`);
                }
            } catch (error) {
                console.error("[COD] Auto-cancel sweep failed:", error?.message || error);
            } finally {
                codAutoCancelRunning = false;
            }
        };

        const server = app.listen(PORT, () => {
            console.log(`Server is running at http://localhost:${PORT}`);
            if (codAutoCancelEnabled) {
                codAutoCancelTimer = setInterval(runCodAutoCancelSweep, codAutoCancelIntervalMs);
                runCodAutoCancelSweep();
                console.log(`[COD] Auto-cancel sweep enabled (interval ${codAutoCancelIntervalMs} ms).`);
            }
        });

        process.on("unhandledRejection", (err) => {
            console.log("UNHANDLED REJECTION! Shutting down...");
            console.log(err.name, err.message);
            if (codAutoCancelTimer) {
                clearInterval(codAutoCancelTimer);
            }
            server.close(() => {
                process.exit(1);
            });
        });

        process.on("SIGTERM", () => {
            console.log("SIGTERM received. Shutting down gracefully.");
            if (codAutoCancelTimer) {
                clearInterval(codAutoCancelTimer);
            }
            server.close(() => {
                console.log("Process terminated.");
            });
        });

    })
    .catch((err) => {
        console.error("MONGODB connection failed", err);
        process.exit(1);
    });
