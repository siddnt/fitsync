import mongoose from 'mongoose';
import Product from '../../models/product.model.js';
import Order from '../../models/order.model.js';
import Revenue from '../../models/revenue.model.js';
import ProductReview from '../../models/productReview.model.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { uploadOnCloudinary } from '../../utils/fileUpload.js';

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

const SELLER_STATUS_FLAGS = new Set(MODERN_ITEM_STATUSES);
const STATUS_SEQUENCE = [...MODERN_ITEM_STATUSES];
const STATUS_INDEX = STATUS_SEQUENCE.reduce((acc, status, index) => {
  acc[status] = index;
  return acc;
}, {});

const ORDER_NUMBER_PREFIX = 'FS';

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

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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
const computeDiscountPercentage = (mrp, price) => {
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

const collectProductSalesStats = async (productIds, { recentWindowDays = 30 } = {}) => {
  if (!productIds?.length) {
    return new Map();
  }

  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - recentWindowDays);

  const stats = await Order.aggregate([
    { $match: { 'orderItems.product': { $in: productIds } } },
    { $project: { createdAt: 1, orderItems: 1 } },
    { $unwind: '$orderItems' },
    {
      $match: {
        'orderItems.product': { $in: productIds },
        'orderItems.status': 'delivered',
      },
    },
    {
      $group: {
        _id: '$orderItems.product',
        totalSold: { $sum: '$orderItems.quantity' },
        soldLast30Days: {
          $sum: {
            $cond: [{ $gte: ['$createdAt', sinceDate] }, '$orderItems.quantity', 0],
          },
        },
      },
    },
  ]);

  const map = new Map();
  stats.forEach((entry) => {
    map.set(String(entry._id), {
      totalSold: Number(entry.totalSold) || 0,
      soldLast30Days: Number(entry.soldLast30Days) || 0,
    });
  });
  return map;
};

const collectProductReviewStats = async (productIds) => {
  if (!productIds?.length) {
    return new Map();
  }

  const stats = await ProductReview.aggregate([
    { $match: { product: { $in: productIds } } },
    {
      $group: {
        _id: '$product',
        reviewCount: { $sum: 1 },
        averageRating: { $avg: '$rating' },
      },
    },
  ]);

  const map = new Map();
  stats.forEach((entry) => {
    const averageRating = Number(entry.averageRating ?? 0);
    map.set(String(entry._id), {
      reviewCount: Number(entry.reviewCount) || 0,
      averageRating: averageRating > 0 ? Math.round(averageRating * 10) / 10 : 0,
    });
  });
  return map;
};

const shapeMarketplaceProduct = (product, salesStats = {}, reviewStats = {}) => {
  const base = mapCatalogueProduct(product);
  return {
    ...base,
    stats: {
      soldLast30Days: salesStats.soldLast30Days ?? 0,
      totalSold: salesStats.totalSold ?? 0,
      inStock: product.stock > 0 && product.status === 'available',
    },
    reviews: {
      count: reviewStats.reviewCount ?? 0,
      averageRating: reviewStats.averageRating ?? 0,
    },
  };
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

  if (search && search.trim()) {
    const term = escapeRegex(search.trim());
    filters.$or = [
      { name: { $regex: term, $options: 'i' } },
      { description: { $regex: term, $options: 'i' } },
    ];
  }

  const resolvedPageSize = Math.min(Math.max(Number(pageSize) || 24, 6), 60);
  const resolvedPage = Math.max(Number(page) || 1, 1);
  const skip = (resolvedPage - 1) * resolvedPageSize;

  let sortStage = { updatedAt: -1 };
  if (sort === 'priceLow') {
    sortStage = { price: 1 };
  } else if (sort === 'priceHigh') {
    sortStage = { price: -1 };
  } else if (sort === 'newest') {
    sortStage = { createdAt: -1 };
  }

  const baseQuery = Product.find(filters)
    .populate({ path: 'seller', select: 'name firstName lastName email role' })
    .sort(sortStage)
    .skip(skip)
    .limit(resolvedPageSize)
    .lean();

  const [products, total] = await Promise.all([
    baseQuery,
    Product.countDocuments(filters),
  ]);

  const productIds = products.map((product) => product._id);
  const [salesStats, reviewStats] = await Promise.all([
    collectProductSalesStats(productIds),
    collectProductReviewStats(productIds),
  ]);

  const enriched = products.map((product) => {
    const key = String(product._id);
    return shapeMarketplaceProduct(product, salesStats.get(key), reviewStats.get(key));
  });

  return res
    .status(200)
    .json(new ApiResponse(200, {
      products: enriched,
      pagination: {
        page: resolvedPage,
        pageSize: resolvedPageSize,
        total,
        totalPages: Math.ceil(total / resolvedPageSize) || 0,
      },
    }, 'Marketplace catalogue fetched successfully'));
});

