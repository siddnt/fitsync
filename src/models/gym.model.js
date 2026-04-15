import mongoose from "mongoose";

const pricingSchema = new mongoose.Schema(
    {
        monthlyMrp: {
            type: Number,
            required: true,
            min: 0
        },
        monthlyPrice: {
            type: Number,
            required: true,
            min: 0
        },
        currency: {
            type: String,
            default: "INR"
        }
    },
    { _id: false }
);

const contactSchema = new mongoose.Schema(
    {
        phone: String,
        email: String,
        website: String,
        whatsapp: String
    },
    { _id: false }
);

const locationSchema = new mongoose.Schema(
    {
        address: {
            type: String,
            required: true
        },
        city: String,
        state: String,
        postalCode: String,
        coordinates: {
            lat: Number,
            lng: Number
        }
    },
    { _id: false }
);

const scheduleSchema = new mongoose.Schema(
    {
        openTime: {
            type: String
        },
        closeTime: {
            type: String
        },
        workingDays: {
            type: [String],
            default: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        }
    },
    { _id: false }
);

const analyticsSchema = new mongoose.Schema(
    {
        impressions: {
            type: Number,
            default: 0
        },
        memberships: {
            type: Number,
            default: 0,
            min: 0
        },
        trainers: {
            type: Number,
            default: 0,
            min: 0
        },
        rating: {
            type: Number,
            default: 0
        },
        ratingCount: {
            type: Number,
            default: 0
        },
        lastImpressionAt: Date,
        lastReviewAt: Date
    },
    { _id: false }
);

const sponsorshipSchema = new mongoose.Schema(
    {
        status: {
            type: String,
            enum: ["none", "active", "expired"],
            default: "none"
        },
        expiresAt: Date,
        package: String
    },
    { _id: false }
);

const gymSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        description: {
            type: String,
            trim: true
        },
        location: {
            type: locationSchema,
            required: true
        },
        pricing: {
            type: pricingSchema,
            required: true
        },
        features: {
            type: [String],
            default: []
        },
        keyFeatures: {
            type: [String],
            default: []
        },
        amenities: {
            type: [String],
            default: []
        },
        tags: {
            type: [String],
            default: []
        },
        images: {
            type: [String],
            default: []
        },
        gallery: {
            type: [String],
            default: []
        },
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        trainers: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            }
        ],
        managers: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            }
        ],
        contact: contactSchema,
        schedule: scheduleSchema,
        analytics: {
            type: analyticsSchema,
            default: () => ({})
        },
        sponsorship: {
            type: sponsorshipSchema,
            default: () => ({})
        },
        status: {
            type: String,
            enum: ["active", "paused", "suspended"],
            default: "active"
        },
        isPublished: {
            type: Boolean,
            default: true
        },
        sponsor: {
            type: Boolean,
            default: false
        },
        sponsorExpiresAt: Date,
        isActive: {
            type: Boolean,
            default: true
        },
        approvalStatus: {
            type: String,
            enum: ["approved", "pending", "rejected"],
            default: "approved"
        },
        approvedAt: Date,
        lastUpdatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }
    },
    {
        timestamps: true
    }
);

const PUBLIC_GYM_FILTER = { status: 'active', isPublished: true };

gymSchema.index(
    { status: 1, isPublished: 1, 'location.city': 1, createdAt: -1 },
    { partialFilterExpression: PUBLIC_GYM_FILTER }
);
gymSchema.index(
    { status: 1, isPublished: 1, 'analytics.impressions': -1, createdAt: -1 },
    { partialFilterExpression: PUBLIC_GYM_FILTER }
);
gymSchema.index(
    { status: 1, isPublished: 1, 'analytics.rating': -1, 'analytics.ratingCount': -1, createdAt: -1 },
    { partialFilterExpression: PUBLIC_GYM_FILTER }
);
gymSchema.index(
    { status: 1, isPublished: 1, 'analytics.memberships': -1, createdAt: -1 },
    { partialFilterExpression: PUBLIC_GYM_FILTER }
);
gymSchema.index(
    { 'sponsorship.status': 1, 'analytics.impressions': -1, createdAt: -1 },
    { partialFilterExpression: PUBLIC_GYM_FILTER }
);
gymSchema.index(
    { "location.city": 1, sponsor: -1, createdAt: -1 },
    { partialFilterExpression: PUBLIC_GYM_FILTER }
);
gymSchema.index({ owner: 1 });
gymSchema.index(
    {
        name: "text",
        description: "text",
        tags: "text",
        amenities: "text",
        "location.city": "text"
    },
    {
        weights: {
            name: 10,
            "location.city": 6,
            tags: 5,
            amenities: 3,
            description: 2
        },
        name: "gym_search_text_idx"
    }
);

gymSchema.virtual("isSponsored").get(function () {
    if (!this.sponsor) return false;
    if (!this.sponsorExpiresAt) return this.sponsor;
    return this.sponsorExpiresAt > new Date();
});

gymSchema.set("toJSON", { virtuals: true });

gymSchema.set("toObject", { virtuals: true });

const Gym = mongoose.model("Gym", gymSchema);

export default Gym;

