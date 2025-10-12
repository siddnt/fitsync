import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "User is required"]
        },
        course: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Course",
            required: [true, "Course is required"]
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

// Compound index to ensure a user can only review a course once
reviewSchema.index({ user: 1, course: 1 }, { unique: true });

// Static method to calculate average rating for a course
reviewSchema.statics.calculateAverageRating = async function(courseId) {
    const stats = await this.aggregate([
        {
            $match: { course: courseId }
        },
        {
            $group: {
                _id: "$course",
                avgRating: { $avg: "$rating" },
                numReviews: { $sum: 1 }
            }
        }
    ]);

    // Update course with average rating
    if (stats.length > 0) {
        await mongoose.model("Course").findByIdAndUpdate(courseId, {
            averageRating: stats[0].avgRating,
            numReviews: stats[0].numReviews
        });
    } else {
        await mongoose.model("Course").findByIdAndUpdate(courseId, {
            averageRating: 0,
            numReviews: 0
        });
    }
};

// Call calculateAverageRating after save
reviewSchema.post("save", function() {
    this.constructor.calculateAverageRating(this.course);
});

// Call calculateAverageRating after remove
reviewSchema.post("remove", function() {
    this.constructor.calculateAverageRating(this.course);
});

const Review = mongoose.model("Review", reviewSchema);

export default Review; 