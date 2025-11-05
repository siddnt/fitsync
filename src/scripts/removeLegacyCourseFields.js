import mongoose from "mongoose";
import dotenv from "dotenv";
import connectDB from "../db/index.js";
import User from "../models/user.model.js";

// Load env variables when running standalone
dotenv.config();

const LEGACY_FIELDS = [
  "enrolledCourses",
  "trainerCourses",
  "trainerClients",
  "enrolledPlans",
  "weeklySchedule",
];

const run = async () => {
  try {
    await connectDB();

    const unsetSpec = LEGACY_FIELDS.reduce((acc, field) => {
      acc[field] = "";
      return acc;
    }, {});

    if (!Object.keys(unsetSpec).length) {
      console.log("No legacy fields defined for cleanup.");
      return;
    }

    const result = await User.updateMany({
      $or: LEGACY_FIELDS.map((field) => ({ [field]: { $exists: true } })),
    }, {
      $unset: unsetSpec,
    });

    console.log(`Legacy course fields removed from ${result.modifiedCount} user document(s).`);
  } catch (error) {
    console.error("Failed to remove legacy course fields:", error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

run();
