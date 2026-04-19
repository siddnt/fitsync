import { registerDashboardOpenApi } from "./openapi/dashboard-domain.js";
import { registerOperationsOpenApi } from "./openapi/operations-domain.js";

const accessSecurity = [{ bearerAuth: [] }, { accessTokenCookie: [] }];
const refreshSecurity = [{ refreshTokenCookie: [] }];
const objectIdSchema = {
  type: "string",
  pattern: "^[a-fA-F0-9]{24}$",
  example: "64b7a0c5d2f0f6a123456789",
};

const genericDataSchema = {
  type: "object",
  nullable: true,
  additionalProperties: true,
};

const schemaRef = (name) => ({ $ref: `#/components/schemas/${name}` });

const envelope = (statusCode, message, dataSchema = genericDataSchema) => ({
  type: "object",
  required: ["success", "statusCode", "message"],
  properties: {
    success: { type: "boolean", example: true },
    statusCode: { type: "integer", example: statusCode },
    message: { type: "string", example: message },
    data: dataSchema,
  },
});

const success = (
  description,
  statusCode = 200,
  message = "Request successful.",
  dataSchema = genericDataSchema,
) => ({
  description,
  content: {
    "application/json": { schema: envelope(statusCode, message, dataSchema) },
  },
});

const failure = (description, statusCode, message) => ({
  description,
  content: {
    "application/json": {
      schema: {
        type: "object",
        required: ["success", "statusCode", "message", "errors"],
        properties: {
          success: { type: "boolean", example: false },
          statusCode: { type: "integer", example: statusCode },
          message: { type: "string", example: message },
          errors: {
            type: "array",
            items: { type: "string" },
            example: [message],
          },
        },
      },
    },
  },
});

const R = {
  ok: (description, dataSchema = genericDataSchema, message = description) =>
    success(description, 200, message, dataSchema),
  created: (
    description,
    dataSchema = genericDataSchema,
    message = description,
  ) => success(description, 201, message, dataSchema),
  accepted: (
    description,
    dataSchema = genericDataSchema,
    message = description,
  ) => success(description, 202, message, dataSchema),
  noContent: (description) => ({ description }),
  bad: failure("Bad request.", 400, "Validation failed."),
  unauth: failure("Unauthorized.", 401, "Unauthorized request"),
  forbidden: failure("Forbidden.", 403, "Forbidden"),
  notFound: failure("Resource not found.", 404, "Resource not found."),
  conflict: failure("Conflict.", 409, "Resource conflict."),
  server: failure(
    "Unexpected server error.",
    500,
    "Something went wrong on the server",
  ),
};

const secureResponses = (base, extra = {}) => ({
  ...base,
  ...extra,
  401: R.unauth,
  403: R.forbidden,
  500: R.server,
});

const idParam = (name, description) => ({
  name,
  in: "path",
  required: true,
  description,
  schema: objectIdSchema,
});

const queryParam = (name, schema, description) => ({
  name,
  in: "query",
  required: false,
  description,
  schema,
});

const operation = (def) => {
  const op = {
    tags: [def.tag],
    summary: def.summary,
    responses: def.responses,
  };

  if (def.description) op.description = def.description;
  if (def.security) op.security = def.security;
  if (def.parameters?.length) op.parameters = def.parameters;
  if (def.bodySchema) {
    op.requestBody = {
      required: def.bodyRequired ?? true,
      description: def.bodyDescription ?? "Request body.",
      content: {
        [def.contentType ?? "application/json"]: {
          schema: { $ref: `#/components/schemas/${def.bodySchema}` },
        },
      },
    };
  }

  return op;
};

const buildPaths = (defs) =>
  defs.reduce((paths, def) => {
    if (!paths[def.path]) paths[def.path] = {};
    paths[def.path][def.method] = operation(def);
    return paths;
  }, {});

const schemas = {
  RegisterRequest: {
    type: "object",
    required: ["firstName", "email", "password"],
    properties: {
      firstName: { type: "string", example: "Sid" },
      lastName: { type: "string", example: "Nath" },
      name: { type: "string", example: "Sid Nath" },
      email: { type: "string", format: "email", example: "sid@example.com" },
      password: { type: "string", format: "password", example: "secret123" },
      role: {
        type: "string",
        enum: [
          "user",
          "trainee",
          "trainer",
          "gym-owner",
          "seller",
          "manager",
          "admin",
        ],
        example: "trainee",
      },
      contactNumber: { type: "string", example: "+91-9876543210" },
      address: { type: "string", example: "Madhapur, Hyderabad" },
      age: { type: "integer", example: 26 },
      gender: { type: "string", example: "female" },
      profile: { type: "object", additionalProperties: true },
    },
  },
  LoginRequest: {
    type: "object",
    required: ["email", "password"],
    properties: {
      email: { type: "string", format: "email", example: "sid@example.com" },
      password: { type: "string", format: "password", example: "secret123" },
    },
  },
  RefreshTokenRequest: {
    type: "object",
    properties: { refreshToken: { type: "string", example: "eyJ...refresh" } },
  },
  GymMutationInput: {
    type: "object",
    required: ["name", "location"],
    properties: {
      name: { type: "string", example: "FitSync Elite" },
      description: { type: "string", example: "Premium training facility." },
      keyFeatures: { type: "array", items: { type: "string" } },
      amenities: { type: "array", items: { type: "string" } },
      location: {
        type: "object",
        additionalProperties: true,
        example: { address: "Road No. 12, Banjara Hills", city: "Hyderabad" },
      },
      pricing: {
        type: "object",
        additionalProperties: true,
        example: { monthlyMrp: 2500, monthlyPrice: 1999, currency: "INR" },
      },
      contact: { type: "object", additionalProperties: true },
      schedule: { type: "object", additionalProperties: true },
      gallery: {
        type: "array",
        items: { type: "object", additionalProperties: true },
      },
      sponsorship: { type: "object", additionalProperties: true },
      subscription: {
        type: "object",
        properties: {
          planCode: {
            type: "string",
            enum: ["listing-1m", "listing-3m", "listing-6m", "listing-12m"],
            example: "listing-1m",
          },
          paymentReference: {
            type: "string",
            example: "qa-listing-260329-001",
          },
          autoRenew: { type: "boolean", example: true },
        },
      },
      planCode: {
        type: "string",
        enum: ["listing-1m", "listing-3m", "listing-6m", "listing-12m"],
        example: "listing-1m",
      },
      paymentReference: { type: "string", example: "qa-listing-260329-001" },
      autoRenew: { type: "boolean", example: true },
    },
  },
  GymMembershipJoinInput: {
    type: "object",
    properties: {
      joinAsTrainer: { type: "boolean", example: false },
      trainerId: objectIdSchema,
      paymentReference: { type: "string", example: "pay_membership_001" },
      autoRenew: { type: "boolean", example: true },
      benefits: { type: "array", items: { type: "string" } },
      notes: { type: "string", example: "Evening batch preferred." },
      billing: { type: "object", additionalProperties: true },
    },
  },
  ReviewInput: {
    type: "object",
    required: ["rating", "comment"],
    properties: {
      rating: { type: "integer", minimum: 1, maximum: 5, example: 5 },
      comment: { type: "string", example: "Great experience." },
    },
  },
  GymGalleryUploadInput: {
    type: "object",
    required: ["photo"],
    properties: {
      photo: { type: "string", format: "binary" },
      title: { type: "string", example: "Reception area" },
      description: { type: "string", example: "Front desk view." },
    },
  },
  DashboardFeedbackInput: {
    type: "object",
    required: ["trainerId", "message"],
    properties: {
      trainerId: objectIdSchema,
      message: { type: "string", example: "Need help with my workout plan." },
    },
  },
  StatusUpdateInput: {
    type: "object",
    required: ["status"],
    properties: {
      status: {
        type: "string",
        enum: ["active", "inactive", "pending", "suspended"],
        example: "active",
      },
    },
  },
  ManagerRoleStatusUpdateInput: {
    type: "object",
    required: ["status"],
    properties: {
      status: {
        type: "string",
        enum: ["active", "inactive"],
        example: "inactive",
      },
    },
  },
  AdminTogglesInput: {
    type: "object",
    required: ["toggles"],
    properties: {
      toggles: {
        type: "object",
        additionalProperties: { type: "boolean" },
        example: { allowSellerRegistrations: true },
      },
    },
  },
  ListingSubscriptionInput: {
    type: "object",
    required: ["gymId", "planCode", "paymentReference"],
    properties: {
      gymId: objectIdSchema,
      planCode: {
        type: "string",
        enum: ["listing-1m", "listing-3m", "listing-6m", "listing-12m"],
        example: "listing-3m",
      },
      autoRenew: { type: "boolean", example: true },
      paymentReference: { type: "string", example: "sub_260329_growth_001" },
    },
  },
  SponsorshipPurchaseInput: {
    type: "object",
    required: ["gymId", "tier", "paymentReference"],
    properties: {
      gymId: objectIdSchema,
      tier: {
        type: "string",
        enum: ["silver", "gold", "platinum"],
        example: "gold",
      },
      paymentReference: { type: "string", example: "sponsor_260329_gold_001" },
    },
  },
};

