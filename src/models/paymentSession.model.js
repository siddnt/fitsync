import mongoose from "mongoose";

const paymentSessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type: { type: String, enum: ["membership", "shop"], required: true },
  // For membership payments
  gym: { type: mongoose.Schema.Types.ObjectId, ref: "Gym" },
  membership: { type: mongoose.Schema.Types.ObjectId, ref: "GymMembership" },
  trainer: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    // For shop payments
    cartSnapshot: {
      items: [
        {
          product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
          name: String,
          quantity: Number,
          price: Number,
          image: String,
        },
      ],
      subtotal: Number,
      tax: Number,
      shippingCost: Number,
      total: Number,
      shippingAddress: {
        firstName: String,
        lastName: String,
        email: String,
        phone: String,
        address: String,
        city: String,
        state: String,
        zipCode: String,
      },
    },
    currency: { type: String, default: "inr" },
    amount: { type: Number, required: true },
    stripe: {
      checkoutSessionId: String,
      paymentIntentId: String,
      status: { type: String, enum: ["open", "completed", "expired", "canceled"], default: "open" },
    },
    processed: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const PaymentSession = mongoose.model("PaymentSession", paymentSessionSchema);
export default PaymentSession;
