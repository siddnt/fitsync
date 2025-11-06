import mongoose from "mongoose";

const revenueSchema = new mongoose.Schema(
    {
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
            enum: ["membership", "enrollment", "renewal", "refund", "other", "shop", "listing", "sponsorship", "marketplace", "seller"],
            default: "membership"
        },
        description: {
            type: String,
            trim: true
        },
        metadata: {
            type: Map,
            of: String,
            default: undefined
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }
);

const Revenue = mongoose.model("Revenue", revenueSchema);

export default Revenue; 