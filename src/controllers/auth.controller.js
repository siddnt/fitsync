import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import User from "../models/user.model.js";
import { Course } from "../models/course.model.js";
import bcrypt from "bcrypt";

// Cookie options
const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production"
};

// Register a new user
export const register = asyncHandler(async (req, res) => {
    const { name, email, password, role } = req.body;

    // Validation
    if (!name || !email || !password) {
        throw new ApiError(400, "All fields are required");
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        throw new ApiError(409, "User with this email already exists");
    }

    // Create new user
    const user = await User.create({
        name,
        email,
        password,
        role: role || "user"
    });

    // Remove password from response
    const createdUser = await User.findById(user._id).select("-password -refreshToken");

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user");
    }

    // If session-based auth, set the session
    if (req.session) {
        req.session.userId = createdUser._id;
        req.session.userRole = createdUser.role;
        req.session.userName = createdUser.name;
    }

    // Return response
    return res.status(201).json(
        new ApiResponse(201, createdUser, "User registered successfully")
    );
});

// Login user
export const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
        throw new ApiError(400, "Email and password are required");
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
        throw new ApiError(404, "User does not exist");
    }

    // Check if user is active
    if (user.status !== "active") {
        throw new ApiError(403, "Your account is not active. Please contact administrator.");
    }

    // Verify password
    const isPasswordValid = await user.isPasswordCorrect(password);
    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid credentials");
    }

    // Generate tokens
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    // Update refresh token in DB
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    // Set cookies
    res.cookie("accessToken", accessToken, cookieOptions);
    res.cookie("refreshToken", refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });

    // Set session if using session-based auth
    if (req.session) {
        req.session.userId = user._id;
        req.session.userRole = user.role;
        req.session.userName = user.name;
    }

    // Return response
    return res.status(200).json(
        new ApiResponse(
            200,
            {
                user: {
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role
                },
                accessToken
            },
            "Login successful"
        )
    );
});

// Logout user
export const logout = asyncHandler(async (req, res) => {
    // If JWT auth, clear cookies and refresh token
    if (req.cookies?.refreshToken) {
        // Find user by refresh token
        const user = await User.findOne({ refreshToken: req.cookies.refreshToken });
        
        if (user) {
            // Clear refresh token in DB
            user.refreshToken = undefined;
            await user.save({ validateBeforeSave: false });
        }
        
        // Clear cookies
        res.clearCookie("accessToken", cookieOptions);
        res.clearCookie("refreshToken", cookieOptions);
    }
    
    // If session auth, destroy session
    if (req.session) {
        req.session.destroy(err => {
            if (err) {
                throw new ApiError(500, "Failed to logout");
            }
        });
    }
    
    // Redirect to home page instead of returning JSON
    return res.redirect('/');
});

// Render login page
export const getLoginPage = asyncHandler(async (req, res) => {
    if (req.session && req.session.userId) {
        // Redirect to dashboard if already logged in
        return res.redirect("/");
    }
    
    return res.render("pages/login", { 
        title: "Login - FitSync",
        error: null
    });
});

// Render register page
export const getRegisterPage = asyncHandler(async (req, res) => {
    if (req.session && req.session.userId) {
        // Redirect to dashboard if already logged in
        return res.redirect("/");
    }
    
    return res.render("pages/register", { 
        title: "Register - FitSync",
        error: null
    });
});

// Process simple form login (for EJS templates)
export const processFormLogin = asyncHandler(async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Find user
        const user = await User.findOne({ email });
        
        if (!user || !(await user.isPasswordCorrect(password))) {
            return res.render("pages/login", {
                title: "Login - FitSync",
                error: "Invalid email or password"
            });
        }
        
        // Check if user is active
        if (user.status !== "active") {
            return res.render("pages/login", {
                title: "Login - FitSync",
                error: "Your account is not active. Please contact administrator."
            });
        }
        
        // Set session
        req.session.userId = user._id;
        req.session.userRole = user.role;
        req.session.userName = user.name;
        
        // Redirect based on role
        if (user.role === "admin") {
            return res.redirect("/admin/dashboard");
        } else if (user.role === "trainer") {
            return res.redirect("/trainer/dashboard");
        } else {
            return res.redirect("/user/dashboard");
        }
    } catch (error) {
        return res.render("pages/login", {
            title: "Login - FitSync",
            error: error.message
        });
    }
});

// Process simple form registration (for EJS templates)
export const processFormRegister = asyncHandler(async (req, res) => {
    try {
        const { name, email, password, role, age, gender, courses } = req.body;
        
        // Validation
        if (!name || !email || !password) {
            return res.render("pages/register", {
                title: "Register - FitSync",
                error: "All fields are required"
            });
        }
        
        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.render("pages/register", {
                title: "Register - FitSync",
                error: "User with this email already exists"
            });
        }
        
        // Prepare user data
        const userData = {
            name,
            email,
            password,
            role: role || "user"
        };
        
        // Add optional fields if provided
        if (age) userData.age = age;
        if (gender) userData.gender = gender;
        
        // Set status to pending for trainers
        if (role === 'trainer') {
            userData.status = 'pending';
        }
        
        // Create user
        const user = await User.create(userData);
        
        // For trainers, add selected courses
        if (role === 'trainer' && courses) {
            // Convert to array if it's a single value
            const coursesArray = Array.isArray(courses) 
                ? courses 
                : [courses];
            
            // Find courses by name (case insensitive)
            const courseInstances = await Course.find({
                name: { $in: coursesArray.map(c => c.toLowerCase()) }
            });
            
            // Add courses to trainer's registered courses
            if (courseInstances.length > 0) {
                const trainerCourses = courseInstances.map(course => ({
                    course: course._id,
                    status: 'active'
                }));
                
                // Update user with trainerCourses
                await User.findByIdAndUpdate(
                    user._id,
                    { $push: { trainerCourses: { $each: trainerCourses } } }
                );
            }
        }
        
        // Set session if not a trainer (trainers need approval)
        if (role !== 'trainer') {
            req.session.userId = user._id;
            req.session.userRole = user.role;
            req.session.userName = user.name;
            
            // Redirect to dashboard
            return res.redirect("/user/dashboard");
        } else {
            // Redirect to a pending approval page for trainers
            return res.render("pages/pendingApproval", {
                title: "Registration Pending - FitSync"
            });
        }
    } catch (error) {
        console.error("Registration error:", error);
        return res.render("pages/register", {
            title: "Register - FitSync",
            error: error.message || "An error occurred during registration"
        });
    }
}); 