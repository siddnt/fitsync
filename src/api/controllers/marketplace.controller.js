import mongoose from 'mongoose';
import Product from '../../models/product.model.js';
import Order from '../../models/order.model.js';
import Revenue from '../../models/revenue.model.js';
import ProductReview from '../../models/productReview.model.js';
import PaymentSession from '../../models/paymentSession.model.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { uploadOnCloudinary } from '../../utils/fileUpload.js';
import stripe from '../../services/stripe.service.js';
import {
  buildCacheKey,
  getOrSetCache,
  invalidateCacheByTags,
  shouldBypassCache,
} from '../../services/cache.service.js';
import {
  buildNextProductSalesMetrics,
  getProductReviewSnapshot,
  getProductSalesSnapshot,
} from '../../services/productMetrics.service.js';
import { enqueueOutboxEvents } from '../../services/outbox.service.js';
import {
  searchProductIndex,
} from '../../services/search.service.js';
import { applyPublicCacheHeaders } from '../../utils/httpCache.js';
import { recordAuditLog } from '../../services/audit.service.js';
import { createNotifications } from '../../services/notification.service.js';
import {
  buildCursorFilter,
  buildCursorSortStage,
  encodeCursorToken,
} from '../../utils/cursorPagination.js';

const toObjectId = (value, label) => {
  if (!value) {
    throw new ApiError(400, `${label} is required.`);
  }
  try {
    return new mongoose.Types.ObjectId(value);
  } catch (_error) {
    throw new ApiError(400, `${label} is invalid.`);
  }
};

const SELLER_PAYOUT_RATE = 0.85;

const MODERN_ITEM_STATUSES = ['processing', 'in-transit', 'out-for-delivery', 'delivered'];
const LEGACY_STATUS_FALLBACKS = new Map([
  ['placed', 'processing'],
  ['cancelled', 'processing'],
  ['shipped', 'in-transit'],
]);

const normaliseItemStatus = (status) => {
  if (!status) {
    return 'processing';
  }

  const lower = String(status).trim().toLowerCase();
  if (MODERN_ITEM_STATUSES.includes(lower)) {
    return lower;
  }

  if (LEGACY_STATUS_FALLBACKS.has(lower)) {
    return LEGACY_STATUS_FALLBACKS.get(lower);
  }

  return 'processing';
};

const TRACKING_STATUS_INPUT_ALIASES = new Map([
  ['preparing', 'processing'],
  ['label-created', 'processing'],
]);

const normaliseTrackingStatusInput = (status) => {
  if (status === undefined || status === null || String(status).trim() === '') {
    return 'in-transit';
  }

  const lower = String(status).trim().toLowerCase();
  if (TRACKING_STATUS_INPUT_ALIASES.has(lower)) {
    return TRACKING_STATUS_INPUT_ALIASES.get(lower);
  }

  if (MODERN_ITEM_STATUSES.includes(lower)) {
    return lower;
  }

  return null;
};

const SELLER_STATUS_FLAGS = new Set(MODERN_ITEM_STATUSES);
const STATUS_SEQUENCE = [...MODERN_ITEM_STATUSES];
const STATUS_INDEX = STATUS_SEQUENCE.reduce((acc, status, index) => {
  acc[status] = index;
  return acc;
}, {});

const ORDER_NUMBER_PREFIX = 'FS';
const MARKETPLACE_LIST_PRODUCT_SELECT = 'name description price mrp image category stock status isPublished createdAt updatedAt seller metrics';
const MARKETPLACE_DETAIL_PRODUCT_SELECT = 'name description price mrp image category stock status isPublished updatedAt seller metrics';
const MARKETPLACE_ORDER_PRODUCT_SELECT = 'seller name price image stock status isPublished metrics';
const MARKETPLACE_SELLER_SELECT = 'name firstName lastName email role';
const MARKETPLACE_REVIEW_SELECT = 'rating title comment createdAt isVerifiedPurchase user';
const MARKETPLACE_REVIEW_USER_SELECT = 'name profilePicture role';

const ensureSellerActive = (user) => {
  if (!user) {
    throw new ApiError(401, 'Sign in to view your seller workspace.');
  }

  if (user.role === 'admin') {
    return;
  }

  if (user.status !== 'active') {
    throw new ApiError(403, 'Your seller account is awaiting admin approval.');
  }
};

const CUSTOMER_ROLES = new Set(['user', 'trainee']);

const ensureMarketplaceBuyerEligible = (user) => {
  if (!user) {
    throw new ApiError(401, 'Sign in to place marketplace orders.');
  }

  if (!CUSTOMER_ROLES.has(user.role)) {
    throw new ApiError(403, 'Only customer accounts can place marketplace orders.');
  }

  if (user.status !== 'active') {
    throw new ApiError(403, 'Activate your account before placing marketplace orders.');
  }
};

const parseBoolean = (value, defaultValue = false) => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalised = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalised)) {
      return true;
    }
    if (['false', '0', 'no', 'off'].includes(normalised)) {
      return false;
    }
    return defaultValue;
  }
  if (typeof value === 'number') {
    if (Number.isNaN(value)) {
      return defaultValue;
    }
    if (value === 0) {
      return false;
    }
    return value !== 0;
  }
  return defaultValue;
};

const toNumber = (value, fallback) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
};

const PRODUCT_CATEGORIES = new Set(['supplements', 'equipment', 'clothing', 'accessories']);

const normaliseCategory = (value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const lower = value.trim().toLowerCase();
  if (lower === 'apparel') {
    return 'clothing';
  }
  if (lower === 'nutrition') {
    return 'supplements';
  }
  return lower;
};

const formatCategoryLabel = (value) => String(value ?? '')
  .split(/[\s-_]+/)
  .filter(Boolean)
  .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
  .join(' ');