const endpointDefs = [];

Object.assign(schemas, {
  MarketplaceOrderInput: {
    type: "object",
    required: ["items", "shippingAddress"],
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          required: ["productId", "quantity"],
          properties: {
            productId: objectIdSchema,
            quantity: { type: "integer", minimum: 1, example: 2 },
          },
        },
      },
      shippingAddress: schemaRef("ShippingAddressData"),
      paymentMethod: { type: "string", example: "Cash on Delivery" },
    },
  },
  ProductReviewInput: {
    type: "object",
    required: ["orderId", "rating", "title", "comment"],
    properties: {
      orderId: objectIdSchema,
      rating: { type: "integer", minimum: 1, maximum: 5, example: 5 },
      title: { type: "string", example: "Great product" },
      comment: {
        type: "string",
        example: "Arrived quickly and matched the description.",
      },
    },
  },
  SellerProductInput: {
    type: "object",
    properties: {
      name: { type: "string", example: "Whey Protein" },
      description: { type: "string", example: "2kg chocolate whey protein." },
      price: { type: "number", example: 1999 },
      mrp: { type: "number", example: 2499 },
      category: { type: "string", example: "supplements" },
      stock: { type: "integer", example: 18 },
      status: { type: "string", example: "available" },
      isPublished: { type: "boolean", example: true },
      image: { type: "string", format: "binary" },
    },
  },
  SellerOrderStatusUpdateInput: {
    type: "object",
    required: ["status"],
    properties: {
      status: {
        type: "string",
        enum: ["processing", "in-transit", "out-for-delivery", "delivered"],
        example: "in-transit",
      },
      note: { type: "string", example: "Handed over to courier partner." },
    },
  },
  ProfileUpdateInput: {
    type: "object",
    properties: {
      firstName: { type: "string", example: "Sid" },
      lastName: { type: "string", example: "Nath" },
      age: { type: "integer", example: 26 },
      gender: { type: "string", example: "male" },
      height: { type: "number", example: 178 },
      weight: { type: "number", example: 76 },
      contactNumber: { type: "string", example: "+91-9876543210" },
      address: { type: "string", example: "Madhapur, Hyderabad" },
      bio: { type: "string", example: "Strength-focused trainee." },
      profile: { type: "object", additionalProperties: true },
      experienceYears: { type: "integer", example: 4 },
      specializations: { type: "array", items: { type: "string" } },
      certifications: { type: "array", items: { type: "string" } },
      mentoredCount: { type: "integer", example: 12 },
      profilePicture: { type: "string", format: "binary" },
    },
  },
  TraineeAttendanceInput: {
    type: "object",
    properties: {
      date: {
        type: "string",
        format: "date-time",
        example: "2026-03-29T06:30:00.000Z",
      },
      status: {
        type: "string",
        enum: ["present", "absent", "late"],
        example: "present",
      },
      notes: { type: "string", example: "Completed full workout." },
    },
  },
  ProgressMetricInput: {
    type: "object",
    required: ["metric", "value"],
    properties: {
      metric: { type: "string", example: "body-fat" },
      value: { type: "number", example: 18.4 },
      unit: { type: "string", example: "%" },
      recordedAt: {
        type: "string",
        format: "date-time",
        example: "2026-03-29T06:30:00.000Z",
      },
      weightKg: { type: "number", example: 76 },
      heightCm: { type: "number", example: 178 },
    },
  },
  DietPlanInput: {
    type: "object",
    required: ["weekOf", "meals"],
    properties: {
      weekOf: { type: "string", format: "date", example: "2026-03-30" },
      meals: {
        type: "array",
        items: { type: "object", additionalProperties: true },
      },
      notes: {
        type: "string",
        example: "Increase water intake on training days.",
      },
    },
  },
  TraineeFeedbackInput: {
    type: "object",
    required: ["message"],
    properties: {
      message: {
        type: "string",
        example: "Excellent adherence to this week's plan.",
      },
      category: {
        type: "string",
        enum: ["progress", "nutrition", "attendance", "general"],
        example: "progress",
      },
    },
  },
  ContactFormInput: {
    type: "object",
    required: ["name", "email", "message"],
    properties: {
      name: { type: "string", example: "Asha Rao" },
      email: { type: "string", format: "email", example: "asha@example.com" },
      message: { type: "string", example: "Interested in a gym-owner demo." },
    },
  },
  ContactStatusUpdateInput: {
    type: "object",
    required: ["status"],
    properties: {
      status: {
        type: "string",
        enum: ["new", "read", "responded"],
        example: "responded",
      },
    },
  },
  PublicProfileInfo: {
    type: "object",
    properties: {
      headline: { type: "string", example: "Strength coach" },
      about: {
        type: "string",
        example: "Helping trainees with structured routines.",
      },
      location: { type: "string", example: "Hyderabad" },
      company: { type: "string", example: "FitSync" },
      socialLinks: {
        type: "object",
        properties: {
          website: { type: "string", example: "https://fitsync.example" },
          instagram: {
            type: "string",
            example: "https://instagram.com/fitsync",
          },
          facebook: { type: "string", example: "https://facebook.com/fitsync" },
        },
      },
    },
  },
  AuthUserData: {
    type: "object",
    properties: {
      id: objectIdSchema,
      firstName: { type: "string", example: "Sid" },
      lastName: { type: "string", example: "Nath" },
      name: { type: "string", example: "Sid Nath" },
      email: { type: "string", format: "email", example: "sid@example.com" },
      role: {
        type: "string",
        enum: [
          "user",
          "trainee",
          "trainer",
          "gym-owner",
          "seller",
          "manager",
          "admin",
        ],
        example: "trainee",
      },
      status: {
        type: "string",
        enum: ["active", "inactive", "pending", "suspended"],
        example: "active",
      },
      profilePicture: {
        type: "string",
        nullable: true,
        example: "https://res.cloudinary.com/demo/image/upload/profile.jpg",
      },
      profile: schemaRef("PublicProfileInfo"),
      ownerMetrics: { type: "object", additionalProperties: true },
      traineeMetrics: { type: "object", additionalProperties: true },
      trainerMetrics: { type: "object", additionalProperties: true },
    },
  },
  AuthSessionData: {
    type: "object",
    required: ["user", "accessToken"],
    properties: {
      user: schemaRef("AuthUserData"),
      accessToken: {
        type: "string",
        example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
      },
    },
  },
  AccessTokenData: {
    type: "object",
    required: ["accessToken"],
    properties: {
      accessToken: {
        type: "string",
        example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
      },
    },
  },
  UserProfileResponseData: {
    type: "object",
    properties: {
      id: objectIdSchema,
      firstName: { type: "string", example: "Sid" },
      lastName: { type: "string", example: "Nath" },
      name: { type: "string", example: "Sid Nath" },
      email: { type: "string", format: "email", example: "sid@example.com" },
      role: { type: "string", example: "trainer" },
      status: { type: "string", example: "active" },
      profilePicture: { type: "string", nullable: true },
      profile: schemaRef("PublicProfileInfo"),
      age: { type: "integer", nullable: true, example: 26 },
      gender: { type: "string", nullable: true, example: "male" },
      height: { type: "number", nullable: true, example: 178 },
      weight: { type: "number", nullable: true, example: 76 },
      contactNumber: {
        type: "string",
        nullable: true,
        example: "+91-9876543210",
      },
      address: {
        type: "string",
        nullable: true,
        example: "Madhapur, Hyderabad",
      },
      bio: {
        type: "string",
        nullable: true,
        example: "Strength-focused trainee.",
      },
      experienceYears: { type: "integer", nullable: true, example: 4 },
      mentoredCount: { type: "integer", nullable: true, example: 12 },
      specializations: { type: "array", items: { type: "string" } },
      certifications: { type: "array", items: { type: "string" } },
    },
  },
  PaginationMeta: {
    type: "object",
    properties: {
      total: { type: "integer", example: 42 },
      page: { type: "integer", example: 1 },
      limit: { type: "integer", example: 20 },
      totalPages: { type: "integer", example: 3 },
    },
  },
  MarketplacePaginationMeta: {
    type: "object",
    properties: {
      page: { type: "integer", example: 1 },
      pageSize: { type: "integer", example: 24 },
      total: { type: "integer", example: 48 },
      totalPages: { type: "integer", example: 2 },
    },
  },
  GymOwnerSummary: {
    type: "object",
    properties: {
      id: objectIdSchema,
      name: { type: "string", example: "Sid Nath" },
      firstName: { type: "string", example: "Sid" },
      lastName: { type: "string", example: "Nath" },
    },
  },
  GymLocationData: {
    type: "object",
    properties: {
      address: { type: "string", example: "Road No. 36, Hyderabad, Telangana" },
      city: { type: "string", example: "Hyderabad" },
      state: { type: "string", example: "Telangana" },
    },
  },
  GymPricingData: {
    type: "object",
    properties: {
      mrp: { type: "number", nullable: true, example: 3000 },
      discounted: { type: "number", nullable: true, example: 2500 },
      monthlyMrp: { type: "number", nullable: true, example: 3000 },
      monthlyPrice: { type: "number", nullable: true, example: 2500 },
      currency: { type: "string", example: "INR" },
    },
  },
  GymScheduleData: {
    type: "object",
    properties: {
      open: { type: "string", nullable: true, example: "06:00" },
      close: { type: "string", nullable: true, example: "22:00" },
      openTime: { type: "string", nullable: true, example: "06:00" },
      closeTime: { type: "string", nullable: true, example: "22:00" },
      workingDays: {
        type: "array",
        items: { type: "string" },
        example: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      },
    },
  },
  GymAnalyticsData: {
    type: "object",
    properties: {
      impressions: { type: "integer", example: 1024 },
      rating: { type: "number", example: 4.6 },
      ratingCount: { type: "integer", example: 38 },
      lastImpressionAt: { type: "string", format: "date-time", nullable: true },
      lastReviewAt: { type: "string", format: "date-time", nullable: true },
    },
  },
  GymSponsorshipData: {
    type: "object",
    properties: {
      status: {
        type: "string",
        enum: ["none", "active", "expired"],
        example: "active",
      },
      expiresAt: { type: "string", format: "date-time", nullable: true },
      package: { type: "string", nullable: true, example: "gold" },
    },
  },
  GymReviewData: {
    type: "object",
    properties: {
      id: { type: "string", example: "64b7a0c5d2f0f6a123456789" },
      rating: { type: "number", example: 5 },
      comment: {
        type: "string",
        example: "Great trainer support and clean equipment.",
      },
      authorId: { ...objectIdSchema, nullable: true },
      authorName: { type: "string", nullable: true, example: "Asha Rao" },
      authorAvatar: {
        type: "string",
        nullable: true,
        example: "https://res.cloudinary.com/demo/image/upload/avatar.jpg",
      },
      createdAt: { type: "string", format: "date-time", nullable: true },
      updatedAt: { type: "string", format: "date-time", nullable: true },
    },
  },
  GymData: {
    type: "object",
    properties: {
      id: objectIdSchema,
      name: { type: "string", example: "FitSync Elite" },
      owner: { allOf: [schemaRef("GymOwnerSummary")], nullable: true },
      city: { type: "string", nullable: true, example: "Hyderabad" },
      location: schemaRef("GymLocationData"),
      pricing: schemaRef("GymPricingData"),
      contact: {
        type: "object",
        properties: {
          phone: { type: "string", nullable: true },
          email: { type: "string", nullable: true },
          website: { type: "string", nullable: true },
          whatsapp: { type: "string", nullable: true },
        },
      },
      schedule: schemaRef("GymScheduleData"),
      features: { type: "array", items: { type: "string" } },
      keyFeatures: { type: "array", items: { type: "string" } },
      amenities: { type: "array", items: { type: "string" } },
      tags: { type: "array", items: { type: "string" } },
      description: {
        type: "string",
        nullable: true,
        example: "Premium training and recovery facility.",
      },
      gallery: { type: "array", items: { type: "string" } },
      sponsorship: schemaRef("GymSponsorshipData"),
      analytics: schemaRef("GymAnalyticsData"),
      status: {
        type: "string",
        enum: ["active", "paused", "suspended"],
        example: "active",
      },
      isPublished: { type: "boolean", example: true },
      updatedAt: { type: "string", format: "date-time", nullable: true },
      reviews: { type: "array", items: schemaRef("GymReviewData") },
    },
  },
  GymListResponseData: {
    type: "object",
    properties: {
      gyms: { type: "array", items: schemaRef("GymData") },
      pagination: schemaRef("PaginationMeta"),
    },
  },
  SingleGymResponseData: {
    type: "object",
    properties: {
      gym: schemaRef("GymData"),
    },
  },
  GymReviewsResponseData: {
    type: "object",
    properties: {
      reviews: { type: "array", items: schemaRef("GymReviewData") },
    },
  },
  GymReviewSubmitResponseData: {
    type: "object",
    properties: {
      review: schemaRef("GymReviewData"),
      analytics: schemaRef("GymAnalyticsData"),
    },
  },
  GalleryUserSummary: {
    type: "object",
    properties: {
      id: objectIdSchema,
      name: { type: "string", example: "Sid Nath" },
      role: { type: "string", nullable: true, example: "gym-owner" },
    },
  },
  GalleryPhotoData: {
    type: "object",
    properties: {
      id: { type: "string", example: "64b7a0c5d2f0f6a123456789" },
      imageUrl: {
        type: "string",
        example: "https://res.cloudinary.com/demo/image/upload/gym.jpg",
      },
      title: { type: "string", nullable: true, example: "Reception area" },
      description: {
        type: "string",
        nullable: true,
        example: "Front desk and lounge.",
      },
      category: { type: "string", example: "gym" },
      uploadedBy: { allOf: [schemaRef("GalleryUserSummary")], nullable: true },
      createdAt: { type: "string", format: "date-time", nullable: true },
    },
  },
  GymGalleryResponseData: {
    type: "object",
    properties: {
      gymPhotos: { type: "array", items: schemaRef("GalleryPhotoData") },
      memberPhotos: { type: "array", items: schemaRef("GalleryPhotoData") },
    },
  },
  GalleryPhotoResponseData: {
    type: "object",
    properties: {
      photo: schemaRef("GalleryPhotoData"),
    },
  },
  TrainerSummaryData: {
    type: "object",
    properties: {
      id: objectIdSchema,
      name: { type: "string", example: "Asha Rao" },
      profilePicture: { type: "string", nullable: true },
      activeTrainees: { type: "integer", example: 7 },
      gyms: { type: "array", items: { type: "string" } },
      experienceYears: { type: "integer", nullable: true, example: 4 },
      certifications: { type: "array", items: { type: "string" } },
      mentoredCount: { type: "integer", example: 18 },
      specializations: { type: "array", items: { type: "string" } },
      headline: {
        type: "string",
        nullable: true,
        example: "Strength and mobility coach",
      },
      bio: {
        type: "string",
        nullable: true,
        example: "Focused on sustainable progress.",
      },
      age: { type: "integer", nullable: true, example: 29 },
      height: { type: "number", nullable: true, example: 172 },
      gender: { type: "string", nullable: true, example: "female" },
    },
  },
  GymTrainersResponseData: {
    type: "object",
    properties: {
      trainers: { type: "array", items: schemaRef("TrainerSummaryData") },
    },
  },
  MembershipBillingData: {
    type: "object",
    properties: {
      amount: { type: "number", example: 2500 },
      currency: { type: "string", example: "INR" },
      paymentGateway: { type: "string", nullable: true, example: "stripe" },
      paymentReference: {
        type: "string",
        nullable: true,
        example: "pay_membership_001",
      },
      status: { type: "string", nullable: true, example: "paid" },
    },
  },
  MembershipGymSummary: {
    type: "object",
    properties: {
      id: objectIdSchema,
      name: { type: "string", example: "FitSync Elite" },
      city: { type: "string", nullable: true, example: "Hyderabad" },
    },
  },
  MembershipTrainerSummary: {
    type: "object",
    properties: {
      id: objectIdSchema,
      name: { type: "string", example: "Asha Rao" },
      profilePicture: { type: "string", nullable: true },
    },
  },
  TrainerAccessData: {
    type: "object",
    properties: {
      status: { type: "string", example: "pending" },
      requestedAt: { type: "string", format: "date-time", nullable: true },
      approvedAt: { type: "string", format: "date-time", nullable: true },
    },
  },
  MembershipData: {
    type: "object",
    properties: {
      id: objectIdSchema,
      status: { type: "string", example: "active" },
      plan: { type: "string", example: "monthly" },
      startDate: { type: "string", format: "date-time", nullable: true },
      endDate: { type: "string", format: "date-time", nullable: true },
      autoRenew: { type: "boolean", example: true },
      benefits: { type: "array", items: { type: "string" } },
      createdAt: { type: "string", format: "date-time", nullable: true },
      updatedAt: { type: "string", format: "date-time", nullable: true },
      notes: { type: "string", nullable: true },
      billing: { allOf: [schemaRef("MembershipBillingData")], nullable: true },
      gym: { allOf: [schemaRef("MembershipGymSummary")], nullable: true },
      trainer: {
        allOf: [schemaRef("MembershipTrainerSummary")],
        nullable: true,
      },
      trainerAccess: {
        allOf: [schemaRef("TrainerAccessData")],
        nullable: true,
      },
    },
  },
  MembershipResponseData: {
    type: "object",
    properties: {
      membership: { allOf: [schemaRef("MembershipData")], nullable: true },
    },
  },
  MarketplaceSellerSummary: {
    type: "object",
    properties: {
      id: objectIdSchema,
      name: { type: "string", nullable: true, example: "FitSync Store" },
      role: { type: "string", nullable: true, example: "seller" },
    },
  },
  MarketplaceReviewStatsData: {
    type: "object",
    properties: {
      count: { type: "integer", example: 16 },
      averageRating: { type: "number", example: 4.5 },
    },
  },
  MarketplaceProductStatsData: {
    type: "object",
    properties: {
      soldLast30Days: { type: "integer", example: 8 },
      totalSold: { type: "integer", example: 104 },
      inStock: { type: "boolean", example: true },
    },
  },
  MarketplaceProductData: {
    type: "object",
    properties: {
      id: objectIdSchema,
      name: { type: "string", example: "Whey Protein" },
      description: { type: "string", example: "2kg chocolate whey protein." },
      price: { type: "number", example: 1999 },
      mrp: { type: "number", example: 2499 },
      discountPercentage: { type: "integer", example: 20 },
      image: { type: "string", nullable: true },
      category: { type: "string", example: "supplements" },
      stock: { type: "integer", example: 18 },
      status: { type: "string", example: "available" },
      isPublished: { type: "boolean", example: true },
      updatedAt: { type: "string", format: "date-time", nullable: true },
      seller: {
        allOf: [schemaRef("MarketplaceSellerSummary")],
        nullable: true,
      },
      stats: schemaRef("MarketplaceProductStatsData"),
      reviews: schemaRef("MarketplaceReviewStatsData"),
    },
  },
  MarketplaceProductReviewItemData: {
    type: "object",
    properties: {
      id: objectIdSchema,
      rating: { type: "integer", example: 5 },
      title: { type: "string", nullable: true, example: "Great product" },
      comment: {
        type: "string",
        example: "Arrived quickly and matched the description.",
      },
      createdAt: { type: "string", format: "date-time", nullable: true },
      isVerifiedPurchase: { type: "boolean", example: true },
      user: {
        type: "object",
        nullable: true,
        properties: {
          id: objectIdSchema,
          name: { type: "string", example: "Asha Rao" },
          avatar: { type: "string", nullable: true },
          role: { type: "string", nullable: true, example: "trainee" },
        },
      },
    },
  },
  MarketplaceProductDetailData: {
    type: "object",
    properties: {
      id: objectIdSchema,
      name: { type: "string", example: "Whey Protein" },
      description: { type: "string", example: "2kg chocolate whey protein." },
      price: { type: "number", example: 1999 },
      mrp: { type: "number", example: 2499 },
      discountPercentage: { type: "integer", example: 20 },
      image: { type: "string", nullable: true },
      category: { type: "string", example: "supplements" },
      stock: { type: "integer", example: 18 },
      status: { type: "string", example: "available" },
      isPublished: { type: "boolean", example: true },
      updatedAt: { type: "string", format: "date-time", nullable: true },
      seller: {
        allOf: [schemaRef("MarketplaceSellerSummary")],
        nullable: true,
      },
      stats: schemaRef("MarketplaceProductStatsData"),
      reviews: {
        type: "object",
        properties: {
          count: { type: "integer", example: 16 },
          averageRating: { type: "number", example: 4.5 },
          items: {
            type: "array",
            items: schemaRef("MarketplaceProductReviewItemData"),
          },
        },
      },
    },
  },
  MarketplaceCatalogueResponseData: {
    type: "object",
    properties: {
      products: { type: "array", items: schemaRef("MarketplaceProductData") },
      pagination: schemaRef("MarketplacePaginationMeta"),
    },
  },
  MarketplaceProductResponseData: {
    type: "object",
    properties: {
      product: schemaRef("MarketplaceProductDetailData"),
    },
  },
  MarketplaceReviewCreatedData: {
    type: "object",
    properties: {
      reviewId: objectIdSchema,
    },
  },
  ShippingAddressData: {
    type: "object",
    required: [
      "firstName",
      "lastName",
      "email",
      "phone",
      "address",
      "city",
      "state",
      "zipCode",
    ],
    properties: {
      firstName: { type: "string", example: "Sid" },
      lastName: { type: "string", example: "Nath" },
      email: { type: "string", format: "email", example: "sid@example.com" },
      phone: { type: "string", example: "+91-9876543210" },
      address: { type: "string", example: "Road No. 36" },
      city: { type: "string", example: "Hyderabad" },
      state: { type: "string", example: "Telangana" },
      zipCode: { type: "string", example: "500033" },
    },
  },
  BuyerOrderItemData: {
    type: "object",
    properties: {
      id: objectIdSchema,
      name: { type: "string", example: "Whey Protein" },
      quantity: { type: "integer", example: 2 },
      price: { type: "number", example: 1999 },
      image: { type: "string", nullable: true },
      status: { type: "string", example: "processing" },
    },
  },
  BuyerOrderData: {
    type: "object",
    properties: {
      id: objectIdSchema,
      orderNumber: { type: "string", example: "FS-260329-4821" },
      subtotal: { type: "number", example: 3998 },
      tax: { type: "number", example: 0 },
      shippingCost: { type: "number", example: 0 },
      total: { type: "number", example: 3998 },
      status: { type: "string", example: "processing" },
      paymentMethod: { type: "string", example: "Cash on Delivery" },
      createdAt: { type: "string", format: "date-time", nullable: true },
      items: { type: "array", items: schemaRef("BuyerOrderItemData") },
      shippingAddress: schemaRef("ShippingAddressData"),
    },
  },
  BuyerOrderResponseData: {
    type: "object",
    properties: {
      order: schemaRef("BuyerOrderData"),
    },
  },
  SellerProductData: {
    type: "object",
    properties: {
      id: objectIdSchema,
      name: { type: "string", example: "Whey Protein" },
      description: { type: "string", example: "2kg chocolate whey protein." },
      price: { type: "number", example: 1999 },
      mrp: { type: "number", example: 2499 },
      discountPercentage: { type: "integer", example: 20 },
      image: { type: "string", nullable: true },
      category: { type: "string", example: "supplements" },
      stock: { type: "integer", example: 18 },
      status: { type: "string", example: "available" },
      isPublished: { type: "boolean", example: true },
      createdAt: { type: "string", format: "date-time", nullable: true },
      updatedAt: { type: "string", format: "date-time", nullable: true },
    },
  },
  SellerProductsResponseData: {
    type: "object",
    properties: {
      products: { type: "array", items: schemaRef("SellerProductData") },
    },
  },
  SellerProductResponseData: {
    type: "object",
    properties: {
      product: schemaRef("SellerProductData"),
    },
  },
  ProductIdResponseData: {
    type: "object",
    properties: {
      productId: objectIdSchema,
    },
  },
  SellerOrderStatusHistoryEntryData: {
    type: "object",
    properties: {
      status: { type: "string", example: "in-transit" },
      note: {
        type: "string",
        nullable: true,
        example: "Handed over to courier partner.",
      },
      updatedBy: { ...objectIdSchema, nullable: true },
      updatedAt: { type: "string", format: "date-time", nullable: true },
    },
  },
  SellerOrderItemData: {
    type: "object",
    properties: {
      id: objectIdSchema,
      itemId: objectIdSchema,
      name: { type: "string", example: "Whey Protein" },
      quantity: { type: "integer", example: 2 },
      price: { type: "number", example: 1999 },
      status: { type: "string", example: "processing" },
      lastStatusAt: { type: "string", format: "date-time", nullable: true },
      statusHistory: {
        type: "array",
        items: schemaRef("SellerOrderStatusHistoryEntryData"),
      },
    },
  },
  SellerOrderData: {
    type: "object",
    properties: {
      id: objectIdSchema,
      orderNumber: { type: "string", example: "FS-260329-4821" },
      status: { type: "string", example: "processing" },
      createdAt: { type: "string", format: "date-time", nullable: true },
      total: { type: "number", example: 3998 },
      buyer: {
        type: "object",
        nullable: true,
        properties: {
          _id: objectIdSchema,
          name: { type: "string", example: "Asha Rao" },
          email: {
            type: "string",
            format: "email",
            example: "asha@example.com",
          },
        },
      },
      items: { type: "array", items: schemaRef("SellerOrderItemData") },
    },
  },
  SellerOrdersResponseData: {
    type: "object",
    properties: {
      orders: { type: "array", items: schemaRef("SellerOrderData") },
      statusOptions: {
        type: "array",
        items: {
          type: "string",
          enum: ["processing", "in-transit", "out-for-delivery", "delivered"],
        },
      },
    },
  },
  SellerOrderUpdateResponseData: {
    type: "object",
    properties: {
      order: schemaRef("SellerOrderData"),
      statusOptions: {
        type: "array",
        items: {
          type: "string",
          enum: ["processing", "in-transit", "out-for-delivery", "delivered"],
        },
      },
      payout: {
        type: "object",
        nullable: true,
        properties: {
          sellerPayout: { type: "number", example: 3398 },
          adminCommission: { type: "number", example: 600 },
        },
      },
    },
  },
  ContactMessageData: {
    type: "object",
    properties: {
      _id: objectIdSchema,
      name: { type: "string", example: "Asha Rao" },
      email: { type: "string", format: "email", example: "asha@example.com" },
      message: { type: "string", example: "Interested in a gym-owner demo." },
      status: {
        type: "string",
        enum: ["new", "read", "responded"],
        example: "new",
      },
      createdAt: { type: "string", format: "date-time", nullable: true },
      updatedAt: { type: "string", format: "date-time", nullable: true },
    },
  },
  ContactMessagesResponseData: {
    type: "array",
    items: schemaRef("ContactMessageData"),
  },
});

