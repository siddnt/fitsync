import mongoose from "mongoose";
import Review from "../models/review.model.js";
import User from "../models/user.model.js";
import { Course } from "../models/course.model.js";
import { connectDB } from "../db/index.js";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import colors from "colors";

// Load environment variables
dotenv.config();

// Initialize sample reviews for courses
const initializeReviews = async () => {
    try {
        console.log(colors.yellow("Starting review initialization"));

        // Force creating new reviews (remove the check for existing reviews)
        console.log(colors.yellow("Forcing review initialization"));

        // Get all courses
        const courses = await Course.find({ isActive: true });
        if (!courses || courses.length === 0) {
            console.log(colors.red("No active courses found. Cannot initialize reviews."));
            return;
        }

        // Log found courses
        console.log(colors.green(`Found ${courses.length} active courses:`));
        courses.forEach((course, index) => {
            console.log(colors.yellow(`${index}: ${course.name} (ID: ${course._id})`));
        });

        // Create a test user to assign reviews to if not exist
        let testUser = await User.findOne({ email: "test.user@fitsync.com" });
        if (!testUser) {
            testUser = await User.create({
                name: "Test User",
                email: "test.user@fitsync.com",
                password: "password123",
                role: "user",
                status: "active"
            });
            console.log(colors.green("Created test user for reviews."));
        }

        // Ensure test user is enrolled in courses to be able to leave reviews
        for (const course of courses) {
            // Check if already enrolled
            const isEnrolled = testUser.enrolledCourses.some(
                enrollment => enrollment.course.toString() === course._id.toString() && enrollment.status === "active"
            );

            if (!isEnrolled) {
                // Add course to user's enrolled courses
                testUser.enrolledCourses.push({
                    course: course._id,
                    status: "active",
                    enrolledAt: new Date(),
                    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
                });
            }
        }
        await testUser.save();
        console.log(colors.green("Ensured test user is enrolled in all courses."));

        // Sample reviews data
        const reviewsData = [
            {
                // Yoga (assumed to be the first course)
                courseIndex: 0,
                rating: 5,
                comment: "Amazing yoga classes! The instructor is knowledgeable and the environment is perfect for mindfulness practice."
            },
            {
                courseIndex: 0,
                rating: 4,
                comment: "Great yoga sessions. I've seen improvement in my flexibility and stress levels have decreased."
            },
            {
                // Zumba (assumed to be the second course)
                courseIndex: 1,
                rating: 5,
                comment: "So much fun! The energy in these Zumba classes is incredible. Great workout without feeling like exercise."
            },
            {
                courseIndex: 1,
                rating: 5,
                comment: "The instructor makes the class enjoyable and the music choices are perfect. Best cardio workout ever!"
            },
            {
                // Strength Training (assumed to be the third course)
                courseIndex: 2,
                rating: 4,
                comment: "Excellent strength training program. The coaches are attentive and ensure proper form on all exercises."
            },
            {
                courseIndex: 2,
                rating: 5,
                comment: "I've gained significant muscle mass since joining this program. The trainers are knowledgeable and supportive."
            }
        ];

        // Create reviews
        const reviewPromises = reviewsData.map(async (reviewData) => {
            if (courses[reviewData.courseIndex]) {
                const courseId = courses[reviewData.courseIndex]._id;
                // Check if review already exists
                const existingReview = await Review.findOne({
                    user: testUser._id,
                    course: courseId
                });

                if (!existingReview) {
                    return Review.create({
                        user: testUser._id,
                        course: courseId,
                        rating: reviewData.rating,
                        comment: reviewData.comment
                    });
                } else {
                    console.log(colors.yellow(`Review for course ${courses[reviewData.courseIndex].name} already exists.`));
                    return null;
                }
            } else {
                console.log(colors.red(`Course at index ${reviewData.courseIndex} not found.`));
                return null;
            }
        });

        const createdReviews = await Promise.all(reviewPromises);
        const validReviews = createdReviews.filter(review => review !== null);
        
        if (validReviews.length > 0) {
            console.log(colors.green(`${validReviews.length} reviews created successfully.`));
        } else {
            console.log(colors.yellow("No new reviews were created."));
        }

    } catch (error) {
        console.error(colors.red("Error initializing reviews:"), error);
    }
};

// Export the function
export default initializeReviews;

// If this file is run directly, execute the function
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    connectDB()
        .then(() => initializeReviews())
        .then(() => {
            console.log(colors.green("Review initialization complete."));
            process.exit(0);
        })
        .catch(err => {
            console.error(colors.red("Failed to initialize reviews:"), err);
            process.exit(1);
        });
} 