const buildMarketplaceCategoryOptions = async (baseFilters = {}) => {
  const categoryFilters = { ...baseFilters };
  delete categoryFilters.category;

  const categories = await Product.aggregate([
    { $match: categoryFilters },
    { $match: { category: { $ne: null } } },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return categories.map((entry) => ({
    value: entry._id,
    label: formatCategoryLabel(entry._id),
    count: entry.count,
  }));
};

const normalizeSearchTerm = (value) => String(value ?? '').trim().replace(/\s+/g, ' ');

const canTransitionStatus = (currentStatus, nextStatus) => {
  const current = normaliseItemStatus(currentStatus);
  const next = normaliseItemStatus(nextStatus);

  if (current === next) {
    return true;
  }

  if (current === 'delivered') {
    return false;
  }

  const currentIndex = STATUS_INDEX[current] ?? -1;
  const nextIndex = STATUS_INDEX[next] ?? -1;

  return nextIndex >= currentIndex && nextIndex !== -1;
};

// Returns an integer discount percentage bounded between 0 and 100.
export const computeDiscountPercentage = (mrp, price) => {
  const mrpValue = Number(mrp);
  const priceValue = Number(price);

  if (!Number.isFinite(mrpValue) || mrpValue <= 0) {
    return 0;
  }

  if (!Number.isFinite(priceValue) || priceValue <= 0) {
    return 0;
  }

  if (priceValue >= mrpValue) {
    return 0;
  }

  const discount = Math.round(((mrpValue - priceValue) / mrpValue) * 100);
  return Math.min(100, Math.max(0, discount));
};

const mapProduct = (product) => ({
  id: product._id,
  name: product.name,
  description: product.description,
  price: product.price,
  mrp: product.mrp ?? product.price,
  discountPercentage: computeDiscountPercentage(product.mrp ?? product.price, product.price),
  image: product.image,
  category: product.category,
  stock: product.stock,
  status: product.status,
  isPublished: product.isPublished,
  createdAt: product.createdAt,
  updatedAt: product.updatedAt,
});

const applyCacheHeaders = (res, meta = {}) => {
  res.set('X-Cache', String(meta.state ?? 'miss').toUpperCase());
  res.set('X-Cache-Provider', meta.provider ?? 'memory');
};

const buildMarketplaceCacheTags = ({ productId, productIds = [] } = {}) => {
  const tags = new Set(['marketplace:catalogue']);

  [productId, ...productIds]
    .filter(Boolean)
    .forEach((value) => tags.add(`marketplace:product:${value}`));

  return Array.from(tags);
};

const invalidateMarketplaceCaches = async ({ productId, productIds = [] } = {}) =>
  invalidateCacheByTags(buildMarketplaceCacheTags({ productId, productIds }));

const buildMarketplaceOutboxEvents = ({ productId, productIds = [], deleted = false } = {}) =>
  buildMarketplaceCacheTags({ productId, productIds })
    .filter((tag) => tag !== 'marketplace:catalogue' || productId || productIds.length)
    .reduce((events, _tag, index, source) => {
      if (index === 0) {
        events.push({
          topic: 'product.cache.invalidate',
          aggregateType: 'product',
          aggregateId: String(productId ?? productIds[0] ?? 'catalogue'),
          payload: {
            tags: buildMarketplaceCacheTags({ productId, productIds }),
          },
        });
      }

      return events;
    }, []).concat(
      [...new Set([productId, ...productIds].filter(Boolean).map(String))].map((id) => ({
        topic: deleted ? 'product.search.delete' : 'product.search.upsert',
        aggregateType: 'product',
        aggregateId: id,
        payload: {},
      })),
    );

const mapCatalogueProduct = (product) => {
  const sellerDoc = product.seller ?? null;
  let sellerName = null;

  if (sellerDoc) {
    const fullName = [sellerDoc.firstName, sellerDoc.lastName].filter(Boolean).join(' ').trim();
    sellerName = sellerDoc.name ?? (fullName || null) ?? sellerDoc.email ?? null;
  }

  return {
    id: product._id,
    name: product.name,
    description: product.description,
    price: product.price,
    mrp: product.mrp ?? product.price,
    discountPercentage: computeDiscountPercentage(product.mrp ?? product.price, product.price),
    image: product.image,
    category: product.category,
    stock: product.stock,
    status: product.status,
    isPublished: product.isPublished,
    updatedAt: product.updatedAt,
    seller: sellerDoc
      ? {
        id: sellerDoc._id,
        name: sellerName,
        role: sellerDoc.role ?? null,
      }
      : null,
  };
};

const toIdString = (value) => (value ? value.toString() : null);

const buildTrackingSnapshot = (item = {}) => {
  if (!item?.tracking) {
    return null;
  }

  return {
    ...item.tracking,
    status: normaliseItemStatus(item.status),
  };
};

const buildReturnRequestSnapshot = (item = {}) => item?.returnRequest ?? { status: 'none' };

const shapeMarketplaceProduct = (product) => {
  const base = mapCatalogueProduct(product);
  const salesStats = getProductSalesSnapshot(product);
  const reviewStats = getProductReviewSnapshot(product);

  return {
    ...base,
    stats: {
      soldLast30Days: salesStats.soldLast30Days,
      totalSold: salesStats.totalSold,
      inStock: product.stock > 0 && product.status === 'available',
    },
    reviews: {
      count: reviewStats.count,
      averageRating: reviewStats.averageRating,
    },
  };
};

const orderProductsByIds = (products = [], ids = []) => {
  const orderMap = new Map(ids.map((id, index) => [String(id), index]));
  return [...products].sort((left, right) =>
    (orderMap.get(String(left._id)) ?? Number.MAX_SAFE_INTEGER)
      - (orderMap.get(String(right._id)) ?? Number.MAX_SAFE_INTEGER));
};

const resolveMarketplaceLastModified = (products = []) =>
  products.reduce((latest, product) => {
    const updatedAt = new Date(product.updatedAt ?? 0).getTime();
    return Math.max(latest, Number.isNaN(updatedAt) ? 0 : updatedAt);
  }, 0);

const buildMarketplaceCollectionVersion = (products = [], pagination = {}, searchStrategy = 'browse', categories = []) =>
  JSON.stringify({
    ids: products.map((product) => String(product.id ?? product._id)),
    updatedAt: products.map((product) => product.updatedAt ?? null),
    total: pagination.total ?? products.length,
    page: pagination.page ?? 1,
    pageSize: pagination.pageSize ?? products.length,
    searchStrategy,
    categories,
  });

const buildMarketplaceDetailVersion = (product) =>
  JSON.stringify({
    id: String(product?.id ?? product?._id ?? ''),
    updatedAt: product?.updatedAt ?? null,
    reviewCount: product?.reviews?.count ?? 0,
    reviewItems: (product?.reviews?.items ?? []).map((review) => ({
      id: review.id,
      createdAt: review.createdAt,
    })),
  });

const MARKETPLACE_CURSOR_SORT_FIELDS = {
  featured: [
    { field: 'updatedAt', order: -1, type: 'date' },
    { field: '_id', order: -1, type: 'objectId' },
  ],
  newest: [
    { field: 'createdAt', order: -1, type: 'date' },
    { field: '_id', order: -1, type: 'objectId' },
  ],
  priceLow: [
    { field: 'price', order: 1, type: 'number' },
    { field: '_id', order: 1, type: 'objectId' },
  ],
  priceHigh: [
    { field: 'price', order: -1, type: 'number' },
    { field: '_id', order: -1, type: 'objectId' },
  ],
};

const SELLER_PRODUCT_CURSOR_SORT_FIELDS = [
  { field: 'updatedAt', order: -1, type: 'date' },
  { field: '_id', order: -1, type: 'objectId' },
];

const SELLER_ORDER_CURSOR_SORT_FIELDS = [
  { field: 'createdAt', order: -1, type: 'date' },
  { field: '_id', order: -1, type: 'objectId' },
];

const recalculateProductReviewMetrics = async (productId, { session } = {}) => {
  const productObjectId = toObjectId(productId, 'Product id');
  const [stats] = await ProductReview.aggregate([
    { $match: { product: productObjectId } },
    {
      $group: {
        _id: '$product',
        count: { $sum: 1 },
        averageRating: { $avg: '$rating' },
        lastReviewedAt: { $max: '$updatedAt' },
      },
    },
  ]).session(session ?? null);

  const count = Number(stats?.count ?? 0) || 0;
  const averageRating = Number(stats?.averageRating ?? 0);

  await Product.findByIdAndUpdate(productObjectId, {
    $set: {
      'metrics.reviews.count': count,
      'metrics.reviews.averageRating': averageRating > 0 ? Math.round(averageRating * 10) / 10 : 0,
      'metrics.reviews.lastReviewedAt': stats?.lastReviewedAt ?? null,
    },
  }, { session });
};

const reserveInventoryForMarketplaceOrder = async (preparedItems = [], { session } = {}) => {
  const reservations = [];

  try {
    for (const { productId, quantity } of preparedItems) {
      // eslint-disable-next-line no-await-in-loop
      const reservedProduct = await Product.findOneAndUpdate(
        {
          _id: productId,
          isPublished: true,
          status: 'available',
          stock: { $gte: quantity },
        },
        [
          {
            $set: {
              stock: { $subtract: ['$stock', quantity] },
              status: {
                $cond: [
                  { $lte: [{ $subtract: ['$stock', quantity] }, 0] },
                  'out-of-stock',
                  '$status',
                ],
              },
            },
          },
        ],
        { new: true, session },
      )
        .select(MARKETPLACE_ORDER_PRODUCT_SELECT)
        .lean();

      if (!reservedProduct) {
        throw new ApiError(400, 'One or more products are unavailable in the requested quantity.');
      }

      reservations.push({
        product: reservedProduct,
        quantity,
      });
    }

    return reservations;
  } catch (error) {
    if (reservations.length) {
      await Product.bulkWrite(
        reservations.map(({ product, quantity }) => ({
          updateOne: {
            filter: { _id: product._id },
            update: [
              {
                $set: {
                  stock: { $add: ['$stock', quantity] },
                  status: {
                    $cond: [
                      { $gt: [{ $add: ['$stock', quantity] }, 0] },
                      'available',
                      '$status',
                    ],
                  },
                },
              },
            ],
          },
        })),
        { ordered: false, session },
      );
    }

    throw error;
  }
};

const releaseMarketplaceInventoryReservations = async (reservations = [], { session } = {}) => {
  if (!reservations.length) {
    return;
  }

  await Product.bulkWrite(
    reservations.map(({ product, quantity }) => ({
      updateOne: {
        filter: { _id: product._id },
        update: [
          {
            $set: {
              stock: { $add: ['$stock', quantity] },
              status: {
                $cond: [
                  { $gt: [{ $add: ['$stock', quantity] }, 0] },
                  'available',
                  '$status',
                ],
              },
            },
          },
        ],
      },
    })),
    { ordered: false, session },
  );
};

const updateDeliveredProductSalesMetrics = async (deliveredItems = [], deliveredAt = new Date(), { session } = {}) => {
  if (!deliveredItems.length) {
    return;
  }

  const groupedQuantities = deliveredItems.reduce((acc, item) => {
    const productId = toIdString(item.product?._id ?? item.product);
    if (!productId) {
      return acc;
    }

    acc.set(productId, (acc.get(productId) ?? 0) + Number(item.quantity ?? 0));
    return acc;
  }, new Map());

  if (!groupedQuantities.size) {
    return;
  }

  const products = await Product.find({ _id: { $in: Array.from(groupedQuantities.keys()) } })
    .select('_id metrics')
    .session(session ?? null)
    .lean();

  if (!products.length) {
    return;
  }

  await Product.bulkWrite(
    products.map((product) => {
      const quantity = groupedQuantities.get(String(product._id)) ?? 0;
      const nextSalesMetrics = buildNextProductSalesMetrics(product.metrics?.sales, quantity, deliveredAt);

      return {
        updateOne: {
          filter: { _id: product._id },
          update: {
            $set: {
              'metrics.sales.totalSold': nextSalesMetrics.totalSold,
              'metrics.sales.lastSoldAt': nextSalesMetrics.lastSoldAt,
              'metrics.sales.recentDaily': nextSalesMetrics.recentDaily,
            },
          },
        },
      };
    }),
    { ordered: false, session },
  );

  await enqueueOutboxEvents(buildMarketplaceOutboxEvents({ productIds: products.map((product) => product._id) }), { session });
};

const resolveCatalogueSort = (sort, searchStrategy) => {
  if (sort === 'priceLow') {
    return { price: 1, updatedAt: -1 };
  }

  if (sort === 'priceHigh') {
    return { price: -1, updatedAt: -1 };
  }

  if (sort === 'newest') {
    return { createdAt: -1 };
  }

  if (searchStrategy === 'text') {
    return { score: { $meta: 'textScore' }, updatedAt: -1 };
  }

  return { updatedAt: -1 };
};

const resolveCatalogueSearchPlan = async (baseFilters, search, sort, { offset = 0, limit = 24 } = {}) => {
  const normalizedSearch = normalizeSearchTerm(search);
  if (!normalizedSearch) {
    return {
      filters: baseFilters,
      total: null,
      searchStrategy: 'browse',
      sortStage: resolveCatalogueSort(sort, 'browse'),
    };
  }

  const textFilters = {
    ...baseFilters,
    $text: { $search: normalizedSearch },
  };
  const textTotal = await Product.countDocuments(textFilters);

  if (textTotal > 0) {
    return {
      filters: textFilters,
      total: textTotal,
      searchStrategy: 'text',
      sortStage: resolveCatalogueSort(sort, 'text'),
    };
  }

  const external = await searchProductIndex(normalizedSearch, {
    category: baseFilters.category,
    minPrice: baseFilters.price?.$gte,
    maxPrice: baseFilters.price?.$lte,
    inStock: Boolean(baseFilters.stock?.$gt === 0 || baseFilters.status === 'available'),
    sort,
    offset,
    limit,
  });

  return {
    filters: external.ids.length ? { _id: { $in: external.ids } } : { _id: { $in: [] } },
    total: external.total,
    searchStrategy: external.provider === 'meilisearch' ? 'meilisearch' : 'no-match',
    sortStage: resolveCatalogueSort(sort, 'browse'),
    orderedIds: external.ids,
  };
};

const prepareMarketplaceOrderItems = (items = []) => {
  const preparedItems = new Map();

  items.forEach((item, index) => {
    const quantity = Number(item?.quantity ?? 0);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new ApiError(400, `Quantity for item ${index + 1} is invalid.`);
    }

    const productId = toObjectId(item?.productId ?? item?.id, 'Product id');
    const key = toIdString(productId);
    const existing = preparedItems.get(key);

    if (existing) {
      existing.quantity += quantity;
      return;
    }

    preparedItems.set(key, { productId, quantity });
  });

  return Array.from(preparedItems.values());
};

const mapBuyerOrder = (order) => ({
  id: order._id,
  orderNumber: order.orderNumber,
  subtotal: order.subtotal,
  tax: order.tax,
  shippingCost: order.shippingCost,
  total: order.total,
  status: deriveSellerOrderStatus(order.orderItems || []),
  paymentMethod: order.paymentMethod,
  createdAt: order.createdAt,
    items: (order.orderItems || []).map((item) => ({
      id: item.product?._id ?? item.product,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      image: item.image ?? item.product?.image ?? null,
      status: normaliseItemStatus(item.status),
      tracking: buildTrackingSnapshot(item),
      returnRequest: buildReturnRequestSnapshot(item),
    })),
  shippingAddress: order.shippingAddress,
});

const generateOrderNumber = async () => {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const candidate = `${ORDER_NUMBER_PREFIX}-${year}${month}${day}-${randomDigits}`;
    // eslint-disable-next-line no-await-in-loop
    const existing = await Order.exists({ orderNumber: candidate });
    if (!existing) {
      return candidate;
    }
  }

  return `${ORDER_NUMBER_PREFIX}-${Date.now()}`;
};

