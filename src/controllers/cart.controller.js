import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import Product from "../models/product.model.js";
import Cart from "../models/cart.model.js";

// Add to cart
export const addToCart = asyncHandler(async (req, res) => {
    // Check if user is logged in
    if (!req.session.userId) {
        return res.status(401).json({
            success: false,
            message: "Please login to add items to cart"
        });
    }

    const { productId } = req.body;
    
    if (!productId) {
        throw new ApiError(400, "Product ID is required");
    }
    
    // Check if product exists
    const product = await Product.findById(productId);
    if (!product) {
        throw new ApiError(404, "Product not found");
    }
    
    // Find or create user's cart
    let cart = await Cart.findOne({ user: req.session.userId });
    if (!cart) {
        cart = new Cart({ user: req.session.userId, items: [] });
    }
    
    // Check if product is already in cart
    const existingItem = cart.items.find(item => 
        item.product.toString() === productId
    );
    
    if (existingItem) {
        // If already in cart, increment quantity
        existingItem.quantity += 1;
    } else {
        // Add product to cart
        cart.items.push({
            product: productId,
            quantity: 1,
            addedAt: new Date()
        });
    }
    
    // Calculate total
    await cart.populate('items.product');
    cart.total = cart.items.reduce((total, item) => {
        return total + (item.product.price * item.quantity);
    }, 0);
    
    // Save cart
    await cart.save();
    
    return res.status(200).json(
        new ApiResponse(200, cart, "Product added to cart successfully")
    );
});

// Get cart
export const getCart = asyncHandler(async (req, res) => {
    // Check if user is logged in
    if (!req.session.userId) {
        throw new ApiError(401, "Please login to view cart");
    }

    // Find user's cart
    const cart = await Cart.findOne({ user: req.session.userId })
        .populate({
            path: 'items.product',
            select: 'name description price image stock'
        });
    
    if (!cart) {
        return res.status(200).json(
            new ApiResponse(200, { items: [], total: 0 }, "Cart is empty")
        );
    }
    
    return res.status(200).json(
        new ApiResponse(200, cart, "Cart fetched successfully")
    );
});

// Remove from cart
export const removeFromCart = asyncHandler(async (req, res) => {
    // Check if user is logged in
    if (!req.session.userId) {
        throw new ApiError(401, "Please login to modify cart");
    }

    const { productId } = req.params;
    
    if (!productId) {
        throw new ApiError(400, "Product ID is required");
    }
    
    // Find user's cart
    const cart = await Cart.findOne({ user: req.session.userId });
    if (!cart) {
        throw new ApiError(404, "Cart not found");
    }
    
    // Check if product exists in cart
    const itemIndex = cart.items.findIndex(
        item => item.product.toString() === productId
    );
    
    if (itemIndex === -1) {
        throw new ApiError(404, "Product not found in cart");
    }
    
    // Remove item from cart
    cart.items.splice(itemIndex, 1);
    
    // Calculate new total
    await cart.populate('items.product');
    cart.total = cart.items.reduce((total, item) => {
        return total + (item.product.price * item.quantity);
    }, 0);
    
    // Save cart
    await cart.save();
    
    return res.status(200).json(
        new ApiResponse(200, cart, "Product removed from cart successfully")
    );
});

// Update cart quantity
export const updateCartQuantity = asyncHandler(async (req, res) => {
    if (!req.session.userId) {
        throw new ApiError(401, "Please login to modify cart");
    }
    const { productId } = req.params;
    const { quantity } = req.body;

    if (!productId) {
        throw new ApiError(400, "Product ID is required");
    }
    if (typeof quantity !== "number" || quantity < 1) {
        throw new ApiError(400, "Quantity must be at least 1");
    }

    const cart = await Cart.findOne({ user: req.session.userId });
    if (!cart) {
        throw new ApiError(404, "Cart not found");
    }

    const item = cart.items.find(item => item.product.toString() === productId);
    if (!item) {
        throw new ApiError(404, "Product not found in cart");
    }

    item.quantity = quantity;
    
    // Calculate new total
    await cart.populate('items.product');
    cart.total = cart.items.reduce((total, item) => {
        return total + (item.product.price * item.quantity);
    }, 0);
    
    await cart.save();

    return res.status(200).json(
        new ApiResponse(200, cart, "Cart quantity updated successfully")
    );
}); 