endpointDefs.push(
  {
    method: "post",
    path: "/api/auth/register",
    tag: "Auth",
    summary: "Register a user account",
    description: "Creates a new account and returns an access token.",
    bodySchema: "RegisterRequest",
    bodyDescription: "User registration payload.",
    responses: {
      201: R.created(
        "Registration successful.",
        schemaRef("AuthSessionData"),
        "Registration successful",
      ),
      400: R.bad,
      409: R.conflict,
      500: R.server,
    },
  },
  {
    method: "post",
    path: "/api/auth/login",
    tag: "Auth",
    summary: "Log in",
    description: "Authenticates a user and returns an access token.",
    bodySchema: "LoginRequest",
    bodyDescription: "Login credentials.",
    responses: {
      200: R.ok(
        "Login successful.",
        schemaRef("AuthSessionData"),
        "Login successful",
      ),
      400: R.bad,
      401: R.unauth,
      403: R.forbidden,
      404: R.notFound,
      500: R.server,
    },
  },
  {
    method: "post",
    path: "/api/auth/refresh",
    tag: "Auth",
    summary: "Refresh the access token",
    description:
      "Uses the refresh cookie or body token to issue a new access token.",
    security: refreshSecurity,
    bodySchema: "RefreshTokenRequest",
    bodyRequired: false,
    bodyDescription: "Optional refresh token body fallback.",
    responses: {
      200: R.ok(
        "Access token refreshed successfully.",
        schemaRef("AccessTokenData"),
        "Access token refreshed successfully",
      ),
      401: R.unauth,
      500: R.server,
    },
  },
  {
    method: "post",
    path: "/api/auth/logout",
    tag: "Auth",
    summary: "Log out",
    description:
      "Clears the refresh token cookie and invalidates the stored refresh token when present.",
    responses: { 204: R.noContent("Logged out successfully."), 500: R.server },
  },
  {
    method: "get",
    path: "/api/gyms",
    tag: "Gyms",
    summary: "List gyms",
    description: "Returns the public gym catalogue.",
    parameters: [
      queryParam(
        "page",
        { type: "integer", minimum: 1, example: 1 },
        "Page number.",
      ),
      queryParam(
        "limit",
        { type: "integer", minimum: 1, maximum: 100, example: 20 },
        "Page size.",
      ),
      queryParam(
        "search",
        { type: "string", example: "strength" },
        "Search term.",
      ),
      queryParam(
        "city",
        { type: "string", example: "Hyderabad" },
        "City filter.",
      ),
      queryParam(
        "state",
        { type: "string", example: "Telangana" },
        "State filter.",
      ),
    ],
    responses: {
      200: R.ok(
        "Gyms fetched successfully.",
        schemaRef("GymListResponseData"),
        "Gyms fetched successfully",
      ),
      500: R.server,
    },
  },
  {
    method: "post",
    path: "/api/gyms",
    tag: "Gyms",
    summary: "Create a gym listing",
    description: "Creates a new gym for the authenticated gym owner or admin.",
    security: accessSecurity,
    bodySchema: "GymMutationInput",
    bodyDescription: "Gym details and listing subscription information.",
    responses: secureResponses(
      {
        201: R.created(
          "Gym created successfully.",
          schemaRef("SingleGymResponseData"),
          "Gym created successfully",
        ),
      },
      { 400: R.bad },
    ),
  },
  {
    method: "get",
    path: "/api/gyms/{gymId}",
    tag: "Gyms",
    summary: "Get gym details",
    parameters: [idParam("gymId", "Gym identifier.")],
    responses: {
      200: R.ok(
        "Gym fetched successfully.",
        schemaRef("SingleGymResponseData"),
        "Gym fetched successfully",
      ),
      400: R.bad,
      404: R.notFound,
      500: R.server,
    },
  },
  {
    method: "put",
    path: "/api/gyms/{gymId}",
    tag: "Gyms",
    summary: "Update a gym listing",
    security: accessSecurity,
    parameters: [idParam("gymId", "Gym identifier.")],
    bodySchema: "GymMutationInput",
    bodyDescription: "Gym details to update.",
    responses: secureResponses(
      {
        200: R.ok(
          "Gym updated successfully.",
          schemaRef("SingleGymResponseData"),
          "Gym updated successfully",
        ),
      },
      { 400: R.bad, 404: R.notFound },
    ),
  },
  {
    method: "get",
    path: "/api/gyms/{gymId}/trainers",
    tag: "Gyms",
    summary: "List gym trainers",
    parameters: [idParam("gymId", "Gym identifier.")],
    responses: {
      200: R.ok(
        "Gym trainers fetched successfully.",
        schemaRef("GymTrainersResponseData"),
        "Gym trainers fetched successfully",
      ),
      400: R.bad,
      404: R.notFound,
      500: R.server,
    },
  },
  {
    method: "get",
    path: "/api/gyms/{gymId}/memberships/me",
    tag: "Gyms",
    summary: "Get my gym membership",
    security: accessSecurity,
    parameters: [idParam("gymId", "Gym identifier.")],
    responses: secureResponses(
      {
        200: R.ok(
          "Membership fetched successfully.",
          schemaRef("MembershipResponseData"),
          "Membership fetched successfully",
        ),
      },
      { 404: R.notFound },
    ),
  },
  {
    method: "post",
    path: "/api/gyms/{gymId}/memberships",
    tag: "Gyms",
    summary: "Join a gym",
    description:
      "Creates a trainee membership or submits a trainer-access request.",
    security: accessSecurity,
    parameters: [idParam("gymId", "Gym identifier.")],
    bodySchema: "GymMembershipJoinInput",
    bodyDescription: "Membership join payload.",
    responses: secureResponses(
      {
        201: R.created(
          "Gym joined successfully.",
          schemaRef("MembershipResponseData"),
          "Gym joined successfully.",
        ),
        202: R.accepted(
          "Trainer request submitted.",
          schemaRef("MembershipResponseData"),
          "Trainer request submitted. Await gym owner approval.",
        ),
      },
      { 400: R.bad, 404: R.notFound, 409: R.conflict },
    ),
  },
  {
    method: "delete",
    path: "/api/gyms/{gymId}/memberships/{membershipId}",
    tag: "Gyms",
    summary: "Cancel or remove a membership",
    security: accessSecurity,
    parameters: [
      idParam("gymId", "Gym identifier."),
      idParam("membershipId", "Membership identifier."),
    ],
    responses: secureResponses(
      {
        200: R.ok(
          "Membership updated successfully.",
          schemaRef("MembershipResponseData"),
          "Membership cancelled successfully.",
        ),
      },
      { 400: R.bad, 404: R.notFound },
    ),
  },
  {
    method: "get",
    path: "/api/gyms/{gymId}/reviews",
    tag: "Gyms",
    summary: "List gym reviews",
    parameters: [
      idParam("gymId", "Gym identifier."),
      queryParam(
        "limit",
        { type: "integer", minimum: 1, maximum: 100, example: 20 },
        "Maximum reviews.",
      ),
    ],
    responses: {
      200: R.ok(
        "Reviews fetched successfully.",
        schemaRef("GymReviewsResponseData"),
        "Reviews fetched successfully",
      ),
      400: R.bad,
      404: R.notFound,
      500: R.server,
    },
  },
  {
    method: "post",
    path: "/api/gyms/{gymId}/reviews",
    tag: "Gyms",
    summary: "Submit a gym review",
    security: accessSecurity,
    parameters: [idParam("gymId", "Gym identifier.")],
    bodySchema: "ReviewInput",
    bodyDescription: "Review content.",
    responses: secureResponses(
      {
        200: R.ok(
          "Review submitted successfully.",
          schemaRef("GymReviewSubmitResponseData"),
          "Thank you for sharing your experience with this gym.",
        ),
      },
      { 400: R.bad, 404: R.notFound, 409: R.conflict },
    ),
  },
  {
    method: "get",
    path: "/api/gyms/{gymId}/gallery",
    tag: "Gyms",
    summary: "Get gym gallery",
    parameters: [idParam("gymId", "Gym identifier.")],
    responses: {
      200: R.ok(
        "Gallery fetched successfully.",
        schemaRef("GymGalleryResponseData"),
        "Gallery fetched successfully",
      ),
      400: R.bad,
      404: R.notFound,
      500: R.server,
    },
  },
  {
    method: "post",
    path: "/api/gyms/{gymId}/gallery",
    tag: "Gyms",
    summary: "Upload a gym gallery photo",
    security: accessSecurity,
    parameters: [idParam("gymId", "Gym identifier.")],
    bodySchema: "GymGalleryUploadInput",
    contentType: "multipart/form-data",
    bodyDescription: "Gallery photo upload.",
    responses: secureResponses(
      {
        201: R.created(
          "Photo uploaded successfully.",
          schemaRef("GalleryPhotoResponseData"),
          "Photo uploaded successfully",
        ),
      },
      { 400: R.bad, 404: R.notFound },
    ),
  },
  {
    method: "post",
    path: "/api/gyms/{gymId}/impressions",
    tag: "Gyms",
    summary: "Record a gym impression",
    parameters: [idParam("gymId", "Gym identifier.")],
    responses: {
      204: R.noContent("Impression recorded successfully."),
      400: R.bad,
      404: R.notFound,
      500: R.server,
    },
  },
);

