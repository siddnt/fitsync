import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
    {
        seller: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            index: true
        },
        name: {
            type: String,
            required: [true, "Product name is required"],
            trim: true
        },
        description: {
            type: String,
            required: [true, "Product description is required"]
        },
        price: {
            type: Number,
            required: [true, "Product price is required"],
            min: [0, "Price cannot be negative"]
        },
        mrp: {
            type: Number,
            min: [0, "MRP cannot be negative"],
            default: null
        },
        image: {
            type: String,
            required: [true, "Product image is required"]
        },
        category: {
            type: String,
            required: [true, "Product category is required"],
            enum: ["supplements", "equipment", "clothing", "accessories"]
        },
        stock: {
            type: Number,
            required: [true, "Stock quantity is required"],
            min: [0, "Stock cannot be negative"]
        },
        status: {
            type: String,
            enum: ["available", "out-of-stock"],
            default: "available"
        },
        isPublished: {
            type: Boolean,
            default: true
        },
        metadata: {
            type: Map,
            of: String,
            default: undefined
        }
    },
    {
        timestamps: true
    }
);

productSchema.pre("validate", function (next) {
    if (this.mrp === undefined || this.mrp === null) {
        this.mrp = this.price;
    }

    if (this.price > this.mrp) {
        this.price = this.mrp;
    }

    next();
});

const Product = mongoose.model("Product", productSchema);
export default Product;