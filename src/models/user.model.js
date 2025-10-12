import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Name is required"],
            trim: true,
            index: true
        },
        email: {
            type: String,
            required: [true, "Email is required"],
            unique: true,
            lowercase: true,
            trim: true
        },
        password: {
            type: String,
            required: [true, "Password is required"],
            minlength: [6, "Password must be at least 6 characters"]
        },
        role: {
            type: String,
            enum: ["user", "trainer", "admin"],
            default: "user"
        },
        status: {
            type: String,
            enum: ["active", "inactive", "pending"],
            default: function() {
                // If role is trainer, set status to pending by default
                return this.role === "trainer" ? "pending" : "active";
            }
        },
        profilePicture: {
            type: String,
            default: ""
        },
        refreshToken: {
            type: String
        },
        bio: {
            type: String,
            default: ""
        },
        contactNumber: {
            type: String,
            default: ""
        },
        address: {
            type: String,
            default: ""
        },
        specializations: [{ type: String }],
        // Trainers registered courses - courses they can teach
        trainerCourses: [
            {
                course: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Course"
                },
                registeredAt: {
                    type: Date,
                    default: Date.now
                },
                status: {
                    type: String,
                    enum: ["active", "inactive"],
                    default: "active"
                }
            }
        ],
        // Trainers' clients/trainees
        trainerClients: [
            {
                user: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User"
                },
                course: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Course"
                },
                enrolledAt: {
                    type: Date,
                    default: Date.now
                },
                startDate: {
                    type: Date,
                    default: Date.now
                },
                endDate: {
                    type: Date,
                    default: function() {
                        // Set end date to 4 weeks (28 days) after start date
                        const startDate = this.startDate || new Date();
                        const endDate = new Date(startDate);
                        endDate.setDate(endDate.getDate() + 28);
                        return endDate;
                    }
                },
                status: {
                    type: String,
                    enum: ["active", "completed", "cancelled"],
                    default: "active"
                }
            }
        ],
        // User enrolled courses
        enrolledCourses: [
            {
                course: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Course"
                },
                trainer: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User"
                },
                enrolledAt: {
                    type: Date,
                    default: Date.now
                },
                startDate: {
                    type: Date,
                    default: Date.now
                },
                endDate: {
                    type: Date,
                    default: function() {
                        // Set end date to 4 weeks (28 days) after start date
                        const startDate = this.startDate || new Date();
                        const endDate = new Date(startDate);
                        endDate.setDate(endDate.getDate() + 28); // 4 weeks
                        return endDate;
                    }
                },
                status: {
                    type: String,
                    enum: ["active", "completed", "cancelled"],
                    default: "active"
                }
            }
        ],
        enrolledPlans: [
            {
                plan: {
                    type: String,
                    required: true
                },
                enrolledAt: {
                    type: Date,
                    default: Date.now
                },
                status: {
                    type: String,
                    enum: ["active", "completed", "cancelled"],
                    default: "active"
                }
            }
        ],
        height: Number,
        weight: Number,
        fitnessGoals: [{ type: String }],
        age: Number,
        gender: String
    },
    {
        timestamps: true
    }
);

// Pre-save hook to hash password
userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();
    
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Method to check if user is already enrolled in a specific course
userSchema.methods.isEnrolledInCourse = function(courseId) {
    if (!courseId) return false;
    const now = new Date();
    
    return this.enrolledCourses.some(enrollment => {
        if (!enrollment.course) return false;
        
        // Convert both to strings for proper comparison
        const enrollmentCourseStr = enrollment.course.toString();
        const courseIdStr = courseId.toString();
        
        return enrollmentCourseStr === courseIdStr && 
               enrollment.status === "active" &&
               enrollment.startDate <= now &&
               enrollment.endDate >= now;
    });
};

// Method to check if an enrollment has expired
userSchema.methods.isEnrollmentExpired = function(enrollmentId) {
    const now = new Date();
    const enrollment = this.enrolledCourses.id(enrollmentId);
    
    if (!enrollment) return true;
    
    return now > enrollment.endDate;
};

// Method to check if trainer can teach a specific course
userSchema.methods.canTeachCourse = function(courseId) {
    if (!courseId) return false;
    
    return this.trainerCourses.some(registration => {
        if (!registration.course) return false;
        
        // Convert both to strings for proper comparison
        const regCourseStr = registration.course.toString();
        const courseIdStr = courseId.toString();
        
        return regCourseStr === courseIdStr && registration.status === "active";
    });
};

