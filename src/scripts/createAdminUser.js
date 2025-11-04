import mongoose from "mongoose";
import User from "../models/user.model.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import colors from "colors";
import { connectDB } from "../db/index.js";

// Setup environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// Admin user data
const adminData = {
  name: "Admin User",
  email: "admin@fitsync.com",
  password: "admin123",
  role: "admin",
  status: "active"
};

// Create admin user
const createAdminUser = async () => {
  try {
    console.log(colors.yellow("Checking for admin user..."));

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: adminData.email });
    
    if (existingAdmin) {
      console.log(colors.green(`Admin user with email ${adminData.email} already exists.`));
      console.log(colors.green("You can login with this email and the password you set."));
    } else {
      // Create new admin user
      const adminUser = await User.create(adminData);
      console.log(colors.green(`Admin user created successfully with ID: ${adminUser._id}`));
      console.log(colors.green(`Email: ${adminData.email}`));
      console.log(colors.green(`Password: ${adminData.password}`));
    }
  } catch (error) {
    console.error(colors.red(`Error creating admin user: ${error.message}`));
  }
};

// Export the function
export default createAdminUser;

// If this file is run directly, execute the function
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  connectDB()
    .then(() => createAdminUser())
    .catch(err => {
      console.error(colors.red("Database connection failed:"), err);
      process.exit(1);
    });
} 