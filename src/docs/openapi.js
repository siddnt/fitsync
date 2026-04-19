const bearerSecurity = [{ bearerAuth: [] }];

const json = (description, schema = 'ApiEnvelope') => ({
  description,
  content: {
    'application/json': {
      schema: { $ref: `#/components/schemas/${schema}` },
    },
  },
});

const body = (schema = 'GenericBody', required = true, mediaType = 'application/json') => ({
  required,
  content: {
    [mediaType]: {
      schema: { $ref: `#/components/schemas/${schema}` },
    },
  },
});

const pathParam = (name, description) => ({
  name,
  in: 'path',
  required: true,
  description,
  schema: { type: 'string' },
});

const queryParam = (name, description, type = 'string') => ({
  name,
  in: 'query',
  required: false,
  description,
  schema: { type },
});

const downloadResponse = (description = 'Download response') => ({
  description,
  content: {
    'text/csv': {
      schema: { type: 'string', format: 'binary' },
    },
    'application/pdf': {
      schema: { type: 'string', format: 'binary' },
    },
  },
});

const endpoint = ({
  tag,
  summary,
  description,
  security,
  parameters,
  requestBody,
  success = 'Successful response',
  created = false,
  noContent = false,
}) => ({
  tags: [tag],
  summary,
  description,
  ...(security ? { security } : {}),
  ...(parameters?.length ? { parameters } : {}),
  ...(requestBody ? { requestBody } : {}),
  responses: noContent
    ? { 204: { description: success } }
    : {
        [created ? 201 : 200]: json(success),
        ...(security ? { 401: json('Unauthorized', 'ErrorResponse') } : {}),
      },
});

const dashboardReads = [
  '/api/dashboards/trainee/overview',
  '/api/dashboards/trainee/progress',
  '/api/dashboards/trainee/diet',
  '/api/dashboards/trainee/orders',
  '/api/dashboards/gym-owner/overview',
  '/api/dashboards/gym-owner/gyms',
  '/api/dashboards/gym-owner/subscriptions',
  '/api/dashboards/gym-owner/sponsorships',
  '/api/dashboards/gym-owner/analytics',
  '/api/dashboards/gym-owner/roster',
  '/api/dashboards/trainer/overview',
  '/api/dashboards/trainer/trainees',
  '/api/dashboards/trainer/updates',
  '/api/dashboards/trainer/feedback',
  '/api/dashboards/admin/overview',
  '/api/dashboards/admin/users',
  '/api/dashboards/admin/gyms',
  '/api/dashboards/admin/revenue',
  '/api/dashboards/admin/marketplace',
  '/api/dashboards/admin/insights',
  '/api/dashboards/admin/ops',
  '/api/dashboards/manager/overview',
  '/api/dashboards/manager/sellers',
  '/api/dashboards/manager/gym-owners',
];

const dashboardPaths = Object.fromEntries(
  dashboardReads.map((path) => [
    path,
    {
      get: endpoint({
        tag: 'Dashboards',
        summary: `Read ${path.split('/').slice(-2).join(' ')}`,
        security: bearerSecurity,
      }),
    },
  ]),
);

