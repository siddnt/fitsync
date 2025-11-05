import mongoose from 'mongoose';

const billingSchema = new mongoose.Schema(
  {
    amount: { type: Number, min: 0 },
    currency: { type: String, default: 'INR' },
    paymentGateway: { type: String },
    paymentReference: { type: String },
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'paid',
    },
  },
  { _id: false },
);

const gymMembershipSchema = new mongoose.Schema(
  {
    trainee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    gym: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Gym',
      required: true,
      index: true,
    },
    trainer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    plan: {
      type: String,
      trim: true,
      default: 'monthly',
    },
    startDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    endDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'expired', 'cancelled'],
      default: 'active',
    },
    autoRenew: { type: Boolean, default: true },
    billing: billingSchema,
    benefits: {
      type: [String],
      default: [],
    },
    renewalReminderSent: { type: Boolean, default: false },
    notes: { type: String },
  },
  { timestamps: true },
);

gymMembershipSchema.index({ trainee: 1, gym: 1, status: 1 });
gymMembershipSchema.index({ endDate: 1, status: 1 });

const GymMembership = mongoose.model('GymMembership', gymMembershipSchema);

export default GymMembership;
export { GymMembership };
