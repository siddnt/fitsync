import mongoose from 'mongoose';

const marketplacePromoCodeSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,
      index: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 240,
      default: '',
    },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed'],
      required: true,
      default: 'percentage',
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    minOrderAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxDiscountAmount: {
      type: Number,
      default: null,
      min: 0,
    },
    usageLimit: {
      type: Number,
      default: null,
      min: 1,
    },
    usedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isPublic: {
      type: Boolean,
      default: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
    startsAt: {
      type: Date,
      default: null,
    },
    endsAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true },
);

marketplacePromoCodeSchema.index({ active: 1, isPublic: 1, startsAt: 1, endsAt: 1 });

const MarketplacePromoCode = mongoose.model('MarketplacePromoCode', marketplacePromoCodeSchema);

export default MarketplacePromoCode;