endpointDefs.push(
  {
    method: "get",
    path: "/api/marketplace/products",
    tag: "Marketplace",
    summary: "List marketplace products",
    parameters: [
      queryParam(
        "search",
        { type: "string", example: "whey" },
        "Free-text search.",
      ),
      queryParam(
        "category",
        { type: "string", example: "supplements" },
        "Product category.",
      ),
      queryParam(
        "minPrice",
        { type: "number", example: 500 },
        "Minimum price.",
      ),
      queryParam(
        "maxPrice",
        { type: "number", example: 2500 },
        "Maximum price.",
      ),
      queryParam(
        "inStock",
        { type: "boolean", example: true },
        "Only include in-stock products.",
      ),
      queryParam(
        "sort",
        { type: "string", example: "featured" },
        "Sort strategy.",
      ),
      queryParam(
        "page",
        { type: "integer", minimum: 1, example: 1 },
        "Page number.",
      ),
      queryParam(
        "pageSize",
        { type: "integer", minimum: 1, maximum: 100, example: 24 },
        "Items per page.",
      ),
    ],
    responses: {
      200: R.ok(
        "Marketplace catalogue fetched.",
        schemaRef("MarketplaceCatalogueResponseData"),
        "Marketplace catalogue fetched successfully",
      ),
      500: R.server,
    },
  },
  {
    method: "get",
    path: "/api/marketplace/products/{productId}",
    tag: "Marketplace",
    summary: "Get marketplace product detail",
    parameters: [idParam("productId", "Product identifier.")],
    responses: {
      200: R.ok(
        "Marketplace product fetched.",
        schemaRef("MarketplaceProductResponseData"),
        "Marketplace product fetched successfully",
      ),
      400: R.bad,
      404: R.notFound,
      500: R.server,
    },
  },
  {
    method: "post",
    path: "/api/marketplace/orders",
    tag: "Marketplace",
    summary: "Create a marketplace order",
    security: accessSecurity,
    bodySchema: "MarketplaceOrderInput",
    responses: secureResponses(
      {
        201: R.created(
          "Order created successfully.",
          schemaRef("BuyerOrderResponseData"),
          "Order placed successfully",
        ),
      },
      { 400: R.bad },
    ),
  },
  {
    method: "post",
    path: "/api/marketplace/products/{productId}/reviews",
    tag: "Marketplace",
    summary: "Create a product review",
    security: accessSecurity,
    parameters: [idParam("productId", "Product identifier.")],
    bodySchema: "ProductReviewInput",
    responses: secureResponses(
      {
        201: R.created(
          "Review submitted successfully.",
          schemaRef("MarketplaceReviewCreatedData"),
          "Review submitted successfully.",
        ),
      },
      { 400: R.bad, 404: R.notFound, 409: R.conflict },
    ),
  },
  {
    method: "get",
    path: "/api/marketplace/seller/products",
    tag: "Marketplace",
    summary: "List seller products",
    security: accessSecurity,
    responses: secureResponses({
      200: R.ok(
        "Seller products fetched.",
        schemaRef("SellerProductsResponseData"),
        "Products fetched successfully",
      ),
    }),
  },
  {
    method: "post",
    path: "/api/marketplace/seller/products",
    tag: "Marketplace",
    summary: "Create a seller product",
    security: accessSecurity,
    bodySchema: "SellerProductInput",
    contentType: "multipart/form-data",
    responses: secureResponses(
      {
        201: R.created(
          "Product created successfully.",
          schemaRef("SellerProductResponseData"),
          "Product created successfully",
        ),
      },
      { 400: R.bad },
    ),
  },
  {
    method: "put",
    path: "/api/marketplace/seller/products/{productId}",
    tag: "Marketplace",
    summary: "Update a seller product",
    security: accessSecurity,
    parameters: [idParam("productId", "Product identifier.")],
    bodySchema: "SellerProductInput",
    contentType: "multipart/form-data",
    responses: secureResponses(
      {
        200: R.ok(
          "Seller product updated successfully.",
          schemaRef("SellerProductResponseData"),
          "Product updated successfully",
        ),
      },
      { 400: R.bad, 404: R.notFound },
    ),
  },
  {
    method: "delete",
    path: "/api/marketplace/seller/products/{productId}",
    tag: "Marketplace",
    summary: "Delete a seller product",
    security: accessSecurity,
    parameters: [idParam("productId", "Product identifier.")],
    responses: secureResponses(
      {
        200: R.ok(
          "Seller product deleted successfully.",
          schemaRef("ProductIdResponseData"),
          "Product removed successfully",
        ),
      },
      { 400: R.bad, 404: R.notFound },
    ),
  },
  {
    method: "get",
    path: "/api/marketplace/seller/orders",
    tag: "Marketplace",
    summary: "List seller orders",
    security: accessSecurity,
    responses: secureResponses({
      200: R.ok(
        "Seller orders fetched.",
        schemaRef("SellerOrdersResponseData"),
        "Orders fetched successfully",
      ),
    }),
  },
  {
    method: "patch",
    path: "/api/marketplace/seller/orders/{orderId}/items/{itemId}/status",
    tag: "Marketplace",
    summary: "Update seller order item status",
    security: accessSecurity,
    parameters: [
      idParam("orderId", "Order identifier."),
      {
        name: "itemId",
        in: "path",
        required: true,
        description:
          "Order item identifier, or `all` to update all items for this seller.",
        schema: {
          oneOf: [objectIdSchema, { type: "string", enum: ["all"] }],
        },
      },
    ],
    bodySchema: "SellerOrderStatusUpdateInput",
    responses: secureResponses(
      {
        200: R.ok(
          "Seller order status updated.",
          schemaRef("SellerOrderUpdateResponseData"),
          "Order status updated successfully",
        ),
      },
      { 400: R.bad, 404: R.notFound },
    ),
  },
  {
    method: "get",
    path: "/api/users/profile",
    tag: "Users",
    summary: "Get the authenticated profile",
    security: accessSecurity,
    responses: {
      200: R.ok(
        "Profile fetched successfully.",
        schemaRef("UserProfileResponseData"),
        "Profile fetched successfully",
      ),
      401: R.unauth,
      404: R.notFound,
      500: R.server,
    },
  },
  {
    method: "patch",
    path: "/api/users/profile",
    tag: "Users",
    summary: "Update the authenticated profile",
    security: accessSecurity,
    bodySchema: "ProfileUpdateInput",
    contentType: "multipart/form-data",
    responses: {
      200: R.ok(
        "Profile updated successfully.",
        schemaRef("UserProfileResponseData"),
        "Profile updated successfully",
      ),
      400: R.bad,
      401: R.unauth,
      404: R.notFound,
      500: R.server,
    },
  },
  {
    method: "post",
    path: "/api/contact",
    tag: "Contact",
    summary: "Submit the contact form",
    bodySchema: "ContactFormInput",
    responses: {
      201: R.created(
        "Message sent successfully.",
        schemaRef("ContactMessageData"),
        "Message sent successfully",
      ),
      400: R.bad,
      500: R.server,
    },
  },
  {
    method: "get",
    path: "/api/contact",
    tag: "Contact",
    summary: "List contact messages",
    security: accessSecurity,
    parameters: [
      queryParam(
        "status",
        { type: "string", enum: ["new", "read", "responded"], example: "new" },
        "Optional message status filter.",
      ),
    ],
    responses: secureResponses({
      200: R.ok(
        "Messages fetched successfully.",
        schemaRef("ContactMessagesResponseData"),
        "Messages fetched successfully",
      ),
    }),
  },
  {
    method: "patch",
    path: "/api/contact/{id}/status",
    tag: "Contact",
    summary: "Update a contact message status",
    security: accessSecurity,
    parameters: [idParam("id", "Contact message identifier.")],
    bodySchema: "ContactStatusUpdateInput",
    responses: secureResponses(
      {
        200: R.ok(
          "Message status updated successfully.",
          schemaRef("ContactMessageData"),
          "Message status updated successfully",
        ),
      },
      { 400: R.bad, 404: R.notFound },
    ),
  },
  {
    method: "get",
    path: "/api/system/health",
    tag: "System",
    summary: "Health check",
    responses: {
      200: {
        description: "Application health response.",
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["status", "timestamp"],
              properties: {
                status: { type: "string", example: "ok" },
                timestamp: { type: "integer", example: 1774814400000 },
              },
            },
          },
        },
      },
    },
  },
);