const buildMarketplaceOrderItemsFromSnapshot = (orderSnapshot = {}, initialStatusTimestamp = new Date()) => (
  (orderSnapshot.items ?? []).map((item) => ({
    seller: item.seller ?? undefined,
    product: item.product,
    name: item.name,
    quantity: item.quantity,
    price: item.price,
    image: item.image,
    status: 'processing',
    lastStatusAt: initialStatusTimestamp,
    statusHistory: [{
      status: 'processing',
      note: null,
      updatedBy: null,
      updatedAt: initialStatusTimestamp,
    }],
  }))
);

const BUYER_ORDER_NOTIFICATION_LINK = '/dashboard/trainee/orders';
const SELLER_ORDER_NOTIFICATION_LINK = '/dashboard/seller/orders';

const buildMarketplaceOrderNotifications = (order) => {
  if (!order?._id) {
    return [];
  }

  const notifications = [];
  const buyerId = order.user?._id ?? order.user;
  const orderNumber = order.orderNumber ?? order._id;
  const orderItems = Array.isArray(order.orderItems) ? order.orderItems : [];

  if (buyerId) {
    notifications.push({
      user: buyerId,
      type: 'order-placed',
      title: 'Order placed successfully',
      message: `Your order ${orderNumber} has been placed successfully.`,
      link: BUYER_ORDER_NOTIFICATION_LINK,
      metadata: {
        orderId: order._id,
        orderNumber,
        lineItems: orderItems.length,
        total: order.total ?? 0,
      },
    });
  }

  const sellerSummaries = orderItems.reduce((acc, item) => {
    const sellerId = item?.seller?._id ?? item?.seller;
    if (!sellerId) {
      return acc;
    }

    const key = String(sellerId);
    const existing = acc.get(key) ?? {
      sellerId,
      lineItems: 0,
      units: 0,
    };

    existing.lineItems += 1;
    existing.units += Number(item?.quantity ?? 0) || 0;
    acc.set(key, existing);
    return acc;
  }, new Map());

  sellerSummaries.forEach((summary) => {
    notifications.push({
      user: summary.sellerId,
      type: 'new-order',
      title: 'New marketplace order',
      message: `Order ${orderNumber} includes ${summary.lineItems} listing${summary.lineItems === 1 ? '' : 's'} and ${summary.units} unit${summary.units === 1 ? '' : 's'} from your catalogue.`,
      link: SELLER_ORDER_NOTIFICATION_LINK,
      metadata: {
        orderId: order._id,
        orderNumber,
        sellerId: summary.sellerId,
        lineItems: summary.lineItems,
        units: summary.units,
      },
    });
  });

  return notifications;
};

const finalizeMarketplacePaymentSession = async ({
  paymentSessionId,
  stripeSessionId,
  paymentIntentId,
  session,
}) => {
  const paymentSession = await PaymentSession.findById(paymentSessionId).session(session);

  if (!paymentSession) {
    throw new ApiError(404, 'Payment session not found.');
  }

  if (paymentSession.orderId) {
    return paymentSession.orderId;
  }

  if (paymentSession.stripe?.status === 'expired') {
    throw new ApiError(400, 'This checkout session has expired.');
  }

  const orderSnapshot = paymentSession.orderSnapshot;
  const snapshotItems = Array.isArray(orderSnapshot?.items) ? orderSnapshot.items : [];

  if (!snapshotItems.length) {
    throw new ApiError(400, 'Unable to finalize an empty payment session.');
  }

  const initialStatusTimestamp = new Date();
  const orderItems = buildMarketplaceOrderItemsFromSnapshot(orderSnapshot, initialStatusTimestamp);

  paymentSession.stripe.checkoutSessionId = stripeSessionId || paymentSession.stripe.checkoutSessionId;
  paymentSession.stripe.paymentIntentId = paymentIntentId || paymentSession.stripe.paymentIntentId;
  paymentSession.stripe.status = 'completed';
  paymentSession.processed = true;
  await paymentSession.save({ session });

  const orderNumber = await generateOrderNumber();
  const [createdOrder] = await Order.create([{
    user: paymentSession.user,
    orderItems,
    shippingAddress: orderSnapshot.shippingAddress,
    paymentMethod: 'Credit / Debit Card',
    subtotal: orderSnapshot.subtotal,
    tax: orderSnapshot.tax,
    shippingCost: orderSnapshot.shippingCost,
    total: orderSnapshot.total,
    orderNumber,
  }], { session });

  await createNotifications(buildMarketplaceOrderNotifications(createdOrder), { session });
  paymentSession.orderId = createdOrder._id;
  await paymentSession.save({ session });

  const productIds = orderItems.map((item) => item.product);
  await enqueueOutboxEvents(buildMarketplaceOutboxEvents({ productIds }), { session });

  return createdOrder._id;
};

