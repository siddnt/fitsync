import mongoose from 'mongoose';

const locationSchema = new mongoose.Schema(
  {
    addressLine1: { type: String, trim: true },
    addressLine2: { type: String, trim: true },
    city: { type: String, trim: true, index: true },
    state: { type: String, trim: true },
    postalCode: { type: String, trim: true },
    country: { type: String, trim: true, default: 'India' },
    coordinates: {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: {
        type: [Number],
        default: undefined,
        validate: {
          validator: (value) => !value || value.length === 2,
          message: 'Coordinates must be an array of [longitude, latitude] values.',
        },
      },
    },
    landmark: { type: String, trim: true },
  },
  { _id: false },
);

const pricingSchema = new mongoose.Schema(
  {
    mrp: { type: Number, min: 0 },
    discounted: { type: Number, min: 0 },
    currency: { type: String, default: 'INR' },
    billingCycle: {
      type: String,
      enum: ['monthly', 'quarterly', 'half-yearly', 'yearly'],
      default: 'monthly',
    },
    setupFee: { type: Number, min: 0 },
  },
  { _id: false },
);

const scheduleSchema = new mongoose.Schema(
  {
    days: {
      type: [
        {
          type: String,
          enum: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        },
      ],
      default: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    },
    open: { type: String, default: '06:00' },
    close: { type: String, default: '22:00' },
  },
  { _id: false },
);

const contactSchema = new mongoose.Schema(
  {
    phone: { type: String, trim: true },
    email: { type: String, trim: true },
    website: { type: String, trim: true },
    instagram: { type: String, trim: true },
  },
  { _id: false },
);

const sponsorshipSchema = new mongoose.Schema(
  {
    tier: { type: String, enum: ['none', 'silver', 'gold', 'platinum'], default: 'none' },
    startDate: { type: Date },
    endDate: { type: Date },
    status: { type: String, enum: ['inactive', 'active', 'expired'], default: 'inactive' },
    amount: { type: Number, min: 0 },
    monthlyBudget: { type: Number, min: 0 },
  },
  { _id: false },
);

const analyticsSchema = new mongoose.Schema(
  {
    impressions: { type: Number, default: 0 },
    memberships: { type: Number, default: 0 },
    trainers: { type: Number, default: 0 },
    rating: { type: Number, min: 0, max: 5, default: 0 },
    ratingCount: { type: Number, default: 0 },
    lastImpressionAt: { type: Date },
  },
  { _id: false },
);

const gymSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      trim: true,
      unique: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
    },
    keyFeatures: {
      type: [String],
      default: [],
    },
    amenities: {
      type: [String],
      default: [],
    },
    location: {
      type: locationSchema,
      required: true,
    },
    contact: contactSchema,
    pricing: pricingSchema,
    schedule: scheduleSchema,
    gallery: {
      type: [String],
      default: [],
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'paused', 'suspended'],
      default: 'draft',
    },
    sponsorship: sponsorshipSchema,
    analytics: analyticsSchema,
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    lastUpdatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedAt: { type: Date },
  },
  {
    timestamps: true,
  },
);

gymSchema.index({ name: 'text', description: 'text', tags: 'text', keyFeatures: 'text' });
gymSchema.index({ 'location.coordinates': '2dsphere' }, { sparse: true });

gymSchema.pre('save', function generateSlug(next) {
  if (!this.isModified('name')) {
    return next();
  }

  const slugBase = this.name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

  this.slug = slugBase ? `${slugBase}-${Date.now().toString().slice(-6)}` : undefined;
  next();
});

const Gym = mongoose.model('Gym', gymSchema);

export default Gym;
export { Gym };
