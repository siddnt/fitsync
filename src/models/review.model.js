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

const Review = mongoose.model("Review", reviewSchema);

export default Review; 

// // Static method to calculate average rating for a gym
// reviewSchema.statics.calculateAverageRating = async function(gymId) {
//     const stats = await this.aggregate([
//         {
//             $match: { gym: gymId }
//         },
//         {
//             $group: {
//                 _id: "$gym",
//                 avgRating: { $avg: "$rating" },
//                 numReviews: { $sum: 1 }
//             }
//         }
//     ]);

//     // Update gym with average rating
//     if (stats.length > 0) {
//         await mongoose.model("Gym").findByIdAndUpdate(gymId, {
//             averageRating: stats[0].avgRating,
//             numReviews: stats[0].numReviews
//         });
//     } else {
//         await mongoose.model("Gym").findByIdAndUpdate(gymId, {
//             averageRating: 0,
//             numReviews: 0
//         });
//     }
// };

// // Call calculateAverageRating after save
// reviewSchema.post("save", function() {
//     this.constructor.calculateAverageRating(this.gym);
// });

// // Call calculateAverageRating after remove
// reviewSchema.post("remove", function() {
//     this.constructor.calculateAverageRating(this.gym);
// });