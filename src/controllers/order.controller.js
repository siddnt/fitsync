import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import Order from "../models/order.model.js";
import Cart from "../models/cart.model.js";
import User from "../models/user.model.js";

// Create a new order
export const createOrder = asyncHandler(async (req, res) => {
    // Check if user is logged in
    if (!req.session.userId) {
        throw new ApiError(401, "Please login to place an order");
    }

    const { 
        firstName, lastName, phone, 
        address, city, state, zipCode, 
        paymentMethod 
    } = req.body;
    
    // Get the user data to get their email
    const user = await User.findById(req.session.userId);
    if (!user) {
        throw new ApiError(404, "User not found");
    }
    
    // Get the user's cart
    const cart = await Cart.findOne({ user: req.session.userId })
        .populate({
            path: "items.product",
            select: "name price image"
        });
    
    if (!cart || !cart.items || cart.items.length === 0) {
        throw new ApiError(400, "Your cart is empty");
    }
    
    // Calculate order totals
    const subtotal = cart.total;
    const taxRate = 0.05; // 5% tax
    const tax = Math.round(subtotal * taxRate);
    const shippingCost = 0; // Free shipping
    const total = subtotal + tax + shippingCost;
    
    // Map cart items to order items
    const orderItems = cart.items.map(item => ({
        product: item.product._id,
        name: item.product.name,
        quantity: item.quantity,
        price: item.product.price,
        image: item.product.image
    }));
    
    try {
        // Generate order number manually
        const date = new Date();
        const year = date.getFullYear().toString().slice(-2);
        const month = (date.getMonth() + 1).toString().padStart(2, "0");
        const day = date.getDate().toString().padStart(2, "0");
        const randomDigits = Math.floor(1000 + Math.random() * 9000);
        const orderNumber = `FS-${year}${month}${day}-${randomDigits}`;
        
        // Create the order with manually generated orderNumber
        const order = await Order.create({
            user: req.session.userId,
            orderItems,
            shippingAddress: {
                firstName,
                lastName,
                email: user.email, // Use email from user account
                phone,
                address,
                city,
                state,
                zipCode
            },
            paymentMethod: paymentMethod || "Cash on Delivery",
            subtotal,
            tax,
            shippingCost,
            total,
            orderNumber, // Set the orderNumber directly
            status: "Processing"
        });
        
        return res.status(201).json({
            success: true,
            data: { order },
            message: "Order placed successfully"
        });
    } catch (error) {
        console.error("Order creation error:", error);
        return res.status(500).json({
            success: false,
            message: error.message || "Error processing your order"
        });
    }
});

// Get all orders for the current user
export const getUserOrders = asyncHandler(async (req, res) => {
    // Check if user is logged in
    if (!req.session.userId) {
        throw new ApiError(401, "Please login to view your orders");
    }

    // Get orders for the user, sorted by newest first
    const orders = await Order.find({ user: req.session.userId })
        .sort({ createdAt: -1 });
    
    return res.status(200).json(
        new ApiResponse(200, { orders }, "Orders fetched successfully")
    );
});

// Get order details by ID
export const getOrderById = asyncHandler(async (req, res) => {
    // Check if user is logged in
    if (!req.session.userId) {
        throw new ApiError(401, "Please login to view order details");
    }

    const { orderId } = req.params;
    
    // Find the order
    const order = await Order.findById(orderId);
    
    if (!order) {
        throw new ApiError(404, "Order not found");
    }
    
    // Check if the order belongs to the current user
    if (order.user.toString() !== req.session.userId) {
        throw new ApiError(403, "You are not authorized to view this order");
    }
    
    return res.status(200).json(
        new ApiResponse(200, { order }, "Order details fetched successfully")
    );
});

// Get orders page
export const getOrdersPage = asyncHandler(async (req, res) => {
    // Check if user is logged in
    if (!req.session.userId) {
        return res.redirect("/auth/login?returnTo=/orders");
    }

    // Get orders for the user, sorted by newest first
    const orders = await Order.find({ user: req.session.userId })
        .sort({ createdAt: -1 });
    
    res.render("pages/orders", {
        title: "My Orders - FitSync",
        orders,
        isLoggedIn: true,
        userId: req.session.userId,
        userRole: req.session.userRole
    });
}); 