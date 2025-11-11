import mongoose from "mongoose";

// Order Item Schema (for products within an order)
export const ORDER_ITEM_STATUSES = [
    "processing",
    "in-transit",
    "out-for-delivery",
    "delivered"
];

const orderItemSchema = new mongoose.Schema({
    seller: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true
    },
    name: {
        type: String,
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    price: {
        type: Number,
        required: true
    },
    image: {
        type: String
    },
    status: {
        type: String,
        enum: ORDER_ITEM_STATUSES,
        default: "processing"
    },
    lastStatusAt: {
        type: Date,
        default: Date.now
    },
    statusHistory: [
        {
            status: {
                type: String,
                enum: ORDER_ITEM_STATUSES,
                required: true
            },
            note: {
                type: String,
                trim: true,
                maxlength: 280
            },
            updatedBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            },
            updatedAt: {
                type: Date,
                default: Date.now
            }
        }
    ],
    payoutRecorded: {
        type: Boolean,
        default: false
    }
});

// Address Schema
const addressSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: true
    },
    lastName: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        required: true
    },
    address: {
        type: String,
        required: true
    },
    city: {
        type: String,
        required: true
    },
    state: {
        type: String,
        required: true
    },
    zipCode: {
        type: String,
        required: true
    }
});

// Order Schema
const orderSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        seller: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            index: true
        },
        orderItems: [orderItemSchema],
        shippingAddress: addressSchema,
        paymentMethod: {
            type: String,
            required: true,
            default: "Cash on Delivery"
        },
        subtotal: {
            type: Number,
            required: true
        },
        tax: {
            type: Number,
            required: true,
            default: 0
        },
        shippingCost: {
            type: Number,
            required: true,
            default: 0
        },
        total: {
            type: Number,
            required: true
        },
        status: {
            type: String,
            required: true,
            enum: ["processing", "in-transit", "out-for-delivery", "delivered"],
            default: "processing"
        },
        orderNumber: {
            type: String,
            required: false,
            unique: true
        }
    },
    {
        timestamps: true
    }
);

// Comment out the pre-save hook since we're now manually generating orderNumber in the controller
/*
orderSchema.pre("save", async function(next) {
    try {
        // Only generate if this is a new order
        if (this.isNew) {
            // Get current date
            const date = new Date();
            const year = date.getFullYear().toString().slice(-2);
            const month = (date.getMonth() + 1).toString().padStart(2, "0");
            const day = date.getDate().toString().padStart(2, "0");
            
            // Generate a random 4-digit number
            const randomDigits = Math.floor(1000 + Math.random() * 9000);
            
            // Create order number in format: FS-YYMMDD-XXXX (e.g., FS-230501-4832)
            this.orderNumber = `FS-${year}${month}${day}-${randomDigits}`;
        }
        next();
    } catch (error) {
        next(error);
    }
});
*/

const Order = mongoose.model("Order", orderSchema);

export default Order; 