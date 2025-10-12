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
        course: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Course",
            required: [true, "Course is required"]
        },
        courseName: {
            type: String,
            required: [true, "Course name is required"]
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
bookingSchema.index({ course: 1, bookingDate: 1 });
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

// Static method to check if booking conflicts with trainer's schedule
bookingSchema.statics.hasTrainerTimeConflict = async function(trainerId, day, startTime, endTime, excludeBookingId = null) {
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);
    
    const query = {
        trainer: trainerId,
        day,
        status: { $nin: ["cancelled"] }
    };
    
    // Exclude current booking when updating
    if (excludeBookingId) {
        query._id = { $ne: excludeBookingId };
    }
    
    const trainerBookings = await this.find(query);
    
    // Check for time conflicts
    return trainerBookings.some(booking => {
        const bookingStartMinutes = timeToMinutes(booking.startTime);
        const bookingEndMinutes = timeToMinutes(booking.endTime);
        
        return (
            (startMinutes >= bookingStartMinutes && startMinutes < bookingEndMinutes) ||
            (endMinutes > bookingStartMinutes && endMinutes <= bookingEndMinutes) ||
            (startMinutes <= bookingStartMinutes && endMinutes >= bookingEndMinutes)
        );
    });
};

// Static method to check if booking conflicts with user's schedule
bookingSchema.statics.hasUserTimeConflict = async function(userId, day, startTime, endTime, excludeBookingId = null) {
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);
    
    const query = {
        user: userId,
        day,
        status: { $nin: ["cancelled"] }
    };
    
    // Exclude current booking when updating
    if (excludeBookingId) {
        query._id = { $ne: excludeBookingId };
    }
    
    const userBookings = await this.find(query);
    
    // Check for time conflicts
    return userBookings.some(booking => {
        const bookingStartMinutes = timeToMinutes(booking.startTime);
        const bookingEndMinutes = timeToMinutes(booking.endTime);
        
        return (
            (startMinutes >= bookingStartMinutes && startMinutes < bookingEndMinutes) ||
            (endMinutes > bookingStartMinutes && endMinutes <= bookingEndMinutes) ||
            (startMinutes <= bookingStartMinutes && endMinutes >= bookingEndMinutes)
        );
    });
};

export const Booking = mongoose.model("Booking", bookingSchema);
export default Booking; 