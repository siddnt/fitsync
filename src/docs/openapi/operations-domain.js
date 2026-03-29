const objectIdSchema = {
  type: "string",
  pattern: "^[a-fA-F0-9]{24}$",
  example: "64b7a0c5d2f0f6a123456789",
};

const profileLocationSchema = {
  type: "object",
  properties: {
    city: { type: "string", nullable: true, example: "Hyderabad" },
    state: { type: "string", nullable: true, example: "Telangana" },
    country: { type: "string", nullable: true, example: "India" },
  },
};

const profileSummarySchema = {
  type: "object",
  properties: {
    headline: {
      type: "string",
      nullable: true,
      example: "Strength-led gym operator",
    },
    location: { ...profileLocationSchema, nullable: true },
  },
};

export const registerOperationsOpenApi = ({
  schemas,
  endpointDefs,
  schemaRef,
  accessSecurity,
  secureResponses,
  R,
  idParam,
}) => {
  Object.assign(schemas, {
    AdminToggleMapData: {
      type: "object",
      additionalProperties: { type: "boolean" },
      example: {
        allowSellerRegistrations: true,
        allowGymOwnerRegistrations: true,
        allowManagerRegistrations: false,
        maintenanceMode: false,
      },
    },
    AdminTogglesResponseData: {
      type: "object",
      properties: {
        adminToggles: schemaRef("AdminToggleMapData"),
      },
      example: {
        adminToggles: {
          allowSellerRegistrations: true,
          allowGymOwnerRegistrations: true,
          allowManagerRegistrations: false,
          maintenanceMode: false,
        },
      },
    },
    UserIdResponseData: {
      type: "object",
      properties: {
        userId: objectIdSchema,
      },
      example: { userId: "64b7a0c5d2f0f6a123456789" },
    },
    UserStatusResponseData: {
      type: "object",
      properties: {
        userId: objectIdSchema,
        status: {
          type: "string",
          enum: ["active", "inactive", "pending", "suspended"],
          example: "active",
        },
      },
      example: {
        userId: "64b7a0c5d2f0f6a123456789",
        status: "active",
      },
    },
    GymIdResponseData: {
      type: "object",
      properties: {
        gymId: objectIdSchema,
      },
      example: { gymId: "64b7a0c5d2f0f6a123456702" },
    },
    AssignmentIdResponseData: {
      type: "object",
      properties: {
        assignmentId: objectIdSchema,
      },
      example: { assignmentId: "64b7a0c5d2f0f6a123456794" },
    },
    MembershipIdResponseData: {
      type: "object",
      properties: {
        membershipId: objectIdSchema,
      },
      example: { membershipId: "64b7a0c5d2f0f6a123456795" },
    },
    ManagerPendingApprovalItemData: {
      type: "object",
      properties: {
        _id: objectIdSchema,
        name: { type: "string", example: "FitGear Store" },
        email: {
          type: "string",
          format: "email",
          example: "seller@fitsync.com",
        },
        role: {
          type: "string",
          enum: ["seller", "gym-owner"],
          example: "seller",
        },
        createdAt: { type: "string", format: "date-time", nullable: true },
        profilePicture: {
          type: "string",
          nullable: true,
          example: "https://res.cloudinary.com/demo/image/upload/profile.jpg",
        },
        contactNumber: {
          type: "string",
          nullable: true,
          example: "+91-9876543210",
        },
        profile: { ...profileSummarySchema, nullable: true },
      },
      example: {
        _id: "64b7a0c5d2f0f6a123456789",
        name: "FitGear Store",
        email: "seller@fitsync.com",
        role: "seller",
        createdAt: "2026-03-29T06:30:00.000Z",
        profile: {
          headline: "Supplements and recovery gear",
          location: { city: "Hyderabad", state: "Telangana", country: "India" },
        },
      },
    },
    ManagerPendingApprovalsResponseData: {
      type: "object",
      properties: {
        pending: {
          type: "array",
          items: schemaRef("ManagerPendingApprovalItemData"),
        },
      },
      example: {
        pending: [
          {
            _id: "64b7a0c5d2f0f6a123456789",
            name: "FitGear Store",
            email: "seller@fitsync.com",
            role: "seller",
            createdAt: "2026-03-29T06:30:00.000Z",
          },
        ],
      },
    },
    ManagerSellerProductCountsData: {
      type: "object",
      properties: {
        total: { type: "integer", example: 18 },
        published: { type: "integer", example: 14 },
      },
    },
    ManagerSellerListItemData: {
      type: "object",
      properties: {
        _id: objectIdSchema,
        name: { type: "string", example: "FitGear Store" },
        email: {
          type: "string",
          format: "email",
          example: "seller@fitsync.com",
        },
        status: {
          type: "string",
          enum: ["active", "inactive", "pending", "suspended"],
          example: "active",
        },
        createdAt: { type: "string", format: "date-time", nullable: true },
        profilePicture: { type: "string", nullable: true },
        contactNumber: {
          type: "string",
          nullable: true,
          example: "+91-9876543210",
        },
        profile: { ...profileSummarySchema, nullable: true },
        products: schemaRef("ManagerSellerProductCountsData"),
      },
      example: {
        _id: "64b7a0c5d2f0f6a123456789",
        name: "FitGear Store",
        email: "seller@fitsync.com",
        status: "active",
        createdAt: "2026-03-29T06:30:00.000Z",
        profile: {
          headline: "Supplements and recovery gear",
          location: { city: "Hyderabad", state: "Telangana", country: "India" },
        },
        products: { total: 18, published: 14 },
      },
    },
    ManagerSellerListResponseData: {
      type: "object",
      properties: {
        sellers: {
          type: "array",
          items: schemaRef("ManagerSellerListItemData"),
        },
      },
      example: {
        sellers: [
          {
            _id: "64b7a0c5d2f0f6a123456789",
            name: "FitGear Store",
            email: "seller@fitsync.com",
            status: "active",
            products: { total: 18, published: 14 },
          },
        ],
      },
    },
    ManagerGymOwnerCountsData: {
      type: "object",
      properties: {
        total: { type: "integer", example: 3 },
        published: { type: "integer", example: 2 },
      },
    },
    ManagerGymOwnerListItemData: {
      type: "object",
      properties: {
        _id: objectIdSchema,
        name: { type: "string", example: "Rohit Varma" },
        email: {
          type: "string",
          format: "email",
          example: "owner@fitsync.com",
        },
        status: {
          type: "string",
          enum: ["active", "inactive", "pending", "suspended"],
          example: "active",
        },
        createdAt: { type: "string", format: "date-time", nullable: true },
        profilePicture: { type: "string", nullable: true },
        contactNumber: {
          type: "string",
          nullable: true,
          example: "+91-9876543210",
        },
        profile: { ...profileSummarySchema, nullable: true },
        gyms: schemaRef("ManagerGymOwnerCountsData"),
      },
      example: {
        _id: "64b7a0c5d2f0f6a123456790",
        name: "Rohit Varma",
        email: "owner@fitsync.com",
        status: "active",
        createdAt: "2026-03-29T06:30:00.000Z",
        gyms: { total: 3, published: 2 },
      },
    },
    ManagerGymOwnerListResponseData: {
      type: "object",
      properties: {
        gymOwners: {
          type: "array",
          items: schemaRef("ManagerGymOwnerListItemData"),
        },
      },
      example: {
        gymOwners: [
          {
            _id: "64b7a0c5d2f0f6a123456790",
            name: "Rohit Varma",
            email: "owner@fitsync.com",
            status: "active",
            gyms: { total: 3, published: 2 },
          },
        ],
      },
    },
    ManagedGymSponsorshipData: {
      type: "object",
      properties: {
        tier: { type: "string", nullable: true, example: "gold" },
        package: { type: "string", nullable: true, example: "gold" },
        status: { type: "string", nullable: true, example: "active" },
        startDate: { type: "string", format: "date-time", nullable: true },
        endDate: { type: "string", format: "date-time", nullable: true },
        expiresAt: { type: "string", format: "date-time", nullable: true },
        amount: { type: "number", nullable: true, example: 24000 },
        monthlyBudget: { type: "number", nullable: true, example: 8000 },
      },
      example: {
        tier: "gold",
        status: "active",
        startDate: "2026-03-01T00:00:00.000Z",
        endDate: "2026-06-01T00:00:00.000Z",
        amount: 24000,
        monthlyBudget: 8000,
      },
    },
    ManagerOversightGymOwnerData: {
      type: "object",
      properties: {
        id: objectIdSchema,
        name: { type: "string", example: "Rohit Varma" },
        email: {
          type: "string",
          format: "email",
          example: "owner@fitsync.com",
        },
        status: { type: "string", example: "active" },
      },
    },
    ManagerOversightGymData: {
      type: "object",
      properties: {
        id: objectIdSchema,
        name: { type: "string", example: "FitSync Elite" },
        status: { type: "string", example: "active" },
        isPublished: { type: "boolean", example: true },
        city: { type: "string", nullable: true, example: "Hyderabad" },
        owner: {
          allOf: [schemaRef("ManagerOversightGymOwnerData")],
          nullable: true,
        },
        sponsorship: {
          allOf: [schemaRef("ManagedGymSponsorshipData")],
          nullable: true,
        },
        analytics: { allOf: [schemaRef("GymAnalyticsData")], nullable: true },
        activeMembers: { type: "integer", example: 46 },
        createdAt: { type: "string", format: "date-time", nullable: true },
      },
      example: {
        id: "64b7a0c5d2f0f6a123456702",
        name: "FitSync Elite",
        status: "active",
        isPublished: true,
        city: "Hyderabad",
        owner: {
          id: "64b7a0c5d2f0f6a123456790",
          name: "Rohit Varma",
          email: "owner@fitsync.com",
          status: "active",
        },
        sponsorship: {
          tier: "gold",
          status: "active",
          endDate: "2026-06-01T00:00:00.000Z",
          amount: 24000,
          monthlyBudget: 8000,
        },
        activeMembers: 46,
      },
    },
    ManagerOversightGymsResponseData: {
      type: "object",
      properties: {
        gyms: { type: "array", items: schemaRef("ManagerOversightGymData") },
      },
      example: {
        gyms: [
          {
            id: "64b7a0c5d2f0f6a123456702",
            name: "FitSync Elite",
            status: "active",
            activeMembers: 46,
          },
        ],
      },
    },
    ManagerMarketplaceOrderContactData: {
      type: "object",
      properties: {
        id: objectIdSchema,
        name: { type: "string", example: "Asha Rao" },
        email: { type: "string", format: "email", example: "asha@example.com" },
      },
    },
    ManagerMarketplaceOrderItemData: {
      type: "object",
      properties: {
        name: { type: "string", example: "Whey Protein" },
        quantity: { type: "integer", example: 2 },
        price: { type: "number", example: 1999 },
        status: { type: "string", example: "delivered" },
      },
    },
    ManagerMarketplaceOrderData: {
      type: "object",
      properties: {
        id: objectIdSchema,
        orderNumber: { type: "string", example: "FS-260329-4821" },
        total: {
          type: "object",
          properties: {
            amount: { type: "number", example: 3998 },
            currency: { type: "string", example: "INR" },
          },
        },
        status: { type: "string", example: "delivered" },
        createdAt: { type: "string", format: "date-time", nullable: true },
        user: {
          allOf: [schemaRef("ManagerMarketplaceOrderContactData")],
          nullable: true,
        },
        seller: {
          allOf: [schemaRef("ManagerMarketplaceOrderContactData")],
          nullable: true,
        },
        items: {
          type: "array",
          items: schemaRef("ManagerMarketplaceOrderItemData"),
        },
      },
      example: {
        id: "64b7a0c5d2f0f6a123456790",
        orderNumber: "FS-260329-4821",
        total: { amount: 3998, currency: "INR" },
        status: "delivered",
        createdAt: "2026-03-29T06:30:00.000Z",
        user: {
          id: "64b7a0c5d2f0f6a123456791",
          name: "Asha Rao",
          email: "asha@example.com",
        },
        seller: {
          id: "64b7a0c5d2f0f6a123456789",
          name: "FitGear Store",
          email: "seller@fitsync.com",
        },
        items: [
          {
            name: "Whey Protein",
            quantity: 2,
            price: 1999,
            status: "delivered",
          },
        ],
      },
    },
    ManagerMarketplaceOrdersResponseData: {
      type: "object",
      properties: {
        orders: {
          type: "array",
          items: schemaRef("ManagerMarketplaceOrderData"),
        },
      },
      example: {
        orders: [
          {
            id: "64b7a0c5d2f0f6a123456790",
            orderNumber: "FS-260329-4821",
            status: "delivered",
          },
        ],
      },
    },
  });

  Object.assign(schemas, {
    OwnerListingPlanData: {
      type: "object",
      properties: {
        planCode: {
          type: "string",
          enum: ["listing-1m", "listing-3m", "listing-6m", "listing-12m"],
          example: "listing-3m",
        },
        label: { type: "string", example: "Growth - 3 months" },
        amount: { type: "number", example: 18999 },
        currency: { type: "string", example: "INR" },
        durationMonths: { type: "integer", example: 3 },
        features: { type: "array", items: { type: "string" } },
      },
      example: {
        planCode: "listing-3m",
        label: "Growth - 3 months",
        amount: 18999,
        currency: "INR",
        durationMonths: 3,
        features: [
          "Priority placement",
          "Monthly insights review",
          "Onboarding success manager",
        ],
      },
    },
    OwnerSponsorshipPackageData: {
      type: "object",
      properties: {
        tier: {
          type: "string",
          enum: ["silver", "gold", "platinum"],
          example: "gold",
        },
        label: { type: "string", example: "Gold Launchpad" },
        amount: { type: "number", example: 24000 },
        currency: { type: "string", example: "INR" },
        durationMonths: { type: "integer", example: 3 },
        monthlyBudget: { type: "number", example: 8000 },
        reach: { type: "integer", example: 60000 },
      },
      example: {
        tier: "gold",
        label: "Gold Launchpad",
        amount: 24000,
        currency: "INR",
        durationMonths: 3,
        monthlyBudget: 8000,
        reach: 60000,
      },
    },
    OwnerMonetisationOptionsResponseData: {
      type: "object",
      properties: {
        listingPlans: {
          type: "array",
          items: schemaRef("OwnerListingPlanData"),
        },
        sponsorshipPackages: {
          type: "array",
          items: schemaRef("OwnerSponsorshipPackageData"),
        },
      },
      example: {
        listingPlans: [
          {
            planCode: "listing-3m",
            label: "Growth - 3 months",
            amount: 18999,
            currency: "INR",
            durationMonths: 3,
            features: ["Priority placement", "Monthly insights review"],
          },
        ],
        sponsorshipPackages: [
          {
            tier: "gold",
            label: "Gold Launchpad",
            amount: 24000,
            currency: "INR",
            durationMonths: 3,
            monthlyBudget: 8000,
            reach: 60000,
          },
        ],
      },
    },
    OwnerSubscriptionInvoiceData: {
      type: "object",
      properties: {
        amount: { type: "number", example: 18999 },
        currency: { type: "string", example: "INR" },
        paidOn: { type: "string", format: "date-time", nullable: true },
        paymentReference: {
          type: "string",
          nullable: true,
          example: "sub_260329_growth_001",
        },
        status: { type: "string", example: "paid" },
      },
    },
    OwnerListingSubscriptionMetadataData: {
      type: "object",
      properties: {
        planLabel: {
          type: "string",
          nullable: true,
          example: "Growth - 3 months",
        },
        features: {
          type: "string",
          nullable: true,
          example:
            "Priority placement, Monthly insights review, Onboarding success manager",
        },
      },
    },
    OwnerSubscriptionGymData: {
      type: "object",
      properties: {
        _id: objectIdSchema,
        name: { type: "string", example: "FitSync Elite" },
        location: { allOf: [schemaRef("GymLocationData")], nullable: true },
        status: { type: "string", example: "active" },
      },
    },
    OwnerListingSubscriptionData: {
      type: "object",
      properties: {
        _id: objectIdSchema,
        gym: { allOf: [schemaRef("OwnerSubscriptionGymData")], nullable: true },
        owner: { ...objectIdSchema, nullable: true },
        planCode: { type: "string", example: "listing-3m" },
        amount: { type: "number", example: 18999 },
        currency: { type: "string", example: "INR" },
        periodStart: { type: "string", format: "date-time", nullable: true },
        periodEnd: { type: "string", format: "date-time", nullable: true },
        status: { type: "string", example: "active" },
        autoRenew: { type: "boolean", example: true },
        invoices: {
          type: "array",
          items: schemaRef("OwnerSubscriptionInvoiceData"),
        },
        metadata: {
          allOf: [schemaRef("OwnerListingSubscriptionMetadataData")],
          nullable: true,
        },
        createdBy: { ...objectIdSchema, nullable: true },
        createdAt: { type: "string", format: "date-time", nullable: true },
        updatedAt: { type: "string", format: "date-time", nullable: true },
      },
      example: {
        _id: "64b7a0c5d2f0f6a123456796",
        gym: {
          _id: "64b7a0c5d2f0f6a123456702",
          name: "FitSync Elite",
          location: {
            city: "Hyderabad",
            state: "Telangana",
            addressLine1: "Road No. 12",
          },
          status: "active",
        },
        owner: "64b7a0c5d2f0f6a123456790",
        planCode: "listing-3m",
        amount: 18999,
        currency: "INR",
        periodStart: "2026-03-29T06:30:00.000Z",
        periodEnd: "2026-06-29T06:30:00.000Z",
        status: "active",
        autoRenew: true,
        invoices: [
          {
            amount: 18999,
            currency: "INR",
            paidOn: "2026-03-29T06:30:00.000Z",
            paymentReference: "sub_260329_growth_001",
            status: "paid",
          },
        ],
        metadata: {
          planLabel: "Growth - 3 months",
          features:
            "Priority placement, Monthly insights review, Onboarding success manager",
        },
      },
    },
    OwnerListingSubscriptionResponseData: {
      type: "object",
      properties: {
        subscription: schemaRef("OwnerListingSubscriptionData"),
      },
      example: {
        subscription: {
          _id: "64b7a0c5d2f0f6a123456796",
          planCode: "listing-3m",
          status: "active",
        },
      },
    },
    OwnerSponsorshipActivationData: {
      type: "object",
      properties: {
        tier: {
          type: "string",
          enum: ["silver", "gold", "platinum"],
          example: "gold",
        },
        startDate: { type: "string", format: "date-time", nullable: true },
        endDate: { type: "string", format: "date-time", nullable: true },
        status: { type: "string", example: "active" },
        amount: { type: "number", example: 24000 },
        monthlyBudget: { type: "number", example: 8000 },
        reach: { type: "integer", example: 60000 },
      },
      example: {
        tier: "gold",
        startDate: "2026-03-29T06:30:00.000Z",
        endDate: "2026-06-29T06:30:00.000Z",
        status: "active",
        amount: 24000,
        monthlyBudget: 8000,
        reach: 60000,
      },
    },
    OwnerSponsorshipActivationResponseData: {
      type: "object",
      properties: {
        sponsorship: schemaRef("OwnerSponsorshipActivationData"),
      },
      example: {
        sponsorship: {
          tier: "gold",
          status: "active",
          amount: 24000,
          monthlyBudget: 8000,
          reach: 60000,
        },
      },
    },
    OwnerTrainerProfileData: {
      type: "object",
      properties: {
        id: objectIdSchema,
        name: { type: "string", example: "Asha Rao" },
        email: {
          type: "string",
          format: "email",
          nullable: true,
          example: "trainer@fitsync.com",
        },
        status: { type: "string", nullable: true, example: "active" },
        profilePicture: { type: "string", nullable: true },
        experienceYears: { type: "number", nullable: true, example: 6 },
        mentoredCount: { type: "integer", nullable: true, example: 24 },
        certifications: { type: "array", items: { type: "string" } },
        specializations: { type: "array", items: { type: "string" } },
        headline: {
          type: "string",
          nullable: true,
          example: "Strength and hypertrophy coach",
        },
        bio: {
          type: "string",
          nullable: true,
          example: "Focuses on beginner-friendly structured programs.",
        },
        age: { type: "number", nullable: true, example: 31 },
        height: { type: "number", nullable: true, example: 168 },
        gender: { type: "string", nullable: true, example: "female" },
      },
      example: {
        id: "64b7a0c5d2f0f6a123456701",
        name: "Asha Rao",
        email: "trainer@fitsync.com",
        status: "active",
        experienceYears: 6,
        mentoredCount: 24,
        certifications: ["ACE", "Nutrition L1"],
        specializations: ["strength", "fat-loss"],
        headline: "Strength and hypertrophy coach",
      },
    },
    OwnerGymBriefData: {
      type: "object",
      properties: {
        id: objectIdSchema,
        name: { type: "string", example: "FitSync Elite" },
        city: { type: "string", nullable: true, example: "Hyderabad" },
      },
    },
    OwnerTrainerRequestData: {
      type: "object",
      properties: {
        id: objectIdSchema,
        requestedAt: { type: "string", format: "date-time", nullable: true },
        trainer: {
          allOf: [schemaRef("OwnerTrainerProfileData")],
          nullable: true,
        },
        gym: { allOf: [schemaRef("OwnerGymBriefData")], nullable: true },
      },
      example: {
        id: "64b7a0c5d2f0f6a123456794",
        requestedAt: "2026-03-29T06:30:00.000Z",
        trainer: {
          id: "64b7a0c5d2f0f6a123456701",
          name: "Asha Rao",
          email: "trainer@fitsync.com",
          status: "pending",
        },
        gym: {
          id: "64b7a0c5d2f0f6a123456702",
          name: "FitSync Elite",
          city: "Hyderabad",
        },
      },
    },
    OwnerTrainerRequestsResponseData: {
      type: "object",
      properties: {
        requests: {
          type: "array",
          items: schemaRef("OwnerTrainerRequestData"),
        },
      },
      example: {
        requests: [
          {
            id: "64b7a0c5d2f0f6a123456794",
            requestedAt: "2026-03-29T06:30:00.000Z",
          },
        ],
      },
    },
    OwnerTrainerApprovalResponseData: {
      type: "object",
      properties: {
        assignmentId: objectIdSchema,
        trainer: {
          allOf: [schemaRef("OwnerTrainerProfileData")],
          nullable: true,
        },
        gym: { allOf: [schemaRef("OwnerGymBriefData")], nullable: true },
        approvedAt: { type: "string", format: "date-time", nullable: true },
        membershipStatus: { type: "string", example: "active" },
      },
      example: {
        assignmentId: "64b7a0c5d2f0f6a123456794",
        trainer: {
          id: "64b7a0c5d2f0f6a123456701",
          name: "Asha Rao",
          email: "trainer@fitsync.com",
          status: "active",
        },
        gym: {
          id: "64b7a0c5d2f0f6a123456702",
          name: "FitSync Elite",
          city: "Hyderabad",
        },
        approvedAt: "2026-03-29T06:30:00.000Z",
        membershipStatus: "active",
      },
    },
    OwnerTrainerAlreadyApprovedResponseData: {
      type: "object",
      properties: {
        trainer: {
          allOf: [schemaRef("OwnerTrainerProfileData")],
          nullable: true,
        },
      },
      example: {
        trainer: {
          id: "64b7a0c5d2f0f6a123456701",
          name: "Asha Rao",
          status: "active",
        },
      },
    },
  });

  endpointDefs.push(
    {
      method: "delete",
      path: "/api/admin/users/{userId}",
      tag: "Admin",
      summary: "Delete a user account",
      security: accessSecurity,
      parameters: [idParam("userId", "User identifier.")],
      responses: secureResponses(
        {
          200: R.ok(
            "User account deleted successfully.",
            schemaRef("UserIdResponseData"),
            "User account deleted successfully.",
          ),
        },
        { 400: R.bad, 404: R.notFound },
      ),
    },
    {
      method: "patch",
      path: "/api/admin/users/{userId}/status",
      tag: "Admin",
      summary: "Update a user status",
      security: accessSecurity,
      parameters: [idParam("userId", "User identifier.")],
      bodySchema: "StatusUpdateInput",
      responses: secureResponses(
        {
          200: R.ok(
            "User status updated successfully.",
            schemaRef("UserStatusResponseData"),
            "User status updated successfully.",
          ),
        },
        { 400: R.bad, 404: R.notFound },
      ),
    },
    {
      method: "delete",
      path: "/api/admin/gyms/{gymId}",
      tag: "Admin",
      summary: "Delete a gym listing",
      security: accessSecurity,
      parameters: [idParam("gymId", "Gym identifier.")],
      responses: secureResponses(
        {
          200: R.ok(
            "Gym listing removed successfully.",
            schemaRef("GymIdResponseData"),
            "Gym listing removed successfully.",
          ),
        },
        { 400: R.bad, 404: R.notFound },
      ),
    },
    {
      method: "delete",
      path: "/api/admin/products/{productId}",
      tag: "Admin",
      summary: "Delete a marketplace product",
      security: accessSecurity,
      parameters: [idParam("productId", "Product identifier.")],
      responses: secureResponses(
        {
          200: R.ok(
            "Product deleted successfully.",
            schemaRef("ProductIdResponseData"),
            "Product deleted successfully.",
          ),
        },
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
        200: R.ok(
          "Admin toggles fetched successfully.",
          schemaRef("AdminTogglesResponseData"),
          "Admin toggles fetched successfully.",
        ),
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
        {
          200: R.ok(
            "Admin toggles updated successfully.",
            schemaRef("AdminTogglesResponseData"),
            "Admin toggles updated successfully.",
          ),
        },
        { 400: R.bad },
      ),
    },
    {
      method: "get",
      path: "/api/manager/pending",
      tag: "Manager",
      summary: "List pending approvals",
      security: accessSecurity,
      responses: secureResponses({
        200: R.ok(
          "Pending approvals fetched.",
          schemaRef("ManagerPendingApprovalsResponseData"),
          "Pending approvals fetched.",
        ),
      }),
    },
    {
      method: "patch",
      path: "/api/manager/users/{userId}/approve",
      tag: "Manager",
      summary: "Approve a seller or gym-owner",
      security: accessSecurity,
      parameters: [idParam("userId", "User identifier.")],
      responses: secureResponses(
        {
          200: R.ok(
            "Approval completed successfully.",
            schemaRef("UserStatusResponseData"),
            "Seller approved successfully.",
          ),
        },
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
        {
          200: R.ok(
            "User rejected and removed.",
            schemaRef("UserIdResponseData"),
            "User rejected and removed.",
          ),
        },
        { 400: R.bad, 404: R.notFound },
      ),
    },
    {
      method: "get",
      path: "/api/manager/sellers",
      tag: "Manager",
      summary: "List sellers",
      security: accessSecurity,
      responses: secureResponses({
        200: R.ok(
          "Sellers fetched.",
          schemaRef("ManagerSellerListResponseData"),
          "Sellers fetched.",
        ),
      }),
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
        {
          200: R.ok(
            "Seller status updated.",
            schemaRef("UserStatusResponseData"),
            "Seller activated.",
          ),
        },
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
        {
          200: R.ok(
            "Seller deleted successfully.",
            schemaRef("UserIdResponseData"),
            "Seller deleted successfully.",
          ),
        },
        { 400: R.bad, 404: R.notFound },
      ),
    },
    {
      method: "get",
      path: "/api/manager/gym-owners",
      tag: "Manager",
      summary: "List gym owners",
      security: accessSecurity,
      responses: secureResponses({
        200: R.ok(
          "Gym owners fetched.",
          schemaRef("ManagerGymOwnerListResponseData"),
          "Gym owners fetched.",
        ),
      }),
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
        {
          200: R.ok(
            "Gym-owner status updated.",
            schemaRef("UserStatusResponseData"),
            "Gym owner activated.",
          ),
        },
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
        {
          200: R.ok(
            "Gym owner deleted successfully.",
            schemaRef("UserIdResponseData"),
            "Gym owner and associated gyms deleted.",
          ),
        },
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
        {
          200: R.ok(
            "User detail fetched.",
            schemaRef("AdminUserDetailDashboardData"),
            "User detail fetched successfully",
          ),
        },
        { 400: R.bad, 404: R.notFound },
      ),
    },
    {
      method: "get",
      path: "/api/manager/gyms",
      tag: "Manager",
      summary: "List gyms for oversight",
      security: accessSecurity,
      responses: secureResponses({
        200: R.ok(
          "Gyms fetched.",
          schemaRef("ManagerOversightGymsResponseData"),
          "Gyms fetched.",
        ),
      }),
    },
    {
      method: "get",
      path: "/api/manager/gyms/{gymId}",
      tag: "Manager",
      summary: "Get gym oversight detail",
      security: accessSecurity,
      parameters: [idParam("gymId", "Gym identifier.")],
      responses: secureResponses(
        {
          200: R.ok(
            "Gym detail fetched.",
            schemaRef("AdminGymDetailDashboardData"),
            "Admin gym detail fetched successfully",
          ),
        },
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
        {
          200: R.ok(
            "Gym removed successfully.",
            schemaRef("GymIdResponseData"),
            "Gym removed successfully.",
          ),
        },
        { 400: R.bad, 404: R.notFound },
      ),
    },
    {
      method: "get",
      path: "/api/manager/marketplace",
      tag: "Manager",
      summary: "Get marketplace oversight dashboard",
      security: accessSecurity,
      responses: secureResponses({
        200: R.ok(
          "Marketplace orders fetched.",
          schemaRef("ManagerMarketplaceOrdersResponseData"),
          "Marketplace orders fetched.",
        ),
      }),
    },
    {
      method: "get",
      path: "/api/manager/products",
      tag: "Manager",
      summary: "List products for oversight",
      security: accessSecurity,
      responses: secureResponses({
        200: R.ok(
          "Products fetched.",
          schemaRef("AdminProductsDashboardData"),
          "Admin products fetched successfully",
        ),
      }),
    },
    {
      method: "get",
      path: "/api/manager/products/{productId}",
      tag: "Manager",
      summary: "Get product buyers for oversight",
      security: accessSecurity,
      parameters: [idParam("productId", "Product identifier.")],
      responses: secureResponses(
        {
          200: R.ok(
            "Product buyers fetched.",
            schemaRef("AdminProductBuyersDashboardData"),
            "Product buyers fetched successfully",
          ),
        },
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
        {
          200: R.ok(
            "Product deleted successfully.",
            schemaRef("ProductIdResponseData"),
            "Product deleted successfully.",
          ),
        },
        { 400: R.bad, 404: R.notFound },
      ),
    },
    {
      method: "get",
      path: "/api/owner/monetisation/options",
      tag: "Owner",
      summary: "Get monetisation options",
      security: accessSecurity,
      responses: secureResponses({
        200: R.ok(
          "Monetisation options fetched successfully.",
          schemaRef("OwnerMonetisationOptionsResponseData"),
          "Monetisation options fetched successfully.",
        ),
      }),
    },
    {
      method: "post",
      path: "/api/owner/subscriptions/checkout",
      tag: "Owner",
      summary: "Activate a listing subscription",
      security: accessSecurity,
      bodySchema: "ListingSubscriptionInput",
      responses: secureResponses(
        {
          201: R.created(
            "Subscription activated successfully.",
            schemaRef("OwnerListingSubscriptionResponseData"),
            "Subscription activated successfully.",
          ),
        },
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
        {
          200: R.ok(
            "Sponsorship activated successfully.",
            schemaRef("OwnerSponsorshipActivationResponseData"),
            "Sponsorship activated successfully.",
          ),
        },
        { 400: R.bad, 404: R.notFound },
      ),
    },
    {
      method: "get",
      path: "/api/owner/trainers/requests",
      tag: "Owner",
      summary: "List trainer requests",
      security: accessSecurity,
      responses: secureResponses({
        200: R.ok(
          "Trainer requests fetched successfully.",
          schemaRef("OwnerTrainerRequestsResponseData"),
          "Trainer requests fetched successfully.",
        ),
      }),
    },
    {
      method: "post",
      path: "/api/owner/trainers/requests/{assignmentId}/approve",
      tag: "Owner",
      summary: "Approve a trainer request",
      security: accessSecurity,
      parameters: [idParam("assignmentId", "Trainer assignment identifier.")],
      responses: secureResponses(
        {
          200: R.ok(
            "Trainer request approval result.",
            {
              oneOf: [
                schemaRef("OwnerTrainerApprovalResponseData"),
                schemaRef("OwnerTrainerAlreadyApprovedResponseData"),
              ],
            },
            "Trainer approved successfully.",
          ),
        },
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
        {
          200: R.ok(
            "Trainer request declined.",
            schemaRef("AssignmentIdResponseData"),
            "Trainer request declined.",
          ),
        },
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
        {
          200: R.ok(
            "Trainer removed from gym.",
            schemaRef("AssignmentIdResponseData"),
            "Trainer removed from gym.",
          ),
        },
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
        {
          200: R.ok(
            "Member removed from gym.",
            schemaRef("MembershipIdResponseData"),
            "Member removed from gym.",
          ),
        },
        { 400: R.bad, 404: R.notFound },
      ),
    },
  );
};
