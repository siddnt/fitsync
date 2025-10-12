import Product from "../models/product.model.js";
import colors from "colors";
import path from "path";

// Normalize paths for cross-platform compatibility
const normalizePath = (imagePath) => {
    // Convert Windows backslashes to forward slashes for web URLs
    return imagePath.replace(/\\/g, '/');
};

const sampleProducts = [
    {
        name: "Protein Powder",
        description: "High-quality whey protein powder for muscle growth and recovery. Contains essential amino acids and helps in post-workout recovery.",
        price: 2999,
        image: normalizePath("/images/products/protein-powder.jpg"),
        category: "supplements",
        stock: 50
    },
    {
        name: "Yoga Mat",
        description: "Premium non-slip yoga mat for comfortable workouts. Made with eco-friendly materials and perfect for yoga, pilates, and floor exercises.",
        price: 1499,
        image: normalizePath("/images/products/yoga-mat.jpg"),
        category: "equipment",
        stock: 30
    },
    {
        name: "Fitness Tracker",
        description: "Smart fitness tracker with heart rate monitor, step counter, and sleep tracking. Water-resistant and long battery life.",
        price: 4999,
        image: normalizePath("/images/products/fitness-tracker.jpg"),
        category: "accessories",
        stock: 20
    },
    {
        name: "Gym Shorts",
        description: "Comfortable and breathable gym shorts with moisture-wicking technology. Perfect for workouts and sports activities.",
        price: 999,
        image: normalizePath("/images/products/gym-shorts.jpg"),
        category: "clothing",
        stock: 40
    },
    {
        name: "Resistance Bands Set",
        description: "Set of 5 resistance bands for strength training and rehabilitation. Includes carrying bag and exercise guide.",
        price: 799,
        image: normalizePath("/images/products/resistance-bands.jpg"),
        category: "equipment",
        stock: 25
    },
    {
        name: "BCAA Supplements",
        description: "Branched-chain amino acids supplement for muscle recovery and endurance. Available in various flavors.",
        price: 1999,
        image: normalizePath("/images/products/bcaa.jpg"),
        category: "supplements",
        stock: 35
    },
    {
        name: "Sports Water Bottle",
        description: "Insulated sports water bottle that keeps drinks cold for 24 hours. BPA-free and leak-proof design.",
        price: 599,
        image: normalizePath("/images/products/water-bottle.jpg"),
        category: "accessories",
        stock: 60
    },
    {
        name: "Compression Tights",
        description: "High-performance compression tights for enhanced blood flow and muscle support during workouts.",
        price: 1299,
        image: normalizePath("/images/products/compression-tights.jpg"),
        category: "clothing",
        stock: 30
    }
];

const initializeProducts = async () => {
    try {
        console.log(colors.yellow("Checking for existing products..."));

        // Check if products already exist
        const existingProducts = await Product.find();
        
        if (existingProducts.length > 0) {
            console.log(colors.green("Products already exist in the database."));
            return;
        }

        // Create products
        const products = await Product.create(sampleProducts);
        console.log(colors.green(`${products.length} products created successfully!`));
    } catch (error) {
        console.error(colors.red(`Error creating products: ${error.message}`));
    }
};

export default initializeProducts; 