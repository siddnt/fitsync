import mongoose from "mongoose";

const courseScheduleSchema = new mongoose.Schema({
    day: {
        type: String,
        enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
        required: true
    },
    startTime: {
        type: String, // Format: "HH:MM" (24-hour format)
        required: true
    },
    endTime: {
        type: String, // Format: "HH:MM" (24-hour format)
        required: true
    }
});

const courseSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Course name is required"],
            enum: ["yoga", "zumba", "strength training"],
            unique: true
        },
        description: {
            type: String,
            required: [true, "Course description is required"]
        },
        price: {
            type: Number,
            required: [true, "Course price is required"],
            min: [0, "Price cannot be negative"]
        },
        schedule: {
            type: [courseScheduleSchema],
            required: [true, "Course schedule is required"],
            validate: {
                validator: function(schedules) {
                    // Ensure there's at least one schedule
                    return schedules.length > 0;
                },
                message: "Course must have at least one scheduled session"
            }
        },
        level: {
            type: String,
            enum: ["beginner", "intermediate", "advanced", "all"],
            default: "all"
        },
        image: {
            type: String,
            default: ""
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

// Validate no time conflicts within the course schedule
courseSchema.pre("save", function(next) {
    const scheduleMap = {};
    
    // Check for overlapping schedules within the same course
    for (const session of this.schedule) {
        const key = `${session.day}`;
        if (!scheduleMap[key]) {
            scheduleMap[key] = [];
        }
        
        // Convert time strings to minutes for comparison
        const startMinutes = timeToMinutes(session.startTime);
        const endMinutes = timeToMinutes(session.endTime);
        
        // Check if this session overlaps with any existing session on the same day
        const conflict = scheduleMap[key].some(existingSession => {
            const existingStart = timeToMinutes(existingSession.startTime);
            const existingEnd = timeToMinutes(existingSession.endTime);
            
            return (
                (startMinutes >= existingStart && startMinutes < existingEnd) ||
                (endMinutes > existingStart && endMinutes <= existingEnd) ||
                (startMinutes <= existingStart && endMinutes >= existingEnd)
            );
        });
        
        if (conflict) {
            return next(new Error(`Time conflict in schedule for ${session.day}`));
        }
        
        scheduleMap[key].push(session);
    }
    
    next();
});

// Utility function to convert time string to minutes
function timeToMinutes(timeString) {
    const [hours, minutes] = timeString.split(":").map(Number);
    return hours * 60 + minutes;
}

// Static method to check for conflicts between courses
courseSchema.statics.hasScheduleConflict = async function() {
    const courses = await this.find({});
    
    // Create a map to store all scheduled sessions by day and time
    const scheduleMap = {};
    
    for (const course of courses) {
        for (const session of course.schedule) {
            const key = `${session.day}`;
            if (!scheduleMap[key]) {
                scheduleMap[key] = [];
            }
            
            // Convert time strings to minutes for comparison
            const startMinutes = timeToMinutes(session.startTime);
            const endMinutes = timeToMinutes(session.endTime);
            
            // Check if this session overlaps with any existing session on the same day
            const conflict = scheduleMap[key].some(existingSession => {
                if (existingSession.courseId.equals(course._id)) {
                    return false; // Skip same course
                }
                
                const existingStart = timeToMinutes(existingSession.startTime);
                const existingEnd = timeToMinutes(existingSession.endTime);
                
                return (
                    (startMinutes >= existingStart && startMinutes < existingEnd) ||
                    (endMinutes > existingStart && endMinutes <= existingEnd) ||
                    (startMinutes <= existingStart && endMinutes >= existingEnd)
                );
            });
            
            if (conflict) {
                return true;
            }
            
            scheduleMap[key].push({
                courseId: course._id,
                startTime: session.startTime,
                endTime: session.endTime
            });
        }
    }
    
    return false;
};

export const Course = mongoose.model("Course", courseSchema);
export default Course; 