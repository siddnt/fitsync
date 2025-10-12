import { Router } from "express";
import {
    createOrder,
    getUserOrders,
    getOrderById,
    getOrdersPage
} from "../controllers/order.controller.js";
import { isAuthenticated } from "../middleware/auth.middleware.js";

const router = Router();

// Apply middleware to all routes
router.use(isAuthenticated);

// API routes
router.post("/create", createOrder);
router.get("/api", getUserOrders);
router.get("/api/:orderId", getOrderById);

// Page routes
router.get("/", getOrdersPage);

export default router; 