// Method to get user's weekly schedule based on enrolled/teaching courses
userSchema.methods.getWeeklySchedule = async function() {
    const schedule = {
        monday: [],
        tuesday: [],
        wednesday: [],
        thursday: [],
        friday: [],
        saturday: [],
        sunday: []
    };
    
    try {
        const now = new Date();
        
        // Populate the courses to get their schedules
        if (this.role === "trainer") {
            await this.populate("trainerCourses.course");
            
            // Add trainer courses to schedule
            for (const registration of this.trainerCourses) {
                if (registration.status === "active" && registration.course) {
                    const course = registration.course;
                    
                    for (const session of course.schedule) {
                        schedule[session.day].push({
                            courseId: course._id,
                            courseName: course.name,
                            startTime: session.startTime,
                            endTime: session.endTime,
                            role: "trainer"
                        });
                    }
                }
            }
        } else {
            // For regular users, populate enrolled courses
            await this.populate("enrolledCourses.course enrolledCourses.trainer");
            
            // Add enrolled courses to schedule (only if active and not expired)
            for (const enrollment of this.enrolledCourses) {
                if (enrollment.status === "active" && enrollment.course && 
                   enrollment.startDate <= now && enrollment.endDate >= now) {
                    const course = enrollment.course;
                    
                    for (const session of course.schedule) {
                        schedule[session.day].push({
                            courseId: course._id,
                            courseName: course.name,
                            startTime: session.startTime,
                            endTime: session.endTime,
                            trainer: enrollment.trainer ? enrollment.trainer.name : "No trainer assigned",
                            role: "trainee",
                            enrollmentEnds: enrollment.endDate
                        });
                    }
                }
            }
        }
        
        // Sort each day's schedule by start time
        for (const day in schedule) {
            schedule[day].sort((a, b) => {
                const aTime = a.startTime.split(":").map(Number);
                const bTime = b.startTime.split(":").map(Number);
                
                // Compare hours first, then minutes
                if (aTime[0] !== bTime[0]) {
                    return aTime[0] - bTime[0];
                }
                return aTime[1] - bTime[1];
            });
        }
        
        return schedule;
    } catch (error) {
        throw error;
    }
};

// Method to renew course enrollment (add another 4 weeks)
userSchema.methods.renewCourseEnrollment = function(enrollmentId) {
    const enrollment = this.enrolledCourses.id(enrollmentId);
    
    if (!enrollment) {
        throw new Error("Enrollment not found");
    }
    
    const newEndDate = new Date(enrollment.endDate);
    newEndDate.setDate(newEndDate.getDate() + 28); // Add 4 more weeks
    enrollment.endDate = newEndDate;
    
    return this.save();
};

// Method to check if password is correct
userSchema.methods.isPasswordCorrect = async function (password) {
    return await bcrypt.compare(password, this.password);
};

// Method to generate access token
userSchema.methods.generateAccessToken = function () {
    return jwt.sign(
        {
            _id: this._id,
            email: this.email,
            name: this.name,
            role: this.role
        },
        process.env.JWT_SECRET || "your-secret-key",
        {
            expiresIn: process.env.JWT_EXPIRY || "1d"
        }
    );
};

// Method to generate refresh token
userSchema.methods.generateRefreshToken = function () {
    return jwt.sign(
        {
            _id: this._id
        },
        process.env.REFRESH_TOKEN_SECRET || "your-refresh-secret",
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY || "7d"
        }
    );
};

// Method to get trainer's clients with their enrollment information
userSchema.methods.getTrainerClients = async function() {
    if (this.role !== "trainer") {
        throw new Error("Only trainers can access client information");
    }
    
    try {
        // Populate the client and course information
        await this.populate({
            path: "trainerClients.user",
            select: "name email profilePicture age gender"
        });
        
        await this.populate({
            path: "trainerClients.course",
            select: "name description"
        });
        
        // Filter for active clients and format the data
        const now = new Date();
        const activeClients = this.trainerClients.filter(client => 
            client.status === "active" && 
            client.startDate <= now && 
            client.endDate >= now
        );
        
        return activeClients.map(client => ({
            id: client.user._id,
            name: client.user.name,
            email: client.user.email,
            profilePicture: client.user.profilePicture,
            age: client.user.age,
            gender: client.user.gender,
            course: {
                id: client.course._id,
                name: client.course.name
            },
            enrolledAt: client.enrolledAt,
            startDate: client.startDate,
            endDate: client.endDate,
            status: client.status,
            remainingDays: Math.ceil((client.endDate - now) / (1000 * 60 * 60 * 24))
        }));
    } catch (error) {
        throw error;
    }
};

const User = mongoose.model("User", userSchema);
export { User };  // Keep named export for backward compatibility 
export default User;  // Default export for cleaner imports 