export const listMarketplaceCatalogue = asyncHandler(async (req, res) => {
  const {
    search,
    category,
    minPrice,
    maxPrice,
    inStock,
    sort = 'featured',
    page = 1,
    pageSize = 24,
  } = req.query ?? {};
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor.trim() : '';
  const paginationMode = String(req.query.pagination ?? '').trim().toLowerCase();

  const filters = { isPublished: true };

  if (category && category !== 'all') {
    filters.category = normaliseCategory(category);
  }

  if (parseBoolean(inStock, false)) {
    filters.status = 'available';
    filters.stock = { $gt: 0 };
  }

  const minPriceValue = minPrice !== undefined ? toNumber(minPrice, NaN) : NaN;
  const maxPriceValue = maxPrice !== undefined ? toNumber(maxPrice, NaN) : NaN;

  if (Number.isFinite(minPriceValue) && minPriceValue >= 0) {
    filters.price = { ...(filters.price ?? {}), $gte: minPriceValue };
  }
  if (Number.isFinite(maxPriceValue) && maxPriceValue >= 0) {
    filters.price = { ...(filters.price ?? {}), $lte: maxPriceValue };
  }

  const resolvedPageSize = Math.min(Math.max(Number(pageSize) || 24, 6), 60);
  const resolvedPage = Math.max(Number(page) || 1, 1);
  const skip = (resolvedPage - 1) * resolvedPageSize;

  const { value: payload, meta } = await getOrSetCache(
    {
      key: buildCacheKey('marketplace:catalogue', req.query),
      ttlSeconds: 120,
      staleWhileRevalidateSeconds: 180,
      tags: ['marketplace:catalogue'],
      bypass: shouldBypassCache(req),
    },
    async () => {
      const searchPlan = await resolveCatalogueSearchPlan(filters, search, sort, {
        offset: skip,
        limit: resolvedPageSize,
      });
      const categories = await buildMarketplaceCategoryOptions(filters);

      const cursorSortFields = MARKETPLACE_CURSOR_SORT_FIELDS[sort] ?? MARKETPLACE_CURSOR_SORT_FIELDS.featured;
      const useCursorPagination = paginationMode === 'cursor' && searchPlan.searchStrategy === 'browse';

      if (useCursorPagination) {
        const cursorFilters = buildCursorFilter({
          baseFilter: searchPlan.filters,
          cursor,
          sortFields: cursorSortFields,
        });

        if (!cursorFilters) {
          throw new ApiError(400, 'Invalid cursor');
        }

        const products = await Product.find(cursorFilters)
          .select(MARKETPLACE_LIST_PRODUCT_SELECT)
          .populate({ path: 'seller', select: MARKETPLACE_SELLER_SELECT })
          .sort(buildCursorSortStage(cursorSortFields))
          .limit(resolvedPageSize + 1)
          .lean();

        const hasMore = products.length > resolvedPageSize;
        const pageItems = hasMore ? products.slice(0, resolvedPageSize) : products;
        const nextCursor = hasMore
          ? encodeCursorToken({ document: pageItems[pageItems.length - 1], sortFields: cursorSortFields })
          : null;

        return {
          products: pageItems.map(shapeMarketplaceProduct),
          categories,
          pagination: {
            mode: 'cursor',
            pageSize: resolvedPageSize,
            hasMore,
            nextCursor,
          },
          searchStrategy: searchPlan.searchStrategy,
        };
      }

      const catalogueQuery = Product.find(searchPlan.filters)
        .select(MARKETPLACE_LIST_PRODUCT_SELECT)
        .populate({ path: 'seller', select: MARKETPLACE_SELLER_SELECT });

      if (!searchPlan.orderedIds?.length) {
        catalogueQuery.sort(searchPlan.sortStage).skip(skip).limit(resolvedPageSize);
      }

      const [products, total] = await Promise.all([
        catalogueQuery.lean(),
        searchPlan.total === null ? Product.countDocuments(searchPlan.filters) : Promise.resolve(searchPlan.total),
      ]);

      const orderedProducts = searchPlan.orderedIds?.length
        ? orderProductsByIds(products, searchPlan.orderedIds)
        : products;
      const enriched = orderedProducts.map(shapeMarketplaceProduct);

      return {
        products: enriched,
        categories,
        pagination: {
          page: resolvedPage,
          pageSize: resolvedPageSize,
          total,
          totalPages: Math.ceil(total / resolvedPageSize) || 0,
        },
        searchStrategy: searchPlan.searchStrategy,
      };
    },
  );

  applyCacheHeaders(res, meta);
  if (applyPublicCacheHeaders(req, res, {
    scope: 'marketplace:catalogue',
    version: buildMarketplaceCollectionVersion(
      payload.products,
      payload.pagination,
      payload.searchStrategy,
      payload.categories,
    ),
    lastModified: resolveMarketplaceLastModified(payload.products),
    maxAgeSeconds: 60,
    staleWhileRevalidateSeconds: 180,
  })) {
    return;
  }

  return res
    .status(200)
    .json(new ApiResponse(200, payload, 'Marketplace catalogue fetched successfully'));
});

export const getMarketplaceProduct = asyncHandler(async (req, res) => {
  const productId = toObjectId(req.params.productId, 'Product id');

  const { value: payload, meta } = await getOrSetCache(
    {
      key: buildCacheKey('marketplace:product', { productId: String(productId) }),
      ttlSeconds: 120,
      staleWhileRevalidateSeconds: 180,
      tags: ['marketplace:catalogue', `marketplace:product:${productId}`],
      bypass: shouldBypassCache(req),
    },
    async () => {
      const product = await Product.findOne({ _id: productId, isPublished: true })
        .select(MARKETPLACE_DETAIL_PRODUCT_SELECT)
        .populate({ path: 'seller', select: MARKETPLACE_SELLER_SELECT })
        .lean();

      if (!product) {
        throw new ApiError(404, 'Product not found');
      }

      const reviewItems = await ProductReview.find({ product: productId })
        .select(MARKETPLACE_REVIEW_SELECT)
        .sort({ createdAt: -1 })
        .limit(12)
        .populate({ path: 'user', select: MARKETPLACE_REVIEW_USER_SELECT })
        .lean();

      const shaped = shapeMarketplaceProduct(product);

      const reviewPayload = reviewItems.map((review) => ({
        id: review._id,
        rating: review.rating,
        title: review.title || null,
        comment: review.comment || '',
        createdAt: review.createdAt,
        isVerifiedPurchase: review.isVerifiedPurchase,
        user: review.user
          ? {
              id: review.user._id,
              name: review.user.name,
              avatar: review.user.profilePicture ?? null,
              role: review.user.role ?? null,
            }
          : null,
      }));

      return {
        product: {
          ...shaped,
          reviews: {
            ...shaped.reviews,
            items: reviewPayload,
          },
        },
      };
    },
  );

  applyCacheHeaders(res, meta);
  if (applyPublicCacheHeaders(req, res, {
    scope: 'marketplace:product',
    version: buildMarketplaceDetailVersion(payload.product),
    lastModified: payload.product?.updatedAt,
    maxAgeSeconds: 90,
    staleWhileRevalidateSeconds: 180,
  })) {
    return;
  }

  return res
    .status(200)
    .json(new ApiResponse(200, payload, 'Marketplace product fetched successfully'));
});

export const createMarketplaceOrder = asyncHandler(async (req, res) => {
  ensureMarketplaceBuyerEligible(req.user);

  const userId = req.user?._id;
  const { items, shippingAddress, paymentMethod = 'Cash on Delivery' } = req.body ?? {};

  if (!userId) {
    throw new ApiError(401, 'You must be signed in to place an order.');
  }

  if (!Array.isArray(items) || !items.length) {
    throw new ApiError(400, 'Select at least one product to place an order.');
  }

  const preparedItems = prepareMarketplaceOrderItems(items);

  const requiredAddressFields = ['firstName', 'lastName', 'email', 'phone', 'address', 'city', 'state', 'zipCode'];

  if (!shippingAddress || requiredAddressFields.some((field) => !shippingAddress[field])) {
    throw new ApiError(400, 'Please provide a complete shipping address.');
  }

  const tax = 0;
  const shippingCost = 0;
  const session = await mongoose.startSession();
  let orderId;
  let productIds = [];

  try {
    await session.withTransaction(async () => {
      const initialStatusTimestamp = new Date();
      const reservations = await reserveInventoryForMarketplaceOrder(preparedItems, { session });
      productIds = reservations.map(({ product }) => product._id);

      const orderItems = reservations.map(({ product, quantity }) => ({
        seller: product.seller ?? undefined,
        product: product._id,
        name: product.name,
        quantity,
        price: product.price,
        image: product.image,
        status: 'processing',
        lastStatusAt: initialStatusTimestamp,
        statusHistory: [{
          status: 'processing',
          note: null,
          updatedBy: null,
          updatedAt: initialStatusTimestamp,
        }],
      }));

      const subtotal = orderItems.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 0), 0);
      const total = subtotal + tax + shippingCost;
      const orderNumber = await generateOrderNumber();
      const [createdOrder] = await Order.create([{
        user: userId,
        orderItems,
        shippingAddress,
        paymentMethod,
        subtotal,
        tax,
        shippingCost,
        total,
        orderNumber,
      }], { session });

      orderId = createdOrder._id;
      await enqueueOutboxEvents(buildMarketplaceOutboxEvents({ productIds }), { session });
    });
  } finally {
    await session.endSession();
  }

  const populated = await Order.findById(orderId)
    .populate({
      path: 'orderItems.product',
      select: 'name image',
    })
    .lean();

  await createNotifications(buildMarketplaceOrderNotifications(populated));

  return res
    .status(201)
    .json(new ApiResponse(201, { order: mapBuyerOrder(populated) }, 'Order placed successfully'));
});

