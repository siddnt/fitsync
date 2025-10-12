import mongoose from "mongoose";
import { Course } from "../models/course.model.js";
import User, { User as UserNamed } from "../models/user.model.js";
import dotenv from "dotenv";
import colors from "colors";
import { connectDB, getDbConnection } from "../db/index.js";
import { fileURLToPath } from "url";

// Load environment variables
dotenv.config();

// Define courses with their fixed schedules
const coursesData = [
    {
        name: "yoga",
        description: "Yoga classes focused on flexibility, strength, and mindfulness.",
        price: 1200,
        level: "all",
        image: "yoga.jpg",
        isActive: true,
        schedule: [
            { day: "monday", startTime: "09:00", endTime: "10:00" },
            { day: "tuesday", startTime: "09:00", endTime: "10:00" },
            { day: "wednesday", startTime: "09:00", endTime: "10:00" },
            { day: "friday", startTime: "09:00", endTime: "10:00" },
            { day: "saturday", startTime: "09:00", endTime: "10:00" }
        ]
    },
    {
        name: "zumba",
        description: "High-energy dance fitness classes that combine Latin rhythms with cardio.",
        price: 1500,
        level: "all",
        image: "zumba.jpg",
        isActive: true,
        schedule: [
            { day: "monday", startTime: "18:00", endTime: "19:00" },
            { day: "wednesday", startTime: "18:00", endTime: "19:00" },
            { day: "thursday", startTime: "17:00", endTime: "18:00" },
            { day: "saturday", startTime: "11:00", endTime: "12:00" }
        ]
    },
    {
        name: "strength training",
        description: "Focused on building muscle and increasing strength through resistance training.",
        price: 2000,
        level: "all",
        image: "strength.jpg",
        isActive: true,
        schedule: [
            { day: "tuesday", startTime: "17:00", endTime: "18:30" },
            { day: "thursday", startTime: "19:00", endTime: "20:30" },
            { day: "friday", startTime: "17:00", endTime: "18:30" },
            { day: "sunday", startTime: "10:00", endTime: "11:30" }
        ]
    }
];

// Initialize predefined courses
const initializeCourses = async () => {
    try {
        console.log(colors.yellow("Starting course initialization"));

        // Check if courses already exist
        const existingCourses = await Course.find({});
        if (existingCourses.length === 3) {
            console.log(colors.yellow("Courses already initialized"));
            
            // Check if we need to create test trainers for courses
            const trainersCount = await User.countDocuments({ 
                role: "trainer", 
                status: "active",
                "trainerCourses.status": "active"
            });
            
            if (trainersCount === 0) {
                await createTestTrainers(existingCourses);
            } else {
                console.log(colors.yellow(`Found ${trainersCount} active trainers`));
            }
            
            return;
        }

        // Delete existing courses (if any - ensures clean slate)
        await Course.deleteMany({});
        console.log(colors.yellow("Deleted existing courses"));

        // Insert courses
        const insertedCourses = await Course.insertMany(coursesData);
        console.log(colors.green(`${insertedCourses.length} courses initialized successfully`));

        // Create test trainers for the courses
        await createTestTrainers(insertedCourses);

        // We're not checking for conflicts here since that requires a fully initialized model with methods
        console.log(colors.green("Course schedules set up without overlapping time slots"));

    } catch (error) {
        console.error(colors.red("Error initializing courses:"), error);
    }
};

// Create test trainers for courses
const createTestTrainers = async (courses) => {
    try {
        console.log(colors.yellow("Creating test trainers for courses..."));
        
        if (!courses || !Array.isArray(courses) || courses.length === 0) {
            console.error(colors.red("No courses provided for trainer creation"));
            return;
        }
        
        // Create one trainer per specialization/course
        const trainerData = [
            {
                name: "John Smith",
                email: "yoga.trainer@fitsync.com",
                password: "password123",
                role: "trainer",
                status: "active",
                bio: "Certified yoga instructor with 5 years of experience",
                specializations: ["Yoga"],
                trainerCourses: []
            },
            {
                name: "Maria Garcia",
                email: "zumba.trainer@fitsync.com",
                password: "password123",
                role: "trainer",
                status: "active",
                bio: "Zumba expert with high-energy classes",
                specializations: ["Zumba"],
                trainerCourses: []
            },
            {
                name: "Mike Johnson",
                email: "strength.trainer@fitsync.com",
                password: "password123",
                role: "trainer",
                status: "active",
                bio: "Certified strength training coach with focus on proper form",
                specializations: ["Strength Training"],
                trainerCourses: []
            }
        ];
        
        // Map course names to their MongoDB IDs
        const courseMap = {};
        courses.forEach(course => {
            if (course && course.name) {
                courseMap[course.name.toLowerCase()] = course._id;
                console.log(`Mapped course ${course.name} to ID ${course._id}`);
            }
        });
        
        // Create trainers and register them for courses
        for (const data of trainerData) {
            try {
                // Check if trainer already exists
                const existingTrainer = await User.findOne({ email: data.email });
                
                if (existingTrainer) {
                    console.log(colors.yellow(`Trainer ${data.name} already exists with ID ${existingTrainer._id}`));
                    
                    // Check if they're registered for the course
                    const specialization = data.specializations[0].toLowerCase();
                    console.log(`Checking if trainer is registered for ${specialization}`);
                    
                    const courseId = courseMap[specialization];
                    if (!courseId) {
                        console.log(colors.red(`No course ID found for ${specialization}`));
                        continue;
                    }
                    
                    // Check if already registered for course
                    const isRegistered = existingTrainer.trainerCourses.some(tc => 
                        tc.course && tc.course.toString() === courseId.toString() && tc.status === "active"
                    );
                    
                    if (isRegistered) {
                        console.log(colors.green(`Trainer ${data.name} already registered for ${specialization}`));
                    } else {
                        // Register for course
                        existingTrainer.trainerCourses.push({
                            course: courseId,
                            status: "active"
                        });
                        await existingTrainer.save();
                        console.log(colors.green(`Registered trainer ${data.name} for ${specialization} (ID: ${courseId})`));
                    }
                } else {
                    // Create new trainer
                    const trainer = new User(data);
                    
                    // Register for the corresponding course
                    const specialization = data.specializations[0].toLowerCase();
                    const courseId = courseMap[specialization];
                    
                    if (courseId) {
                        trainer.trainerCourses.push({
                            course: courseId,
                            status: "active"
                        });
                        console.log(colors.green(`Added course ${specialization} (ID: ${courseId}) to new trainer ${data.name}`));
                    } else {
                        console.log(colors.red(`No course ID found for ${specialization}, trainer created without course registration`));
                    }
                    
                    await trainer.save();
                    console.log(colors.green(`Created trainer ${data.name} with ID ${trainer._id}`));
                }
            } catch (trainerError) {
                console.error(colors.red(`Error processing trainer ${data.name}:`), trainerError);
            }
        }
        
        // Verify trainers were correctly registered for courses
        const trainersCount = await User.countDocuments({ 
            role: "trainer", 
            status: "active",
            "trainerCourses.status": "active"
        });
        
        console.log(colors.green(`After setup: Found ${trainersCount} active trainers registered for courses`));
        
        console.log(colors.green("Test trainers setup complete"));
    } catch (error) {
        console.error(colors.red("Error creating test trainers:"), error);
    }
};

// Export the function
export default initializeCourses;

// If this file is run directly, execute the function
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    connectDB()
        .then(() => initializeCourses())
        .catch(err => {
            console.error(colors.red("Failed to initialize courses:"), err);
        });
} 