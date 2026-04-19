import mongoose from "mongoose";

const promoSnapshotSchema = new mongoose.Schema(
    {
        promoId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "MarketplacePromoCode",
            default: null
        },
        code: String,
        label: String,
        description: String,
        discountType: {
            type: String,
            enum: ["percentage", "fixed"]
        },
        discountValue: Number,
        discountAmount: {
            type: Number,
            default: 0
        }
    },
    { _id: false }
);

const orderSnapshotSchema = new mongoose.Schema(
    {
        items: [
            {
                seller: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
                product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
                name: String,
                quantity: Number,
                price: Number,
                image: String
            }
        ],
        subtotal: Number,
        tax: Number,
        shippingCost: Number,
        discountAmount: {
            type: Number,
            default: 0
        },
        promo: {
            type: promoSnapshotSchema,
            default: null
        },
        total: Number,
        shippingAddress: {
            firstName: String,
            lastName: String,
            email: String,
            phone: String,
            address: String,
            city: String,
            state: String,
            zipCode: String
        }
    },
    { _id: false }
);

const paymentSessionSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        type: {
            type: String,
            enum: ["shop", "gym-subscription", "gym-membership", "sponsorship"],
            required: true
        },
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        gym: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Gym"
        },
        subscription: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Subscription"
        },
        ownerSubscription: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "OwnerSubscription"
        },
        plan: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ListingPlan"
        },
        invoice: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "OwnerInvoice"
        },
        period: {
            start: Date,
            end: Date
        },
        orderSnapshot: orderSnapshotSchema,
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: () => ({})
        },
        currency: {
            type: String,
            default: "inr"
        },
        amount: {
            type: Number,
            required: true
        },
        stripe: {
            checkoutSessionId: String,
            paymentIntentId: String,
            status: {
                type: String,
                enum: ["open", "completed", "expired", "canceled"],
                default: "open"
            }
        },
        orderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Order"
        },
        processed: {
            type: Boolean,
            default: false
        }
    },
    { timestamps: true }
);

paymentSessionSchema.index({ user: 1, type: 1, "stripe.checkoutSessionId": 1 });
paymentSessionSchema.index({ owner: 1, type: 1, createdAt: -1 });

const PaymentSession = mongoose.model("PaymentSession", paymentSessionSchema);
export default PaymentSession;
