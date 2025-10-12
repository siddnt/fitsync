import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

// Track connection state
let dbInstance = null;

const connectDB = async () => {
    try {
        if (dbInstance) {
            console.log("Using existing MongoDB connection");
            return dbInstance;
        }
        
        const connectionInstance = await mongoose.connect(process.env.MONGODB_URI, {
    dbName: DB_NAME,
    useNewUrlParser: true,
    useUnifiedTopology: true
});

        console.log(`\nMongoDB connected !! DB HOST: ${connectionInstance.connection.host}`);
        
        // Store the connection instance
        dbInstance = connectionInstance;
        
        // Handle connection errors
        mongoose.connection.on('error', (err) => {
            console.error("MongoDB connection error:", err);
        });
        
        // If the connection is closed, try to reconnect
        mongoose.connection.on('disconnected', () => {
            console.log("MongoDB disconnected, trying to reconnect...");
            dbInstance = null;
            setTimeout(() => {
                connectDB();
            }, 5000); // Reconnect after 5 seconds
        });
        
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