[
  "/api/dashboards/trainee/overview|Get trainee overview dashboard",
  "/api/dashboards/trainee/progress|Get trainee progress dashboard",
  "/api/dashboards/trainee/diet|Get trainee diet dashboard",
  "/api/dashboards/trainee/orders|Get trainee marketplace orders",
  "/api/dashboards/gym-owner/overview|Get gym-owner overview dashboard",
  "/api/dashboards/gym-owner/gyms|List gym-owner gyms",
  "/api/dashboards/gym-owner/subscriptions|Get gym-owner subscriptions",
  "/api/dashboards/gym-owner/sponsorships|Get gym-owner sponsorships",
  "/api/dashboards/gym-owner/analytics|Get gym-owner analytics",
  "/api/dashboards/gym-owner/roster|Get gym-owner roster",
  "/api/dashboards/trainer/overview|Get trainer overview dashboard",
  "/api/dashboards/trainer/trainees|Get trainer trainees",
  "/api/dashboards/trainer/updates|Get trainer updates",
  "/api/dashboards/trainer/feedback|Get trainer feedback inbox",
  "/api/dashboards/admin/overview|Get admin overview dashboard",
  "/api/dashboards/admin/users|List admin users dashboard",
  "/api/dashboards/admin/gyms|List admin gyms dashboard",
  "/api/dashboards/admin/revenue|Get admin revenue dashboard",
  "/api/dashboards/admin/marketplace|Get admin marketplace dashboard",
  "/api/dashboards/admin/insights|Get admin insights dashboard",
  "/api/dashboards/admin/memberships|Get admin memberships dashboard",
  "/api/dashboards/admin/products|Get admin product dashboard",
  "/api/dashboards/admin/reviews|Get admin reviews dashboard",
  "/api/dashboards/admin/subscriptions|Get admin subscriptions dashboard",
  "/api/dashboards/manager/overview|Get manager overview dashboard",
  "/api/dashboards/manager/sellers|Get manager sellers dashboard",
  "/api/dashboards/manager/gym-owners|Get manager gym-owner dashboard",
].forEach((entry) => {
  const [path, summary] = entry.split("|");
  endpointDefs.push({
    method: "get",
    path,
    tag: "Dashboards",
    summary,
    security: accessSecurity,
    responses: secureResponses({ 200: R.ok(`${summary}.`) }),
  });
});

