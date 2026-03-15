const bearerSecurity = [{ bearerAuth: [] }];

const jsonContent = (schema) => ({
  "application/json": {
    schema,
  },
});

const jsonBody = (schema, required = true) => ({
  required,
  content: jsonContent(schema),
});

const multipartBody = (schema, required = false) => ({
  required,
  content: {
    "multipart/form-data": {
      schema,
    },
  },
});

const successResponse = (
  statusCode = 200,
  description = "Successful response",
) => ({
  description,
  content: jsonContent({
    allOf: [
      { $ref: "#/components/schemas/ApiResponse" },
      {
        type: "object",
        properties: {
          statusCode: {
            type: "integer",
            example: statusCode,
          },
        },
      },
    ],
  }),
});

const errorResponse = (statusCode, description) => ({
  description,
  content: jsonContent({
    allOf: [
      { $ref: "#/components/schemas/ApiError" },
      {
        type: "object",
        properties: {
          statusCode: {
            type: "integer",
            example: statusCode,
          },
        },
      },
    ],
  }),
});

const noContentResponse = (description = "Completed successfully") => ({
  description,
});

const buildOperation = ({
  summary,
  tag,
  secure = false,
  statusCode = 200,
  requestBody,
  parameters = [],
}) => {
  const responses =
    statusCode === 204
      ? { 204: noContentResponse(summary) }
      : { [statusCode]: successResponse(statusCode, summary) };

  if (secure) {
    responses[401] = errorResponse(401, "Authentication required");
    responses[403] = errorResponse(403, "Insufficient permissions");
  }

  return {
    summary,
    tags: [tag],
    ...(secure ? { security: bearerSecurity } : {}),
    ...(parameters.length ? { parameters } : {}),
    ...(requestBody ? { requestBody } : {}),
    responses,
  };
};

const addRoutes = (paths, routes) => {
  for (const route of routes) {
    paths[route.path] ??= {};
    paths[route.path][route.method] = buildOperation(route);
  }
};

const pathParameter = (name, description) => ({
  name,
  in: "path",
  required: true,
  description,
  schema: { type: "string" },
});

const queryParameter = (name, description, example) => ({
  name,
  in: "query",
  description,
  schema: {
    type: "string",
    ...(example ? { example } : {}),
  },
});

const params = {
  gymId: pathParameter("gymId", "Gym identifier"),
  membershipId: pathParameter("membershipId", "Membership identifier"),
  traineeId: pathParameter("traineeId", "Trainee identifier"),
  feedbackId: pathParameter("feedbackId", "Feedback identifier"),
  userId: pathParameter("userId", "User identifier"),
  productId: pathParameter("productId", "Product identifier"),
  orderId: pathParameter("orderId", "Order identifier"),
  itemId: pathParameter("itemId", "Order item identifier"),
  assignmentId: pathParameter("assignmentId", "Trainer assignment identifier"),
  id: pathParameter("id", "Contact message identifier"),
};

const withParams = (...names) => names.map((name) => params[name]);

