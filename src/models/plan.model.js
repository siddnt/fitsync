import mongoose from "mongoose";

const planSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, "Plan title is required"],
            trim: true
        },
        description: {
            type: String,
            required: [true, "Plan description is required"]
        },
        price: {
            type: Number,
            required: [true, "Plan price is required"],
            min: [0, "Price cannot be negative"]
        },
        duration: {
            value: {
                type: Number,
                required: [true, "Duration value is required"],
                min: [1, "Duration must be at least 1"]
            },
            unit: {
                type: String,
                enum: ["days", "weeks", "months"],
                default: "months"
            }
        },
        level: {
            type: String,
            enum: ["beginner", "intermediate", "advanced", "all"],
            default: "all"
        },
        category: {
            type: String,
            required: [true, "Plan category is required"],
            enum: ["weight loss", "muscle gain", "cardio", "yoga", "flexibility", "general fitness", "other"]
        },
        image: {
            type: String,
            default: ""
        },
        creator: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "Plan creator is required"]
        },
        workouts: [
            {
                day: {
                    type: Number,
                    required: true
                },
                exercises: [
                    {
                        name: {
                            type: String,
                            required: true
                        },
                        sets: {
                            type: Number,
                            default: 3
                        },
                        reps: {
                            type: Number,
                            default: 10
                        },
                        duration: {
                            type: Number
                        },
                        notes: {
                            type: String
                        }
                    }
                ],
                notes: String
            }
        ],
        enrollmentCount: {
            type: Number,
            default: 0
        },
        rating: {
            type: Number,
            min: [0, "Rating cannot be negative"],
            max: [5, "Rating cannot be more than 5"],
            default: 0
        },
        isActive: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true
    }
);

// Index for faster searching
planSchema.index({ title: "text", description: "text", category: 1, level: 1 });

// Method to compute the full duration in days
planSchema.methods.getDurationInDays = function() {
    const { value, unit } = this.duration;
    switch(unit) {
        case "days": return value;
        case "weeks": return value * 7;
        case "months": return value * 30; // Approximate
        default: return value * 30;
    }
};

export const Plan = mongoose.model("Plan", planSchema);
export default Plan; 