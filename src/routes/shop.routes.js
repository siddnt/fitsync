import { Router } from "express";
import { isAuthenticated } from "../middlewares/auth.middleware.js";
import Product from "../models/product.model.js";
import Cart from "../models/cart.model.js";

const router = Router();

// Get all products
router.get("/products", async (req, res) => {
    try {
        const products = await Product.find({ status: "available" });
        res.json(products);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ message: 'Error fetching products' });
    }
});

// Get product by ID
router.get("/products/:id", async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.json(product);
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).json({ message: 'Error fetching product' });
    }
});

// Shop page route
router.get("/", async (req, res) => {
    try {
        const products = await Product.find({ status: "available" });
        console.log("Shop products:", products); // Debug log
        let cart = null;
        if (req.session.userId) {
            cart = await Cart.findOne({ user: req.session.userId }).populate('items.product');
        }
        res.render('pages/shop', {
            title: "Shop - FitSync",
            products,
            cart,
            isLoggedIn: !!req.session.userId,
            userId: req.session.userId,
            userRole: req.session.userRole
        });
    } catch (error) {
        console.error('Error loading shop page:', error);
        res.status(500).render('pages/error', {
            title: "Error - FitSync",
            message: 'Error loading shop page',
            statusCode: 500,
            isLoggedIn: !!req.session.userId,
            userId: req.session.userId,
            userRole: req.session.userRole
        });
    }
});

export default router; 