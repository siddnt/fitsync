import { Router } from "express";
import {
    addToCart,
    getCart,
    removeFromCart,
    updateCartQuantity
} from "../controllers/cart.controller.js";
import { isAuthenticated } from "../middlewares/auth.middleware.js";
import Cart from "../models/cart.model.js";
import path from "path";
import { fileURLToPath } from "url";
import { asyncHandler } from "../utils/asyncHandler.js";
import Product from "../models/product.model.js";
import { createOrder } from "../controllers/order.controller.js";
import User from "../models/user.model.js";
import Order from "../models/order.model.js";

const router = Router();

// API routes
router.post("/", isAuthenticated, addToCart);
router.get("/api", isAuthenticated, getCart); // API endpoint for JSON
router.delete("/:productId", isAuthenticated, removeFromCart);
router.patch("/:productId/quantity", isAuthenticated, updateCartQuantity);

// Create order route - Using a custom wrapper for better error handling
router.post("/create-order", isAuthenticated, asyncHandler(async (req, res) => {
    try {
        // Get the user data to get their email
        const user = await User.findById(req.session.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }
        
        // Get the user's cart
        const cart = await Cart.findOne({ user: req.session.userId })
            .populate({
                path: "items.product",
                select: "name price image"
            });
        
        if (!cart || !cart.items || cart.items.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Your cart is empty"
            });
        }
        
        const { 
            firstName, lastName, phone, 
            address, city, state, zipCode, 
            paymentMethod 
        } = req.body;
        
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
}));

// Clear cart route
router.post("/clear", isAuthenticated, asyncHandler(async (req, res) => {
    try {
        await Cart.findOneAndUpdate(
            { user: req.session.userId },
            { items: [], total: 0 },
            { upsert: true }
        );
        
        return res.status(200).json({
            success: true,
            message: "Cart cleared successfully"
        });
    } catch (error) {
        console.error("Error clearing cart:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to clear cart"
        });
    }
}));

// Buy now route - clear cart, add product, go to checkout
router.post("/buy-now/:productId", isAuthenticated, asyncHandler(async (req, res) => {
    try {
        const { productId } = req.params;
        
        // Check if product exists
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: "Product not found"
            });
        }
        
        // Clear cart first
        await Cart.findOneAndUpdate(
            { user: req.session.userId },
            { items: [], total: 0 },
            { upsert: true }
        );
        
        // Create cart with only this product
        let cart = await Cart.findOne({ user: req.session.userId });
        if (!cart) {
            cart = new Cart({ user: req.session.userId, items: [] });
        }
        
        // Add product to cart
        cart.items.push({
            product: productId,
            quantity: 1,
            addedAt: new Date()
        });
        
        // Calculate total
        await cart.populate('items.product');
        cart.total = cart.items.reduce((total, item) => {
            return total + (item.product.price * item.quantity);
        }, 0);
        
        // Save cart
        await cart.save();
        
        // Redirect to checkout
        return res.redirect('/cart/checkout');
    } catch (error) {
        console.error("Error in buy-now process:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to process buy now request"
        });
    }
}));

// Cart page route
router.get("/", isAuthenticated, async (req, res) => {
    // Serve static HTML that will fetch cart data via /api
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const htmlPath = path.join(__dirname, "../../views/pages/cart.html");
    res.sendFile(htmlPath);
});

// Checkout page route
router.get("/checkout", isAuthenticated, async (req, res) => {
    try {
        const cart = await Cart.findOne({ user: req.session.userId })
            .populate({
                path: 'items.product',
                select: 'name description price image stock category'
            });
        
        // Check if cart is empty
        if (!cart || !cart.items || cart.items.length === 0) {
            return res.redirect('/cart');
        }
        
        res.render('pages/checkout', {
            title: "Checkout - FitSync",
            cart: cart,
            isLoggedIn: true,
            userId: req.session.userId,
            userRole: req.session.userRole
        });
    } catch (error) {
        console.error('Error fetching checkout page:', error);
        res.status(500).render('pages/error', {
            title: "Error - FitSync",
            message: 'Error loading checkout page',
            statusCode: 500,
            isLoggedIn: !!req.session.userId,
            userId: req.session.userId,
            userRole: req.session.userRole
        });
    }
});

export default router; 