export const buildOpenApiSpec = (serverUrl = "http://localhost:4000") => {
  const paths = {};

  addRoutes(paths, [
    {
      path: "/",
      method: "get",
      summary: "Get API service metadata",
      tag: "System",
    },
    {
      path: "/payments/cancelled",
      method: "get",
      summary: "Get payment cancellation result",
      tag: "Payments",
    },
    {
      path: "/payments/success",
      method: "get",
      summary: "Get payment success result",
      tag: "Payments",
      parameters: [
        queryParameter(
          "session_id",
          "Checkout session identifier",
          "cs_test_123",
        ),
      ],
    },
    {
      path: "/api/auth/register",
      method: "post",
      summary: "Register a new user",
      tag: "Auth",
      statusCode: 201,
      requestBody: jsonBody({ $ref: "#/components/schemas/RegisterRequest" }),
    },
    {
      path: "/api/auth/login",
      method: "post",
      summary: "Authenticate a user",
      tag: "Auth",
      requestBody: jsonBody({ $ref: "#/components/schemas/LoginRequest" }),
    },
    {
      path: "/api/auth/refresh",
      method: "post",
      summary: "Refresh an access token",
      tag: "Auth",
      requestBody: jsonBody(
        { $ref: "#/components/schemas/RefreshTokenRequest" },
        false,
      ),
    },
    {
      path: "/api/auth/logout",
      method: "post",
      summary: "Log out the current session",
      tag: "Auth",
      statusCode: 204,
    },
    {
      path: "/api/auth/me",
      method: "get",
      summary: "Get the authenticated user profile",
      tag: "Auth",
      secure: true,
    },
    { path: "/api/gyms", method: "get", summary: "List gyms", tag: "Gyms" },
    {
      path: "/api/gyms",
      method: "post",
      summary: "Create a gym listing",
      tag: "Gyms",
      secure: true,
      statusCode: 201,
      requestBody: jsonBody({
        $ref: "#/components/schemas/GymMutationRequest",
      }),
    },
    {
      path: "/api/gyms/{gymId}",
      method: "get",
      summary: "Get gym details",
      tag: "Gyms",
      parameters: withParams("gymId"),
    },
    {
      path: "/api/gyms/{gymId}",
      method: "put",
      summary: "Update a gym listing",
      tag: "Gyms",
      secure: true,
      parameters: withParams("gymId"),
      requestBody: jsonBody({
        $ref: "#/components/schemas/GymMutationRequest",
      }),
    },
    {
      path: "/api/gyms/{gymId}/trainers",
      method: "get",
      summary: "List trainers for a gym",
      tag: "Gyms",
      parameters: withParams("gymId"),
    },
    {
      path: "/api/gyms/{gymId}/memberships/me",
      method: "get",
      summary: "Get the authenticated member's gym membership",
      tag: "Gyms",
      secure: true,
      parameters: withParams("gymId"),
    },
    {
      path: "/api/gyms/{gymId}/memberships",
      method: "post",
      summary: "Join a gym",
      tag: "Gyms",
      secure: true,
      statusCode: 201,
      parameters: withParams("gymId"),
      requestBody: jsonBody(
        { $ref: "#/components/schemas/GenericPayload" },
        false,
      ),
    },
    {
      path: "/api/gyms/{gymId}/memberships/{membershipId}",
      method: "delete",
      summary: "Leave or remove a gym membership",
      tag: "Gyms",
      secure: true,
      parameters: withParams("gymId", "membershipId"),
    },
    {
      path: "/api/gyms/{gymId}/reviews",
      method: "get",
      summary: "List gym reviews",
      tag: "Gyms",
      parameters: withParams("gymId"),
    },
    {
      path: "/api/gyms/{gymId}/reviews",
      method: "post",
      summary: "Submit a gym review",
      tag: "Gyms",
      secure: true,
      statusCode: 201,
      parameters: withParams("gymId"),
      requestBody: jsonBody({ $ref: "#/components/schemas/ReviewRequest" }),
    },
    {
      path: "/api/gyms/{gymId}/impressions",
      method: "post",
      summary: "Record a gym impression",
      tag: "Gyms",
      parameters: withParams("gymId"),
    },
    {
      path: "/api/trainer/trainees/{traineeId}/attendance",
      method: "post",
      summary: "Log trainee attendance",
      tag: "Trainer",
      secure: true,
      statusCode: 201,
      parameters: withParams("traineeId"),
      requestBody: jsonBody({
        $ref: "#/components/schemas/TrainerAttendanceRequest",
      }),
    },
    {
      path: "/api/trainer/trainees/{traineeId}/progress",
      method: "post",
      summary: "Record trainee progress metrics",
      tag: "Trainer",
      secure: true,
      statusCode: 201,
      parameters: withParams("traineeId"),
      requestBody: jsonBody({
        $ref: "#/components/schemas/TrainerProgressRequest",
      }),
    },
    {
      path: "/api/trainer/trainees/{traineeId}/diet",
      method: "put",
      summary: "Create or update a trainee diet plan",
      tag: "Trainer",
      secure: true,
      parameters: withParams("traineeId"),
      requestBody: jsonBody({
        $ref: "#/components/schemas/TrainerDietRequest",
      }),
    },
    {
      path: "/api/trainer/trainees/{traineeId}/feedback",
      method: "post",
      summary: "Add trainer feedback for a trainee",
      tag: "Trainer",
      secure: true,
      statusCode: 201,
      parameters: withParams("traineeId"),
      requestBody: jsonBody({
        $ref: "#/components/schemas/TrainerFeedbackRequest",
      }),
    },
    {
      path: "/api/trainer/feedback/{feedbackId}/review",
      method: "patch",
      summary: "Mark trainer feedback as reviewed",
      tag: "Trainer",
      secure: true,
      parameters: withParams("feedbackId"),
    },
    {
      path: "/api/admin/users/{userId}",
      method: "delete",
      summary: "Delete a user account",
      tag: "Admin",
      secure: true,
      parameters: withParams("userId"),
    },
    {
      path: "/api/admin/users/{userId}/status",
      method: "patch",
      summary: "Update a user's status",
      tag: "Admin",
      secure: true,
      parameters: withParams("userId"),
      requestBody: jsonBody({ $ref: "#/components/schemas/AdminStatusUpdate" }),
    },
    {
      path: "/api/admin/gyms/{gymId}",
      method: "delete",
      summary: "Delete a gym listing",
      tag: "Admin",
      secure: true,
      parameters: withParams("gymId"),
    },
    {
      path: "/api/admin/products/{productId}",
      method: "delete",
      summary: "Delete a marketplace product listing",
      tag: "Admin",
      secure: true,
      parameters: withParams("productId"),
    },
    {
      path: "/api/admin/settings/toggles",
      method: "get",
      summary: "Get admin feature toggles",
      tag: "Admin",
      secure: true,
    },
    {
      path: "/api/admin/settings/toggles",
      method: "patch",
      summary: "Update admin feature toggles",
      tag: "Admin",
      secure: true,
      requestBody: jsonBody({ $ref: "#/components/schemas/AdminToggleUpdate" }),
    },
    {
      path: "/api/owner/monetisation/options",
      method: "get",
      summary: "Get owner monetisation options",
      tag: "Owner",
      secure: true,
    },
    {
      path: "/api/owner/subscriptions/checkout",
      method: "post",
      summary: "Create an owner subscription checkout flow",
      tag: "Owner",
      secure: true,
      requestBody: jsonBody(
        { $ref: "#/components/schemas/GenericPayload" },
        false,
      ),
    },
    {
      path: "/api/owner/sponsorships/purchase",
      method: "post",
      summary: "Purchase an owner sponsorship package",
      tag: "Owner",
      secure: true,
      requestBody: jsonBody(
        { $ref: "#/components/schemas/GenericPayload" },
        false,
      ),
    },
    {
      path: "/api/owner/trainers/requests",
      method: "get",
      summary: "List trainer assignment requests",
      tag: "Owner",
      secure: true,
    },
    {
      path: "/api/owner/trainers/requests/{assignmentId}/approve",
      method: "post",
      summary: "Approve a trainer assignment request",
      tag: "Owner",
      secure: true,
      parameters: withParams("assignmentId"),
    },
    {
      path: "/api/owner/trainers/requests/{assignmentId}/decline",
      method: "post",
      summary: "Decline a trainer assignment request",
      tag: "Owner",
      secure: true,
      parameters: withParams("assignmentId"),
    },
    {
      path: "/api/owner/trainers/{assignmentId}",
      method: "delete",
      summary: "Remove a trainer from a gym",
      tag: "Owner",
      secure: true,
      parameters: withParams("assignmentId"),
    },
    {
      path: "/api/owner/memberships/{membershipId}",
      method: "delete",
      summary: "Remove a member from a gym",
      tag: "Owner",
      secure: true,
      parameters: withParams("membershipId"),
    },
    {
      path: "/api/marketplace/products",
      method: "get",
      summary: "List marketplace products",
      tag: "Marketplace",
    },
    {
      path: "/api/marketplace/products/suggestions",
      method: "get",
      summary: "Get marketplace product suggestions",
      tag: "Marketplace",
    },
    {
      path: "/api/marketplace/products/{productId}",
      method: "get",
      summary: "Get marketplace product details",
      tag: "Marketplace",
      parameters: withParams("productId"),
    },
    {
      path: "/api/marketplace/orders",
      method: "post",
      summary: "Create a marketplace order",
      tag: "Marketplace",
      secure: true,
      statusCode: 201,
      requestBody: jsonBody(
        { $ref: "#/components/schemas/GenericPayload" },
        false,
      ),
    },
    {
      path: "/api/marketplace/orders/{orderId}/cod-confirm",
      method: "post",
      summary: "Confirm a cash-on-delivery order",
      tag: "Marketplace",
      secure: true,
      parameters: withParams("orderId"),
    },
    {
      path: "/api/marketplace/products/{productId}/reviews",
      method: "post",
      summary: "Submit a marketplace product review",
      tag: "Marketplace",
      secure: true,
      statusCode: 201,
      parameters: withParams("productId"),
      requestBody: jsonBody({ $ref: "#/components/schemas/ReviewRequest" }),
    },
    {
      path: "/api/marketplace/seller/products",
      method: "get",
      summary: "List seller products",
      tag: "Marketplace",
      secure: true,
    },
    {
      path: "/api/marketplace/seller/products",
      method: "post",
      summary: "Create a seller product",
      tag: "Marketplace",
      secure: true,
      statusCode: 201,
      requestBody: multipartBody(
        { $ref: "#/components/schemas/SellerProductFormData" },
        true,
      ),
    },
    {
      path: "/api/marketplace/seller/products/{productId}",
      method: "put",
      summary: "Update a seller product",
      tag: "Marketplace",
      secure: true,
      parameters: withParams("productId"),
      requestBody: multipartBody({
        $ref: "#/components/schemas/SellerProductFormData",
      }),
    },
    {
      path: "/api/marketplace/seller/products/{productId}",
      method: "delete",
      summary: "Delete a seller product",
      tag: "Marketplace",
      secure: true,
      parameters: withParams("productId"),
    },
    {
      path: "/api/marketplace/seller/orders",
      method: "get",
      summary: "List seller orders",
      tag: "Marketplace",
      secure: true,
    },
    {
      path: "/api/marketplace/seller/orders/{orderId}/items/{itemId}/status",
      method: "patch",
      summary: "Update a seller order item status",
      tag: "Marketplace",
      secure: true,
      parameters: withParams("orderId", "itemId"),
      requestBody: jsonBody({
        $ref: "#/components/schemas/SellerOrderStatusUpdate",
      }),
    },
    {
      path: "/api/marketplace/seller/orders/{orderId}/settle",
      method: "patch",
      summary: "Settle a seller order payout",
      tag: "Marketplace",
      secure: true,
      parameters: withParams("orderId"),
    },
    {
      path: "/api/users/profile",
      method: "get",
      summary: "Get the authenticated user profile",
      tag: "User",
      secure: true,
    },
    {
      path: "/api/users/profile",
      method: "patch",
      summary: "Update the authenticated user profile",
      tag: "User",
      secure: true,
      requestBody: multipartBody({
        $ref: "#/components/schemas/ProfileUpdateFormData",
      }),
    },
    {
      path: "/api/contact",
      method: "post",
      summary: "Submit a contact form entry",
      tag: "Contact",
      statusCode: 201,
      requestBody: jsonBody({ $ref: "#/components/schemas/ContactRequest" }),
    },
    {
      path: "/api/contact",
      method: "get",
      summary: "List contact messages",
      tag: "Contact",
      secure: true,
    },
    {
      path: "/api/contact/{id}/status",
      method: "patch",
      summary: "Update contact message status",
      tag: "Contact",
      secure: true,
      parameters: withParams("id"),
      requestBody: jsonBody({
        $ref: "#/components/schemas/ContactStatusUpdate",
      }),
    },
    {
      path: "/api/payments/config",
      method: "get",
      summary: "Get Stripe client configuration",
      tag: "Payments",
    },
    {
      path: "/api/payments/webhook",
      method: "post",
      summary: "Receive Stripe webhook events",
      tag: "Payments",
      requestBody: jsonBody(
        { $ref: "#/components/schemas/GenericPayload" },
        false,
      ),
    },
    {
      path: "/api/payments/confirm",
      method: "post",
      summary: "Confirm a payment session",
      tag: "Payments",
      secure: true,
      requestBody: jsonBody(
        { $ref: "#/components/schemas/GenericPayload" },
        false,
      ),
    },
    {
      path: "/api/payments/owner/confirm",
      method: "post",
      summary: "Confirm an owner payment",
      tag: "Payments",
      secure: true,
      requestBody: jsonBody(
        { $ref: "#/components/schemas/GenericPayload" },
        false,
      ),
    },
    {
      path: "/api/payments/owner/gyms/checkout-session",
      method: "post",
      summary: "Create a gym creation checkout session",
      tag: "Payments",
      secure: true,
      requestBody: jsonBody(
        { $ref: "#/components/schemas/GenericPayload" },
        false,
      ),
    },
    {
      path: "/api/payments/owner/subscriptions/checkout-session",
      method: "post",
      summary: "Create an owner listing checkout session",
      tag: "Payments",
      secure: true,
      requestBody: jsonBody(
        { $ref: "#/components/schemas/GenericPayload" },
        false,
      ),
    },
    {
      path: "/api/payments/owner/sponsorships/checkout-session",
      method: "post",
      summary: "Create an owner sponsorship checkout session",
      tag: "Payments",
      secure: true,
      requestBody: jsonBody(
        { $ref: "#/components/schemas/GenericPayload" },
        false,
      ),
    },
    {
      path: "/api/payments/memberships/checkout-session",
      method: "post",
      summary: "Create a membership checkout session",
      tag: "Payments",
      secure: true,
      requestBody: jsonBody(
        { $ref: "#/components/schemas/GenericPayload" },
        false,
      ),
    },
    {
      path: "/api/payments/marketplace/checkout-session",
      method: "post",
      summary: "Create a marketplace checkout session",
      tag: "Payments",
      secure: true,
      requestBody: jsonBody(
        { $ref: "#/components/schemas/GenericPayload" },
        false,
      ),
    },
    {
      path: "/api/payments/marketplace/payment-intent",
      method: "post",
      summary: "Create a marketplace payment intent",
      tag: "Payments",
      secure: true,
      requestBody: jsonBody(
        { $ref: "#/components/schemas/GenericPayload" },
        false,
      ),
    },
    {
      path: "/api/payments/marketplace/upi/session",
      method: "post",
      summary: "Create a marketplace UPI session",
      tag: "Payments",
      secure: true,
      requestBody: jsonBody(
        { $ref: "#/components/schemas/GenericPayload" },
        false,
      ),
    },
    {
      path: "/api/payments/marketplace/upi/confirm",
      method: "post",
      summary: "Confirm a marketplace UPI payment",
      tag: "Payments",
      secure: true,
      requestBody: jsonBody(
        { $ref: "#/components/schemas/GenericPayload" },
        false,
      ),
    },
  ]);

  addRoutes(
    paths,
    [
      "/api/dashboards/trainee/overview",
      "/api/dashboards/trainee/progress",
      "/api/dashboards/trainee/diet",
      "/api/dashboards/trainee/orders",
      "/api/dashboards/gym-owner/overview",
      "/api/dashboards/gym-owner/gyms",
      "/api/dashboards/gym-owner/subscriptions",
      "/api/dashboards/gym-owner/sponsorships",
      "/api/dashboards/gym-owner/analytics",
      "/api/dashboards/gym-owner/roster",
      "/api/dashboards/trainer/overview",
      "/api/dashboards/trainer/trainees",
      "/api/dashboards/trainer/updates",
      "/api/dashboards/trainer/feedback",
      "/api/dashboards/admin/overview",
      "/api/dashboards/admin/users",
      "/api/dashboards/admin/gyms",
      "/api/dashboards/admin/revenue",
      "/api/dashboards/admin/marketplace",
      "/api/dashboards/admin/bookings",
      "/api/dashboards/admin/memberships",
      "/api/dashboards/admin/trainer-assignments",
      "/api/dashboards/admin/products",
      "/api/dashboards/admin/reviews",
      "/api/dashboards/admin/subscriptions",
      "/api/dashboards/admin/insights",
    ].map((path) => ({
      path,
      method: "get",
      summary: `Fetch ${path.split("/").slice(-1)[0].replace(/-/g, " ")}`,
      tag: "Dashboard",
      secure: true,
    })),
  );

  addRoutes(paths, [
    {
      path: "/api/dashboards/trainee/feedback",
      method: "post",
      summary: "Submit trainee feedback to a trainer",
      tag: "Dashboard",
      secure: true,
      statusCode: 201,
      requestBody: jsonBody({
        $ref: "#/components/schemas/TrainerFeedbackRequest",
      }),
    },
    {
      path: "/api/dashboards/admin/users/{userId}",
      method: "get",
      summary: "Get admin user details",
      tag: "Dashboard",
      secure: true,
      parameters: withParams("userId"),
    },
    {
      path: "/api/dashboards/admin/gyms/{gymId}",
      method: "get",
      summary: "Get admin gym details",
      tag: "Dashboard",
      secure: true,
      parameters: withParams("gymId"),
    },
    {
      path: "/api/dashboards/admin/products/{productId}/buyers",
      method: "get",
      summary: "Get admin product buyers",
      tag: "Dashboard",
      secure: true,
      parameters: withParams("productId"),
    },
    {
      path: "/api/system/health",
      method: "get",
      summary: "Health check",
      tag: "System",
    },
  ]);

  return {
    openapi: "3.0.3",
    info: {
      title: "FitSync API",
      version: "1.0.0",
      description:
        "OpenAPI documentation for the FitSync web services, including authentication, gyms, marketplace, dashboards, trainer workflows, and payment flows.",
    },
    servers: [
      {
        url: serverUrl,
        description: "Active server",
      },
    ],
    tags: [
      { name: "System" },
      { name: "Auth" },
      { name: "Gyms" },
      { name: "Dashboard" },
      { name: "Trainer" },
      { name: "Admin" },
      { name: "Owner" },
      { name: "Marketplace" },
      { name: "User" },
      { name: "Contact" },
      { name: "Payments" },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        ApiResponse: {
          type: "object",
          properties: {
            statusCode: { type: "integer", example: 200 },
            success: { type: "boolean", example: true },
            message: { type: "string", example: "Success" },
            data: {
              type: "object",
              nullable: true,
              additionalProperties: true,
            },
          },
        },
        ApiError: {
          type: "object",
          properties: {
            statusCode: { type: "integer", example: 400 },
            success: { type: "boolean", example: false },
            message: { type: "string", example: "Something went wrong" },
            data: { nullable: true, example: null },
            errors: {
              type: "array",
              items: { type: "string" },
            },
          },
        },
        RegisterRequest: {
          type: "object",
          required: ["firstName", "email", "password"],
          properties: {
            firstName: { type: "string", example: "Alex" },
            lastName: { type: "string", example: "Morgan" },
            email: {
              type: "string",
              format: "email",
              example: "alex@fitsync.dev",
            },
            password: {
              type: "string",
              format: "password",
              example: "Test1234!",
            },
            role: { type: "string", example: "trainee" },
          },
        },
        LoginRequest: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: {
              type: "string",
              format: "email",
              example: "alex@fitsync.dev",
            },
            password: {
              type: "string",
              format: "password",
              example: "Test1234!",
            },
            rememberMe: { type: "boolean", example: true },
          },
        },
        RefreshTokenRequest: {
          type: "object",
          properties: {
            refreshToken: { type: "string", example: "refresh-token-value" },
          },
        },
        GymMutationRequest: {
          type: "object",
          properties: {
            name: { type: "string", example: "FitSync Downtown" },
            description: {
              type: "string",
              example: "Premium gym with coached programs.",
            },
            amenities: {
              type: "array",
              items: { type: "string" },
              example: ["Weights", "Cardio"],
            },
            location: {
              type: "object",
              properties: {
                address: { type: "string", example: "123 MG Road" },
                city: { type: "string", example: "Bengaluru" },
                state: { type: "string", example: "Karnataka" },
              },
            },
            pricing: {
              type: "object",
              properties: {
                monthlyMrp: { type: "number", example: 1800 },
                monthlyPrice: { type: "number", example: 1400 },
                currency: { type: "string", example: "INR" },
              },
            },
          },
        },
        ReviewRequest: {
          type: "object",
          properties: {
            rating: { type: "integer", minimum: 1, maximum: 5, example: 5 },
            comment: {
              type: "string",
              example: "Great atmosphere and trainers.",
            },
          },
        },
        ContactRequest: {
          type: "object",
          required: ["name", "email", "subject", "message"],
          properties: {
            name: { type: "string", example: "Priya Sharma" },
            email: {
              type: "string",
              format: "email",
              example: "priya@example.com",
            },
            subject: { type: "string", example: "Need help with a listing" },
            message: {
              type: "string",
              example: "Please help me update my listing details.",
            },
          },
        },
        ContactStatusUpdate: {
          type: "object",
          properties: {
            status: { type: "string", example: "resolved" },
          },
        },
        GenericPayload: {
          type: "object",
          additionalProperties: true,
        },
        TrainerAttendanceRequest: {
          type: "object",
          properties: {
            attendedAt: {
              type: "string",
              format: "date-time",
              example: "2026-03-15T09:30:00.000Z",
            },
            status: { type: "string", example: "present" },
            notes: {
              type: "string",
              example: "Completed the full workout circuit.",
            },
          },
        },
        TrainerProgressRequest: {
          type: "object",
          properties: {
            recordedAt: {
              type: "string",
              format: "date-time",
              example: "2026-03-15T09:30:00.000Z",
            },
            weightKg: { type: "number", example: 68.5 },
            bodyFatPercentage: { type: "number", example: 18.2 },
            notes: {
              type: "string",
              example: "Strength metrics improved this week.",
            },
          },
        },
        TrainerDietRequest: {
          type: "object",
          properties: {
            meals: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: true,
              },
            },
            instructions: {
              type: "string",
              example: "Hydrate well and keep carbs around workouts.",
            },
          },
        },
        TrainerFeedbackRequest: {
          type: "object",
          properties: {
            message: {
              type: "string",
              example: "Energy felt much better this week.",
            },
            rating: { type: "integer", minimum: 1, maximum: 5, example: 5 },
          },
        },
        AdminStatusUpdate: {
          type: "object",
          properties: {
            status: { type: "string", example: "active" },
          },
        },
        AdminToggleUpdate: {
          type: "object",
          additionalProperties: {
            type: "boolean",
          },
          example: {
            allowSellerRegistrations: true,
            enableSponsorships: true,
          },
        },
        SellerProductFormData: {
          type: "object",
          properties: {
            name: { type: "string", example: "Recovery Whey Protein" },
            description: {
              type: "string",
              example: "Fast-digesting post-workout whey isolate.",
            },
            category: { type: "string", example: "supplements" },
            price: { type: "number", example: 2499 },
            mrp: { type: "number", example: 2999 },
            stock: { type: "integer", example: 20 },
            image: { type: "string", format: "binary" },
          },
        },
        SellerOrderStatusUpdate: {
          type: "object",
          properties: {
            status: { type: "string", example: "shipped" },
          },
        },
        ProfileUpdateFormData: {
          type: "object",
          properties: {
            firstName: { type: "string", example: "Alex" },
            lastName: { type: "string", example: "Morgan" },
            bio: {
              type: "string",
              example: "Working on strength and mobility.",
            },
            contactNumber: { type: "string", example: "+91 9876543210" },
            profilePicture: { type: "string", format: "binary" },
          },
        },
      },
    },
    paths: {
      ...paths,
      "/api/system/health": {
        get: {
          summary: "Health check",
          tags: ["System"],
          responses: {
            200: {
              description: "API is healthy",
              content: jsonContent({
                type: "object",
                properties: {
                  status: { type: "string", example: "ok" },
                  timestamp: { type: "integer", example: 1710000000000 },
                },
              }),
            },
          },
        },
      },
    },
  };
};
