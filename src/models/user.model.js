import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const userSchema = new mongoose.Schema(
    {
        firstName: {
            type: String,
            trim: true,
            index: true
        },
        lastName: {
            type: String,
            trim: true,
            index: true
        },
        name: {
            type: String,
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
            enum: [
                "user",
                "trainee",
                "trainer",
                "gym-owner",
                "seller",
                "admin"
            ],
            default: "trainee"
        },
        status: {
            type: String,
            enum: ["active", "inactive", "pending"],
            default: function() {
                // If role is trainer, set status to pending by default
                if (this.role === "trainer") {
                    return "pending";
                }
                if (this.role === "gym-owner") {
                    return "pending";
                }
                return "active";
            }
        },
        profile: {
            headline: { type: String, trim: true, default: "" },
            about: { type: String, trim: true, default: "" },
            location: { type: String, trim: true, default: "" },
            company: { type: String, trim: true, default: "" },
            socialLinks: {
                website: { type: String, trim: true, default: "" },
                instagram: { type: String, trim: true, default: "" },
                facebook: { type: String, trim: true, default: "" }
            }
        },
        ownerMetrics: {
            totalGyms: { type: Number, default: 0 },
            totalImpressions: { type: Number, default: 0 },
            monthlySpend: { type: Number, default: 0 },
            monthlyEarnings: { type: Number, default: 0 }
        },
        traineeMetrics: {
            activeMemberships: { type: Number, default: 0 },
            lastCheckInAt: { type: Date },
            primaryGym: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Gym"
            }
        },
        trainerMetrics: {
            activeTrainees: { type: Number, default: 0 },
            gyms: [{
                type: mongoose.Schema.Types.ObjectId,
                ref: "Gym"
            }]
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
        experienceYears: {
            type: Number,
            default: 0,
            min: 0,
            max: 60
        },
        certifications: [{
            type: String,
            trim: true
        }],
        mentoredCount: {
            type: Number,
            default: 0,
            min: 0
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

userSchema.pre("validate", function (next) {
    if (!this.firstName && this.name) {
        const parts = this.name.trim().split(/\s+/);
        this.firstName = parts.shift();
        this.lastName = parts.length ? parts.join(" ") : this.lastName;
    }

    if (!this.name) {
        const combined = [this.firstName, this.lastName].filter(Boolean).join(" ").trim();
        if (combined) {
            this.name = combined;
        }
    }

    if (!this.name) {
        return next(new Error("Name is required"));
    }

    return next();
});

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

const User = mongoose.model("User", userSchema);
export { User };  // Keep named export for backward compatibility 
export default User;  // Default export for cleaner imports 