endpointDefs.push(
  {
    method: "post",
    path: "/api/dashboards/trainee/feedback",
    tag: "Dashboards",
    summary: "Submit trainee feedback to a trainer",
    security: accessSecurity,
    bodySchema: "DashboardFeedbackInput",
    bodyDescription: "Trainer feedback payload.",
    responses: secureResponses(
      { 201: R.created("Feedback submitted successfully.") },
      { 400: R.bad },
    ),
  },
  {
    method: "get",
    path: "/api/dashboards/admin/gyms/{gymId}",
    tag: "Dashboards",
    summary: "Get admin gym detail",
    security: accessSecurity,
    parameters: [idParam("gymId", "Gym identifier.")],
    responses: secureResponses(
      { 200: R.ok("Admin gym detail fetched.") },
      { 400: R.bad, 404: R.notFound },
    ),
  },
  {
    method: "get",
    path: "/api/dashboards/admin/users/{userId}",
    tag: "Dashboards",
    summary: "Get admin user detail",
    security: accessSecurity,
    parameters: [idParam("userId", "User identifier.")],
    responses: secureResponses(
      { 200: R.ok("Admin user detail fetched.") },
      { 400: R.bad, 404: R.notFound },
    ),
  },
  {
    method: "get",
    path: "/api/dashboards/admin/products/{productId}",
    tag: "Dashboards",
    summary: "Get admin product buyers",
    security: accessSecurity,
    parameters: [idParam("productId", "Product identifier.")],
    responses: secureResponses(
      { 200: R.ok("Admin product buyers fetched.") },
      { 400: R.bad, 404: R.notFound },
    ),
  },
);

