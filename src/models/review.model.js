import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "User is required"]
        },
        gym: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Gym",
            required: [true, "Gym is required"]
        },
        rating: {
            type: Number,
            required: [true, "Rating is required"],
            min: 1,
            max: 5
        },
        comment: {
            type: String,
            required: [true, "Comment is required"],
            trim: true,
            maxlength: [500, "Comment cannot be more than 500 characters"]
        }
    },
    {
        timestamps: true
    }
);

// Compound index to ensure a user can only review a gym once
reviewSchema.index({ user: 1, gym: 1 }, { unique: true });
reviewSchema.index({ gym: 1, updatedAt: -1 });

const Review = mongoose.model("Review", reviewSchema);

export default Review;