export const createMarketplaceCheckoutSession = asyncHandler(async (req, res) => {
  ensureMarketplaceBuyerEligible(req.user);

  const userId = req.user?._id;
  const { items, shippingAddress } = req.body ?? {};

  if (!userId) {
    throw new ApiError(401, 'You must be signed in to create a checkout session.');
  }

  if (!Array.isArray(items) || !items.length) {
    throw new ApiError(400, 'Select at least one product to checkout.');
  }

  const preparedItems = prepareMarketplaceOrderItems(items);

  const requiredAddressFields = ['firstName', 'lastName', 'email', 'phone', 'address', 'city', 'state', 'zipCode'];

  if (!shippingAddress || requiredAddressFields.some((field) => !shippingAddress[field])) {
    throw new ApiError(400, 'Please provide a complete shipping address.');
  }

  const tax = 0;
  const shippingCost = 0;
  const session = await mongoose.startSession();
  let paymentSessionId;
  let stripeSession;

  try {
    await session.withTransaction(async () => {
      // Validate products and calculate totals
      const reservations = await reserveInventoryForMarketplaceOrder(preparedItems, { session });
      
      const orderItems = reservations.map(({ product, quantity }) => ({
        seller: product.seller ?? undefined,
        product: product._id,
        name: product.name,
        quantity,
        price: product.price,
        image: product.image,
      }));

      const subtotal = orderItems.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 0), 0);
      const total = subtotal + tax + shippingCost;

      // Create payment session record
      const paymentSession = await PaymentSession.create([{
        user: userId,
        type: 'shop',
        orderSnapshot: {
          items: orderItems,
          subtotal,
          tax,
          shippingCost,
          total,
          shippingAddress,
        },
        currency: 'inr',
        amount: total,
        metadata: {
          items: items.map(item => ({ productId: item.productId, quantity: item.quantity })),
        },
      }], { session });

      paymentSessionId = paymentSession[0]._id;

      // Create Stripe Checkout Session
      const lineItems = orderItems.map((item) => ({
        price_data: {
          currency: 'inr',
          product_data: {
            name: item.name,
            images: item.image ? [item.image] : [],
          },
          unit_amount: Math.round(item.price * 100), // Convert to paise/cents
        },
        quantity: item.quantity,
      }));

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';

      stripeSession = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: lineItems,
        mode: 'payment',
        customer_email: shippingAddress.email,
        metadata: {
          paymentSessionId: String(paymentSessionId),
          userId: String(userId),
          type: 'marketplace-order',
        },
        success_url: `${frontendUrl}/marketplace/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${frontendUrl}/marketplace/checkout/cancel`,
        shipping_address_collection: {
          allowed_countries: ['IN'],
        },
      });

      // Update payment session with Stripe session ID
      await PaymentSession.findByIdAndUpdate(
        paymentSessionId,
        {
          'stripe.checkoutSessionId': stripeSession.id,
          'stripe.status': 'open',
        },
        { session }
      );
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(500, error.message || 'Failed to create checkout session');
  } finally {
    await session.endSession();
  }

  return res
    .status(200)
    .json(new ApiResponse(200, { 
      checkoutUrl: stripeSession.url,
      sessionId: stripeSession.id,
    }, 'Checkout session created'));
});

export const getOrderByStripeSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;

  if (!sessionId) {
    throw new ApiError(400, 'Session ID is required.');
  }

  // Find payment session by Stripe checkout session ID
  let paymentSession = await PaymentSession.findOne({
    'stripe.checkoutSessionId': sessionId,
  }).lean();

  if (!paymentSession) {
    throw new ApiError(404, 'Payment session not found.');
  }

  if (!paymentSession.orderId) {
    const stripeSession = await stripe.checkout.sessions.retrieve(sessionId);
    const isPaid = stripeSession?.payment_status === 'paid';
    const isComplete = stripeSession?.status === 'complete';

    if (!isPaid || !isComplete) {
      throw new ApiError(202, 'Order is still being processed. Please wait a moment.');
    }

    const finalizeSession = await mongoose.startSession();

    try {
      await finalizeSession.withTransaction(async () => {
        await finalizeMarketplacePaymentSession({
          paymentSessionId: paymentSession._id,
          stripeSessionId: stripeSession.id,
          paymentIntentId: stripeSession.payment_intent,
          session: finalizeSession,
        });
      });
    } finally {
      await finalizeSession.endSession();
    }

    paymentSession = await PaymentSession.findOne({
      'stripe.checkoutSessionId': sessionId,
    }).lean();

    if (!paymentSession?.orderId) {
      throw new ApiError(202, 'Order is still being processed. Please wait a moment.');
    }
  }

  const order = await Order.findById(paymentSession.orderId)
    .populate({
      path: 'orderItems.product',
      select: 'name image',
    })
    .lean();

  if (!order) {
    throw new ApiError(404, 'Order not found.');
  }

  return res
    .status(200)
    .json(new ApiResponse(200, { order: mapBuyerOrder(order) }, 'Order retrieved successfully'));
});

export const handleStripeWebhook = asyncHandler(async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const rawBody = req.rawBody || req.body;
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      
      // Only process marketplace order sessions
      if (session.metadata?.type !== 'marketplace-order') {
        return res.json({ received: true });
      }

      const paymentSessionId = session.metadata.paymentSessionId;
      const userId = session.metadata.userId;

      if (!paymentSessionId || !userId) {
        console.error('Missing metadata in Stripe session');
        return res.status(400).json({ error: 'Missing metadata' });
      }

      const session_db = await mongoose.startSession();

      try {
        await session_db.withTransaction(async () => {
          await finalizeMarketplacePaymentSession({
            paymentSessionId,
            stripeSessionId: session.id,
            paymentIntentId: session.payment_intent,
            session: session_db,
          });
        });
      } catch (error) {
        console.error('Error processing webhook:', error);
        throw error;
      } finally {
        await session_db.endSession();
      }

      break;
    }

    case 'checkout.session.expired': {
      const session = event.data.object;
      
      if (session.metadata?.type === 'marketplace-order') {
        const paymentSessionId = session.metadata.paymentSessionId;
        
        if (paymentSessionId) {
          const paymentSession = await PaymentSession.findById(paymentSessionId).lean();

          if (paymentSession && !paymentSession.processed) {
            const reservations = (paymentSession.orderSnapshot?.items ?? [])
              .map((item) => ({
                product: item?.product ? { _id: item.product } : null,
                quantity: Number(item?.quantity) || 0,
              }))
              .filter((entry) => entry.product?._id && entry.quantity > 0);

            const expirySession = await mongoose.startSession();

            try {
              await expirySession.withTransaction(async () => {
                await PaymentSession.findByIdAndUpdate(
                  paymentSessionId,
                  {
                    'stripe.status': 'expired',
                    processed: true,
                  },
                  { session: expirySession },
                );

                await releaseMarketplaceInventoryReservations(reservations, {
                  session: expirySession,
                });
              });
            } finally {
              await expirySession.endSession();
            }
          }
        }
      }
      break;
    }

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});

export const createMarketplaceProductReview = asyncHandler(async (req, res) => {
  ensureMarketplaceBuyerEligible(req.user);

  const userId = req.user?._id;
  const productId = toObjectId(req.params.productId, 'Product id');
  const {
    orderId,
    rating,
    title,
    comment,
  } = req.body ?? {};

  if (!orderId) {
    throw new ApiError(400, 'A delivered order is required to submit a review.');
  }

  const ratingValue = Number(rating);
  if (!Number.isFinite(ratingValue) || ratingValue < 1 || ratingValue > 5) {
    throw new ApiError(400, 'Rating must be between 1 and 5 stars.');
  }
  const resolvedRating = Math.min(5, Math.max(1, Math.round(ratingValue)));

  const resolvedTitle = title ? String(title).trim().slice(0, 120) : '';
  const resolvedComment = comment ? String(comment).trim().slice(0, 1000) : '';
  const trimmedTitle = resolvedTitle || undefined;
  const trimmedComment = resolvedComment || undefined;

  const orderObjectId = toObjectId(orderId, 'Order id');

  const productExists = await Product.exists({ _id: productId });
  if (!productExists) {
    throw new ApiError(404, 'Product not found.');
  }

  const order = await Order.findOne({ _id: orderObjectId, user: userId, 'orderItems.product': productId }).lean();

  if (!order) {
    throw new ApiError(400, 'We could not find this product in your order history.');
  }

  const matchingItem = (order.orderItems || []).find((item) => {
    const itemProductId = item.product?._id ?? item.product;
    return itemProductId && String(itemProductId) === String(productId);
  });

  if (!matchingItem) {
    throw new ApiError(400, 'This item is not part of the selected order.');
  }

  const normalisedStatus = normaliseItemStatus(matchingItem.status);
  if (normalisedStatus !== 'delivered') {
    throw new ApiError(400, 'You can only review items after they are delivered.');
  }

  const session = await mongoose.startSession();
  let review;
  try {
    await session.withTransaction(async () => {
      review = await ProductReview.findOneAndUpdate(
        { product: productId, user: userId },
        {
          $set: {
            rating: resolvedRating,
            title: trimmedTitle,
            comment: trimmedComment,
            order: order._id,
            isVerifiedPurchase: true,
          },
          $setOnInsert: {
            product: productId,
            user: userId,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true, session },
      );

      await recalculateProductReviewMetrics(productId, { session });
      await enqueueOutboxEvents(buildMarketplaceOutboxEvents({ productId }), { session });
    });
  } finally {
    await session.endSession();
  }

  return res
    .status(201)
    .json(new ApiResponse(201, { reviewId: review._id }, 'Review submitted successfully.'));
});

export const listSellerProducts = asyncHandler(async (req, res) => {
  ensureSellerActive(req.user);
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor.trim() : '';
  const paginationMode = String(req.query.pagination ?? '').trim().toLowerCase();
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);

  if (paginationMode === 'cursor') {
    const filters = buildCursorFilter({
      baseFilter: { seller: req.user._id },
      cursor,
      sortFields: SELLER_PRODUCT_CURSOR_SORT_FIELDS,
    });

    if (!filters) {
      throw new ApiError(400, 'Invalid cursor');
    }

    const products = await Product.find(filters)
      .sort(buildCursorSortStage(SELLER_PRODUCT_CURSOR_SORT_FIELDS))
      .limit(limit + 1)
      .lean();

    const hasMore = products.length > limit;
    const pageItems = hasMore ? products.slice(0, limit) : products;
    const nextCursor = hasMore
      ? encodeCursorToken({ document: pageItems[pageItems.length - 1], sortFields: SELLER_PRODUCT_CURSOR_SORT_FIELDS })
      : null;

    return res
      .status(200)
      .json(new ApiResponse(200, {
        products: pageItems.map(mapProduct),
        pagination: { mode: 'cursor', limit, hasMore, nextCursor },
      }, 'Products fetched successfully'));
  }

  const products = await Product.find({ seller: req.user._id })
    .sort({ updatedAt: -1 })
    .lean();

  return res
    .status(200)
    .json(new ApiResponse(200, { products: products.map(mapProduct) }, 'Products fetched successfully'));
});

