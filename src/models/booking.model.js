import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "User is required"]
        },
        trainer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: [true, "Trainer is required"]
        },
        gym: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Gym",
            required: [true, "Gym is required"]
        },
        gymName: {
            type: String,
            required: [true, "Gym name is required"]
        },
        day: {
            type: String,
            enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
            required: [true, "Day is required"]
        },
        startTime: {
            type: String, // HH:MM format
            required: [true, "Start time is required"]
        },
        endTime: {
            type: String, // HH:MM format
            required: [true, "End time is required"]
        },
        bookingDate: {
            type: Date,
            required: [true, "Booking date is required"]
        },

        // for future enhancements
        status: {
            type: String,
            enum: ["pending", "confirmed", "cancelled", "completed"],
            default: "pending"
        },
        type: {
            type: String,
            enum: ["in-person", "virtual"],
            default: "in-person"
        },
        paymentStatus: {
            type: String,
            enum: ["pending", "paid", "refunded", "free"],
            default: "pending"
        },
        price: {
            type: Number,
            default: 0
        },
        notes: {
            type: String,
            default: ""
        },
        sessionFeedback: {
            rating: {
                type: Number,
                min: 1,
                max: 5
            },
            comment: {
                type: String
            },
            createdAt: {
                type: Date
            }
        },
        cancellationReason: {
            type: String
        }
    },
    {
        timestamps: true
    }
);

// Index for faster querying
bookingSchema.index({ user: 1, trainer: 1, bookingDate: 1 });
bookingSchema.index({ trainer: 1, bookingDate: 1 });
bookingSchema.index({ gym: 1, bookingDate: 1 });
bookingSchema.index({ status: 1 });

// Validate time format
bookingSchema.pre("save", function(next) {
    // Validate time format (HH:MM)
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(this.startTime) || !timeRegex.test(this.endTime)) {
        return next(new Error("Invalid time format. Use HH:MM format."));
    }
    
    // Convert time strings to minutes for comparison
    const startMinutes = timeToMinutes(this.startTime);
    const endMinutes = timeToMinutes(this.endTime);
    
    // Validate start time is before end time
    if (startMinutes >= endMinutes) {
        return next(new Error("Start time must be before end time"));
    }
    
    next();
});

// Utility function to convert time string to minutes
function timeToMinutes(timeString) {
    const [hours, minutes] = timeString.split(":").map(Number);
    return hours * 60 + minutes;
}

export const Booking = mongoose.model("Booking", bookingSchema);
export default Booking; 