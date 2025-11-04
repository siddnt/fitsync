import Revenue from "../models/revenue.model.js";
import { Course } from "../models/course.model.js";

/**
 * Record revenue for a course enrollment
 * @param {string} courseId - Course ID
 * @param {string} userId - User ID
 * @param {string} type - Type of revenue (enrollment, renewal, etc)
 * @param {string} description - Optional description
 */
export const recordCourseRevenue = async (courseId, userId, type = "enrollment", description = "") => {
    try {
        // Get the course to determine price
        const course = await Course.findById(courseId);
        if (!course) {
            throw new Error("Course not found");
        }

        // Create revenue record
        const revenue = await Revenue.create({
            course: courseId,
            amount: course.price || 0,
            user: userId,
            type,
            description: description || `${type} for course ${course.name}`
        });

        console.log(`Revenue recorded: ${revenue.amount} for course ${course.name}`);
        return revenue;
    } catch (error) {
        console.error("Error recording revenue:", error);
        throw error;
    }
};

/**
 * Get total revenue grouped by course
 */
export const getTotalRevenueByCourse = async () => {
    try {
        const coursesWithRevenue = await Revenue.getTotalRevenueByCourse();
        
        // Also get courses with no revenue recorded
        const allCourses = await Course.find({ isActive: true }).select("name");
        
        // Create a map of course IDs to revenue
        const revenueMap = {};
        coursesWithRevenue.forEach(course => {
            revenueMap[course._id.toString()] = {
                courseName: course.courseName,
                totalAmount: course.totalAmount
            };
        });
        
        // Add courses with no revenue
        const completeRevenueData = allCourses.map(course => {
            const courseId = course._id.toString();
            if (revenueMap[courseId]) {
                return revenueMap[courseId];
            } else {
                return {
                    _id: courseId,
                    courseName: course.name,
                    totalAmount: 0
                };
            }
        });
        
        return completeRevenueData;
    } catch (error) {
        console.error("Error getting revenue by course:", error);
        throw error;
    }
};

/**
 * Get revenue statistics including total revenue and course-specific revenue
 */
export const getRevenueStatistics = async () => {
    try {
        const revenueByType = await Revenue.aggregate([
            {
                $group: {
                    _id: "$type",
                    totalAmount: { $sum: "$amount" }
                }
            }
        ]);
        
        const totalRevenue = await Revenue.aggregate([
            {
                $group: {
                    _id: null,
                    totalAmount: { $sum: "$amount" }
                }
            }
        ]);
        
        const revenueByCourse = await getTotalRevenueByCourse();
        const shopAgg = await Revenue.getTotalShopRevenue();
        
        return {
            totalRevenue: totalRevenue.length > 0 ? totalRevenue[0].totalAmount : 0,
            revenueByType,
            revenueByCourse,
            shopRevenue: shopAgg.length ? shopAgg[0].totalAmount : 0
        };
    } catch (error) {
        console.error("Error getting revenue statistics:", error);
        throw error;
    }
}; 

// Helper to record shop revenue
export const recordShopRevenue = async (orderId, userId, amount, description = "") => {
    try {
        const revenue = await Revenue.create({
            order: orderId,
            amount: amount || 0,
            user: userId,
            type: "shop",
            description: description || `Shop order ${orderId}`
        });
        return revenue;
    } catch (error) {
        console.error("Error recording shop revenue:", error);
        throw error;
    }
};