export const createSellerProduct = asyncHandler(async (req, res) => {
  ensureSellerActive(req.user);

  const {
    name,
    description,
    price,
    mrp,
    category,
    stock,
    status = 'available',
    isPublished,
  } = req.body ?? {};

  if (!name || !description || mrp === undefined || mrp === null || !category) {
    throw new ApiError(400, 'Name, description, MRP, and category are required.');
  }

  const mrpValue = toNumber(mrp, NaN);
  if (!Number.isFinite(mrpValue) || mrpValue <= 0) {
    throw new ApiError(400, 'MRP must be a valid amount.');
  }

  let priceValue = price === undefined || price === null || price === '' ? mrpValue : toNumber(price, NaN);
  if (!Number.isFinite(priceValue) || priceValue <= 0) {
    priceValue = mrpValue;
  }
  if (priceValue > mrpValue) {
    priceValue = mrpValue;
  }

  const rawStockValue = toNumber(stock, NaN);
  const stockValue = Number.isFinite(rawStockValue) ? Math.floor(rawStockValue) : NaN;
  if (!Number.isFinite(stockValue) || stockValue < 0) {
    throw new ApiError(400, 'Stock must be a non-negative integer.');
  }

  const categoryValue = normaliseCategory(category);
  if (!PRODUCT_CATEGORIES.has(categoryValue)) {
    throw new ApiError(400, 'Product category is invalid.');
  }

  const statusValue = ['available', 'out-of-stock'].includes(String(status).toLowerCase())
    ? String(status).toLowerCase()
    : 'available';
  const publishFlag = parseBoolean(isPublished, false);

  const imageFile = req.file;
  if (!imageFile) {
    throw new ApiError(400, 'Upload a product image to list this item.');
  }

  let uploadResult;
  try {
    uploadResult = await uploadOnCloudinary(imageFile.path, {
      folder: 'fitsync/products',
      resourceType: 'image',
    });
  } catch (error) {
    throw new ApiError(500, 'Could not upload the product image. Please try again.');
  }

  if (!uploadResult?.url) {
    throw new ApiError(500, 'Product image upload failed.');
  }

  const metadataEntries = [];
  if (uploadResult.provider) {
    metadataEntries.push(['imageProvider', uploadResult.provider]);
  }
  if (uploadResult.publicId) {
    metadataEntries.push(['imagePublicId', uploadResult.publicId]);
  }
  if (uploadResult.format) {
    metadataEntries.push(['imageFormat', uploadResult.format]);
  }
  if (uploadResult.bytes) {
    metadataEntries.push(['imageBytes', String(uploadResult.bytes)]);
  }
  if (uploadResult.width && uploadResult.height) {
    metadataEntries.push(['imageSize', `${uploadResult.width}x${uploadResult.height}`]);
  }

  const product = await Product.create({
    seller: req.user._id,
    name: name.trim(),
    description: description.trim(),
    price: priceValue,
    mrp: mrpValue,
    image: uploadResult.url,
    category: categoryValue,
    stock: stockValue,
    status: statusValue,
    isPublished: publishFlag,
    metadata: metadataEntries.length ? new Map(metadataEntries) : undefined,
  });
  await enqueueOutboxEvents(buildMarketplaceOutboxEvents({ productId: product._id }));

  return res
    .status(201)
    .json(new ApiResponse(201, { product: mapProduct(product) }, 'Product created successfully'));
});

export const updateSellerProduct = asyncHandler(async (req, res) => {
  ensureSellerActive(req.user);

  const productId = toObjectId(req.params.productId, 'Product id');
  const product = await Product.findOne({ _id: productId, seller: req.user._id });

  if (!product) {
    throw new ApiError(404, 'Product not found');
  }

  const { name, description, price, mrp, category, stock, status, isPublished } = req.body ?? {};

  if (name !== undefined) {
    product.name = String(name).trim();
  }
  if (description !== undefined) {
    product.description = String(description).trim();
  }

  if (mrp !== undefined) {
    const mrpValue = toNumber(mrp, NaN);
    if (!Number.isFinite(mrpValue) || mrpValue <= 0) {
      throw new ApiError(400, 'MRP must be a valid amount');
    }
    product.mrp = mrpValue;
    if (product.price > mrpValue) {
      product.price = mrpValue;
    }
  }

  if (price !== undefined) {
    const priceValue = toNumber(price, NaN);
    if (!Number.isFinite(priceValue) || priceValue <= 0) {
      throw new ApiError(400, 'Selling price must be a valid amount');
    }
    product.price = priceValue;
  }

  if (category !== undefined) {
    const categoryValue = normaliseCategory(category);
    if (!PRODUCT_CATEGORIES.has(categoryValue)) {
      throw new ApiError(400, 'Product category is invalid.');
    }
    product.category = categoryValue;
  }

  if (stock !== undefined) {
    const rawStock = toNumber(stock, NaN);
    const stockValue = Number.isFinite(rawStock) ? Math.floor(rawStock) : NaN;
    if (!Number.isFinite(stockValue) || stockValue < 0) {
      throw new ApiError(400, 'Stock must be a non-negative integer.');
    }
    product.stock = stockValue;
  }

  if (status !== undefined) {
    const statusValue = ['available', 'out-of-stock'].includes(String(status).toLowerCase())
      ? String(status).toLowerCase()
      : null;
    if (!statusValue) {
      throw new ApiError(400, 'Stock status is invalid.');
    }
    product.status = statusValue;
  }

  if (isPublished !== undefined) {
    product.isPublished = parseBoolean(isPublished, product.isPublished);
  }

  if (req.file) {
    let uploadResult;
    try {
      uploadResult = await uploadOnCloudinary(req.file.path, {
        folder: 'fitsync/products',
        resourceType: 'image',
      });
    } catch (error) {
      throw new ApiError(500, 'Could not upload the new product image.');
    }

    if (!uploadResult?.url) {
      throw new ApiError(500, 'Product image upload failed.');
    }

    product.image = uploadResult.url;

    let metadataMap;
    if (product.metadata instanceof Map) {
      metadataMap = product.metadata;
    } else if (product.metadata && typeof product.metadata === 'object') {
      metadataMap = new Map(Object.entries(product.metadata));
    } else {
      metadataMap = new Map();
    }

    metadataMap.set('imageProvider', uploadResult.provider ?? 'cloudinary');
    if (uploadResult.publicId) {
      metadataMap.set('imagePublicId', uploadResult.publicId);
    }
    if (uploadResult.format) {
      metadataMap.set('imageFormat', uploadResult.format);
    }
    if (uploadResult.bytes) {
      metadataMap.set('imageBytes', String(uploadResult.bytes));
    }
    if (uploadResult.width && uploadResult.height) {
      metadataMap.set('imageSize', `${uploadResult.width}x${uploadResult.height}`);
    }

    product.metadata = metadataMap;
    if (typeof product.markModified === 'function') {
      product.markModified('metadata');
    }
  }

  if (product.mrp !== undefined && product.price > product.mrp) {
    product.price = product.mrp;
  }

  await product.save();
  await enqueueOutboxEvents(buildMarketplaceOutboxEvents({ productId }));

  return res
    .status(200)
    .json(new ApiResponse(200, { product: mapProduct(product) }, 'Product updated successfully'));
});

