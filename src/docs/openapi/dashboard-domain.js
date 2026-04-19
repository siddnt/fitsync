export const registerDashboardOpenApi = ({
  schemas,
  endpointDefs,
  schemaRef,
  accessSecurity,
  secureResponses,
  R,
  idParam,
}) => {
  Object.assign(schemas, {
    TraineeOverviewDashboardData: {
      type: "object",
      properties: {
        membership: { allOf: [schemaRef("MembershipData")], nullable: true },
        progress: {
          type: "object",
          nullable: true,
          additionalProperties: true,
        },
        diet: { type: "object", nullable: true, additionalProperties: true },
        recentOrders: {
          type: "array",
          items: { type: "object", additionalProperties: true },
        },
      },
      example: {
        membership: {
          id: "64b7a0c5d2f0f6a123456789",
          plan: "monthly",
          status: "active",
        },
        progress: { streak: 5, lastCheckIn: "2026-03-29T06:30:00.000Z" },
        diet: {
          weekOf: "2026-03-30",
          notes: "Increase water intake on training days.",
        },
        recentOrders: [
          {
            id: "64b7a0c5d2f0f6a123456790",
            orderNumber: "FS-260329-4821",
            status: "delivered",
          },
        ],
      },
    },
    TraineeProgressDashboardData: {
      type: "object",
      properties: {
        attendance: {
          type: "object",
          nullable: true,
          additionalProperties: true,
        },
        metrics: {
          type: "array",
          items: { type: "object", additionalProperties: true },
        },
        bodyMetrics: {
          type: "array",
          items: { type: "object", additionalProperties: true },
        },
        rawAttendance: {
          type: "array",
          items: { type: "object", additionalProperties: true },
        },
        feedback: {
          type: "array",
          items: { type: "object", additionalProperties: true },
        },
        trainerFeedbackTargets: {
          type: "array",
          items: { type: "object", additionalProperties: true },
        },
        trainerFeedbackHistory: {
          type: "array",
          items: { type: "object", additionalProperties: true },
        },
      },
      example: {
        attendance: { totalSessions: 18, present: 16, streak: 5 },
        metrics: [{ metric: "body-fat", latestValue: 18.4 }],
        trainerFeedbackTargets: [
          {
            trainerId: "64b7a0c5d2f0f6a123456701",
            trainerName: "Asha Rao",
            gymName: "FitSync Elite",
          },
        ],
      },
    },
    TraineeDietDashboardData: {
      type: "object",
      properties: {
        latest: { type: "object", nullable: true, additionalProperties: true },
        history: {
          type: "array",
          items: { type: "object", additionalProperties: true },
        },
      },
      example: {
        latest: {
          weekOf: "2026-03-30",
          meals: [{ day: "Monday", meal: "Breakfast" }],
          notes: "Prioritize protein.",
        },
        history: [],
      },
    },
    TraineeOrdersDashboardData: {
      type: "object",
      properties: {
        orders: {
          type: "array",
          items: { type: "object", additionalProperties: true },
        },
      },
      example: {
        orders: [
          {
            id: "64b7a0c5d2f0f6a123456790",
            orderNumber: "FS-260329-4821",
            total: "INR 3,998.00",
            status: "delivered",
          },
        ],
      },
    },
    DashboardFeedbackCreatedData: {
      type: "object",
      properties: {
        feedback: { type: "object", additionalProperties: true },
      },
      example: {
        feedback: {
          id: "64b7a0c5d2f0f6a123456791",
          trainer: { id: "64b7a0c5d2f0f6a123456701", name: "Asha Rao" },
          gym: { id: "64b7a0c5d2f0f6a123456702", name: "FitSync Elite" },
          message: "Need adjustments for my leg-day routine.",
          createdAt: "2026-03-29T06:30:00.000Z",
        },
      },
    },
    TrainerFeedbackInboxData: {
      type: "object",
      properties: {
        feedback: {
          type: "array",
          items: { type: "object", additionalProperties: true },
        },
      },
      example: {
        feedback: [
          {
            id: "64b7a0c5d2f0f6a123456791",
            trainee: { id: "64b7a0c5d2f0f6a123456792", name: "Rahul" },
            gym: { id: "64b7a0c5d2f0f6a123456702", name: "FitSync Elite" },
            message: "Great coaching",
          },
        ],
      },
    },
    GymOwnerOverviewDashboardData: {
      type: "object",
      properties: {
        stats: { type: "object", additionalProperties: true },
        gyms: {
          type: "array",
          items: { type: "object", additionalProperties: true },
        },
        expiringSubscriptions: {
          type: "array",
          items: { type: "object", additionalProperties: true },
        },
        recentMembers: {
          type: "array",
          items: { type: "object", additionalProperties: true },
        },
      },
      example: {
        stats: {
          totalGyms: 2,
          publishedGyms: 2,
          activeMemberships: 83,
          revenue30d: "INR 48,900.00",
        },
        gyms: [
          {
            id: "64b7a0c5d2f0f6a123456702",
            name: "FitSync Elite",
            members: 46,
          },
        ],
        expiringSubscriptions: [
          { id: "64b7a0c5d2f0f6a123456703", planCode: "growth" },
        ],
      },
    },
    GymOwnerCollectionDashboardData: {
      type: "object",
      properties: {
        gyms: {
          type: "array",
          items: { type: "object", additionalProperties: true },
        },
      },
      example: {
        gyms: [
          {
            id: "64b7a0c5d2f0f6a123456702",
            name: "FitSync Elite",
            city: "Hyderabad",
          },
        ],
      },
    },
    GymOwnerSubscriptionsDashboardData: {
      type: "object",
      properties: {
        subscriptions: {
          type: "array",
          items: { type: "object", additionalProperties: true },
        },
      },
      example: {
        subscriptions: [
          {
            id: "64b7a0c5d2f0f6a123456703",
            planCode: "growth",
            status: "active",
          },
        ],
      },
    },
    GymOwnerSponsorshipsDashboardData: {
      type: "object",
      properties: {
        sponsorships: {
          type: "array",
          items: { type: "object", additionalProperties: true },
        },
      },
      example: {
        sponsorships: [
          {
            id: "64b7a0c5d2f0f6a123456702",
            name: "FitSync Elite",
            impressions: 1024,
          },
        ],
      },
    },
    GymOwnerAnalyticsDashboardData: {
      type: "object",
      properties: {
        revenueTrend: { type: "object", additionalProperties: true },
        revenueSummary: { type: "object", additionalProperties: true },
        membershipTrend: { type: "object", additionalProperties: true },
        expenseBreakdown: {
          type: "array",
          items: { type: "object", additionalProperties: true },
        },
        gyms: {
          type: "array",
          items: { type: "object", additionalProperties: true },
        },
      },
      example: {
        revenueTrend: {
          monthly: [
            {
              id: "2026-03",
              label: "Mar",
              revenue: 48900,
              expenses: 12000,
              profit: 36900,
            },
          ],
        },
        revenueSummary: {
          monthly: { totalRevenue: 48900, totalProfit: 36900 },
        },
        expenseBreakdown: [
          { id: "listing", label: "Listing plans", value: 12000 },
        ],
      },
    },
    TrainerOverviewDashboardData: {
      type: "object",
      properties: {
        totals: { type: "object", additionalProperties: true },
        activeAssignments: {
          type: "array",
          items: { type: "object", additionalProperties: true },
        },
        upcomingCheckIns: {
          type: "array",
          items: { type: "object", additionalProperties: true },
        },
      },
      example: {
        totals: {
          gyms: 2,
          activeTrainees: 14,
          pendingUpdates: 3,
          earnings30d: "INR 18,450.00",
        },
        activeAssignments: [
          {
            trainee: { id: "64b7a0c5d2f0f6a123456792", name: "Rahul" },
            gym: { name: "FitSync Elite" },
          },
        ],
      },
    },
    TrainerAssignmentsDashboardData: {
      type: "object",
      properties: {
        assignments: {
          type: "array",
          items: { type: "object", additionalProperties: true },
        },
      },
      example: {
        assignments: [
          {
            id: "64b7a0c5d2f0f6a123456794",
            gym: { name: "FitSync Elite" },
            trainees: [{ id: "64b7a0c5d2f0f6a123456792", name: "Rahul" }],
          },
        ],
      },
    },
    TrainerUpdatesDashboardData: {
      type: "object",
      properties: {
        updates: {
          type: "array",
          items: { type: "object", additionalProperties: true },
        },
      },
      example: {
        updates: [
          {
            trainee: { name: "Rahul" },
            pendingFeedback: [],
            attendance: [],
            metrics: [],
          },
        ],
      },
    },
    AdminOverviewDashboardData: {
      type: "object",
      properties: {
        users: { type: "object", additionalProperties: { type: "integer" } },
        gyms: { type: "object", additionalProperties: true },
        marketplace: { type: "object", additionalProperties: true },
        revenue: {
          type: "array",
          items: { type: "object", additionalProperties: true },
        },
        adminToggles: { type: "object", additionalProperties: true },
      },
      example: {
        users: { trainee: 84, seller: 9, "gym-owner": 6 },
        gyms: { total: 12, published: 10, sponsored: 3 },
        marketplace: {
          totalOrders: 241,
          totalRevenue: "INR 148,200.00",
          totalItems: 95,
        },
      },
    },
    AdminUsersDashboardData: {
      type: "object",
      properties: {
        pending: {
          type: "array",
          items: { type: "object", additionalProperties: true },
        },
        recent: {
          type: "array",
          items: { type: "object", additionalProperties: true },
        },
        adminToggles: { type: "object", additionalProperties: true },
      },
    },
    AdminGymsDashboardData: {
      type: "object",
      properties: {
        gyms: {
          type: "array",
          items: { type: "object", additionalProperties: true },
        },
        adminToggles: { type: "object", additionalProperties: true },
      },
    },
    AdminGymDetailDashboardData: { type: "object", additionalProperties: true },
    AdminRevenueDashboardData: {
      type: "object",
      properties: {
        trend: { type: "object", additionalProperties: true },
        marketplaceDistribution: { type: "object", additionalProperties: true },
        adminToggles: { type: "object", additionalProperties: true },
      },
      example: {
        trend: { monthly: [{ id: "2026-03", label: "Mar", value: 142000 }] },
        marketplaceDistribution: {
          monthly: [{ name: "supplements", value: 3200 }],
        },
      },
    },
    AdminMarketplaceDashboardData: {
      type: "object",
      properties: {
        orders: {
          type: "array",
          items: { type: "object", additionalProperties: true },
        },
        adminToggles: { type: "object", additionalProperties: true },
      },
    },
    AdminInsightsDashboardData: {
      type: "object",
      properties: {
        capturedAt: { type: "string", format: "date-time" },
        geoDensity: { type: "object", additionalProperties: true },
        demographics: { type: "object", additionalProperties: true },
        notifications: {
          type: "array",
          items: { type: "object", additionalProperties: true },
        },
        adminToggles: { type: "object", additionalProperties: true },
      },
      example: {
        geoDensity: {
          totalGyms: 12,
          totalImpressions: 24000,
          topLocations: [{ city: "Hyderabad", gyms: 4 }],
        },
        demographics: {
          gender: [{ label: "male", value: 56 }],
          ageBuckets: [{ label: "25-34", value: 43 }],
        },
      },
    },
    AdminUserDetailDashboardData: {
      type: "object",
      additionalProperties: true,
    },
    AdminMembershipsDashboardData: {
      type: "object",
      properties: {
        memberships: {
          type: "array",
          items: { type: "object", additionalProperties: true },
        },
      },
    },
    AdminProductsDashboardData: {
      type: "object",
      properties: {
        products: {
          type: "array",
          items: { type: "object", additionalProperties: true },
        },
      },
    },
    AdminProductBuyersDashboardData: {
      type: "object",
      properties: {
        product: { type: "object", additionalProperties: true },
        buyers: {
          type: "array",
          items: { type: "object", additionalProperties: true },
        },
        totalBuyers: { type: "integer", example: 12 },
      },
    },
    AdminReviewsDashboardData: {
      type: "object",
      properties: {
        gymReviews: {
          type: "array",
          items: { type: "object", additionalProperties: true },
        },
        productReviews: {
          type: "array",
          items: { type: "object", additionalProperties: true },
        },
      },
    },
    AdminSubscriptionsDashboardData: {
      type: "object",
      properties: {
        listingSubscriptions: {
          type: "array",
          items: { type: "object", additionalProperties: true },
        },
        sponsorships: {
          type: "array",
          items: { type: "object", additionalProperties: true },
        },
      },
    },
    ManagerOverviewDashboardData: {
      type: "object",
      properties: {
        stats: { type: "object", additionalProperties: true },
        recentPending: {
          type: "array",
          items: { type: "object", additionalProperties: true },
        },
      },
      example: {
        stats: {
          pendingApprovals: 4,
          activeSellers: 9,
          activeGymOwners: 6,
          totalGyms: 12,
          openMessages: 3,
        },
        recentPending: [{ name: "FitGear Store", role: "seller" }],
      },
    },
    ManagerSellersDashboardData: {
      type: "object",
      properties: {
        sellers: {
          type: "array",
          items: { type: "object", additionalProperties: true },
        },
      },
    },
    ManagerGymOwnersDashboardData: {
      type: "object",
      properties: {
        gymOwners: {
          type: "array",
          items: { type: "object", additionalProperties: true },
        },
      },
    },
  });

  Object.assign(schemas, {
    AdminDashboardPendingUserItemData: {
      type: "object",
      properties: {
        _id: { type: "string", example: "64b7a0c5d2f0f6a123456789" },
        name: { type: "string", example: "FitGear Store" },
        email: {
          type: "string",
          format: "email",
          example: "seller@fitsync.com",
        },
        role: { type: "string", example: "seller" },
        createdAt: { type: "string", format: "date-time", nullable: true },
        profile: {
          type: "object",
          nullable: true,
          properties: {
            headline: {
              type: "string",
              nullable: true,
              example: "Supplements and recovery gear",
            },
            location: {
              type: "object",
              nullable: true,
              properties: {
                city: { type: "string", nullable: true, example: "Hyderabad" },
                state: { type: "string", nullable: true, example: "Telangana" },
                country: { type: "string", nullable: true, example: "India" },
              },
            },
          },
        },
      },
    },
    AdminDashboardRecentUserItemData: {
      type: "object",
      properties: {
        _id: { type: "string", example: "64b7a0c5d2f0f6a123456790" },
        name: { type: "string", example: "Asha Rao" },
        email: { type: "string", format: "email", example: "asha@example.com" },
        role: { type: "string", example: "trainee" },
        status: { type: "string", example: "active" },
        createdAt: { type: "string", format: "date-time", nullable: true },
        profilePicture: { type: "string", nullable: true },
        contactNumber: {
          type: "string",
          nullable: true,
          example: "+91-9876543210",
        },
        memberships: { type: "integer", example: 2 },
        orders: { type: "integer", example: 4 },
        gymsOwned: { type: "integer", example: 0 },
      },
    },
    AdminDashboardGymListItemData: {
      type: "object",
      properties: {
        id: { type: "string", example: "64b7a0c5d2f0f6a123456702" },
        name: { type: "string", example: "FitSync Elite" },
        status: { type: "string", example: "active" },
        isPublished: { type: "boolean", example: true },
        city: { type: "string", nullable: true, example: "Hyderabad" },
        state: { type: "string", nullable: true, example: "Telangana" },
        owner: {
          type: "object",
          nullable: true,
          properties: {
            id: { type: "string", example: "64b7a0c5d2f0f6a123456790" },
            name: { type: "string", example: "Rohit Varma" },
            email: {
              type: "string",
              format: "email",
              example: "owner@fitsync.com",
            },
          },
        },
        sponsorship: {
          allOf: [schemaRef("ManagedGymSponsorshipData")],
          nullable: true,
        },
        analytics: { allOf: [schemaRef("GymAnalyticsData")], nullable: true },
        activeMembers: { type: "integer", example: 46 },
        activeTrainers: { type: "integer", example: 3 },
        createdAt: { type: "string", format: "date-time", nullable: true },
      },
    },
    AdminDashboardMarketplaceOrderData: {
      type: "object",
      properties: {
        id: { type: "string", example: "64b7a0c5d2f0f6a123456790" },
        orderNumber: { type: "string", example: "FS-260329-4821" },
        total: { type: "string", example: "INR 3,998.00" },
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
          items: {
            type: "object",
            properties: {
              name: { type: "string", example: "Whey Protein" },
              quantity: { type: "integer", example: 2 },
              price: { type: "number", example: 1999 },
              category: {
                type: "string",
                nullable: true,
                example: "supplements",
              },
              seller: {
                allOf: [schemaRef("ManagerMarketplaceOrderContactData")],
                nullable: true,
              },
            },
          },
        },
      },
    },
    AdminMembershipItemData: {
      type: "object",
      properties: {
        id: { type: "string", example: "64b7a0c5d2f0f6a123456795" },
        trainee: {
          type: "object",
          nullable: true,
          properties: {
            id: { type: "string", example: "64b7a0c5d2f0f6a123456791" },
            name: { type: "string", example: "Asha Rao" },
            email: {
              type: "string",
              format: "email",
              example: "asha@example.com",
            },
          },
        },
        gym: { allOf: [schemaRef("MembershipGymSummary")], nullable: true },
        trainer: {
          type: "object",
          nullable: true,
          properties: {
            id: { type: "string", example: "64b7a0c5d2f0f6a123456701" },
            name: { type: "string", example: "Asha Rao" },
            email: {
              type: "string",
              format: "email",
              example: "trainer@fitsync.com",
            },
          },
        },
        plan: { type: "string", example: "monthly" },
        status: { type: "string", example: "active" },
        startDate: { type: "string", format: "date-time", nullable: true },
        endDate: { type: "string", format: "date-time", nullable: true },
        autoRenew: { type: "boolean", example: true },
        billing: {
          allOf: [schemaRef("MembershipBillingData")],
          nullable: true,
        },
        benefits: { type: "array", items: { type: "string" } },
        notes: { type: "string", nullable: true },
        createdAt: { type: "string", format: "date-time", nullable: true },
      },
    },
    AdminProductListItemData: {
      type: "object",
      properties: {
        id: { type: "string", example: "64b7a0c5d2f0f6a123456780" },
        name: { type: "string", example: "Whey Protein" },
        description: {
          type: "string",
          nullable: true,
          example: "2kg chocolate whey protein.",
        },
        price: { type: "number", example: 1999 },
        mrp: { type: "number", example: 2499 },
        image: { type: "string", nullable: true },
        category: { type: "string", example: "supplements" },
        stock: { type: "integer", example: 18 },
        status: { type: "string", example: "available" },
        isPublished: { type: "boolean", example: true },
        seller: {
          type: "object",
          nullable: true,
          properties: {
            id: { type: "string", example: "64b7a0c5d2f0f6a123456789" },
            name: { type: "string", example: "FitGear Store" },
            email: {
              type: "string",
              format: "email",
              example: "seller@fitsync.com",
            },
          },
        },
        reviews: {
          type: "object",
          properties: {
            avgRating: { type: "number", example: 4.7 },
            reviewCount: { type: "integer", example: 32 },
          },
        },
        createdAt: { type: "string", format: "date-time", nullable: true },
      },
    },
    AdminProductBuyerItemData: {
      type: "object",
      properties: {
        orderId: { type: "string", example: "64b7a0c5d2f0f6a123456790" },
        orderNumber: { type: "string", example: "FS-260329-4821" },
        user: {
          type: "object",
          nullable: true,
          properties: {
            id: { type: "string", example: "64b7a0c5d2f0f6a123456791" },
            name: { type: "string", example: "Asha Rao" },
            email: {
              type: "string",
              format: "email",
              example: "asha@example.com",
            },
            profilePicture: { type: "string", nullable: true },
            contactNumber: {
              type: "string",
              nullable: true,
              example: "+91-9876543210",
            },
          },
        },
        quantity: { type: "integer", example: 2 },
        price: { type: "number", example: 1999 },
        itemStatus: { type: "string", example: "delivered" },
        shippingAddress: {
          type: "object",
          nullable: true,
          properties: {
            city: { type: "string", nullable: true, example: "Hyderabad" },
            state: { type: "string", nullable: true, example: "Telangana" },
          },
        },
        total: { type: "number", example: 3998 },
        orderDate: { type: "string", format: "date-time", nullable: true },
      },
    },
    AdminGymReviewItemData: {
      type: "object",
      properties: {
        id: { type: "string", example: "64b7a0c5d2f0f6a123456792" },
        user: {
          allOf: [schemaRef("ManagerMarketplaceOrderContactData")],
          nullable: true,
        },
        gym: { allOf: [schemaRef("MembershipGymSummary")], nullable: true },
        rating: { type: "number", example: 5 },
        comment: {
          type: "string",
          nullable: true,
          example: "Great trainer support and clean equipment.",
        },
        createdAt: { type: "string", format: "date-time", nullable: true },
      },
    },
    AdminProductReviewItemData: {
      type: "object",
      properties: {
        id: { type: "string", example: "64b7a0c5d2f0f6a123456793" },
        user: {
          allOf: [schemaRef("ManagerMarketplaceOrderContactData")],
          nullable: true,
        },
        product: {
          type: "object",
          nullable: true,
          properties: {
            id: { type: "string", example: "64b7a0c5d2f0f6a123456780" },
            name: { type: "string", example: "Whey Protein" },
            category: {
              type: "string",
              nullable: true,
              example: "supplements",
            },
          },
        },
        rating: { type: "number", example: 5 },
        title: { type: "string", nullable: true, example: "Great value" },
        comment: {
          type: "string",
          nullable: true,
          example: "Mixes well and tastes good.",
        },
        isVerifiedPurchase: { type: "boolean", example: true },
        createdAt: { type: "string", format: "date-time", nullable: true },
      },
    },
    AdminListingSubscriptionDashboardItemData: {
      type: "object",
      properties: {
        id: { type: "string", example: "64b7a0c5d2f0f6a123456796" },
        gym: { allOf: [schemaRef("MembershipGymSummary")], nullable: true },
        owner: {
          allOf: [schemaRef("ManagerMarketplaceOrderContactData")],
          nullable: true,
        },
        planCode: { type: "string", example: "listing-3m" },
        amount: { type: "number", example: 18999 },
        currency: { type: "string", example: "INR" },
        periodStart: { type: "string", format: "date-time", nullable: true },
        periodEnd: { type: "string", format: "date-time", nullable: true },
        status: { type: "string", example: "active" },
        autoRenew: { type: "boolean", example: true },
        invoiceCount: { type: "integer", example: 1 },
        createdAt: { type: "string", format: "date-time", nullable: true },
      },
    },
    AdminSponsorshipDashboardItemData: {
      type: "object",
      properties: {
        id: { type: "string", example: "64b7a0c5d2f0f6a123456702" },
        gym: {
          type: "object",
          properties: {
            id: { type: "string", example: "64b7a0c5d2f0f6a123456702" },
            name: { type: "string", example: "FitSync Elite" },
            city: { type: "string", nullable: true, example: "Hyderabad" },
          },
        },
        owner: {
          allOf: [schemaRef("ManagerMarketplaceOrderContactData")],
          nullable: true,
        },
        package: { type: "string", nullable: true, example: "gold" },
        status: { type: "string", example: "active" },
        expiresAt: { type: "string", format: "date-time", nullable: true },
        createdAt: { type: "string", format: "date-time", nullable: true },
      },
    },
    AdminUsersDashboardData: {
      type: "object",
      properties: {
        pending: {
          type: "array",
          items: schemaRef("AdminDashboardPendingUserItemData"),
        },
        recent: {
          type: "array",
          items: schemaRef("AdminDashboardRecentUserItemData"),
        },
        adminToggles: {
          allOf: [schemaRef("AdminToggleMapData")],
          nullable: true,
        },
      },
    },
    AdminGymsDashboardData: {
      type: "object",
      properties: {
        gyms: {
          type: "array",
          items: schemaRef("AdminDashboardGymListItemData"),
        },
        adminToggles: {
          allOf: [schemaRef("AdminToggleMapData")],
          nullable: true,
        },
      },
    },
    AdminMarketplaceDashboardData: {
      type: "object",
      properties: {
        orders: {
          type: "array",
          items: schemaRef("AdminDashboardMarketplaceOrderData"),
        },
        adminToggles: {
          allOf: [schemaRef("AdminToggleMapData")],
          nullable: true,
        },
      },
    },
    AdminMembershipsDashboardData: {
      type: "object",
      properties: {
        memberships: {
          type: "array",
          items: schemaRef("AdminMembershipItemData"),
        },
      },
    },
    AdminProductsDashboardData: {
      type: "object",
      properties: {
        products: {
          type: "array",
          items: schemaRef("AdminProductListItemData"),
        },
      },
    },
    AdminProductBuyersDashboardData: {
      type: "object",
      properties: {
        product: {
          allOf: [schemaRef("AdminProductListItemData")],
          nullable: true,
        },
        buyers: {
          type: "array",
          items: schemaRef("AdminProductBuyerItemData"),
        },
        totalBuyers: { type: "integer", example: 12 },
      },
    },
    AdminReviewsDashboardData: {
      type: "object",
      properties: {
        gymReviews: {
          type: "array",
          items: schemaRef("AdminGymReviewItemData"),
        },
        productReviews: {
          type: "array",
          items: schemaRef("AdminProductReviewItemData"),
        },
      },
    },
    AdminSubscriptionsDashboardData: {
      type: "object",
      properties: {
        listingSubscriptions: {
          type: "array",
          items: schemaRef("AdminListingSubscriptionDashboardItemData"),
        },
        sponsorships: {
          type: "array",
          items: schemaRef("AdminSponsorshipDashboardItemData"),
        },
      },
    },
    ManagerOverviewDashboardData: {
      type: "object",
      properties: {
        stats: {
          type: "object",
          properties: {
            pendingApprovals: { type: "integer", example: 4 },
            activeSellers: { type: "integer", example: 9 },
            activeGymOwners: { type: "integer", example: 6 },
            totalGyms: { type: "integer", example: 12 },
            recentOrders: { type: "integer", example: 17 },
            openMessages: { type: "integer", example: 3 },
          },
        },
        recentPending: {
          type: "array",
          items: schemaRef("ManagerPendingApprovalItemData"),
        },
      },
    },
    ManagerSellersDashboardData: {
      type: "object",
      properties: {
        sellers: {
          type: "array",
          items: schemaRef("ManagerSellerListItemData"),
        },
      },
    },
    ManagerGymOwnersDashboardData: {
      type: "object",
      properties: {
        gymOwners: {
          type: "array",
          items: schemaRef("ManagerGymOwnerListItemData"),
        },
      },
    },
  });

  Object.assign(schemas, {
    AdminDashboardGalleryItemData: {
      type: "object",
      properties: {
        id: { type: "string", example: "64b7a0c5d2f0f6a123456797" },
        title: { type: "string", nullable: true, example: "Strength Floor" },
        description: {
          type: "string",
          nullable: true,
          example: "Main free-weight area",
        },
        imageUrl: {
          type: "string",
          nullable: true,
          example: "https://res.cloudinary.com/demo/image/upload/gym-floor.jpg",
        },
        category: { type: "string", nullable: true, example: "interior" },
        createdAt: { type: "string", format: "date-time", nullable: true },
      },
    },
    AdminDashboardTrainerAssignmentDetailData: {
      type: "object",
      properties: {
        id: { type: "string", example: "64b7a0c5d2f0f6a123456794" },
        trainer: {
          type: "object",
          nullable: true,
          properties: {
            id: { type: "string", example: "64b7a0c5d2f0f6a123456701" },
            name: { type: "string", example: "Asha Rao" },
            email: {
              type: "string",
              format: "email",
              example: "trainer@fitsync.com",
            },
            profilePicture: { type: "string", nullable: true },
          },
        },
        status: { type: "string", example: "active" },
        traineesCount: { type: "integer", example: 12 },
        approvedAt: { type: "string", format: "date-time", nullable: true },
        createdAt: { type: "string", format: "date-time", nullable: true },
      },
    },
    AdminDashboardUserCoreData: {
      type: "object",
      properties: {
        id: { type: "string", example: "64b7a0c5d2f0f6a123456791" },
        name: { type: "string", example: "Asha Rao" },
        email: { type: "string", format: "email", example: "asha@example.com" },
        role: { type: "string", example: "seller" },
        status: { type: "string", example: "active" },
        profilePicture: { type: "string", nullable: true },
        contactNumber: {
          type: "string",
          nullable: true,
          example: "+91-9876543210",
        },
        age: { type: "number", nullable: true, example: 31 },
        gender: { type: "string", nullable: true, example: "female" },
        profile: { type: "object", nullable: true, additionalProperties: true },
        createdAt: { type: "string", format: "date-time", nullable: true },
      },
    },
    AdminDashboardSellerDetailData: {
      type: "object",
      properties: {
        products: {
          type: "array",
          items: schemaRef("AdminProductListItemData"),
        },
        orders: {
          type: "array",
          items: {
            type: "object",
            properties: {
              orderId: { type: "string", example: "64b7a0c5d2f0f6a123456790" },
              orderNumber: { type: "string", example: "FS-260329-4821" },
              buyer: {
                type: "object",
                nullable: true,
                properties: {
                  name: { type: "string", example: "Asha Rao" },
                  email: {
                    type: "string",
                    format: "email",
                    example: "asha@example.com",
                  },
                },
              },
              productName: { type: "string", example: "Whey Protein" },
              image: { type: "string", nullable: true },
              quantity: { type: "integer", example: 2 },
              price: { type: "number", example: 1999 },
              status: { type: "string", example: "delivered" },
              lastStatusAt: {
                type: "string",
                format: "date-time",
                nullable: true,
              },
              orderDate: {
                type: "string",
                format: "date-time",
                nullable: true,
              },
            },
          },
        },
        reviews: {
          type: "array",
          items: schemaRef("AdminProductReviewItemData"),
        },
        payouts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string", example: "64b7a0c5d2f0f6a123456798" },
              amount: { type: "number", example: 3398 },
              type: { type: "string", example: "seller" },
              metadata: { type: "object", additionalProperties: true },
              createdAt: {
                type: "string",
                format: "date-time",
                nullable: true,
              },
            },
          },
        },
        stats: {
          type: "object",
          properties: {
            totalProducts: { type: "integer", example: 18 },
            publishedProducts: { type: "integer", example: 14 },
            totalItemsSold: { type: "integer", example: 62 },
            deliveredItems: { type: "integer", example: 55 },
            totalRevenue: { type: "number", example: 124800 },
            totalPayout: { type: "number", example: 106080 },
            totalReviews: { type: "integer", example: 32 },
            avgRating: { type: "number", example: 4.7 },
          },
        },
      },
    },
    AdminDashboardGymOwnerDetailData: {
      type: "object",
      properties: {
        gyms: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string", example: "64b7a0c5d2f0f6a123456702" },
              name: { type: "string", example: "FitSync Elite" },
              description: { type: "string", nullable: true },
              location: {
                allOf: [schemaRef("GymLocationData")],
                nullable: true,
              },
              pricing: { allOf: [schemaRef("GymPricingData")], nullable: true },
              analytics: {
                allOf: [schemaRef("GymAnalyticsData")],
                nullable: true,
              },
              sponsorship: {
                allOf: [schemaRef("ManagedGymSponsorshipData")],
                nullable: true,
              },
              status: { type: "string", example: "active" },
              isPublished: { type: "boolean", example: true },
              members: {
                type: "array",
                items: schemaRef("AdminMembershipItemData"),
              },
              trainers: {
                type: "array",
                items: schemaRef("AdminDashboardTrainerAssignmentDetailData"),
              },
              reviews: {
                type: "array",
                items: schemaRef("AdminGymReviewItemData"),
              },
              memberStats: {
                type: "object",
                properties: {
                  total: { type: "integer", example: 83 },
                  active: { type: "integer", example: 79 },
                },
              },
              trainerStats: {
                type: "object",
                properties: {
                  total: { type: "integer", example: 4 },
                  active: { type: "integer", example: 3 },
                },
              },
            },
          },
        },
        subscriptions: {
          type: "array",
          items: schemaRef("AdminListingSubscriptionDashboardItemData"),
        },
        stats: {
          type: "object",
          properties: {
            totalGyms: { type: "integer", example: 2 },
            publishedGyms: { type: "integer", example: 2 },
            totalMembers: { type: "integer", example: 83 },
            activeMembers: { type: "integer", example: 79 },
            totalTrainers: { type: "integer", example: 4 },
            activeTrainers: { type: "integer", example: 3 },
            totalReviews: { type: "integer", example: 26 },
            totalImpressions: { type: "integer", example: 24000 },
          },
        },
      },
    },
    AdminDashboardTrainerDetailData: {
      type: "object",
      properties: {
        assignments: {
          type: "array",
          items: schemaRef("AdminDashboardTrainerAssignmentDetailData"),
        },
        recentProgress: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string", example: "64b7a0c5d2f0f6a123456799" },
              trainee: { type: "string", nullable: true, example: "Rahul" },
              update: {
                type: "string",
                nullable: true,
                example: "Body-fat down 1.2% this month.",
              },
              date: { type: "string", format: "date-time", nullable: true },
            },
          },
        },
        stats: {
          type: "object",
          properties: {
            totalAssignments: { type: "integer", example: 4 },
            activeAssignments: { type: "integer", example: 3 },
            totalTrainees: { type: "integer", example: 19 },
            activeTrainees: { type: "integer", example: 14 },
          },
        },
      },
    },
    AdminDashboardTraineeDetailData: {
      type: "object",
      properties: {
        memberships: {
          type: "array",
          items: schemaRef("AdminMembershipItemData"),
        },
        orders: {
          type: "array",
          items: schemaRef("AdminDashboardMarketplaceOrderData"),
        },
        gymReviews: {
          type: "array",
          items: schemaRef("AdminGymReviewItemData"),
        },
        productReviews: {
          type: "array",
          items: schemaRef("AdminProductReviewItemData"),
        },
        progress: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string", example: "64b7a0c5d2f0f6a123456799" },
              trainer: { type: "string", nullable: true, example: "Asha Rao" },
              update: {
                type: "string",
                nullable: true,
                example: "Increased squat volume this week.",
              },
              date: { type: "string", format: "date-time", nullable: true },
            },
          },
        },
        stats: {
          type: "object",
          properties: {
            totalMemberships: { type: "integer", example: 2 },
            activeMemberships: { type: "integer", example: 1 },
            totalOrders: { type: "integer", example: 4 },
            totalSpent: { type: "number", example: 12450 },
            totalGymReviews: { type: "integer", example: 3 },
            totalProductReviews: { type: "integer", example: 5 },
          },
        },
      },
    },
    AdminGymDetailDashboardData: {
      type: "object",
      properties: {
        id: { type: "string", example: "64b7a0c5d2f0f6a123456702" },
        name: { type: "string", example: "FitSync Elite" },
        description: {
          type: "string",
          nullable: true,
          example: "Premium strength and conditioning gym.",
        },
        status: { type: "string", example: "active" },
        isPublished: { type: "boolean", example: true },
        approvalStatus: { type: "string", nullable: true, example: "approved" },
        location: { allOf: [schemaRef("GymLocationData")], nullable: true },
        pricing: { allOf: [schemaRef("GymPricingData")], nullable: true },
        contact: { type: "object", nullable: true, additionalProperties: true },
        schedule: { allOf: [schemaRef("GymScheduleData")], nullable: true },
        features: { type: "array", items: { type: "string" } },
        keyFeatures: { type: "array", items: { type: "string" } },
        amenities: { type: "array", items: { type: "string" } },
        tags: { type: "array", items: { type: "string" } },
        images: { type: "array", items: { type: "string" } },
        galleryImages: { type: "array", items: { type: "string" } },
        analytics: { allOf: [schemaRef("GymAnalyticsData")], nullable: true },
        sponsorship: {
          allOf: [schemaRef("ManagedGymSponsorshipData")],
          nullable: true,
        },
        owner: {
          type: "object",
          nullable: true,
          properties: {
            id: { type: "string", example: "64b7a0c5d2f0f6a123456790" },
            name: { type: "string", example: "Rohit Varma" },
            email: {
              type: "string",
              format: "email",
              example: "owner@fitsync.com",
            },
            profilePicture: { type: "string", nullable: true },
            contactNumber: {
              type: "string",
              nullable: true,
              example: "+91-9876543210",
            },
          },
        },
        trainers: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string", example: "64b7a0c5d2f0f6a123456701" },
              name: { type: "string", example: "Asha Rao" },
              email: {
                type: "string",
                format: "email",
                example: "trainer@fitsync.com",
              },
              profilePicture: { type: "string", nullable: true },
            },
          },
        },
        members: { type: "array", items: schemaRef("AdminMembershipItemData") },
        assignments: {
          type: "array",
          items: schemaRef("AdminDashboardTrainerAssignmentDetailData"),
        },
        subscriptions: {
          type: "array",
          items: schemaRef("AdminListingSubscriptionDashboardItemData"),
        },
        reviews: { type: "array", items: schemaRef("AdminGymReviewItemData") },
        gallery: {
          type: "array",
          items: schemaRef("AdminDashboardGalleryItemData"),
        },
        createdAt: { type: "string", format: "date-time", nullable: true },
        updatedAt: { type: "string", format: "date-time", nullable: true },
      },
    },
    AdminUserDetailDashboardData: {
      type: "object",
      properties: {
        user: {
          allOf: [schemaRef("AdminDashboardUserCoreData")],
          nullable: true,
        },
        seller: {
          allOf: [schemaRef("AdminDashboardSellerDetailData")],
          nullable: true,
        },
        gymOwner: {
          allOf: [schemaRef("AdminDashboardGymOwnerDetailData")],
          nullable: true,
        },
        trainer: {
          allOf: [schemaRef("AdminDashboardTrainerDetailData")],
          nullable: true,
        },
        trainee: {
          allOf: [schemaRef("AdminDashboardTraineeDetailData")],
          nullable: true,
        },
        manager: {
          type: "object",
          nullable: true,
          properties: {
            note: {
              type: "string",
              example: "Manager approval and moderation role.",
            },
          },
        },
        admin: {
          type: "object",
          nullable: true,
          properties: {
            note: { type: "string", example: "Platform administrator." },
          },
        },
      },
    },
  });

  endpointDefs.push(
    {
      method: "get",
      path: "/api/dashboards/trainee/overview",
      tag: "Dashboards",
      summary: "Get trainee overview dashboard",
      security: accessSecurity,
      responses: secureResponses({
        200: R.ok(
          "Trainee overview fetched.",
          schemaRef("TraineeOverviewDashboardData"),
          "Trainee overview fetched successfully",
        ),
      }),
    },
    {
      method: "get",
      path: "/api/dashboards/trainee/progress",
      tag: "Dashboards",
      summary: "Get trainee progress dashboard",
      security: accessSecurity,
      responses: secureResponses({
        200: R.ok(
          "Trainee progress fetched.",
          schemaRef("TraineeProgressDashboardData"),
          "Trainee progress fetched successfully",
        ),
      }),
    },
    {
      method: "get",
      path: "/api/dashboards/trainee/diet",
      tag: "Dashboards",
      summary: "Get trainee diet dashboard",
      security: accessSecurity,
      responses: secureResponses({
        200: R.ok(
          "Trainee diet fetched.",
          schemaRef("TraineeDietDashboardData"),
          "Diet plans fetched successfully",
        ),
      }),
    },
    {
      method: "get",
      path: "/api/dashboards/trainee/orders",
      tag: "Dashboards",
      summary: "Get trainee marketplace orders",
      security: accessSecurity,
      responses: secureResponses({
        200: R.ok(
          "Trainee orders fetched.",
          schemaRef("TraineeOrdersDashboardData"),
          "Orders fetched successfully",
        ),
      }),
    },
    {
      method: "post",
      path: "/api/dashboards/trainee/feedback",
      tag: "Dashboards",
      summary: "Submit trainee feedback to a trainer",
      security: accessSecurity,
      bodySchema: "DashboardFeedbackInput",
      bodyDescription: "Trainer feedback payload.",
      responses: secureResponses(
        {
          201: R.created(
            "Feedback submitted successfully.",
            schemaRef("DashboardFeedbackCreatedData"),
            "Feedback shared with your trainer.",
          ),
        },
        { 400: R.bad },
      ),
    },
    {
      method: "get",
      path: "/api/dashboards/gym-owner/overview",
      tag: "Dashboards",
      summary: "Get gym-owner overview dashboard",
      security: accessSecurity,
      responses: secureResponses({
        200: R.ok(
          "Gym-owner overview fetched.",
          schemaRef("GymOwnerOverviewDashboardData"),
          "Gym owner overview fetched successfully",
        ),
      }),
    },
    {
      method: "get",
      path: "/api/dashboards/gym-owner/gyms",
      tag: "Dashboards",
      summary: "List gym-owner gyms",
      security: accessSecurity,
      responses: secureResponses({
        200: R.ok(
          "Gym-owner gyms fetched.",
          schemaRef("GymOwnerCollectionDashboardData"),
          "Gym list fetched successfully",
        ),
      }),
    },
    {
      method: "get",
      path: "/api/dashboards/gym-owner/subscriptions",
      tag: "Dashboards",
      summary: "Get gym-owner subscriptions",
      security: accessSecurity,
      responses: secureResponses({
        200: R.ok(
          "Gym-owner subscriptions fetched.",
          schemaRef("GymOwnerSubscriptionsDashboardData"),
          "Subscriptions fetched successfully",
        ),
      }),
    },
    {
      method: "get",
      path: "/api/dashboards/gym-owner/sponsorships",
      tag: "Dashboards",
      summary: "Get gym-owner sponsorships",
      security: accessSecurity,
      responses: secureResponses({
        200: R.ok(
          "Gym-owner sponsorships fetched.",
          schemaRef("GymOwnerSponsorshipsDashboardData"),
          "Sponsorship data fetched successfully",
        ),
      }),
    },
    {
      method: "get",
      path: "/api/dashboards/gym-owner/analytics",
      tag: "Dashboards",
      summary: "Get gym-owner analytics",
      security: accessSecurity,
      responses: secureResponses({
        200: R.ok(
          "Gym-owner analytics fetched.",
          schemaRef("GymOwnerAnalyticsDashboardData"),
          "Analytics fetched successfully",
        ),
      }),
    },
    {
      method: "get",
      path: "/api/dashboards/gym-owner/roster",
      tag: "Dashboards",
      summary: "Get gym-owner roster",
      security: accessSecurity,
      responses: secureResponses({
        200: R.ok(
          "Gym-owner roster fetched.",
          schemaRef("GymOwnerCollectionDashboardData"),
          "Gym roster fetched successfully",
        ),
      }),
    },
    {
      method: "get",
      path: "/api/dashboards/trainer/overview",
      tag: "Dashboards",
      summary: "Get trainer overview dashboard",
      security: accessSecurity,
      responses: secureResponses({
        200: R.ok(
          "Trainer overview fetched.",
          schemaRef("TrainerOverviewDashboardData"),
          "Trainer overview fetched successfully",
        ),
      }),
    },
    {
      method: "get",
      path: "/api/dashboards/trainer/trainees",
      tag: "Dashboards",
      summary: "Get trainer trainees",
      security: accessSecurity,
      responses: secureResponses({
        200: R.ok(
          "Trainer trainees fetched.",
          schemaRef("TrainerAssignmentsDashboardData"),
          "Trainer trainees fetched successfully",
        ),
      }),
    },
    {
      method: "get",
      path: "/api/dashboards/trainer/updates",
      tag: "Dashboards",
      summary: "Get trainer updates",
      security: accessSecurity,
      responses: secureResponses({
        200: R.ok(
          "Trainer updates fetched.",
          schemaRef("TrainerUpdatesDashboardData"),
          "Trainer updates fetched successfully",
        ),
      }),
    },
    {
      method: "get",
      path: "/api/dashboards/trainer/feedback",
      tag: "Dashboards",
      summary: "Get trainer feedback inbox",
      security: accessSecurity,
      responses: secureResponses({
        200: R.ok(
          "Trainer feedback inbox fetched.",
          schemaRef("TrainerFeedbackInboxData"),
          "Trainer feedback inbox fetched successfully",
        ),
      }),
    },
    {
      method: "get",
      path: "/api/dashboards/admin/overview",
      tag: "Dashboards",
      summary: "Get admin overview dashboard",
      security: accessSecurity,
      responses: secureResponses({
        200: R.ok(
          "Admin overview fetched.",
          schemaRef("AdminOverviewDashboardData"),
          "Admin overview fetched successfully",
        ),
      }),
    },
    {
      method: "get",
      path: "/api/dashboards/admin/users",
      tag: "Dashboards",
      summary: "List admin users dashboard",
      security: accessSecurity,
      responses: secureResponses({
        200: R.ok(
          "Admin users fetched.",
          schemaRef("AdminUsersDashboardData"),
          "Admin user backlog fetched successfully",
        ),
      }),
    },
    {
      method: "get",
      path: "/api/dashboards/admin/gyms",
      tag: "Dashboards",
      summary: "List admin gyms dashboard",
      security: accessSecurity,
      responses: secureResponses({
        200: R.ok(
          "Admin gyms fetched.",
          schemaRef("AdminGymsDashboardData"),
          "Admin gym list fetched successfully",
        ),
      }),
    },
    {
      method: "get",
      path: "/api/dashboards/admin/gyms/{gymId}",
      tag: "Dashboards",
      summary: "Get admin gym detail",
      security: accessSecurity,
      parameters: [idParam("gymId", "Gym identifier.")],
      responses: secureResponses(
        {
          200: R.ok(
            "Admin gym detail fetched.",
            schemaRef("AdminGymDetailDashboardData"),
            "Admin gym detail fetched successfully",
          ),
        },
        { 400: R.bad, 404: R.notFound },
      ),
    },
    {
      method: "get",
      path: "/api/dashboards/admin/revenue",
      tag: "Dashboards",
      summary: "Get admin revenue dashboard",
      security: accessSecurity,
      responses: secureResponses({
        200: R.ok(
          "Admin revenue fetched.",
          schemaRef("AdminRevenueDashboardData"),
          "Admin revenue trend fetched successfully",
        ),
      }),
    },
    {
      method: "get",
      path: "/api/dashboards/admin/marketplace",
      tag: "Dashboards",
      summary: "Get admin marketplace dashboard",
      security: accessSecurity,
      responses: secureResponses({
        200: R.ok(
          "Admin marketplace fetched.",
          schemaRef("AdminMarketplaceDashboardData"),
          "Admin marketplace activity fetched successfully",
        ),
      }),
    },
    {
      method: "get",
      path: "/api/dashboards/admin/insights",
      tag: "Dashboards",
      summary: "Get admin insights dashboard",
      security: accessSecurity,
      responses: secureResponses({
        200: R.ok(
          "Admin insights fetched.",
          schemaRef("AdminInsightsDashboardData"),
          "Admin insights fetched successfully",
        ),
      }),
    },
    {
      method: "get",
      path: "/api/dashboards/admin/memberships",
      tag: "Dashboards",
      summary: "Get admin memberships dashboard",
      security: accessSecurity,
      responses: secureResponses({
        200: R.ok(
          "Admin memberships fetched.",
          schemaRef("AdminMembershipsDashboardData"),
          "Admin memberships fetched successfully",
        ),
      }),
    },
    {
      method: "get",
      path: "/api/dashboards/admin/users/{userId}",
      tag: "Dashboards",
      summary: "Get admin user detail",
      security: accessSecurity,
      parameters: [idParam("userId", "User identifier.")],
      responses: secureResponses(
        {
          200: R.ok(
            "Admin user detail fetched.",
            schemaRef("AdminUserDetailDashboardData"),
            "User detail fetched successfully",
          ),
        },
        { 400: R.bad, 404: R.notFound },
      ),
    },
    {
      method: "get",
      path: "/api/dashboards/admin/products",
      tag: "Dashboards",
      summary: "Get admin product dashboard",
      security: accessSecurity,
      responses: secureResponses({
        200: R.ok(
          "Admin products fetched.",
          schemaRef("AdminProductsDashboardData"),
          "Admin products fetched successfully",
        ),
      }),
    },
    {
      method: "get",
      path: "/api/dashboards/admin/products/{productId}",
      tag: "Dashboards",
      summary: "Get admin product buyers",
      security: accessSecurity,
      parameters: [idParam("productId", "Product identifier.")],
      responses: secureResponses(
        {
          200: R.ok(
            "Admin product buyers fetched.",
            schemaRef("AdminProductBuyersDashboardData"),
            "Product buyers fetched successfully",
          ),
        },
        { 400: R.bad, 404: R.notFound },
      ),
    },
    {
      method: "get",
      path: "/api/dashboards/admin/reviews",
      tag: "Dashboards",
      summary: "Get admin reviews dashboard",
      security: accessSecurity,
      responses: secureResponses({
        200: R.ok(
          "Admin reviews fetched.",
          schemaRef("AdminReviewsDashboardData"),
          "Admin reviews fetched successfully",
        ),
      }),
    },
    {
      method: "get",
      path: "/api/dashboards/admin/subscriptions",
      tag: "Dashboards",
      summary: "Get admin subscriptions dashboard",
      security: accessSecurity,
      responses: secureResponses({
        200: R.ok(
          "Admin subscriptions fetched.",
          schemaRef("AdminSubscriptionsDashboardData"),
          "Admin subscriptions fetched successfully",
        ),
      }),
    },
    {
      method: "get",
      path: "/api/dashboards/manager/overview",
      tag: "Dashboards",
      summary: "Get manager overview dashboard",
      security: accessSecurity,
      responses: secureResponses({
        200: R.ok(
          "Manager overview fetched.",
          schemaRef("ManagerOverviewDashboardData"),
          "Manager overview fetched successfully.",
        ),
      }),
    },
    {
      method: "get",
      path: "/api/dashboards/manager/sellers",
      tag: "Dashboards",
      summary: "Get manager sellers dashboard",
      security: accessSecurity,
      responses: secureResponses({
        200: R.ok(
          "Manager sellers fetched.",
          schemaRef("ManagerSellersDashboardData"),
          "Manager sellers fetched.",
        ),
      }),
    },
    {
      method: "get",
      path: "/api/dashboards/manager/gym-owners",
      tag: "Dashboards",
      summary: "Get manager gym-owner dashboard",
      security: accessSecurity,
      responses: secureResponses({
        200: R.ok(
          "Manager gym-owners fetched.",
          schemaRef("ManagerGymOwnersDashboardData"),
          "Manager gym owners fetched.",
        ),
      }),
    },
  );
};
