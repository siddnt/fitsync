import { Router } from "express";
import {
    register,
    login,
    logout,
    getLoginPage,
    getRegisterPage,
    processFormLogin,
    processFormRegister
} from "../controllers/auth.controller.js";

const router = Router();

// API Routes (for JSON responses)
router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);

// View Routes (for rendering EJS templates)
router.get("/login", getLoginPage);
router.get("/register", getRegisterPage);
router.post("/login-form", processFormLogin);
router.post("/register-form", processFormRegister);

// Handle GET form submissions (redirects)
router.get("/login-form", (req, res) => res.redirect("/auth/login"));
router.get("/register-form", (req, res) => res.redirect("/auth/register"));

// Logout route (both GET and POST)
router.get("/logout", logout);

export default router; 