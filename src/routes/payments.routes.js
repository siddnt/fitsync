import { Router } from "express";
import { isAuthenticated } from "../middlewares/auth.middleware.js";
import {
  createCourseCheckoutSession,
  createShopCheckoutSession,
  stripeWebhook,
  paymentSuccess,
  paymentCancelled,
} from "../controllers/payment.controller.js";

const router = Router();

// Public pages for results
router.get("/success", paymentSuccess);
router.get("/cancelled", paymentCancelled);

// Create sessions (auth required)
router.post("/create-course-session", isAuthenticated, createCourseCheckoutSession);
router.post("/create-shop-session", isAuthenticated, createShopCheckoutSession);

// Stripe webhook requires raw body, so this route should be mounted with a raw parser upstream
router.post("/webhook", stripeWebhook);

export default router;