[
  [
    "/api/trainer/trainees/{traineeId}/attendance",
    "post",
    "Log trainee attendance",
    "TraineeAttendanceInput",
    201,
  ],
  [
    "/api/trainer/trainees/{traineeId}/progress",
    "post",
    "Record a progress metric",
    "ProgressMetricInput",
    201,
  ],
  [
    "/api/trainer/trainees/{traineeId}/diet",
    "put",
    "Create or update a diet plan",
    "DietPlanInput",
    200,
  ],
  [
    "/api/trainer/trainees/{traineeId}/feedback",
    "post",
    "Add trainer feedback",
    "TraineeFeedbackInput",
    201,
  ],
].forEach(([path, method, summary, bodySchema, statusCode]) => {
  endpointDefs.push({
    method,
    path,
    tag: "Trainer",
    summary,
    security: accessSecurity,
    parameters: [idParam("traineeId", "Trainee identifier.")],
    bodySchema,
    responses: secureResponses(
      {
        [statusCode]:
          statusCode === 201 ? R.created(`${summary}.`) : R.ok(`${summary}.`),
      },
      { 400: R.bad, 404: R.notFound },
    ),
  });
});

endpointDefs.push({
  method: "patch",
  path: "/api/trainer/feedback/{feedbackId}/review",
  tag: "Trainer",
  summary: "Mark feedback as reviewed",
  security: accessSecurity,
  parameters: [idParam("feedbackId", "Feedback identifier.")],
  responses: secureResponses(
    { 200: R.ok("Feedback marked as reviewed.") },
    { 400: R.bad, 404: R.notFound },
  ),
});

[
  ["/api/admin/users/{userId}", "delete", "Delete a user account", "userId"],
  ["/api/admin/gyms/{gymId}", "delete", "Delete a gym listing", "gymId"],
  [
    "/api/admin/products/{productId}",
    "delete",
    "Delete a marketplace product",
    "productId",
  ],
].forEach(([path, method, summary, idName]) => {
  endpointDefs.push({
    method,
    path,
    tag: "Admin",
    summary,
    security: accessSecurity,
    parameters: [idParam(idName, `${idName} identifier.`)],
    responses: secureResponses(
      { 200: R.ok(`${summary}.`) },
      { 400: R.bad, 404: R.notFound },
    ),
  });
});

endpointDefs.push(
  {
    method: "patch",
    path: "/api/admin/users/{userId}/status",
    tag: "Admin",
    summary: "Update a user status",
    security: accessSecurity,
    parameters: [idParam("userId", "User identifier.")],
    bodySchema: "StatusUpdateInput",
    responses: secureResponses(
      { 200: R.ok("User status updated successfully.") },
      { 400: R.bad, 404: R.notFound },
    ),
  },
  {
    method: "get",
    path: "/api/admin/settings/toggles",
    tag: "Admin",
    summary: "Get admin feature toggles",
    security: accessSecurity,
    responses: secureResponses({
      200: R.ok("Admin toggles fetched successfully."),
    }),
  },
  {
    method: "patch",
    path: "/api/admin/settings/toggles",
    tag: "Admin",
    summary: "Update admin feature toggles",
    security: accessSecurity,
    bodySchema: "AdminTogglesInput",
    responses: secureResponses(
      { 200: R.ok("Admin toggles updated successfully.") },
      { 400: R.bad },
    ),
  },
);

[
  "/api/manager/pending|List pending approvals",
  "/api/manager/sellers|List sellers",
  "/api/manager/gym-owners|List gym owners",
  "/api/manager/gyms|List gyms for oversight",
  "/api/manager/marketplace|Get marketplace oversight dashboard",
  "/api/manager/products|List products for oversight",
].forEach((entry) => {
  const [path, summary] = entry.split("|");
  endpointDefs.push({
    method: "get",
    path,
    tag: "Manager",
    summary,
    security: accessSecurity,
    responses: secureResponses({ 200: R.ok(`${summary}.`) }),
  });
});

