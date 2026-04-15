import mongoose from "mongoose";

const productSalesMetricSchema = new mongoose.Schema(
    {
        totalSold: {
            type: Number,
            default: 0,
            min: 0
        },
        lastSoldAt: Date,
        recentDaily: {
            type: [
                new mongoose.Schema(
                    {
                        date: {
                            type: String,
                            required: true
                        },
                        quantity: {
                            type: Number,
                            required: true,
                            min: 1
                        }
                    },
                    { _id: false }
                )
            ],
            default: []
        }
    },
    { _id: false }
);

const productReviewMetricSchema = new mongoose.Schema(
    {
        count: {
            type: Number,
            default: 0,
            min: 0
        },
        averageRating: {
            type: Number,
            default: 0,
            min: 0
        },
        lastReviewedAt: Date
    },
    { _id: false }
);

const productMetricsSchema = new mongoose.Schema(
    {
        sales: {
            type: productSalesMetricSchema,
            default: () => ({})
        },
        reviews: {
            type: productReviewMetricSchema,
            default: () => ({})
        }
    },
    { _id: false }
);

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
        metrics: {
            type: productMetricsSchema,
            default: () => ({})
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

const PUBLIC_PRODUCT_FILTER = { isPublished: true };

productSchema.index(
    { isPublished: 1, category: 1, status: 1, stock: 1, updatedAt: -1 },
    { partialFilterExpression: PUBLIC_PRODUCT_FILTER }
);
productSchema.index(
    { isPublished: 1, price: 1, updatedAt: -1 },
    { partialFilterExpression: PUBLIC_PRODUCT_FILTER }
);
productSchema.index(
    { isPublished: 1, createdAt: -1 },
    { partialFilterExpression: PUBLIC_PRODUCT_FILTER }
);
productSchema.index(
    {
        name: "text",
        description: "text",
        category: "text"
    },
    {
        weights: {
            name: 10,
            category: 4,
            description: 2
        },
        name: "product_search_text_idx"
    }
);

const Product = mongoose.model("Product", productSchema);
export default Product;