export const getMarketplaceProduct = asyncHandler(async (req, res) => {
  const productId = toObjectId(req.params.productId, 'Product id');

  const product = await Product.findOne({ _id: productId, isPublished: true })
    .populate({ path: 'seller', select: 'name firstName lastName email role profilePicture' })
    .lean();

  if (!product) {
    throw new ApiError(404, 'Product not found');
  }

  const key = String(product._id);
  const [salesStats, reviewStats, reviewItems] = await Promise.all([
    collectProductSalesStats([product._id]),
    collectProductReviewStats([product._id]),
    ProductReview.find({ product: productId })
      .sort({ createdAt: -1 })
      .limit(12)
      .populate({ path: 'user', select: 'name profilePicture role' })
      .lean(),
  ]);

  const shaped = shapeMarketplaceProduct(product, salesStats.get(key), reviewStats.get(key));

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

  const productPayload = {
    ...shaped,
    reviews: {
      ...shaped.reviews,
      items: reviewPayload,
    },
  };

  return res
    .status(200)
    .json(new ApiResponse(200, { product: productPayload }, 'Marketplace product fetched successfully'));
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

  const preparedItems = items.map((item, index) => {
    const quantity = Number(item?.quantity ?? 0);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new ApiError(400, `Quantity for item ${index + 1} is invalid.`);
    }

    return {
      productId: toObjectId(item?.productId ?? item?.id, 'Product id'),
      quantity,
    };
  });

  const productIds = preparedItems.map((item) => item.productId);

  const products = await Product.find({ _id: { $in: productIds } });

  if (!products.length) {
    throw new ApiError(404, 'Selected products could not be found.');
  }

  const productMap = new Map(products.map((product) => [String(product._id), product]));

  const initialStatusTimestamp = new Date();

  const orderItems = preparedItems.map(({ productId, quantity }) => {
    const product = productMap.get(String(productId));

    if (!product) {
      throw new ApiError(404, 'One or more products are no longer available.');
    }

    if (!product.isPublished || product.status !== 'available' || product.stock <= 0) {
      throw new ApiError(400, `${product.name} is currently unavailable.`);
    }

    if (quantity > product.stock) {
      throw new ApiError(400, `Only ${product.stock} units of ${product.name} are available right now.`);
    }

    return {
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
    };
  });

  const requiredAddressFields = ['firstName', 'lastName', 'email', 'phone', 'address', 'city', 'state', 'zipCode'];

  if (!shippingAddress || requiredAddressFields.some((field) => !shippingAddress[field])) {
    throw new ApiError(400, 'Please provide a complete shipping address.');
  }

  const subtotal = orderItems.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 0), 0);
  const tax = 0;
  const shippingCost = 0;
  const total = subtotal + tax + shippingCost;

  const orderNumber = await generateOrderNumber();

  const order = await Order.create({
    user: userId,
    orderItems,
    shippingAddress,
    paymentMethod,
    subtotal,
    tax,
    shippingCost,
    total,
    orderNumber,
  });

  await Promise.all(orderItems.map(async (item) => {
    const product = productMap.get(String(item.product));
    if (!product) {
      return;
    }

    const updatedStock = Math.max(0, (product.stock || 0) - item.quantity);
    product.stock = updatedStock;
    if (updatedStock === 0) {
      product.status = 'out-of-stock';
    }
    await product.save();
  }));

  const populated = await Order.findById(order._id)
    .populate({
      path: 'orderItems.product',
      select: 'name image',
    })
    .lean();

  return res
    .status(201)
    .json(new ApiResponse(201, { order: mapBuyerOrder(populated) }, 'Order placed successfully'));
});

export const listSellerProducts = asyncHandler(async (req, res) => {
  ensureSellerActive(req.user);

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

export const listSellerOrders = asyncHandler(async (req, res) => {
  const sellerId = req.user._id;

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

  const normaliseOrderItemStatuses = (items) => {
    items.forEach((item) => {
      item.status = normaliseItemStatus(item.status);
    });
  };

  const allItems = order.orderItems || [];
  normaliseOrderItemStatuses(allItems);

  targetItems.forEach((item) => {
    const currentStatus = normaliseItemStatus(item.status);
    if (!canTransitionStatus(currentStatus, nextStatus)) {
      throw new ApiError(400, 'Order items can only move forward through the fulfillment steps.');
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

  const payoutResult = recordSellerPayoutIfEligible(order, sellerId);

  await order.save();

  if (payoutResult) {
    const metadataEntries = [
      ['orderId', String(order._id)],
      ['sellerId', String(sellerId)],
      ['itemsCount', String(payoutResult.itemsCount)],
      ['grossAmount', String(payoutResult.grossAmount)],
      ['commission', String(payoutResult.adminCommission)],
    ];

    const sellerRevenuePromise = payoutResult.sellerPayout > 0
      ? Revenue.create({
        order: order._id,
        amount: payoutResult.sellerPayout,
        user: sellerId,
        type: 'seller',
        description: `Order ${order.orderNumber ?? order._id} items delivered (85% seller share)`,
        metadata: new Map(metadataEntries),
      })
      : Promise.resolve(null);

    const adminRevenuePromise = payoutResult.adminCommission > 0
      ? Revenue.create({
        order: order._id,
        amount: payoutResult.adminCommission,
        user: null,
        type: 'marketplace',
        description: `Admin commission from order ${order.orderNumber ?? order._id} delivery (15%)`,
        metadata: new Map([
          ...metadataEntries,
          ['sellerPayout', String(payoutResult.sellerPayout)],
        ]),
      })
      : Promise.resolve(null);

    await Promise.all([sellerRevenuePromise, adminRevenuePromise]);
  }

  const refreshed = await Order.findById(order._id)
    .populate({ path: 'user', select: 'name email' })
    .lean();

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
