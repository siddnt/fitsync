import Stripe from "stripe";
import { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, isStripeConfigured } from "../config/stripe.config.js";
import PaymentSession from "../models/paymentSession.model.js";
import { Course } from "../models/course.model.js";
import User from "../models/user.model.js";
import Cart from "../models/cart.model.js";
import Order from "../models/order.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { recordCourseRevenue } from "../services/revenue.service.js";
import Revenue from "../models/revenue.model.js";

const stripe = new Stripe(STRIPE_SECRET_KEY);

// Helpers
const appBaseUrl = () => process.env.APP_BASE_URL || "http://localhost:4000";

// Create Stripe Checkout Session for course enrollment
export const createCourseCheckoutSession = asyncHandler(async (req, res) => {
  if (!req.session.userId) throw new ApiError(401, "Login required");
  if (!isStripeConfigured()) throw new ApiError(500, "Stripe not configured");

  const { courseId, trainerId } = req.body;
  if (!courseId || !trainerId) throw new ApiError(400, "courseId and trainerId are required");

  const [course, user, trainer] = await Promise.all([
    Course.findById(courseId),
    User.findById(req.session.userId),
    User.findById(trainerId),
  ]);
  if (!course) throw new ApiError(404, "Course not found");
  if (!user) throw new ApiError(404, "User not found");
  if (!trainer) throw new ApiError(404, "Trainer not found");

  // Deny duplicate enrollment of the same course irrespective of trainer
  if (typeof user.isEnrolledInCourse === 'function' && user.isEnrolledInCourse(course._id)) {
    throw new ApiError(400, "You are already enrolled in this course. You can renew after it expires.");
  }

  const sessionRecord = await PaymentSession.create({
    user: user._id,
    type: "course",
    course: course._id,
    trainer: trainer._id,
    currency: "inr",
    amount: course.price,
  });

  const checkout = await stripe.checkout.sessions.create({
    mode: "payment",
    metadata: {
      paymentSessionId: sessionRecord._id.toString(),
      type: "course",
      courseId: course._id.toString(),
      trainerId: trainer._id.toString(),
      userId: user._id.toString(),
    },
    customer_email: user.email,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "inr",
          unit_amount: Math.round(course.price * 100),
          product_data: { name: `Course Enrollment: ${course.name}` },
        },
      },
    ],
    success_url: `${appBaseUrl()}/payments/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appBaseUrl()}/payments/cancelled`,
  });

  sessionRecord.stripe.checkoutSessionId = checkout.id;
  await sessionRecord.save();

  return res.status(200).json(new ApiResponse(200, { url: checkout.url }, "Checkout session created"));
});

// Create Stripe Checkout Session for shop (cart) order
export const createShopCheckoutSession = asyncHandler(async (req, res) => {
  if (!req.session.userId) throw new ApiError(401, "Login required");
  if (!isStripeConfigured()) throw new ApiError(500, "Stripe not configured");

  // Expect shipping form info in body to snapshot before redirecting to Stripe
  const { firstName, lastName, phone, address, city, state, zipCode } = req.body;

  const [user, cart] = await Promise.all([
    User.findById(req.session.userId),
    Cart.findOne({ user: req.session.userId }).populate({ path: "items.product", select: "name price image" }),
  ]);
  if (!user) throw new ApiError(404, "User not found");
  if (!cart || !cart.items || cart.items.length === 0) throw new ApiError(400, "Cart is empty");

  const subtotal = cart.total;
  const tax = Math.round(subtotal * 0.05);
  const shippingCost = 0;
  const total = subtotal + tax + shippingCost;

  const snapshot = {
    items: cart.items.map((i) => ({
      product: i.product._id,
      name: i.product.name,
      quantity: i.quantity,
      price: i.product.price,
      image: i.product.image,
    })),
    subtotal,
    tax,
    shippingCost,
    total,
    shippingAddress: {
      firstName,
      lastName,
      email: user.email,
      phone,
      address,
      city,
      state,
      zipCode,
    },
  };

  const sessionRecord = await PaymentSession.create({
    user: user._id,
    type: "shop",
    cartSnapshot: snapshot,
    currency: "inr",
    amount: total,
  });

  const line_items = cart.items.map((i) => ({
    quantity: i.quantity,
    price_data: {
      currency: "inr",
      unit_amount: Math.round(i.product.price * 100),
      product_data: { name: i.product.name },
    },
  }));

  // Add a tax line if needed to show total matches
  if (tax > 0) {
    line_items.push({
      quantity: 1,
      price_data: {
        currency: "inr",
        unit_amount: Math.round(tax * 100),
        product_data: { name: "Tax" },
      },
    });
  }

  const checkout = await stripe.checkout.sessions.create({
    mode: "payment",
    metadata: {
      paymentSessionId: sessionRecord._id.toString(),
      type: "shop",
      userId: user._id.toString(),
    },
    customer_email: user.email,
    line_items,
    success_url: `${appBaseUrl()}/payments/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appBaseUrl()}/payments/cancelled`,
  });

  sessionRecord.stripe.checkoutSessionId = checkout.id;
  await sessionRecord.save();

  return res.status(200).json(new ApiResponse(200, { url: checkout.url }, "Checkout session created"));
});

