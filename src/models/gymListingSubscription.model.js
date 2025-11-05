import mongoose from 'mongoose';

const invoiceSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    paidOn: { type: Date, default: Date.now },
    paymentReference: { type: String },
    status: {
      type: String,
      enum: ['paid', 'refunded', 'failed'],
      default: 'paid',
    },
    metadata: { type: Map, of: String },
  },
  { _id: false },
);

const gymListingSubscriptionSchema = new mongoose.Schema(
  {
    gym: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Gym',
      required: true,
      index: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    planCode: {
      type: String,
      enum: ['basic', 'growth', 'scale'],
      default: 'basic',
    },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    status: {
      type: String,
      enum: ['active', 'grace', 'expired', 'cancelled'],
      default: 'active',
    },
    autoRenew: { type: Boolean, default: true },
    invoices: [invoiceSchema],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    cancellationReason: { type: String },
    metadata: { type: Map, of: String },
  },
  { timestamps: true },
);

gymListingSubscriptionSchema.index({ owner: 1, status: 1 });
gymListingSubscriptionSchema.index({ periodEnd: 1, status: 1 });

gymListingSubscriptionSchema.methods.isActive = function isActive(referenceDate = new Date()) {
  return this.status === 'active' && this.periodEnd >= referenceDate;
};

const GymListingSubscription = mongoose.model(
  'GymListingSubscription',
  gymListingSubscriptionSchema,
);

export default GymListingSubscription;
export { GymListingSubscription };
