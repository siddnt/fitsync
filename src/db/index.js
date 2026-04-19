import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";
import { initializeQueryMetrics } from "../services/observability.service.js";

// Track connection state
let dbInstance = null;

const connectDB = async () => {
    try {
        initializeQueryMetrics(mongoose);

        if (dbInstance) {
            console.log("Using existing MongoDB connection");
            return dbInstance;
        }
        
        const connectionOptions = {
            dbName: DB_NAME,
            maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE ?? 20),
            minPoolSize: Number(process.env.MONGODB_MIN_POOL_SIZE ?? 5),
            serverSelectionTimeoutMS: Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS ?? 5000),
            socketTimeoutMS: Number(process.env.MONGODB_SOCKET_TIMEOUT_MS ?? 45000),
        };

        const connectionInstance = await mongoose.connect(process.env.MONGODB_URI, connectionOptions);

        console.log(`\nMongoDB connected !! DB HOST: ${connectionInstance.connection.host}`);
        
        // Store the connection instance
        dbInstance = connectionInstance;
        
        // Handle connection errors
        mongoose.connection.on('error', (err) => {
            console.error("MongoDB connection error:", err);
        });

        const disableReconnect = String(process.env.DISABLE_DB_RECONNECT ?? '').toLowerCase() === 'true';
        if (process.env.NODE_ENV !== 'test' && !disableReconnect) {
            // If the connection is closed, try to reconnect in non-test environments
            mongoose.connection.on('disconnected', () => {
                console.log("MongoDB disconnected, trying to reconnect...");
                dbInstance = null;
                setTimeout(() => {
                    connectDB();
                }, 5000); // Reconnect after 5 seconds
            });
        }
        
        return connectionInstance;
    } catch (error) {
        console.log("MONGODB connection FAILED ", error);
        process.exit(1);
    }
};

// Get the mongoose connection instance
const getDbConnection = () => {
    return mongoose.connection;
};

export { connectDB, getDbConnection };
export default connectDB; 