// Stripe Webhook handler
export const stripeWebhook = asyncHandler(async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;
  try {
    const raw = req.rawBody || req.body;
    event = stripe.webhooks.constructEvent(raw, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed.", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const paymentSessionId = session.metadata?.paymentSessionId;
    if (!paymentSessionId) return res.json({ received: true });

    const record = await PaymentSession.findById(paymentSessionId);
    if (!record || record.processed) return res.json({ received: true });

    record.stripe.paymentIntentId = session.payment_intent;
    record.stripe.status = "completed";
    await record.save();

    if (record.type === "course") {
      await finalizeCourseEnrollment(record);
    } else if (record.type === "shop") {
      await finalizeShopOrder(record);
    }
  }

  res.json({ received: true });
});

// Post-payment processors
const finalizeCourseEnrollment = async (payment) => {
  const [user, trainer, course] = await Promise.all([
    User.findById(payment.user),
    User.findById(payment.trainer),
    Course.findById(payment.course),
  ]);
  if (!user || !trainer || !course) return;

  // Prevent duplicate processing
  if (payment.processed) return;

  // If already enrolled, skip
  if (user.isEnrolledInCourse && user.isEnrolledInCourse(course._id)) {
    payment.processed = true;
    await payment.save();
    return;
  }

  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 28);

  user.enrolledCourses.push({ course: course._id, trainer: trainer._id, status: "active", startDate, endDate });
  trainer.trainerClients.push({ user: user._id, course: course._id, status: "active", startDate, endDate });
  await Promise.all([user.save(), trainer.save()]);

  try {
    await recordCourseRevenue(course._id, user._id, "enrollment", `Stripe: ${payment.stripe.paymentIntentId}`);
  } catch (e) {
    console.error("Failed to record course revenue", e);
  }

  payment.processed = true;
  await payment.save();
};

const finalizeShopOrder = async (payment) => {
  const user = await User.findById(payment.user);
  if (!user) return;
  if (payment.processed) return;

  const snap = payment.cartSnapshot;
  if (!snap) return;

  // Create order from snapshot
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const randomDigits = Math.floor(1000 + Math.random() * 9000);
  const orderNumber = `FS-${year}${month}${day}-${randomDigits}`;

  const orderItems = snap.items.map((i) => ({
    product: i.product,
    name: i.name,
    quantity: i.quantity,
    price: i.price,
    image: i.image,
  }));

  const order = await Order.create({
    user: user._id,
    orderItems,
    shippingAddress: snap.shippingAddress,
    paymentMethod: "Stripe",
    subtotal: snap.subtotal,
    tax: snap.tax,
    shippingCost: snap.shippingCost,
    total: snap.total,
    orderNumber,
    status: "Processing",
  });

  // Clear the live cart after successful checkout
  try {
    await Cart.findOneAndUpdate({ user: user._id }, { items: [], total: 0 }, { upsert: true });
  } catch (e) {
    console.warn("Failed clearing cart post payment", e.message);
  }

  // Record revenue for shop
  try {
    await Revenue.create({
      order: order._id,
      amount: snap.total,
      user: user._id,
      type: "shop",
      description: `Shop order via Stripe: ${payment.stripe.paymentIntentId}`,
    });
  } catch (e) {
    console.error("Failed to record shop revenue", e);
  }

  payment.processed = true;
  await payment.save();
};

// Payment success/cancel pages endpoints
export const paymentSuccess = asyncHandler(async (req, res) => {
  const { session_id } = req.query;
  if (!session_id) return res.redirect("/");

  // Optional: fetch session to display info
  try {
    const cs = await stripe.checkout.sessions.retrieve(session_id);

    // Fallback: if webhook didn't process, finalize based on session metadata
    try {
      const paymentSessionId = cs?.metadata?.paymentSessionId;
      if (paymentSessionId) {
        const record = await PaymentSession.findById(paymentSessionId);
        if (record && !record.processed) {
          if (record.type === "course") {
            await finalizeCourseEnrollment(record);
          } else if (record.type === "shop") {
            await finalizeShopOrder(record);
          }
        }
      }
    } catch (e) {
      console.warn("Payment success fallback finalize failed:", e?.message);
    }
    return res.render("pages/checkoutSuccess", {
      title: "Payment Successful - FitSync",
      message: "Your payment was successful.",
      session: cs,
      isLoggedIn: !!req.session.userId,
      userId: req.session.userId,
      userRole: req.session.userRole,
    });
  } catch (e) {
    return res.render("pages/checkoutSuccess", {
      title: "Payment Successful - FitSync",
      message: "Your payment was successful.",
      session: null,
      isLoggedIn: !!req.session.userId,
      userId: req.session.userId,
      userRole: req.session.userRole,
    });
  }
});

export const paymentCancelled = asyncHandler(async (req, res) => {
  return res.render("pages/checkoutCancelled", {
    title: "Payment Cancelled - FitSync",
    isLoggedIn: !!req.session.userId,
    userId: req.session.userId,
    userRole: req.session.userRole,
  });
});