export const deleteSellerProduct = asyncHandler(async (req, res) => {
  const productId = toObjectId(req.params.productId, 'Product id');
  const product = await Product.findOne({ _id: productId, seller: req.user._id });

  if (!product) {
    throw new ApiError(404, 'Product not found');
  }

  await product.deleteOne();
  await enqueueOutboxEvents(buildMarketplaceOutboxEvents({ productId, deleted: true }));

  return res
    .status(200)
    .json(new ApiResponse(200, { productId }, 'Product removed successfully'));
});

const normaliseSellerId = (value) => (value ? String(value) : null);

const deriveSellerOrderStatus = (items = []) => {
  if (!items.length) {
    return 'processing';
  }

  const statuses = items.map((item) => normaliseItemStatus(item.status));

  if (statuses.every((status) => status === 'delivered')) {
    return 'delivered';
  }

  if (statuses.some((status) => status === 'out-for-delivery')) {
    return 'out-for-delivery';
  }

  if (statuses.some((status) => status === 'in-transit')) {
    return 'in-transit';
  }

  return 'processing';
};

const getSellerOrderItems = (order, sellerId) =>
  (order.orderItems || []).filter((item) => normaliseSellerId(item.seller ?? order.seller) === normaliseSellerId(sellerId));

const mapOrder = (order, sellerId) => {
  const relevantItems = getSellerOrderItems(order, sellerId);
  const total = relevantItems.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 0), 0);

  return {
    id: order._id,
    orderNumber: order.orderNumber,
    status: deriveSellerOrderStatus(relevantItems),
    createdAt: order.createdAt,
    total,
    buyer: order.user,
    items: relevantItems.map((item) => ({
      id: item.product,
      itemId: item._id,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      status: normaliseItemStatus(item.status),
      lastStatusAt: item.lastStatusAt,
      tracking: buildTrackingSnapshot(item),
      returnRequest: buildReturnRequestSnapshot(item),
      statusHistory: (item.statusHistory || []).map((entry) => ({
        status: normaliseItemStatus(entry.status),
        note: entry.note,
        updatedBy: entry.updatedBy,
        updatedAt: entry.updatedAt,
      })),
    })),
  };
};

const recordSellerPayoutIfEligible = (orderDoc, sellerId) => {
  const sellerItems = getSellerOrderItems(orderDoc, sellerId);
  if (!sellerItems.length) {
    return null;
  }

  const allDelivered = sellerItems.every((item) => normaliseItemStatus(item.status) === 'delivered');
  if (!allDelivered) {
    return null;
  }

  const unsettledItems = sellerItems.filter((item) => !item.payoutRecorded);
  if (!unsettledItems.length) {
    return null;
  }

  const grossAmount = unsettledItems.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 0), 0);
  if (grossAmount <= 0) {
    unsettledItems.forEach((item) => {
      item.payoutRecorded = true;
    });
    return null;
  }

  const sellerShare = Math.round(grossAmount * SELLER_PAYOUT_RATE);
  const adminCommission = grossAmount - sellerShare;

  unsettledItems.forEach((item) => {
    item.payoutRecorded = true;
  });
  return {
    sellerPayout: sellerShare,
    adminCommission,
    itemsCount: unsettledItems.length,
    grossAmount,
  };
};

const toOrderItemIdString = (value) => (value ? String(value) : null);

export const listSellerOrders = asyncHandler(async (req, res) => {
  const sellerId = req.user._id;
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor.trim() : '';
  const paginationMode = String(req.query.pagination ?? '').trim().toLowerCase();
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);

  if (paginationMode === 'cursor') {
    const filters = buildCursorFilter({
      baseFilter: {
        $or: [
          { seller: sellerId },
          { 'orderItems.seller': sellerId },
        ],
      },
      cursor,
      sortFields: SELLER_ORDER_CURSOR_SORT_FIELDS,
    });

    if (!filters) {
      throw new ApiError(400, 'Invalid cursor');
    }

    const orders = await Order.find(filters)
      .sort(buildCursorSortStage(SELLER_ORDER_CURSOR_SORT_FIELDS))
      .limit(limit + 1)
      .populate({ path: 'user', select: 'name email' })
      .lean();

    const hasMore = orders.length > limit;
    const pageItems = hasMore ? orders.slice(0, limit) : orders;
    const nextCursor = hasMore
      ? encodeCursorToken({ document: pageItems[pageItems.length - 1], sortFields: SELLER_ORDER_CURSOR_SORT_FIELDS })
      : null;

    return res
      .status(200)
      .json(new ApiResponse(200, {
        orders: pageItems.map((order) => mapOrder(order, sellerId)),
        statusOptions: Array.from(SELLER_STATUS_FLAGS),
        pagination: { mode: 'cursor', limit, hasMore, nextCursor },
      }, 'Orders fetched successfully'));
  }

  const orders = await Order.find({
    $or: [
      { seller: sellerId },
      { 'orderItems.seller': sellerId },
    ],
  })
    .sort({ createdAt: -1 })
    .populate({ path: 'user', select: 'name email' })
    .lean();

  const payload = orders.map((order) => mapOrder(order, sellerId));

  return res
    .status(200)
    .json(new ApiResponse(200, { orders: payload, statusOptions: Array.from(SELLER_STATUS_FLAGS) }, 'Orders fetched successfully'));
});

export const updateSellerOrderStatus = asyncHandler(async (req, res) => {
  const orderId = toObjectId(req.params.orderId, 'Order id');
  const { itemId } = req.params;
  const sellerId = req.user._id;
  const { status, note } = req.body ?? {};
  const nextStatus = normaliseItemStatus(status);

  if (!nextStatus || !SELLER_STATUS_FLAGS.has(nextStatus)) {
    throw new ApiError(400, 'Invalid status selection');
  }

  const session = await mongoose.startSession();
  let refreshedOrderId = null;
  let payoutResult = null;
  let updatedProductIds = [];

  try {
    await session.withTransaction(async () => {
      const order = await Order.findOne({
        _id: orderId,
        $or: [
          { seller: sellerId },
          { 'orderItems.seller': sellerId },
        ],
      }).session(session);

      if (!order) {
        throw new ApiError(404, 'Order not found');
      }

      const relevantItems = getSellerOrderItems(order, sellerId);
      if (!relevantItems.length) {
        throw new ApiError(403, 'You cannot update this order');
      }

      const targetItems = itemId === 'all'
        ? relevantItems
        : relevantItems.filter((item) => normaliseSellerId(item._id) === normaliseSellerId(itemId));

      if (!targetItems.length) {
        throw new ApiError(404, 'Order item not found for this seller');
      }

      const now = new Date();
      const allItems = order.orderItems || [];
      allItems.forEach((item) => {
        item.status = normaliseItemStatus(item.status);
      });

      const deliveredItems = [];
      targetItems.forEach((item) => {
        const currentStatus = normaliseItemStatus(item.status);
        if (!canTransitionStatus(currentStatus, nextStatus)) {
          throw new ApiError(400, 'Order items can only move forward through the fulfillment steps.');
        }

        if (nextStatus === 'delivered' && currentStatus !== 'delivered') {
          deliveredItems.push({ product: item.product, quantity: item.quantity });
        }

        item.status = nextStatus;
        item.lastStatusAt = now;
        if (!Array.isArray(item.statusHistory)) {
          item.statusHistory = [];
        }
        item.statusHistory.push({
          status: nextStatus,
          note,
          updatedBy: sellerId,
          updatedAt: now,
        });

        if (nextStatus !== 'delivered') {
          item.payoutRecorded = false;
        }
      });

      order.status = deriveSellerOrderStatus(order.orderItems || []);
      payoutResult = recordSellerPayoutIfEligible(order, sellerId);
      await order.save({ session });

      if (deliveredItems.length) {
        await updateDeliveredProductSalesMetrics(deliveredItems, now, { session });
      }

      if (payoutResult) {
        const metadataEntries = [
          ['orderId', String(order._id)],
          ['sellerId', String(sellerId)],
          ['itemsCount', String(payoutResult.itemsCount)],
          ['grossAmount', String(payoutResult.grossAmount)],
          ['commission', String(payoutResult.adminCommission)],
        ];

        if (payoutResult.sellerPayout > 0) {
          await Revenue.create([{
            order: order._id,
            amount: payoutResult.sellerPayout,
            user: sellerId,
            type: 'seller',
            description: `Order ${order.orderNumber ?? order._id} items delivered (85% seller share)`,
            metadata: new Map(metadataEntries),
          }], { session });
        }

        if (payoutResult.adminCommission > 0) {
          await Revenue.create([{
            order: order._id,
            amount: payoutResult.adminCommission,
            user: null,
            type: 'marketplace',
            description: `Admin commission from order ${order.orderNumber ?? order._id} delivery (15%)`,
            metadata: new Map([
              ...metadataEntries,
              ['sellerPayout', String(payoutResult.sellerPayout)],
            ]),
          }], { session });
        }
      }

      updatedProductIds = (order.orderItems || []).map((item) => item.product).filter(Boolean);
      await enqueueOutboxEvents(buildMarketplaceOutboxEvents({ productIds: updatedProductIds }), { session });
      refreshedOrderId = order._id;
    });
  } finally {
    await session.endSession();
  }

  const refreshed = await Order.findById(refreshedOrderId)
    .populate({ path: 'user', select: 'name email' })
    .lean();

  await Promise.all([
    createNotifications([{
      user: refreshed.user?._id ?? refreshed.user,
      type: 'order-status',
      title: 'Order status updated',
      message: `Your order ${refreshed.orderNumber ?? refreshed._id} was updated to ${nextStatus}.`,
      link: BUYER_ORDER_NOTIFICATION_LINK,
      metadata: { orderId: refreshed._id, status: nextStatus },
    }]),
    recordAuditLog({
      actor: sellerId,
      actorRole: req.user?.role,
      action: 'marketplace.order.status.updated',
      entityType: 'order',
      entityId: refreshed._id,
      summary: `Order status updated to ${nextStatus}`,
      metadata: { itemId, payout: payoutResult },
    }),
  ]);

  return res
    .status(200)
    .json(new ApiResponse(200, {
      order: mapOrder(refreshed, sellerId),
      statusOptions: Array.from(SELLER_STATUS_FLAGS),
      payout: payoutResult
        ? {
          sellerPayout: payoutResult.sellerPayout,
          adminCommission: payoutResult.adminCommission,
        }
        : undefined,
    }, 'Order status updated successfully'));
});

