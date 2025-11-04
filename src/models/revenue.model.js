import mongoose from "mongoose";

const revenueSchema = new mongoose.Schema(
    {
        course: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Course",
        },
        order: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order",
        },
        amount: {
            type: Number,
            required: [true, "Amount is required"],
            default: 0
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        type: {
            type: String,
            enum: ["enrollment", "renewal", "refund", "other", "shop"],
            default: "enrollment"
        },
        description: {
            type: String,
            trim: true
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }
);

// Static method to get total revenue by course
revenueSchema.statics.getTotalRevenueByCourse = async function() {
    return this.aggregate([
        {
            $group: {
                _id: "$course",
                totalAmount: { $sum: "$amount" }
            }
        },
        {
            $lookup: {
                from: "courses",
                localField: "_id",
                foreignField: "_id",
                as: "courseDetails"
            }
        },
        {
            $unwind: "$courseDetails"
        },
        {
            $project: {
                courseName: "$courseDetails.name",
                totalAmount: 1
            }
        }
    ]);
};

// Static method to get total shop revenue
revenueSchema.statics.getTotalShopRevenue = async function() {
    return this.aggregate([
        { $match: { type: "shop" } },
        { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
    ]);
};

const Revenue = mongoose.model("Revenue", revenueSchema);

export default Revenue; 