export const buildOpenApiDocument = ({ origin = '/' } = {}) => ({
  openapi: '3.1.0',
  info: {
    title: 'FitSync REST API',
    version: '1.1.0',
    description:
      'REST documentation for the FitSync B2C web client and B2B partner integrations. Public catalogue endpoints use MongoDB text indexes and Redis-backed response caching.',
  },
  servers: [{ url: origin }],
  tags: [
    { name: 'System' },
    { name: 'Auth' },
    { name: 'Gyms' },
    { name: 'Bookings' },
    { name: 'Marketplace' },
    { name: 'Dashboards' },
    { name: 'Trainer' },
    { name: 'Owner' },
    { name: 'Admin' },
    { name: 'Manager' },
    { name: 'Users' },
    { name: 'Contact' },
    { name: 'Communications' },
    { name: 'Payments' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      refreshCookie: { type: 'apiKey', in: 'cookie', name: 'refreshToken' },
    },
    schemas: {
      ApiEnvelope: {
        type: 'object',
        properties: {
          statusCode: { type: 'integer', example: 200 },
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Success' },
          data: { type: 'object', additionalProperties: true },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          statusCode: { type: 'integer', example: 400 },
          message: { type: 'string', example: 'Validation failed' },
          errors: { type: 'array', items: { type: 'string' } },
        },
      },
      GenericBody: {
        type: 'object',
        additionalProperties: true,
      },
      MultipartBody: {
        type: 'object',
        additionalProperties: true,
        properties: {
          image: { type: 'string', format: 'binary' },
          profilePicture: { type: 'string', format: 'binary' },
        },
      },
    },
  },
  paths: {
    '/api/system/health': {
      get: endpoint({
        tag: 'System',
        summary: 'Health check',
        description: 'Returns API status plus cache and search provider metadata.',
      }),
    },
    '/api/system/metrics': {
      get: endpoint({
        tag: 'System',
        summary: 'Runtime metrics',
        description: 'Returns cache, search, request, and slow-query observability counters.',
      }),
    },
    '/api/system/metrics/prometheus': {
      get: {
        tags: ['System'],
        summary: 'Prometheus metrics',
        description: 'Returns Prometheus-compatible plaintext metrics for cache, search, request, and Mongo query observability.',
        responses: {
          200: {
            description: 'Prometheus metrics payload',
            content: {
              'text/plain': {
                schema: { type: 'string' },
              },
            },
          },
        },
      },
    },
    '/api/auth/register': {
      post: endpoint({ tag: 'Auth', summary: 'Register user', requestBody: body(), created: true }),
    },
    '/api/auth/login': {
      post: endpoint({ tag: 'Auth', summary: 'Login user', requestBody: body() }),
    },
    '/api/auth/refresh': {
      post: endpoint({
        tag: 'Auth',
        summary: 'Refresh access token',
        security: [{ refreshCookie: [] }],
        requestBody: body('GenericBody', false),
      }),
    },
    '/api/auth/logout': {
      post: endpoint({
        tag: 'Auth',
        summary: 'Logout session',
        security: [{ refreshCookie: [] }],
        noContent: true,
        success: 'Logged out successfully',
      }),
    },
    '/api/auth/me': {
      get: endpoint({ tag: 'Auth', summary: 'Get current user', security: bearerSecurity }),
    },
    '/api/gyms': {
      get: endpoint({
        tag: 'Gyms',
        summary: 'List gyms',
        description: 'Indexed text search with Meilisearch fallback, stale-while-revalidate caching, ETag, and Last-Modified headers.',
        parameters: [
          queryParam('search', 'Keyword search'),
          queryParam('city', 'City or PIN code filter'),
          queryParam('amenities', 'Amenity filter'),
          queryParam('pagination', 'Set to `cursor` to enable cursor-based pagination for browse results'),
          queryParam('cursor', 'Opaque cursor returned from a previous browse response'),
          queryParam('page', 'Page number', 'integer'),
          queryParam('limit', 'Page size', 'integer'),
        ],
      }),
      post: endpoint({
        tag: 'Gyms',
        summary: 'Create gym',
        security: bearerSecurity,
        requestBody: body(),
        created: true,
      }),
    },
    '/api/gyms/{gymId}': {
      get: endpoint({ tag: 'Gyms', summary: 'Get gym', parameters: [pathParam('gymId', 'Gym id')] }),
      put: endpoint({
        tag: 'Gyms',
        summary: 'Update gym',
        security: bearerSecurity,
        parameters: [pathParam('gymId', 'Gym id')],
        requestBody: body(),
      }),
    },
    '/api/gyms/{gymId}/trainers': {
      get: endpoint({ tag: 'Gyms', summary: 'List gym trainers', parameters: [pathParam('gymId', 'Gym id')] }),
    },
    '/api/gyms/{gymId}/memberships/me': {
      get: endpoint({
        tag: 'Gyms',
        summary: 'Get my membership',
        security: bearerSecurity,
        parameters: [pathParam('gymId', 'Gym id')],
      }),
    },
    '/api/gyms/{gymId}/memberships': {
      post: endpoint({
        tag: 'Gyms',
        summary: 'Join gym',
        security: bearerSecurity,
        parameters: [pathParam('gymId', 'Gym id')],
        requestBody: body(),
        created: true,
      }),
    },
    '/api/gyms/{gymId}/memberships/{membershipId}': {
      delete: endpoint({
        tag: 'Gyms',
        summary: 'Cancel membership',
        security: bearerSecurity,
        parameters: [pathParam('gymId', 'Gym id'), pathParam('membershipId', 'Membership id')],
      }),
    },
    '/api/gyms/{gymId}/reviews': {
      get: endpoint({
        tag: 'Gyms',
        summary: 'List gym reviews',
        parameters: [pathParam('gymId', 'Gym id'), queryParam('limit', 'Review limit', 'integer')],
      }),
      post: endpoint({
        tag: 'Gyms',
        summary: 'Create gym review',
        security: bearerSecurity,
        parameters: [pathParam('gymId', 'Gym id')],
        requestBody: body(),
      }),
    },
    '/api/gyms/{gymId}/impressions': {
      post: endpoint({
        tag: 'Gyms',
        summary: 'Record gym impression',
        parameters: [pathParam('gymId', 'Gym id')],
        noContent: true,
        success: 'Impression recorded',
      }),
    },
    '/api/gyms/{gymId}/opens': {
      post: endpoint({
        tag: 'Gyms',
        summary: 'Record gym detail open event',
        parameters: [pathParam('gymId', 'Gym id')],
        noContent: true,
        success: 'Open event recorded',
      }),
    },
    '/api/bookings/slots': {
      get: endpoint({
        tag: 'Bookings',
        summary: 'List available booking slots',
        security: bearerSecurity,
        parameters: [
          queryParam('gymId', 'Gym id'),
          queryParam('trainerId', 'Trainer id'),
          queryParam('date', 'Booking date'),
        ],
      }),
    },
    '/api/bookings/me': {
      get: endpoint({
        tag: 'Bookings',
        summary: 'List my bookings',
        security: bearerSecurity,
      }),
    },
    '/api/bookings': {
      post: endpoint({
        tag: 'Bookings',
        summary: 'Create booking',
        security: bearerSecurity,
        requestBody: body(),
        created: true,
      }),
    },
    '/api/bookings/{bookingId}/status': {
      patch: endpoint({
        tag: 'Bookings',
        summary: 'Update booking status',
        security: bearerSecurity,
        parameters: [pathParam('bookingId', 'Booking id')],
        requestBody: body(),
      }),
    },
    ...dashboardPaths,
    '/api/dashboards/trainee/feedback': {
      post: endpoint({
        tag: 'Dashboards',
        summary: 'Submit trainee feedback',
        security: bearerSecurity,
        requestBody: body(),
      }),
    },
    '/api/dashboards/gym-owner/sponsorships/export': {
      get: {
        tags: ['Dashboards'],
        summary: 'Export gym owner sponsorship report',
        security: bearerSecurity,
        parameters: [
          queryParam('format', 'Download format: csv or pdf'),
          queryParam('gymId', 'Optional gym id filter'),
        ],
        responses: {
          200: downloadResponse('Sponsorship report download'),
          401: json('Unauthorized', 'ErrorResponse'),
        },
      },
    },
    '/api/dashboards/gym-owner/memberships/export': {
      get: {
        tags: ['Dashboards'],
        summary: 'Export gym owner memberships report',
        security: bearerSecurity,
        parameters: [
          queryParam('format', 'Download format: csv or pdf'),
          queryParam('gymId', 'Optional gym id filter'),
        ],
        responses: {
          200: downloadResponse('Membership report download'),
          401: json('Unauthorized', 'ErrorResponse'),
        },
      },
    },
    '/api/dashboards/admin/users/{userId}': {
      get: endpoint({
        tag: 'Dashboards',
        summary: 'Read admin user detail view',
        security: bearerSecurity,
        parameters: [pathParam('userId', 'User id')],
      }),
    },
    '/api/dashboards/admin/gyms/{gymId}': {
      get: endpoint({
        tag: 'Dashboards',
        summary: 'Read admin gym detail view',
        security: bearerSecurity,
        parameters: [pathParam('gymId', 'Gym id')],
      }),
    },
    '/api/dashboards/admin/revenue/export': {
      get: {
        tags: ['Dashboards'],
        summary: 'Export admin revenue report',
        security: bearerSecurity,
        parameters: [
          queryParam('format', 'Download format: csv or pdf'),
          queryParam('since', 'ISO date lower bound'),
        ],
        responses: {
          200: downloadResponse('Revenue report download'),
          401: json('Unauthorized', 'ErrorResponse'),
        },
      },
    },
    '/api/trainer/trainees/{traineeId}/attendance': {
      post: endpoint({
        tag: 'Trainer',
        summary: 'Log attendance',
        security: bearerSecurity,
        parameters: [pathParam('traineeId', 'Trainee id')],
        requestBody: body(),
      }),
    },
    '/api/trainer/trainees/{traineeId}/progress': {
      post: endpoint({
        tag: 'Trainer',
        summary: 'Record progress',
        security: bearerSecurity,
        parameters: [pathParam('traineeId', 'Trainee id')],
        requestBody: body(),
      }),
    },
    '/api/trainer/trainees/{traineeId}/diet': {
      put: endpoint({
        tag: 'Trainer',
        summary: 'Upsert diet plan',
        security: bearerSecurity,
        parameters: [pathParam('traineeId', 'Trainee id')],
        requestBody: body(),
      }),
    },
    '/api/trainer/trainees/{traineeId}/feedback': {
      post: endpoint({
        tag: 'Trainer',
        summary: 'Add trainee feedback',
        security: bearerSecurity,
        parameters: [pathParam('traineeId', 'Trainee id')],
        requestBody: body(),
      }),
    },
    '/api/trainer/feedback/{feedbackId}/review': {
      patch: endpoint({
        tag: 'Trainer',
        summary: 'Review feedback',
        security: bearerSecurity,
        parameters: [pathParam('feedbackId', 'Feedback id')],
        requestBody: body(),
      }),
    },
    '/api/trainer/availability': {
      put: endpoint({
        tag: 'Trainer',
        summary: 'Upsert trainer availability',
        security: bearerSecurity,
        requestBody: body(),
      }),
    },
    '/api/trainer/availability/me': {
      get: endpoint({
        tag: 'Trainer',
        summary: 'List my availability',
        security: bearerSecurity,
      }),
    },
    '/api/trainer/{trainerId}/availability': {
      get: endpoint({
        tag: 'Trainer',
        summary: 'Get trainer availability',
        parameters: [pathParam('trainerId', 'Trainer id'), queryParam('gymId', 'Gym id')],
      }),
    },
    '/api/admin/users/{userId}': {
      delete: endpoint({
        tag: 'Admin',
        summary: 'Delete user account',
        security: bearerSecurity,
        parameters: [pathParam('userId', 'User id')],
      }),
    },
    '/api/admin/users/{userId}/status': {
      patch: endpoint({
        tag: 'Admin',
        summary: 'Update user status',
        security: bearerSecurity,
        parameters: [pathParam('userId', 'User id')],
        requestBody: body(),
      }),
    },
    '/api/admin/gyms/{gymId}': {
      delete: endpoint({
        tag: 'Admin',
        summary: 'Delete gym listing',
        security: bearerSecurity,
        parameters: [pathParam('gymId', 'Gym id')],
      }),
    },
    '/api/admin/settings/toggles': {
      get: endpoint({ tag: 'Admin', summary: 'Get admin toggles', security: bearerSecurity }),
      patch: endpoint({
        tag: 'Admin',
        summary: 'Update admin toggles',
        security: bearerSecurity,
        requestBody: body(),
      }),
    },
    '/api/admin/audit-logs': {
      get: endpoint({
        tag: 'Admin',
        summary: 'List audit logs',
        security: bearerSecurity,
        parameters: [
          queryParam('entityType', 'Entity type'),
          queryParam('entityId', 'Entity id'),
          queryParam('actor', 'Actor id'),
          queryParam('action', 'Action key'),
          queryParam('limit', 'Result limit', 'integer'),
        ],
      }),
    },
    '/api/admin/audit-logs/export': {
      get: {
        tags: ['Admin'],
        summary: 'Export audit logs report',
        security: bearerSecurity,
        parameters: [
          queryParam('format', 'Download format: csv or pdf'),
          queryParam('entityType', 'Entity type'),
          queryParam('entityId', 'Entity id'),
          queryParam('actor', 'Actor id'),
          queryParam('action', 'Action key'),
          queryParam('search', 'Free-text search'),
          queryParam('limit', 'Result limit', 'integer'),
        ],
        responses: {
          200: downloadResponse('Audit log report download'),
          401: json('Unauthorized', 'ErrorResponse'),
        },
      },
    },
    '/api/manager/pending': {
      get: endpoint({
        tag: 'Manager',
        summary: 'List pending approvals',
        security: bearerSecurity,
      }),
    },
    '/api/manager/users/{userId}/approve': {
      patch: endpoint({
        tag: 'Manager',
        summary: 'Approve user',
        security: bearerSecurity,
        parameters: [pathParam('userId', 'User id')],
      }),
    },
    '/api/manager/users/{userId}/reject': {
      delete: endpoint({
        tag: 'Manager',
        summary: 'Reject user',
        security: bearerSecurity,
        parameters: [pathParam('userId', 'User id')],
      }),
    },
    '/api/manager/sellers': {
      get: endpoint({
        tag: 'Manager',
        summary: 'List sellers',
        security: bearerSecurity,
      }),
    },
    '/api/manager/sellers/{userId}/status': {
      patch: endpoint({
        tag: 'Manager',
        summary: 'Update seller status',
        security: bearerSecurity,
        parameters: [pathParam('userId', 'Seller id')],
        requestBody: body(),
      }),
    },
    '/api/manager/sellers/{userId}': {
      delete: endpoint({
        tag: 'Manager',
        summary: 'Delete seller',
        security: bearerSecurity,
        parameters: [pathParam('userId', 'Seller id')],
      }),
    },
    '/api/manager/gym-owners': {
      get: endpoint({
        tag: 'Manager',
        summary: 'List gym owners',
        security: bearerSecurity,
      }),
    },
    '/api/manager/gym-owners/{userId}/status': {
      patch: endpoint({
        tag: 'Manager',
        summary: 'Update gym owner status',
        security: bearerSecurity,
        parameters: [pathParam('userId', 'Gym owner id')],
        requestBody: body(),
      }),
    },
    '/api/manager/gym-owners/{userId}': {
      delete: endpoint({
        tag: 'Manager',
        summary: 'Delete gym owner',
        security: bearerSecurity,
        parameters: [pathParam('userId', 'Gym owner id')],
      }),
    },
    '/api/manager/users/{userId}': {
      get: endpoint({
        tag: 'Manager',
        summary: 'Read manager user detail view',
        security: bearerSecurity,
        parameters: [pathParam('userId', 'User id')],
      }),
    },
    '/api/manager/gyms': {
      get: endpoint({
        tag: 'Manager',
        summary: 'List gyms for manager review',
        security: bearerSecurity,
      }),
    },
    '/api/manager/gyms/{gymId}': {
      get: endpoint({
        tag: 'Manager',
        summary: 'Read manager gym detail view',
        security: bearerSecurity,
        parameters: [pathParam('gymId', 'Gym id')],
      }),
      delete: endpoint({
        tag: 'Manager',
        summary: 'Delete gym as manager',
        security: bearerSecurity,
        parameters: [pathParam('gymId', 'Gym id')],
      }),
    },
    '/api/manager/marketplace': {
      get: endpoint({
        tag: 'Manager',
        summary: 'Read manager marketplace summary',
        security: bearerSecurity,
      }),
    },
    '/api/manager/products': {
      get: endpoint({
        tag: 'Manager',
        summary: 'List products for manager review',
        security: bearerSecurity,
      }),
    },
    '/api/manager/products/{productId}': {
      get: endpoint({
        tag: 'Manager',
        summary: 'Read product buyer detail view',
        security: bearerSecurity,
        parameters: [pathParam('productId', 'Product id')],
      }),
      delete: endpoint({
        tag: 'Manager',
        summary: 'Delete product as manager',
        security: bearerSecurity,
        parameters: [pathParam('productId', 'Product id')],
      }),
    },
    '/api/owner/monetisation/options': {
      get: endpoint({ tag: 'Owner', summary: 'List monetisation options', security: bearerSecurity }),
    },
    '/api/owner/subscriptions/checkout': {
      post: endpoint({
        tag: 'Owner',
        summary: 'Create listing subscription checkout',
        security: bearerSecurity,
        requestBody: body('GenericBody', false),
      }),
    },
    '/api/owner/sponsorships/purchase': {
      post: endpoint({
        tag: 'Owner',
        summary: 'Purchase sponsorship',
        security: bearerSecurity,
        requestBody: body('GenericBody', false),
      }),
    },
    '/api/owner/trainers/requests': {
      get: endpoint({ tag: 'Owner', summary: 'List trainer requests', security: bearerSecurity }),
    },
    '/api/owner/trainers/requests/{assignmentId}/approve': {
      post: endpoint({
        tag: 'Owner',
        summary: 'Approve trainer request',
        security: bearerSecurity,
        parameters: [pathParam('assignmentId', 'Assignment id')],
      }),
    },
    '/api/owner/trainers/requests/{assignmentId}/decline': {
      post: endpoint({
        tag: 'Owner',
        summary: 'Decline trainer request',
        security: bearerSecurity,
        parameters: [pathParam('assignmentId', 'Assignment id')],
      }),
    },
    '/api/owner/trainers/{assignmentId}': {
      delete: endpoint({
        tag: 'Owner',
        summary: 'Remove trainer from gym',
        security: bearerSecurity,
        parameters: [pathParam('assignmentId', 'Assignment id')],
      }),
    },
    '/api/owner/memberships/{membershipId}': {
      delete: endpoint({
        tag: 'Owner',
        summary: 'Remove gym member',
        security: bearerSecurity,
        parameters: [pathParam('membershipId', 'Membership id')],
      }),
    },
    '/api/marketplace/products': {
      get: endpoint({
        tag: 'Marketplace',
        summary: 'List marketplace products',
        description: 'Indexed text search with Meilisearch fallback, stale-while-revalidate caching, ETag, and Last-Modified headers.',
        parameters: [
          queryParam('search', 'Keyword search'),
          queryParam('category', 'Category filter'),
          queryParam('minPrice', 'Minimum price', 'number'),
          queryParam('maxPrice', 'Maximum price', 'number'),
          queryParam('inStock', 'In-stock filter', 'boolean'),
          queryParam('sort', 'Sort mode'),
          queryParam('pagination', 'Set to `cursor` to enable cursor-based pagination for browse results'),
          queryParam('cursor', 'Opaque cursor returned from a previous browse response'),
          queryParam('page', 'Page number', 'integer'),
          queryParam('pageSize', 'Page size', 'integer'),
        ],
      }),
    },
    '/api/marketplace/products/{productId}': {
      get: endpoint({
        tag: 'Marketplace',
        summary: 'Get marketplace product',
        parameters: [pathParam('productId', 'Product id')],
      }),
    },
    '/api/marketplace/promos/public': {
      get: endpoint({
        tag: 'Marketplace',
        summary: 'List public marketplace promo codes',
      }),
    },
    '/api/marketplace/pricing': {
      post: endpoint({
        tag: 'Marketplace',
        summary: 'Preview marketplace pricing',
        security: bearerSecurity,
        requestBody: body(),
      }),
    },
    '/api/marketplace/orders': {
      post: endpoint({
        tag: 'Marketplace',
        summary: 'Create marketplace order',
        security: bearerSecurity,
        requestBody: body(),
        created: true,
      }),
    },
    '/api/marketplace/checkout/create-session': {
      post: endpoint({
        tag: 'Marketplace',
        summary: 'Create marketplace checkout session',
        security: bearerSecurity,
        requestBody: body(),
        created: true,
      }),
    },
    '/api/marketplace/checkout/order/{sessionId}': {
      get: endpoint({
        tag: 'Marketplace',
        summary: 'Resolve marketplace order by Stripe checkout session',
        security: bearerSecurity,
        parameters: [pathParam('sessionId', 'Stripe checkout session id')],
      }),
    },
    '/api/marketplace/webhook/stripe': {
      post: endpoint({
        tag: 'Marketplace',
        summary: 'Receive Stripe marketplace webhook',
        requestBody: body('GenericBody', false),
      }),
    },
    '/api/marketplace/products/{productId}/reviews': {
      post: endpoint({
        tag: 'Marketplace',
        summary: 'Create marketplace review',
        security: bearerSecurity,
        parameters: [pathParam('productId', 'Product id')],
        requestBody: body(),
        created: true,
      }),
    },
    '/api/marketplace/orders/{orderId}/items/{itemId}/return': {
      post: endpoint({
        tag: 'Marketplace',
        summary: 'Request item return',
        security: bearerSecurity,
        parameters: [pathParam('orderId', 'Order id'), pathParam('itemId', 'Order item id')],
        requestBody: body(),
      }),
    },
    '/api/marketplace/promos': {
      get: endpoint({
        tag: 'Marketplace',
        summary: 'List marketplace promo codes',
        security: bearerSecurity,
      }),
      post: endpoint({
        tag: 'Marketplace',
        summary: 'Create marketplace promo code',
        security: bearerSecurity,
        requestBody: body(),
        created: true,
      }),
    },
    '/api/marketplace/promos/{promoId}': {
      patch: endpoint({
        tag: 'Marketplace',
        summary: 'Update marketplace promo code',
        security: bearerSecurity,
        parameters: [pathParam('promoId', 'Promo code id')],
        requestBody: body(),
      }),
    },
    '/api/marketplace/seller/products': {
      get: endpoint({ tag: 'Marketplace', summary: 'List seller products', security: bearerSecurity }),
      post: endpoint({
        tag: 'Marketplace',
        summary: 'Create seller product',
        security: bearerSecurity,
        requestBody: body('MultipartBody', true, 'multipart/form-data'),
        created: true,
      }),
    },
    '/api/marketplace/seller/products/{productId}': {
      get: endpoint({
        tag: 'Marketplace',
        summary: 'Get seller product',
        security: bearerSecurity,
        parameters: [pathParam('productId', 'Product id')],
      }),
      put: endpoint({
        tag: 'Marketplace',
        summary: 'Update seller product',
        security: bearerSecurity,
        parameters: [pathParam('productId', 'Product id')],
        requestBody: body('MultipartBody', true, 'multipart/form-data'),
      }),
      delete: endpoint({
        tag: 'Marketplace',
        summary: 'Delete seller product',
        security: bearerSecurity,
        parameters: [pathParam('productId', 'Product id')],
      }),
    },
    '/api/marketplace/seller/orders': {
      get: endpoint({ tag: 'Marketplace', summary: 'List seller orders', security: bearerSecurity }),
    },
    '/api/marketplace/seller/orders/{orderId}/items/{itemId}/status': {
      patch: endpoint({
        tag: 'Marketplace',
        summary: 'Update seller order status',
        security: bearerSecurity,
        parameters: [pathParam('orderId', 'Order id'), pathParam('itemId', 'Item id or all')],
        requestBody: body(),
      }),
    },
    '/api/marketplace/seller/orders/{orderId}/items/{itemId}/tracking': {
      patch: endpoint({
        tag: 'Marketplace',
        summary: 'Update seller tracking',
        security: bearerSecurity,
        parameters: [pathParam('orderId', 'Order id'), pathParam('itemId', 'Item id')],
        requestBody: body(),
      }),
    },
    '/api/marketplace/seller/orders/{orderId}/items/{itemId}/return': {
      patch: endpoint({
        tag: 'Marketplace',
        summary: 'Review return request',
        security: bearerSecurity,
        parameters: [pathParam('orderId', 'Order id'), pathParam('itemId', 'Item id')],
        requestBody: body(),
      }),
    },
    '/api/marketplace/seller/orders/{orderId}/settle': {
      patch: endpoint({
        tag: 'Marketplace',
        summary: 'Settle seller order',
        security: bearerSecurity,
        parameters: [pathParam('orderId', 'Order id')],
      }),
    },
    '/api/users/profile': {
      get: endpoint({ tag: 'Users', summary: 'Get profile', security: bearerSecurity }),
      patch: endpoint({
        tag: 'Users',
        summary: 'Update profile',
        security: bearerSecurity,
        requestBody: body('MultipartBody', true, 'multipart/form-data'),
      }),
    },
    '/api/users/notifications': {
      get: endpoint({
        tag: 'Users',
        summary: 'List my notifications',
        security: bearerSecurity,
        parameters: [
          queryParam('limit', 'Result limit', 'integer'),
          queryParam('unreadOnly', 'Unread only', 'boolean'),
        ],
      }),
    },
    '/api/users/notifications/read': {
      patch: endpoint({
        tag: 'Users',
        summary: 'Mark notifications read',
        security: bearerSecurity,
        requestBody: body(),
      }),
    },
    '/api/users/recommendations': {
      get: endpoint({
        tag: 'Users',
        summary: 'Get personalized recommendations',
        security: bearerSecurity,
      }),
    },
    '/api/communications/recipients': {
      get: endpoint({
        tag: 'Communications',
        summary: 'List internal communication recipients',
        security: bearerSecurity,
      }),
    },
    '/api/communications': {
      get: endpoint({
        tag: 'Communications',
        summary: 'List internal conversations',
        security: bearerSecurity,
      }),
      post: endpoint({
        tag: 'Communications',
        summary: 'Create internal conversation',
        security: bearerSecurity,
        requestBody: body(),
        created: true,
      }),
    },
    '/api/communications/{id}/reply': {
      post: endpoint({
        tag: 'Communications',
        summary: 'Reply to internal conversation',
        security: bearerSecurity,
        parameters: [pathParam('id', 'Conversation id')],
        requestBody: body(),
      }),
    },
    '/api/communications/{id}/state': {
      patch: endpoint({
        tag: 'Communications',
        summary: 'Update internal conversation state',
        security: bearerSecurity,
        parameters: [pathParam('id', 'Conversation id')],
        requestBody: body(),
      }),
    },
    '/api/contact': {
      post: endpoint({ tag: 'Contact', summary: 'Submit contact message', requestBody: body(), created: true }),
      get: endpoint({
        tag: 'Contact',
        summary: 'List contact messages',
        security: bearerSecurity,
        parameters: [queryParam('status', 'Status filter')],
      }),
    },
    '/api/contact/mine': {
      get: endpoint({
        tag: 'Contact',
        summary: 'List my contact messages',
        security: bearerSecurity,
      }),
    },
    '/api/contact/{id}/status': {
      patch: endpoint({
        tag: 'Contact',
        summary: 'Update contact status',
        security: bearerSecurity,
        parameters: [pathParam('id', 'Contact id')],
        requestBody: body(),
      }),
    },
    '/api/contact/{id}/assign': {
      patch: endpoint({
        tag: 'Contact',
        summary: 'Assign contact message',
        security: bearerSecurity,
        parameters: [pathParam('id', 'Contact id')],
        requestBody: body(),
      }),
    },
    '/api/contact/{id}/reply': {
      post: endpoint({
        tag: 'Contact',
        summary: 'Reply to or continue a support ticket conversation',
        security: bearerSecurity,
        parameters: [pathParam('id', 'Contact id')],
        requestBody: body(),
      }),
    },
    '/payments/success': {
      get: endpoint({
        tag: 'Payments',
        summary: 'Payment success redirect',
        parameters: [queryParam('session_id', 'Payment session id')],
      }),
    },
    '/payments/cancelled': {
      get: endpoint({ tag: 'Payments', summary: 'Payment cancelled redirect' }),
    },
    '/api/payments/checkout/{sessionId}': {
      get: endpoint({
        tag: 'Payments',
        summary: 'Resolve generic payment checkout session',
        security: bearerSecurity,
        parameters: [pathParam('sessionId', 'Stripe checkout session id')],
      }),
    },
    '/api/payments/webhook/stripe': {
      post: endpoint({
        tag: 'Payments',
        summary: 'Receive generic Stripe webhook',
        requestBody: body('GenericBody', false),
      }),
    },
  },
});

export const renderSwaggerUiHtml = ({
  swaggerJsonUrl = '/api/docs/openapi.json',
  swaggerAssetBase = '/api/docs/static',
} = {}) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>FitSync API Docs</title>
    <link rel="stylesheet" href="${swaggerAssetBase}/swagger-ui.css" />
    <style>body{margin:0;background:#0f172a}.topbar{display:none}</style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="${swaggerAssetBase}/swagger-ui-bundle.js"></script>
    <script src="${swaggerAssetBase}/swagger-ui-standalone-preset.js"></script>
    <script>
      window.addEventListener('load', function () {
        window.ui = window.SwaggerUIBundle({
          url: '${swaggerJsonUrl}',
          dom_id: '#swagger-ui',
          presets: [window.SwaggerUIBundle.presets.apis, window.SwaggerUIStandalonePreset],
          layout: 'StandaloneLayout',
          deepLinking: true,
          persistAuthorization: true
        });
      });
    </script>
  </body>
</html>`;