export const settleSellerOrder = asyncHandler(async (req, res) => {
  req.params.itemId = 'all';
  req.body = { ...(req.body ?? {}), status: 'delivered' };
  return updateSellerOrderStatus(req, res);
});

export const updateSellerOrderTracking = asyncHandler(async (req, res) => {
  const orderId = toObjectId(req.params.orderId, 'Order id');
  const { itemId } = req.params;
  const sellerId = req.user?._id;
  const {
    carrier,
    trackingNumber,
    trackingUrl,
    status = 'in-transit',
  } = req.body ?? {};
  const carrierValue = String(carrier ?? '').trim();
  const trackingNumberValue = String(trackingNumber ?? '').trim();
  const trackingUrlValue = String(trackingUrl ?? '').trim();
  const nextStatus = normaliseTrackingStatusInput(status);

  if (!carrierValue || !trackingNumberValue) {
    throw new ApiError(400, 'Carrier and tracking number are required.');
  }

  if (!nextStatus) {
    throw new ApiError(400, 'Tracking status is invalid.');
  }

  const order = await Order.findOne({
    _id: orderId,
    $or: [
      { seller: sellerId },
      { 'orderItems.seller': sellerId },
    ],
  }).populate({ path: 'user', select: 'name email' });

  if (!order) {
    throw new ApiError(404, 'Order not found');
  }

  const item = (order.orderItems || []).find((entry) => toOrderItemIdString(entry._id) === String(itemId));
  if (!item || normaliseSellerId(item.seller ?? order.seller) !== normaliseSellerId(sellerId)) {
    throw new ApiError(404, 'Order item not found for this seller');
  }

  if (!canTransitionStatus(item.status, nextStatus)) {
    throw new ApiError(400, 'Tracking status can only move forward through the fulfillment steps.');
  }

  item.tracking = {
    carrier: carrierValue,
    trackingNumber: trackingNumberValue,
    trackingUrl: trackingUrlValue,
    updatedAt: new Date(),
  };
  item.status = nextStatus;
  item.lastStatusAt = new Date();
  order.status = deriveSellerOrderStatus(order.orderItems || []);
  await order.save();

  await Promise.all([
    createNotifications([{
      user: order.user?._id ?? order.user,
      type: 'order-tracking',
      title: 'Order tracking updated',
      message: `Tracking details were updated for ${item.name}.`,
      link: BUYER_ORDER_NOTIFICATION_LINK,
      metadata: {
        orderId: order._id,
        itemId: item._id,
        tracking: item.tracking,
      },
    }]),
    recordAuditLog({
      actor: sellerId,
      actorRole: req.user?.role,
      action: 'marketplace.tracking.updated',
      entityType: 'order',
      entityId: order._id,
      summary: `Tracking updated for ${item.name}`,
      metadata: { itemId: item._id, tracking: item.tracking },
    }),
  ]);

  return res.status(200).json(new ApiResponse(200, {
    order: mapOrder(order.toObject(), sellerId),
  }, 'Tracking updated successfully'));
});

export const requestMarketplaceReturn = asyncHandler(async (req, res) => {
  const orderId = toObjectId(req.params.orderId, 'Order id');
  const { itemId } = req.params;
  const userId = req.user?._id;
  const reason = String(req.body?.reason ?? '').trim();

  if (!reason) {
    throw new ApiError(400, 'Return reason is required.');
  }

  const order = await Order.findOne({ _id: orderId, user: userId }).populate({ path: 'user', select: 'name email' });
  if (!order) {
    throw new ApiError(404, 'Order not found.');
  }

  const item = (order.orderItems || []).find((entry) => toOrderItemIdString(entry._id) === String(itemId));
  if (!item) {
    throw new ApiError(404, 'Order item not found.');
  }
  if (normaliseItemStatus(item.status) !== 'delivered') {
    throw new ApiError(400, 'Returns can only be requested after delivery.');
  }

  item.returnRequest = {
    status: 'requested',
    reason,
    requestedAt: new Date(),
    requestedBy: userId,
    refundAmount: (item.price || 0) * (item.quantity || 0),
  };
  await order.save();

  await Promise.all([
    createNotifications([{
      user: item.seller ?? order.seller,
      type: 'return-request',
      title: 'Return requested',
      message: `A buyer requested a return for ${item.name}.`,
      link: SELLER_ORDER_NOTIFICATION_LINK,
      metadata: { orderId: order._id, itemId: item._id, reason },
    }]),
    recordAuditLog({
      actor: userId,
      actorRole: req.user?.role,
      action: 'marketplace.return.requested',
      entityType: 'order',
      entityId: order._id,
      summary: `Return requested for ${item.name}`,
      metadata: { itemId: item._id, reason },
    }),
  ]);

  return res.status(200).json(new ApiResponse(200, {
    itemId: item._id,
    returnRequest: item.returnRequest,
  }, 'Return request submitted successfully.'));
});

export const reviewMarketplaceReturn = asyncHandler(async (req, res) => {
  const orderId = toObjectId(req.params.orderId, 'Order id');
  const { itemId } = req.params;
  const sellerId = req.user?._id;
  const decision = String(req.body?.decision ?? '').trim().toLowerCase();
  const note = String(req.body?.note ?? '').trim();

  if (!['approved', 'rejected', 'refunded'].includes(decision)) {
    throw new ApiError(400, 'Decision must be approved, rejected, or refunded.');
  }

  const order = await Order.findOne({
    _id: orderId,
    $or: [
      { seller: sellerId },
      { 'orderItems.seller': sellerId },
    ],
  }).populate({ path: 'user', select: 'name email' });

  if (!order) {
    throw new ApiError(404, 'Order not found');
  }

  const item = (order.orderItems || []).find((entry) => toOrderItemIdString(entry._id) === String(itemId));
  if (!item || normaliseSellerId(item.seller ?? order.seller) !== normaliseSellerId(sellerId)) {
    throw new ApiError(404, 'Order item not found for this seller');
  }
  const currentReturnStatus = String(item.returnRequest?.status ?? 'none').trim().toLowerCase();

  if (!['requested', 'approved'].includes(currentReturnStatus)) {
    throw new ApiError(400, 'There is no pending return request for this item.');
  }

  if (decision === 'refunded' && !['requested', 'approved'].includes(currentReturnStatus)) {
    throw new ApiError(400, 'Only requested or approved returns can be refunded.');
  }

  if (decision !== 'refunded' && currentReturnStatus !== 'requested') {
    throw new ApiError(400, 'Only pending return requests can be approved or rejected.');
  }

  item.returnRequest = {
    ...(item.returnRequest?.toObject?.() ?? item.returnRequest ?? {}),
    status: decision,
    reviewedAt: new Date(),
    reviewedBy: sellerId,
    note,
    refundAmount: item.returnRequest?.refundAmount ?? (item.price || 0) * (item.quantity || 0),
  };
  await order.save();

  await Promise.all([
    createNotifications([{
      user: order.user?._id ?? order.user,
      type: 'return-update',
      title: 'Return request updated',
      message: `Your return request for ${item.name} was ${decision}.`,
      link: BUYER_ORDER_NOTIFICATION_LINK,
      metadata: { orderId: order._id, itemId: item._id, decision },
    }]),
    recordAuditLog({
      actor: sellerId,
      actorRole: req.user?.role,
      action: `marketplace.return.${decision}`,
      entityType: 'order',
      entityId: order._id,
      summary: `Return ${decision} for ${item.name}`,
      metadata: { itemId: item._id, note },
    }),
  ]);

  return res.status(200).json(new ApiResponse(200, {
    itemId: item._id,
    returnRequest: item.returnRequest,
  }, 'Return request updated successfully.'));
});
