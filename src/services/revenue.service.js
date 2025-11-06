import Revenue from "../models/revenue.model.js";

/**
 * Record a revenue event with optional contextual metadata.
 */
export const recordRevenueEvent = async ({
    amount = 0,
    userId = null,
    type = "membership",
    description = "",
    orderId = null,
    metadata = {}
} = {}) => {
    try {
        const revenue = await Revenue.create({
            order: orderId,
            amount,
            user: userId,
            type,
            description,
            metadata
        });
        return revenue;
    } catch (error) {
        console.error("Error recording revenue:", error);
        throw error;
    }
};

/**
 * Get revenue statistics grouped by revenue type.
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

        const totals = revenueByType.map((entry) => ({
            type: entry._id,
            totalAmount: entry.totalAmount
        }));

        const totalRevenue = totals.reduce((sum, entry) => sum + entry.totalAmount, 0);
        const shopRevenue = totals.find((entry) => entry.type === "shop")?.totalAmount ?? 0;

        return {
            totalRevenue,
            revenueByType: totals,
            shopRevenue
        };
    } catch (error) {
        console.error("Error getting revenue statistics:", error);
        throw error;
    }
};
