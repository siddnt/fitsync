import mongoose from 'mongoose';
import Product from '../../models/product.model.js';
import Order, { ORDER_ITEM_STATUSES } from '../../models/order.model.js';
import Revenue from '../../models/revenue.model.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

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

const SELLER_STATUS_FLAGS = new Set(ORDER_ITEM_STATUSES);

const ORDER_NUMBER_PREFIX = 'FS';

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

const mapBuyerOrder = (order) => ({
  id: order._id,
  orderNumber: order.orderNumber,
  subtotal: order.subtotal,
  tax: order.tax,
  shippingCost: order.shippingCost,
  total: order.total,
  status: order.status,
  paymentMethod: order.paymentMethod,
  createdAt: order.createdAt,
  items: (order.orderItems || []).map((item) => ({
    id: item.product?._id ?? item.product,
    name: item.name,
    quantity: item.quantity,
    price: item.price,
    image: item.image ?? item.product?.image ?? null,
    status: item.status,
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

export const listMarketplaceCatalogue = asyncHandler(async (_req, res) => {
  const products = await Product.find({
    isPublished: true,
    status: 'available',
    stock: { $gt: 0 },
  })
    .sort({ updatedAt: -1 })
    .populate({ path: 'seller', select: 'name firstName lastName email role' })
    .lean();

  return res
    .status(200)
    .json(new ApiResponse(200, { products: products.map(mapCatalogueProduct) }, 'Marketplace catalogue fetched successfully'));
});

export const createMarketplaceOrder = asyncHandler(async (req, res) => {
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
  const products = await Product.find({ seller: req.user._id })
    .sort({ updatedAt: -1 })
    .lean();

  return res
    .status(200)
    .json(new ApiResponse(200, { products: products.map(mapProduct) }, 'Products fetched successfully'));
});

export const createSellerProduct = asyncHandler(async (req, res) => {
  const {
    name,
    description,
    price,
    mrp,
    image,
    category,
    stock,
    status = 'available',
    isPublished = true,
  } = req.body ?? {};

  if (!name || !description || mrp === undefined || !category) {
    throw new ApiError(400, 'Name, description, MRP, and category are required');
  }

  const mrpValue = Number(mrp);
  if (!Number.isFinite(mrpValue) || mrpValue <= 0) {
    throw new ApiError(400, 'MRP must be a valid amount');
  }

  let priceValue = price === undefined || price === null || price === '' ? mrpValue : Number(price);
  if (!Number.isFinite(priceValue) || priceValue <= 0) {
    priceValue = mrpValue;
  }
  if (priceValue > mrpValue) {
    priceValue = mrpValue;
  }

  const product = await Product.create({
    seller: req.user._id,
    name,
    description,
    price: priceValue,
    mrp: mrpValue,
    image,
    category,
    stock,
    status,
    isPublished,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, { product: mapProduct(product) }, 'Product created successfully'));
});

export const updateSellerProduct = asyncHandler(async (req, res) => {
  const productId = toObjectId(req.params.productId, 'Product id');
  const product = await Product.findOne({ _id: productId, seller: req.user._id });

  if (!product) {
    throw new ApiError(404, 'Product not found');
  }

  const { name, description, price, mrp, image, category, stock, status, isPublished } = req.body ?? {};

  if (name !== undefined) product.name = name;
  if (description !== undefined) product.description = description;
  if (mrp !== undefined) {
    const mrpValue = Number(mrp);
    if (!Number.isFinite(mrpValue) || mrpValue < 0) {
      throw new ApiError(400, 'MRP must be a valid amount');
    }
    product.mrp = mrpValue;
  }
  if (price !== undefined) {
    const priceValue = Number(price);
    if (!Number.isFinite(priceValue) || priceValue < 0) {
      throw new ApiError(400, 'Selling price must be a valid amount');
    }
    product.price = priceValue;
  }
  if (image !== undefined) product.image = image;
  if (category !== undefined) product.category = category;
  if (stock !== undefined) product.stock = stock;
  if (status !== undefined) product.status = status;
  if (isPublished !== undefined) product.isPublished = isPublished;

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
    return 'Processing';
  }

  if (items.every((item) => item.status === 'cancelled')) {
    return 'Cancelled';
  }

  if (items.every((item) => item.status === 'delivered')) {
    return 'Delivered';
  }

  if (items.some((item) => item.status === 'in-transit' || item.status === 'out-for-delivery')) {
    return 'Shipped';
  }

  return 'Processing';
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
      status: item.status,
      lastStatusAt: item.lastStatusAt,
      statusHistory: (item.statusHistory || []).map((entry) => ({
        status: entry.status,
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

  const allDelivered = sellerItems.every((item) => item.status === 'delivered');
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

  if (!status || !SELLER_STATUS_FLAGS.has(status)) {
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

  targetItems.forEach((item) => {
    item.status = status;
    item.lastStatusAt = now;
    if (!Array.isArray(item.statusHistory)) {
      item.statusHistory = [];
    }
    item.statusHistory.push({
      status,
      note,
      updatedBy: sellerId,
      updatedAt: now,
    });

    if (status !== 'delivered') {
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