endpointDefs.push(
  {
    method: "patch",
    path: "/api/manager/users/{userId}/approve",
    tag: "Manager",
    summary: "Approve a seller or gym-owner",
    security: accessSecurity,
    parameters: [idParam("userId", "User identifier.")],
    responses: secureResponses(
      { 200: R.ok("User approved successfully.") },
      { 400: R.bad, 404: R.notFound },
    ),
  },
  {
    method: "delete",
    path: "/api/manager/users/{userId}/reject",
    tag: "Manager",
    summary: "Reject and remove a pending seller or gym-owner",
    security: accessSecurity,
    parameters: [idParam("userId", "User identifier.")],
    responses: secureResponses(
      { 200: R.ok("User rejected successfully.") },
      { 400: R.bad, 404: R.notFound },
    ),
  },
  {
    method: "patch",
    path: "/api/manager/sellers/{userId}/status",
    tag: "Manager",
    summary: "Update seller status",
    security: accessSecurity,
    parameters: [idParam("userId", "Seller identifier.")],
    bodySchema: "ManagerRoleStatusUpdateInput",
    responses: secureResponses(
      { 200: R.ok("Seller status updated.") },
      { 400: R.bad, 404: R.notFound },
    ),
  },
  {
    method: "delete",
    path: "/api/manager/sellers/{userId}",
    tag: "Manager",
    summary: "Delete a seller",
    security: accessSecurity,
    parameters: [idParam("userId", "Seller identifier.")],
    responses: secureResponses(
      { 200: R.ok("Seller deleted successfully.") },
      { 400: R.bad, 404: R.notFound },
    ),
  },
  {
    method: "patch",
    path: "/api/manager/gym-owners/{userId}/status",
    tag: "Manager",
    summary: "Update gym-owner status",
    security: accessSecurity,
    parameters: [idParam("userId", "Gym-owner identifier.")],
    bodySchema: "ManagerRoleStatusUpdateInput",
    responses: secureResponses(
      { 200: R.ok("Gym-owner status updated.") },
      { 400: R.bad, 404: R.notFound },
    ),
  },
  {
    method: "delete",
    path: "/api/manager/gym-owners/{userId}",
    tag: "Manager",
    summary: "Delete a gym owner",
    security: accessSecurity,
    parameters: [idParam("userId", "Gym-owner identifier.")],
    responses: secureResponses(
      { 200: R.ok("Gym owner deleted successfully.") },
      { 400: R.bad, 404: R.notFound },
    ),
  },
  {
    method: "get",
    path: "/api/manager/users/{userId}",
    tag: "Manager",
    summary: "Get managed user detail",
    security: accessSecurity,
    parameters: [idParam("userId", "User identifier.")],
    responses: secureResponses(
      { 200: R.ok("User detail fetched.") },
      { 400: R.bad, 404: R.notFound },
    ),
  },
  {
    method: "get",
    path: "/api/manager/gyms/{gymId}",
    tag: "Manager",
    summary: "Get gym oversight detail",
    security: accessSecurity,
    parameters: [idParam("gymId", "Gym identifier.")],
    responses: secureResponses(
      { 200: R.ok("Gym detail fetched.") },
      { 400: R.bad, 404: R.notFound },
    ),
  },
  {
    method: "delete",
    path: "/api/manager/gyms/{gymId}",
    tag: "Manager",
    summary: "Delete a gym",
    security: accessSecurity,
    parameters: [idParam("gymId", "Gym identifier.")],
    responses: secureResponses(
      { 200: R.ok("Gym deleted successfully.") },
      { 400: R.bad, 404: R.notFound },
    ),
  },
  {
    method: "get",
    path: "/api/manager/products/{productId}",
    tag: "Manager",
    summary: "Get product buyers for oversight",
    security: accessSecurity,
    parameters: [idParam("productId", "Product identifier.")],
    responses: secureResponses(
      { 200: R.ok("Product buyers fetched.") },
      { 400: R.bad, 404: R.notFound },
    ),
  },
  {
    method: "delete",
    path: "/api/manager/products/{productId}",
    tag: "Manager",
    summary: "Delete a product",
    security: accessSecurity,
    parameters: [idParam("productId", "Product identifier.")],
    responses: secureResponses(
      { 200: R.ok("Product deleted successfully.") },
      { 400: R.bad, 404: R.notFound },
    ),
  },
);

[
  "/api/owner/monetisation/options|Get monetisation options",
  "/api/owner/trainers/requests|List trainer requests",
].forEach((entry) => {
  const [path, summary] = entry.split("|");
  endpointDefs.push({
    method: "get",
    path,
    tag: "Owner",
    summary,
    security: accessSecurity,
    responses: secureResponses({ 200: R.ok(`${summary}.`) }),
  });
});

endpointDefs.push(
  {
    method: "post",
    path: "/api/owner/subscriptions/checkout",
    tag: "Owner",
    summary: "Activate a listing subscription",
    security: accessSecurity,
    bodySchema: "ListingSubscriptionInput",
    responses: secureResponses(
      { 201: R.created("Subscription activated successfully.") },
      { 400: R.bad, 404: R.notFound },
    ),
  },
  {
    method: "post",
    path: "/api/owner/sponsorships/purchase",
    tag: "Owner",
    summary: "Purchase a sponsorship",
    security: accessSecurity,
    bodySchema: "SponsorshipPurchaseInput",
    responses: secureResponses(
      { 201: R.created("Sponsorship purchased successfully.") },
      { 400: R.bad, 404: R.notFound },
    ),
  },
  {
    method: "post",
    path: "/api/owner/trainers/requests/{assignmentId}/approve",
    tag: "Owner",
    summary: "Approve a trainer request",
    security: accessSecurity,
    parameters: [idParam("assignmentId", "Trainer assignment identifier.")],
    responses: secureResponses(
      { 200: R.ok("Trainer request approved.") },
      { 400: R.bad, 404: R.notFound },
    ),
  },
  {
    method: "post",
    path: "/api/owner/trainers/requests/{assignmentId}/decline",
    tag: "Owner",
    summary: "Decline a trainer request",
    security: accessSecurity,
    parameters: [idParam("assignmentId", "Trainer assignment identifier.")],
    responses: secureResponses(
      { 200: R.ok("Trainer request declined.") },
      { 400: R.bad, 404: R.notFound },
    ),
  },
  {
    method: "delete",
    path: "/api/owner/trainers/{assignmentId}",
    tag: "Owner",
    summary: "Remove a trainer from a gym",
    security: accessSecurity,
    parameters: [idParam("assignmentId", "Trainer assignment identifier.")],
    responses: secureResponses(
      { 200: R.ok("Trainer removed from gym.") },
      { 400: R.bad, 404: R.notFound },
    ),
  },
  {
    method: "delete",
    path: "/api/owner/memberships/{membershipId}",
    tag: "Owner",
    summary: "Remove a gym member",
    security: accessSecurity,
    parameters: [idParam("membershipId", "Membership identifier.")],
    responses: secureResponses(
      { 200: R.ok("Gym member removed.") },
      { 400: R.bad, 404: R.notFound },
    ),
  },
);

registerDashboardOpenApi({
  schemas,
  endpointDefs,
  schemaRef,
  accessSecurity,
  secureResponses,
  R,
  idParam,
});

registerOperationsOpenApi({
  schemas,
  endpointDefs,
  schemaRef,
  accessSecurity,
  secureResponses,
  R,
  idParam,
});

export const swaggerUiOptions = {
  explorer: true,
  customSiteTitle: "FitSync API Docs",
  swaggerOptions: {
    url: "/api/docs.json",
    displayRequestDuration: true,
    docExpansion: "list",
    persistAuthorization: true,
  },
};

export const createOpenApiSpec = (baseUrl = "http://localhost:4000") => ({
  openapi: "3.0.3",
  info: {
    title: "FitSync API",
    version: "1.0.0",
    description:
      "Centralized OpenAPI documentation for the FitSync Express backend. Authenticated endpoints accept either a Bearer token or the access-token cookie unless noted otherwise.",
  },
  servers: [{ url: baseUrl, description: "Current server" }],
  tags: [
    { name: "Auth" },
    { name: "Gyms" },
    { name: "Dashboards" },
    { name: "Trainer" },
    { name: "Admin" },
    { name: "Manager" },
    { name: "Owner" },
    { name: "Marketplace" },
    { name: "Users" },
    { name: "Contact" },
    { name: "System" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      accessTokenCookie: { type: "apiKey", in: "cookie", name: "accessToken" },
      refreshTokenCookie: {
        type: "apiKey",
        in: "cookie",
        name: "refreshToken",
      },
    },
    schemas,
  },
  paths: buildPaths(endpointDefs),
});
