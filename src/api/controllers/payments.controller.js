import mongoose from 'mongoose';
import Stripe from 'stripe';
import Gym from '../../models/gym.model.js';
import GymListingSubscription from '../../models/gymListingSubscription.model.js';
import Product from '../../models/product.model.js';
import Order from '../../models/order.model.js';
import Revenue from '../../models/revenue.model.js';
import User from '../../models/user.model.js';
import PaymentSession from '../../models/paymentSession.model.js';
import { resolveListingPlan, resolveSponsorshipPackage } from '../../config/monetisation.config.js';
import {
  STRIPE_PUBLISHABLE_KEY,
  STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET,
  isStripeConfigured,
} from '../../config/stripe.config.js';
import {
  activateListingSubscription,
  activateGymSponsorship,
} from './monetisation.controller.js';
import {
  preparePaidMembershipContext,
  activatePaidGymMembership,
} from './gymMembership.controller.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const ensureStripeConfigured = () => {
  if (!isStripeConfigured()) {
    throw new ApiError(503, 'Stripe is not configured on this server.');
  }
};

let stripeClient = null;
const CUSTOMER_ROLES = new Set(['user', 'trainee']);
const ORDER_NUMBER_PREFIX = 'FS';
const DEFAULT_DEMO_UPI_ID = 'fitsync.demo@upi';
const DEFAULT_DEMO_UPI_NAME = 'FitSync Demo';

const getStripeClient = () => {
  ensureStripeConfigured();
  if (!stripeClient) {
    stripeClient = new Stripe(STRIPE_SECRET_KEY);
  }
  return stripeClient;
};

const toObjectId = (value, label) => {
  if (!value) {
    throw new ApiError(400, `${label} is required.`);
  }
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new ApiError(400, `${label} is invalid.`);
  }
  return new mongoose.Types.ObjectId(value);
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
  }
  return defaultValue;
};

const toPositiveInteger = (value, fallback, min = 1, max = Number.MAX_SAFE_INTEGER) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
};

const normalizeLocationInput = (location) => {
  if (!location) {
    return undefined;
  }

  const sanitized = { ...location };

  if (sanitized.coordinates) {
    const coordsCandidate = sanitized.coordinates.coordinates ?? sanitized.coordinates;

    if (Array.isArray(coordsCandidate) && coordsCandidate.length === 2) {
      sanitized.coordinates = {
        type: 'Point',
        coordinates: coordsCandidate.map(Number),
      };
    } else if (
      coordsCandidate &&
      typeof coordsCandidate === 'object' &&
      ('lat' in coordsCandidate || 'latitude' in coordsCandidate) &&
      ('lng' in coordsCandidate || 'longitude' in coordsCandidate)
    ) {
      const lat = coordsCandidate.lat ?? coordsCandidate.latitude;
      const lng = coordsCandidate.lng ?? coordsCandidate.longitude;
      sanitized.coordinates = {
        type: 'Point',
        coordinates: [Number(lng), Number(lat)],
      };
    } else {
      delete sanitized.coordinates;
    }
  }

  return sanitized;
};

const resolveClientBaseUrl = () => {
  const explicit =
    process.env.CLIENT_BASE_URL ||
    process.env.FRONTEND_URL ||
    process.env.PUBLIC_CLIENT_URL;

  if (explicit) {
    return explicit.replace(/\/+$/, '');
  }

  const origins = String(process.env.CORS_ORIGIN || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (!origins.length) {
    return String(process.env.APP_BASE_URL || 'http://localhost:5173').replace(/\/+$/, '');
  }

  const likelyClient = origins.find((origin) => {
    try {
      const { port } = new URL(origin);
      return port === '5173' || port === '3000';
    } catch (_error) {
      return false;
    }
  });

  return (likelyClient || origins[0]).replace(/\/+$/, '');
};

const sanitizeRedirectPath = (value, fallbackPath) => {
  if (typeof value !== 'string') {
    return fallbackPath;
  }

  const trimmed = value.trim();
  if (!trimmed || !trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return fallbackPath;
  }

  return trimmed;
};

const resolveRedirectPaths = (type, paymentSessionId, metadata = {}) => {
  const clientBaseUrl = resolveClientBaseUrl();
  const routeByType = {
    'gym-subscription': '/dashboard/gym-owner/subscriptions',
    sponsorship: '/dashboard/gym-owner/sponsorship',
    'gym-create': '/dashboard/gym-owner/gyms',
    membership: '/gyms',
    shop: '/checkout',
  };
  const routePath = sanitizeRedirectPath(metadata?.redirectPath, routeByType[type]);

  if (!routePath) {
    throw new ApiError(500, 'Unsupported checkout type for redirect.');
  }

  const successUrl = new URL(`${clientBaseUrl}${routePath}`);
  successUrl.searchParams.set('stripe', 'success');
  successUrl.searchParams.set('payment_session_id', paymentSessionId);
  successUrl.searchParams.set('session_id', '{CHECKOUT_SESSION_ID}');

  const cancelUrl = new URL(`${clientBaseUrl}${routePath}`);
  cancelUrl.searchParams.set('stripe', 'cancelled');
  cancelUrl.searchParams.set('payment_session_id', paymentSessionId);

  return { successUrl: successUrl.toString(), cancelUrl: cancelUrl.toString() };
};

const ensureGymOwnerAccess = async (user, gymId) => {
  const gym = await Gym.findById(gymId).select('_id owner name');
  if (!gym) {
    throw new ApiError(404, 'Gym not found.');
  }

  if (user.role !== 'admin' && String(gym.owner) !== String(user._id)) {
    throw new ApiError(403, 'You do not have access to this gym.');
  }

  return gym;
};

const toMinorAmount = (amount) => {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) {
    throw new ApiError(400, 'Payment amount must be greater than zero.');
  }
  return Math.round(value * 100);
};

const isDemoUpiModeEnabled = () => parseBoolean(process.env.UPI_DUMMY_MODE, true);

const buildDemoUpiPayload = ({ paymentSession, amount }) => {
  const upiId = String(process.env.DEMO_UPI_ID || DEFAULT_DEMO_UPI_ID).trim();
  const payeeName = String(process.env.DEMO_UPI_NAME || DEFAULT_DEMO_UPI_NAME).trim();
  const reference = `demo-${String(paymentSession._id).slice(-8)}-${Date.now()}`;
  const amountValue = Number(amount);
  const resolvedAmount = Number.isFinite(amountValue) ? amountValue : 0;
  const formattedAmount = resolvedAmount.toFixed(2);
  const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName)}&am=${encodeURIComponent(formattedAmount)}&cu=INR&tn=${encodeURIComponent(`FitSync demo order ${paymentSession._id}`)}&tr=${encodeURIComponent(reference)}`;

  return {
    reference,
    upiId,
    payeeName,
    amount: formattedAmount,
    currency: 'INR',
    upiUri,
  };
};

const resolvePaymentSessionExpiryPolicy = () => ({
  expiryMinutes: toPositiveInteger(process.env.PAYMENT_SESSION_EXPIRY_MINUTES, 30, 5, 24 * 60),
  batchSize: toPositiveInteger(process.env.PAYMENT_SESSION_SWEEP_BATCH_SIZE, 100, 1, 500),
});

const STRIPE_PAYMENT_METHOD_TYPES = new Set(['card', 'upi']);

const resolveCheckoutPaymentMethods = (currency, requestedTypes = []) => {
  const requested = Array.isArray(requestedTypes)
    ? requestedTypes
      .map((type) => String(type || '').trim().toLowerCase())
      .filter((type) => STRIPE_PAYMENT_METHOD_TYPES.has(type))
    : [];

  if (requested.length) {
    return [...new Set(requested)];
  }

  const normalised = String(currency || '').toLowerCase();
  if (normalised === 'inr') {
    return ['card', 'upi'];
  }
  return ['card'];
};

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

const resolveMarketplacePaymentPreference = ({
  paymentMethod = 'Credit / Debit Card',
  preferredUpiApp,
} = {}) => {
  const paymentMethodLabel = String(paymentMethod || 'Credit / Debit Card').trim() || 'Credit / Debit Card';
  const isUpiPayment = paymentMethodLabel.toLowerCase().startsWith('upi');
  const preferredUpiAppLabelRaw = isUpiPayment && preferredUpiApp
    ? String(preferredUpiApp).trim()
    : '';
  const preferredUpiAppLabel = preferredUpiAppLabelRaw.toLowerCase() === 'any upi app'
    ? ''
    : preferredUpiAppLabelRaw;
  const resolvedPaymentMethod = isUpiPayment
    ? preferredUpiAppLabel
      ? `UPI (${preferredUpiAppLabel})`
      : 'UPI'
    : paymentMethodLabel;

  return {
    isUpiPayment,
    preferredUpiAppLabel,
    resolvedPaymentMethod,
    requestedPaymentMethodTypes: isUpiPayment ? ['upi'] : ['card'],
  };
};

const mapStripeStatus = (stripeStatus) => {
  if (!stripeStatus) {
    return 'open';
  }

  const normalised = String(stripeStatus).toLowerCase();
  if (normalised === 'complete' || normalised === 'paid' || normalised === 'succeeded') {
    return 'completed';
  }
  if (normalised === 'expired') {
    return 'expired';
  }
  if (normalised === 'canceled' || normalised === 'cancelled') {
    return 'canceled';
  }
  return 'open';
};


const mapBuyerOrder = (order) => ({
  id: order._id,
  orderNumber: order.orderNumber,
  subtotal: order.subtotal,
  tax: order.tax,
  shippingCost: order.shippingCost,
  codFee: Number(order.codFee || 0),
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
    status: item.status ?? 'processing',
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

const createGymWithStripeActivation = async ({
  actor,
  gymPayload,
  planCode,
  autoRenew = true,
  paymentReference,
  stripeSessionId,
  stripePaymentIntentId,
}) => {
  if (!actor?._id || !['gym-owner', 'admin'].includes(actor.role)) {
    throw new ApiError(403, 'Only gym owners or admins can create gyms with listing activation.');
  }

  const plan = resolveListingPlan(planCode);
  if (!plan) {
    throw new ApiError(400, 'Select a valid listing plan to register your gym.');
  }

  if (!paymentReference) {
    throw new ApiError(400, 'Payment reference is required to activate the listing.');
  }

  const {
    name,
    description,
    keyFeatures,
    amenities,
    location,
    pricing,
    contact,
    schedule,
    gallery,
    sponsorship,
    tags,
  } = gymPayload ?? {};

  if (!name || !location?.city) {
    throw new ApiError(400, 'Gym name and city are required.');
  }

  const sanitizedLocation = normalizeLocationInput(location) ?? {};
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + plan.durationMonths);

  const gym = await Gym.create({
    owner: actor._id,
    name,
    description,
    keyFeatures,
    amenities,
    location: sanitizedLocation,
    pricing,
    contact,
    schedule,
    gallery,
    sponsorship,
    tags,
    status: 'active',
    isPublished: true,
    approvedAt: now,
    lastUpdatedBy: actor._id,
  });

  try {
    await GymListingSubscription.create({
      gym: gym._id,
      owner: actor._id,
      planCode: plan.planCode,
      amount: plan.amount,
      currency: plan.currency,
      periodStart: now,
      periodEnd,
      status: 'active',
      autoRenew: Boolean(autoRenew),
      invoices: [
        {
          amount: plan.amount,
          currency: plan.currency,
          paidOn: now,
          paymentReference,
          status: 'paid',
          metadata: new Map(
            [
              ['paymentSource', 'stripe'],
              ...(stripeSessionId ? [['stripeSessionId', String(stripeSessionId)]] : []),
              ...(stripePaymentIntentId ? [['stripePaymentIntentId', String(stripePaymentIntentId)]] : []),
            ],
          ),
        },
      ],
      metadata: new Map(
        [
          ['planLabel', plan.label],
          ['durationMonths', String(plan.durationMonths)],
          ['paymentSource', 'stripe'],
          ...(stripeSessionId ? [['stripeSessionId', String(stripeSessionId)]] : []),
          ...(stripePaymentIntentId ? [['stripePaymentIntentId', String(stripePaymentIntentId)]] : []),
        ],
      ),
      createdBy: actor._id,
    });

    await Revenue.create({
      amount: plan.amount,
      user: actor._id,
      type: 'listing',
      description: `${plan.label} activation for ${name}`,
      metadata: new Map(
        [
          ['gymId', String(gym._id)],
          ['planCode', plan.planCode],
          ['paymentReference', String(paymentReference)],
          ['paymentSource', 'stripe'],
          ...(stripeSessionId ? [['stripeSessionId', String(stripeSessionId)]] : []),
          ...(stripePaymentIntentId ? [['stripePaymentIntentId', String(stripePaymentIntentId)]] : []),
        ],
      ),
    });
  } catch (error) {
    await Promise.all([
      Gym.findByIdAndDelete(gym._id),
      GymListingSubscription.deleteMany({ gym: gym._id }),
    ]);
    throw error;
  }

  return {
    id: String(gym._id),
    name: gym.name,
    city: gym.location?.city ?? null,
    status: gym.status,
  };
};

const buildMarketplaceOrderSnapshot = async ({
  items,
  shippingAddress,
} = {}) => {
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

  const products = await Product.find({
    _id: { $in: preparedItems.map((item) => item.productId) },
  });

  if (!products.length) {
    throw new ApiError(404, 'Selected products could not be found.');
  }

  const productMap = new Map(products.map((product) => [String(product._id), product]));

  const snapshotItems = preparedItems.map(({ productId, quantity }) => {
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

  const subtotal = snapshotItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const tax = 0;
  const shippingCost = 0;
  const total = subtotal + tax + shippingCost;

  return {
    items: snapshotItems,
    subtotal,
    tax,
    shippingCost,
    total,
    shippingAddress,
  };
};

const createMarketplaceOrderFromStripeSession = async ({
  actor,
  paymentSession,
  paymentMethod = 'Credit / Debit Card',
}) => {
  ensureMarketplaceBuyerEligible(actor);

  const snapshot = paymentSession.orderSnapshot;
  if (!snapshot || !Array.isArray(snapshot.items) || !snapshot.items.length) {
    throw new ApiError(400, 'Missing marketplace order snapshot for this payment.');
  }

  const requiredAddressFields = ['firstName', 'lastName', 'email', 'phone', 'address', 'city', 'state', 'zipCode'];
  if (!snapshot.shippingAddress || requiredAddressFields.some((field) => !snapshot.shippingAddress[field])) {
    throw new ApiError(400, 'Please provide a complete shipping address.');
  }

  const preparedItems = snapshot.items.map((item, index) => {
    const quantity = Number(item?.quantity ?? 0);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new ApiError(400, `Quantity for item ${index + 1} is invalid.`);
    }

    const price = Number(item?.price ?? 0);
    if (!Number.isFinite(price) || price <= 0) {
      throw new ApiError(400, `Price for item ${index + 1} is invalid.`);
    }

    return {
      productId: toObjectId(item?.product ?? item?.productId ?? item?.id, 'Product id'),
      quantity,
      price,
      name: item?.name,
      image: item?.image,
    };
  });

  const products = await Product.find({
    _id: { $in: preparedItems.map((item) => item.productId) },
  });
  const productMap = new Map(products.map((product) => [String(product._id), product]));

  const statusTimestamp = new Date();
  const orderItems = preparedItems.map((item) => {
    const product = productMap.get(String(item.productId));
    if (!product) {
      throw new ApiError(404, 'One or more products are no longer available.');
    }

    if (!product.isPublished || product.status !== 'available' || product.stock <= 0) {
      throw new ApiError(409, `${product.name} is currently unavailable.`);
    }

    if (item.quantity > product.stock) {
      throw new ApiError(409, `Only ${product.stock} units of ${product.name} are available right now.`);
    }

    return {
      seller: product.seller ?? undefined,
      product: product._id,
      name: item.name ?? product.name,
      quantity: item.quantity,
      price: item.price,
      image: item.image ?? product.image,
      status: 'processing',
      lastStatusAt: statusTimestamp,
      statusHistory: [
        {
          status: 'processing',
          note: null,
          updatedBy: null,
          updatedAt: statusTimestamp,
        },
      ],
    };
  });

  const subtotal = orderItems.reduce(
    (sum, item) => sum + (item.price || 0) * (item.quantity || 0),
    0,
  );
  const tax = Number(snapshot.tax);
  const shippingCost = Number(snapshot.shippingCost);
  const codFee = Number(snapshot.codFee);
  const resolvedTax = Number.isFinite(tax) && tax >= 0 ? tax : 0;
  const resolvedShippingCost = Number.isFinite(shippingCost) && shippingCost >= 0 ? shippingCost : 0;
  const resolvedCodFee = Number.isFinite(codFee) && codFee >= 0 ? codFee : 0;
  const total = subtotal + resolvedTax + resolvedShippingCost + resolvedCodFee;

  const orderNumber = await generateOrderNumber();

  const order = await Order.create({
    user: actor._id,
    orderItems,
    shippingAddress: snapshot.shippingAddress,
    paymentMethod,
    subtotal,
    tax: resolvedTax,
    shippingCost: resolvedShippingCost,
    codFee: resolvedCodFee,
    total,
    orderNumber,
  });

  await Promise.all(
    orderItems.map(async (item) => {
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
    }),
  );

  const populated = await Order.findById(order._id)
    .populate({
      path: 'orderItems.product',
      select: 'name image',
    });

  return mapBuyerOrder(populated);
};

const processPaidSession = async ({ paymentSession, stripeSession, actor }) => {
  if (!paymentSession) {
    throw new ApiError(404, 'Payment session not found.');
  }

  if (paymentSession.processed) {
    return {
      alreadyProcessed: true,
      resultType: paymentSession.metadata?.resultType ?? null,
      resultId: paymentSession.metadata?.resultId ?? null,
      paymentReference: paymentSession.metadata?.paymentReference ?? paymentSession.stripe?.paymentIntentId ?? null,
    };
  }

  if (!actor?._id) {
    throw new ApiError(401, 'Unable to resolve payment actor.');
  }

  const paymentIntentId = stripeSession?.payment_intent
    ? String(stripeSession.payment_intent)
    : null;
  const paymentReference = paymentIntentId || String(stripeSession?.id || paymentSession.stripe?.checkoutSessionId || paymentSession._id);

  let resultType = null;
  let resultId = null;
  let payload = {};

  if (paymentSession.type === 'gym-subscription') {
    const subscription = await activateListingSubscription({
      actor,
      gymId: paymentSession.gym,
      planCode: paymentSession.metadata?.planCode,
      autoRenew: parseBoolean(paymentSession.metadata?.autoRenew, true),
      paymentReference,
      paymentSource: 'stripe',
      stripeSessionId: stripeSession.id,
      stripePaymentIntentId: paymentIntentId,
    });

    resultType = 'subscription';
    resultId = String(subscription?._id ?? subscription?.id ?? '');
    payload = { subscription };
  } else if (paymentSession.type === 'sponsorship') {
    const sponsorship = await activateGymSponsorship({
      actor,
      gymId: paymentSession.gym,
      tier: paymentSession.metadata?.tier,
      paymentReference,
      paymentSource: 'stripe',
      stripeSessionId: stripeSession.id,
      stripePaymentIntentId: paymentIntentId,
    });

    resultType = 'sponsorship';
    resultId = `${paymentSession.gym}`;
    payload = { sponsorship };
  } else if (paymentSession.type === 'gym-create') {
    const gym = await createGymWithStripeActivation({
      actor,
      gymPayload: paymentSession.metadata?.gymPayload,
      planCode: paymentSession.metadata?.planCode,
      autoRenew: parseBoolean(paymentSession.metadata?.autoRenew, true),
      paymentReference,
      stripeSessionId: stripeSession.id,
      stripePaymentIntentId: paymentIntentId,
    });

    resultType = 'gym';
    resultId = String(gym?.id ?? '');
    payload = { gym };
  } else if (paymentSession.type === 'membership') {
    const membership = await activatePaidGymMembership({
      actor,
      gymId: paymentSession.metadata?.gymId ?? paymentSession.gym,
      trainerId: paymentSession.metadata?.trainerId,
      paymentReference,
      autoRenew: parseBoolean(paymentSession.metadata?.autoRenew, true),
      benefits: Array.isArray(paymentSession.metadata?.benefits) ? paymentSession.metadata.benefits : undefined,
      notes: paymentSession.metadata?.notes,
      billing: {
        currency: paymentSession.currency?.toUpperCase() ?? 'INR',
        paymentGateway: 'stripe',
      },
    });

    resultType = 'membership';
    resultId = String(membership?.id ?? membership?._id ?? '');
    payload = { membership };
  } else if (paymentSession.type === 'shop') {
    const order = await createMarketplaceOrderFromStripeSession({
      actor,
      paymentSession,
      paymentMethod: paymentSession.metadata?.paymentMethod ?? 'Credit / Debit Card',
    });

    resultType = 'order';
    resultId = String(order?.id ?? order?._id ?? '');
    payload = { order };
  } else {
    throw new ApiError(400, `Unsupported payment session type: ${paymentSession.type}`);
  }

  paymentSession.processed = true;
  paymentSession.stripe = {
    checkoutSessionId: stripeSession.id,
    paymentIntentId,
    status: 'completed',
  };
  paymentSession.metadata = {
    ...(paymentSession.metadata ?? {}),
    paymentReference,
    resultType,
    resultId,
    completedAt: new Date().toISOString(),
  };

  await paymentSession.save();

  return {
    alreadyProcessed: false,
    resultType,
    resultId,
    paymentReference,
    ...payload,
  };
};

const buildStripeMetadata = (paymentSession, extra = {}) => {
  const base = {
    paymentSessionId: String(paymentSession._id),
    paymentType: paymentSession.type,
    ...extra,
  };

  return Object.entries(base).reduce((acc, [key, value]) => {
    if (value === undefined || value === null) {
      return acc;
    }
    acc[key] = String(value);
    return acc;
  }, {});
};

const createCheckoutSessionForPayment = async ({
  req,
  type,
  amount,
  currency = 'INR',
  ownerId,
  gymId,
  metadata,
  lineItemName,
  lineItemDescription,
  orderSnapshot,
  paymentMethodTypes,
  allowCardFallback = true,
}) => {
  const stripe = getStripeClient();
  const normalisedCurrency = String(currency || 'INR').toLowerCase();
  const resolvedAmount = Number(amount);
  const unitAmount = toMinorAmount(resolvedAmount);

  const paymentSession = await PaymentSession.create({
    user: req.user._id,
    type,
    owner: ownerId ?? req.user._id,
    gym: gymId,
    amount: resolvedAmount,
    currency: normalisedCurrency,
    orderSnapshot,
    metadata,
  });

  const { successUrl, cancelUrl } = resolveRedirectPaths(type, String(paymentSession._id), metadata);
  const stripeMetadata = buildStripeMetadata(paymentSession, metadata);
  const resolvedPaymentMethodTypes = resolveCheckoutPaymentMethods(normalisedCurrency, paymentMethodTypes);

  const sessionPayload = {
    mode: 'payment',
    payment_method_types: resolvedPaymentMethodTypes,
    customer_email: req.user?.email || undefined,
    success_url: successUrl,
    cancel_url: cancelUrl,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: normalisedCurrency,
          unit_amount: unitAmount,
          product_data: {
            name: lineItemName || 'FitSync payment',
            description: lineItemDescription || undefined,
          },
        },
      },
    ],
    metadata: stripeMetadata,
    payment_intent_data: {
      metadata: stripeMetadata,
    },
  };

  let checkoutSession;
  try {
    checkoutSession = await stripe.checkout.sessions.create(sessionPayload);
  } catch (error) {
    // If UPI is not enabled in Stripe Dashboard yet, retry with card-only.
    const canRetryCardOnly = allowCardFallback && resolvedPaymentMethodTypes.includes('upi');
    if (!canRetryCardOnly) {
      if (resolvedPaymentMethodTypes.includes('upi')) {
        throw new ApiError(
          400,
          'UPI is unavailable for this Stripe account. Enable UPI in Stripe Dashboard for this mode (test/live).',
        );
      }
      throw error;
    }

    checkoutSession = await stripe.checkout.sessions.create({
      ...sessionPayload,
      payment_method_types: ['card'],
    });
  }

  paymentSession.stripe = {
    checkoutSessionId: checkoutSession.id,
    status: mapStripeStatus(checkoutSession.status),
  };

  await paymentSession.save();

  return {
    paymentSession,
    checkoutSession,
  };
};

const createPaymentIntentForPayment = async ({
  req,
  type,
  amount,
  currency = 'INR',
  ownerId,
  gymId,
  metadata,
  orderSnapshot,
  paymentMethodTypes,
}) => {
  const stripe = getStripeClient();
  const normalisedCurrency = String(currency || 'INR').toLowerCase();
  const resolvedAmount = Number(amount);
  const unitAmount = toMinorAmount(resolvedAmount);

  const paymentSession = await PaymentSession.create({
    user: req.user._id,
    type,
    owner: ownerId ?? req.user._id,
    gym: gymId,
    amount: resolvedAmount,
    currency: normalisedCurrency,
    orderSnapshot,
    metadata,
  });

  const stripeMetadata = buildStripeMetadata(paymentSession, metadata);
  const resolvedPaymentMethodTypes = resolveCheckoutPaymentMethods(normalisedCurrency, paymentMethodTypes);

  let paymentIntent;
  try {
    paymentIntent = await stripe.paymentIntents.create({
      amount: unitAmount,
      currency: normalisedCurrency,
      payment_method_types: resolvedPaymentMethodTypes,
      receipt_email: req.user?.email || undefined,
      metadata: stripeMetadata,
    });
  } catch (error) {
    const canRetryCardOnly = resolvedPaymentMethodTypes.includes('upi');
    if (!canRetryCardOnly) {
      throw error;
    }

    paymentIntent = await stripe.paymentIntents.create({
      amount: unitAmount,
      currency: normalisedCurrency,
      payment_method_types: ['card'],
      receipt_email: req.user?.email || undefined,
      metadata: stripeMetadata,
    });
  }

  paymentSession.stripe = {
    paymentIntentId: paymentIntent.id,
    status: mapStripeStatus(paymentIntent.status),
  };
  await paymentSession.save();

  return {
    paymentSession,
    paymentIntent,
  };
};

export const getStripeConfig = asyncHandler(async (_req, res) => {
  const configured = isStripeConfigured();
  return res.status(200).json(
    new ApiResponse(200, {
      configured,
      publishableKey: configured ? STRIPE_PUBLISHABLE_KEY : null,
    }, configured ? 'Stripe is configured.' : 'Stripe is not configured.'),
  );
});

export const createOwnerListingCheckoutSession = asyncHandler(async (req, res) => {
  ensureStripeConfigured();

  const { gymId: gymIdRaw, planCode, autoRenew = true } = req.body ?? {};
  const plan = resolveListingPlan(planCode);

  if (!plan) {
    throw new ApiError(400, 'Unknown subscription plan selected.');
  }

  const gymId = toObjectId(gymIdRaw, 'Gym id');
  const gym = await ensureGymOwnerAccess(req.user, gymId);

  const { paymentSession, checkoutSession } = await createCheckoutSessionForPayment({
    req,
    type: 'gym-subscription',
    amount: plan.amount,
    currency: plan.currency,
    ownerId: req.user._id,
    gymId: gym._id,
    metadata: {
      gymId: String(gym._id),
      gymName: gym.name,
      planCode: plan.planCode,
      autoRenew: parseBoolean(autoRenew, true),
    },
    lineItemName: `${plan.label} - ${gym.name}`,
    lineItemDescription: `Gym listing activation (${plan.durationMonths} month plan)`,
  });

  return res.status(201).json(
    new ApiResponse(201, {
      paymentSessionId: paymentSession._id,
      checkoutSessionId: checkoutSession.id,
      checkoutUrl: checkoutSession.url,
    }, 'Stripe checkout session created.'),
  );
});

export const createOwnerSponsorshipCheckoutSession = asyncHandler(async (req, res) => {
  ensureStripeConfigured();

  const { gymId: gymIdRaw, tier } = req.body ?? {};
  const sponsorshipPackage = resolveSponsorshipPackage(tier);

  if (!sponsorshipPackage) {
    throw new ApiError(400, 'Unknown sponsorship package.');
  }

  const gymId = toObjectId(gymIdRaw, 'Gym id');
  const gym = await ensureGymOwnerAccess(req.user, gymId);

  const { paymentSession, checkoutSession } = await createCheckoutSessionForPayment({
    req,
    type: 'sponsorship',
    amount: sponsorshipPackage.amount,
    currency: sponsorshipPackage.currency,
    ownerId: req.user._id,
    gymId: gym._id,
    metadata: {
      gymId: String(gym._id),
      gymName: gym.name,
      tier: sponsorshipPackage.tier,
    },
    lineItemName: `${sponsorshipPackage.label} - ${gym.name}`,
    lineItemDescription: `Sponsorship package (${sponsorshipPackage.durationMonths} month plan)`,
  });

  return res.status(201).json(
    new ApiResponse(201, {
      paymentSessionId: paymentSession._id,
      checkoutSessionId: checkoutSession.id,
      checkoutUrl: checkoutSession.url,
    }, 'Stripe checkout session created.'),
  );
});

export const createGymCreationCheckoutSession = asyncHandler(async (req, res) => {
  ensureStripeConfigured();

  const { gym: gymPayload, planCode, autoRenew = true, redirectPath } = req.body ?? {};
  const plan = resolveListingPlan(planCode);

  if (!plan) {
    throw new ApiError(400, 'Unknown subscription plan selected.');
  }

  if (!gymPayload || !gymPayload.name || !gymPayload.location?.city) {
    throw new ApiError(400, 'Gym name and city are required.');
  }

  const { paymentSession, checkoutSession } = await createCheckoutSessionForPayment({
    req,
    type: 'gym-create',
    amount: plan.amount,
    currency: plan.currency,
    ownerId: req.user._id,
    metadata: {
      gymName: gymPayload.name,
      planCode: plan.planCode,
      autoRenew: parseBoolean(autoRenew, true),
      gymPayload,
      redirectPath,
    },
    lineItemName: `${plan.label} - ${gymPayload.name}`,
    lineItemDescription: `New gym listing activation (${plan.durationMonths} month plan)`,
  });

  return res.status(201).json(
    new ApiResponse(201, {
      paymentSessionId: paymentSession._id,
      checkoutSessionId: checkoutSession.id,
      checkoutUrl: checkoutSession.url,
    }, 'Stripe checkout session created.'),
  );
});

export const createMembershipCheckoutSession = asyncHandler(async (req, res) => {
  ensureStripeConfigured();

  const {
    gymId: gymIdRaw,
    trainerId,
    autoRenew = true,
    benefits,
    notes,
    redirectPath,
  } = req.body ?? {};

  const gymId = toObjectId(gymIdRaw, 'Gym id');
  const { gym, assignment, monthlyFee } = await preparePaidMembershipContext({
    actor: req.user,
    gymId,
    trainerId,
  });

  const currency = String(gym?.pricing?.currency || 'INR').toUpperCase();
  const trainerName = assignment?.trainer?.name || 'Assigned trainer';

  const { paymentSession, checkoutSession } = await createCheckoutSessionForPayment({
    req,
    type: 'membership',
    amount: monthlyFee,
    currency,
    ownerId: gym.owner,
    gymId: gym._id,
    metadata: {
      gymId: String(gym._id),
      gymName: gym.name,
      trainerId: String(assignment.trainer._id),
      trainerName,
      autoRenew: parseBoolean(autoRenew, true),
      benefits: Array.isArray(benefits) ? benefits : undefined,
      notes: typeof notes === 'string' ? notes.trim() : undefined,
      paymentMethod: 'Credit / Debit Card',
      redirectPath,
    },
    lineItemName: `Monthly membership - ${gym.name}`,
    lineItemDescription: `Trainer: ${trainerName}`,
  });

  return res.status(201).json(
    new ApiResponse(201, {
      paymentSessionId: paymentSession._id,
      checkoutSessionId: checkoutSession.id,
      checkoutUrl: checkoutSession.url,
    }, 'Stripe checkout session created.'),
  );
});

export const createMarketplaceCheckoutSession = asyncHandler(async (req, res) => {
  ensureStripeConfigured();
  ensureMarketplaceBuyerEligible(req.user);

  const {
    items,
    shippingAddress,
    paymentMethod = 'Credit / Debit Card',
    preferredUpiApp,
    redirectPath,
  } = req.body ?? {};

  const { isUpiPayment, preferredUpiAppLabel, resolvedPaymentMethod, requestedPaymentMethodTypes } =
    resolveMarketplacePaymentPreference({
      paymentMethod,
      preferredUpiApp,
    });

  if (isUpiPayment) {
    throw new ApiError(400, 'UPI payments use the dedicated UPI session endpoint.');
  }

  const orderSnapshot = await buildMarketplaceOrderSnapshot({
    items,
    shippingAddress,
  });

  const { paymentSession, checkoutSession } = await createCheckoutSessionForPayment({
    req,
    type: 'shop',
    amount: orderSnapshot.total,
    currency: 'INR',
    paymentMethodTypes: requestedPaymentMethodTypes,
    allowCardFallback: !isUpiPayment,
    metadata: {
      paymentMethod: resolvedPaymentMethod,
      preferredUpiApp: preferredUpiAppLabel || undefined,
      redirectPath,
    },
    orderSnapshot,
    lineItemName: 'FitSync Marketplace Order',
    lineItemDescription: `${orderSnapshot.items.length} item(s)`,
  });

  return res.status(201).json(
    new ApiResponse(201, {
      paymentSessionId: paymentSession._id,
      checkoutSessionId: checkoutSession.id,
      checkoutUrl: checkoutSession.url,
    }, 'Stripe checkout session created.'),
  );
});

export const createMarketplacePaymentIntent = asyncHandler(async (req, res) => {
  ensureStripeConfigured();
  ensureMarketplaceBuyerEligible(req.user);

  const {
    items,
    shippingAddress,
    paymentMethod = 'Credit / Debit Card',
    preferredUpiApp,
  } = req.body ?? {};

  const { preferredUpiAppLabel, resolvedPaymentMethod, requestedPaymentMethodTypes } =
    resolveMarketplacePaymentPreference({
      paymentMethod,
      preferredUpiApp,
    });

  if (requestedPaymentMethodTypes.includes('upi')) {
    throw new ApiError(400, 'UPI payments use the dedicated UPI session endpoint.');
  }

  const orderSnapshot = await buildMarketplaceOrderSnapshot({
    items,
    shippingAddress,
  });

  const { paymentSession, paymentIntent } = await createPaymentIntentForPayment({
    req,
    type: 'shop',
    amount: orderSnapshot.total,
    currency: 'INR',
    paymentMethodTypes: requestedPaymentMethodTypes,
    metadata: {
      paymentMethod: resolvedPaymentMethod,
      preferredUpiApp: preferredUpiAppLabel || undefined,
      paymentFlow: 'elements',
    },
    orderSnapshot,
  });

  return res.status(201).json(
    new ApiResponse(201, {
      paymentSessionId: paymentSession._id,
      paymentIntentId: paymentIntent.id,
      clientSecret: paymentIntent.client_secret,
      publishableKey: STRIPE_PUBLISHABLE_KEY,
    }, 'Payment intent created.'),
  );
});

export const createMarketplaceUpiSession = asyncHandler(async (req, res) => {
  ensureMarketplaceBuyerEligible(req.user);

  const {
    items,
    shippingAddress,
    paymentMethod = 'UPI',
    preferredUpiApp,
  } = req.body ?? {};

  const { isUpiPayment, preferredUpiAppLabel, resolvedPaymentMethod } =
    resolveMarketplacePaymentPreference({
      paymentMethod,
      preferredUpiApp,
    });

  if (!isUpiPayment) {
    throw new ApiError(400, 'UPI session creation is only available for UPI payments.');
  }

  const orderSnapshot = await buildMarketplaceOrderSnapshot({
    items,
    shippingAddress,
  });

  const paymentSession = await PaymentSession.create({
    user: req.user._id,
    type: 'shop',
    owner: req.user._id,
    amount: orderSnapshot.total,
    currency: 'inr',
    orderSnapshot,
    metadata: {
      paymentMethod: resolvedPaymentMethod,
      preferredUpiApp: preferredUpiAppLabel || undefined,
      paymentGateway: 'demo-upi',
      paymentFlow: 'manual-upi',
    },
  });

  const demoUpiPayload = buildDemoUpiPayload({
    paymentSession,
    amount: orderSnapshot.total,
  });

  paymentSession.metadata = {
    ...(paymentSession.metadata ?? {}),
    demoUpiReference: demoUpiPayload.reference,
    demoUpiId: demoUpiPayload.upiId,
    demoUpiName: demoUpiPayload.payeeName,
    demoUpiUri: demoUpiPayload.upiUri,
  };
  await paymentSession.save();

  return res.status(201).json(
    new ApiResponse(201, {
      paymentSessionId: paymentSession._id,
      upiId: demoUpiPayload.upiId,
      payeeName: demoUpiPayload.payeeName,
      upiUri: demoUpiPayload.upiUri,
      amount: demoUpiPayload.amount,
      currency: demoUpiPayload.currency,
    }, 'UPI payment session created.'),
  );
});

export const confirmMarketplaceUpiPayment = asyncHandler(async (req, res) => {
  ensureMarketplaceBuyerEligible(req.user);

  const {
    paymentSessionId,
    transactionReference,
  } = req.body ?? {};

  if (!paymentSessionId) {
    throw new ApiError(400, 'paymentSessionId is required.');
  }

  const paymentSession = await PaymentSession.findById(paymentSessionId);
  if (!paymentSession) {
    throw new ApiError(404, 'Payment session not found.');
  }

  const canAccess =
    req.user?.role === 'admin' ||
    String(paymentSession.user) === String(req.user?._id);

  if (!canAccess) {
    throw new ApiError(403, 'You do not have access to this payment session.');
  }

  if (paymentSession.type !== 'shop') {
    throw new ApiError(400, 'Only marketplace sessions are supported for UPI confirmation.');
  }

  if (!isDemoUpiModeEnabled()) {
    throw new ApiError(409, 'UPI demo mode is disabled on this server.');
  }

  const demoReference = String(
    transactionReference
    || paymentSession.metadata?.demoUpiReference
    || `demo-confirm-${paymentSession._id}`,
  );

  paymentSession.metadata = {
    ...(paymentSession.metadata ?? {}),
    paymentGateway: 'demo-upi',
    demoUpiReference: demoReference,
    demoConfirmedAt: new Date().toISOString(),
  };
  await paymentSession.save();

  const processed = await processPaidSession({
    paymentSession,
    stripeSession: {
      id: demoReference,
      payment_intent: demoReference,
      payment_status: 'paid',
    },
    actor: req.user,
  });

  return res.status(200).json(
    new ApiResponse(200, {
      paymentSessionId: paymentSession._id,
      ...processed,
    }, processed.alreadyProcessed ? 'Payment already confirmed.' : 'Payment confirmed successfully.'),
  );
});

export const confirmPayment = asyncHandler(async (req, res) => {
  ensureStripeConfigured();

  const { paymentSessionId, sessionId, paymentIntentId } = req.body ?? {};

  if (!paymentSessionId) {
    throw new ApiError(400, 'paymentSessionId is required.');
  }

  const paymentSession = await PaymentSession.findById(paymentSessionId);
  if (!paymentSession) {
    throw new ApiError(404, 'Payment session not found.');
  }

  const canAccess =
    req.user?.role === 'admin' ||
    String(paymentSession.user) === String(req.user?._id);

  if (!canAccess) {
    throw new ApiError(403, 'You do not have access to this payment session.');
  }

  const stripe = getStripeClient();
  const stripeSessionId = sessionId || paymentSession.stripe?.checkoutSessionId;
  const resolvedPaymentIntentId = paymentIntentId || paymentSession.stripe?.paymentIntentId;

  let sessionLikePayload;

  if (stripeSessionId) {
    const stripeSession = await stripe.checkout.sessions.retrieve(String(stripeSessionId));

    paymentSession.stripe = {
      ...paymentSession.stripe,
      checkoutSessionId: stripeSession.id,
      paymentIntentId: stripeSession.payment_intent ? String(stripeSession.payment_intent) : undefined,
      status: mapStripeStatus(stripeSession.status),
    };
    await paymentSession.save();

    if (stripeSession.payment_status !== 'paid') {
      throw new ApiError(409, 'Payment is not completed yet.');
    }

    sessionLikePayload = stripeSession;
  } else if (resolvedPaymentIntentId) {
    const paymentIntent = await stripe.paymentIntents.retrieve(String(resolvedPaymentIntentId));

    paymentSession.stripe = {
      ...paymentSession.stripe,
      paymentIntentId: paymentIntent.id,
      status: mapStripeStatus(paymentIntent.status),
    };
    await paymentSession.save();

    if (paymentIntent.status !== 'succeeded') {
      throw new ApiError(409, 'Payment is not completed yet.');
    }

    sessionLikePayload = {
      id: paymentIntent.id,
      payment_intent: paymentIntent.id,
      payment_status: 'paid',
    };
  } else {
    throw new ApiError(400, 'Missing Stripe payment reference.');
  }

  const processed = await processPaidSession({
    paymentSession,
    stripeSession: sessionLikePayload,
    actor: req.user,
  });

  return res.status(200).json(
    new ApiResponse(200, {
      paymentSessionId: paymentSession._id,
      ...processed,
    }, processed.alreadyProcessed ? 'Payment already confirmed.' : 'Payment confirmed successfully.'),
  );
});

export const confirmOwnerPayment = confirmPayment;

export const stripeWebhook = asyncHandler(async (req, res) => {
  ensureStripeConfigured();

  const stripe = getStripeClient();
  const signature = req.headers['stripe-signature'];

  if (!signature) {
    throw new ApiError(400, 'Missing Stripe signature.');
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, signature, STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    throw new ApiError(400, `Webhook signature verification failed: ${error.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const stripeSession = event.data.object;
    const paymentSession = await PaymentSession.findOne({
      'stripe.checkoutSessionId': stripeSession.id,
    });

    if (paymentSession) {
      paymentSession.stripe = {
        checkoutSessionId: stripeSession.id,
        paymentIntentId: stripeSession.payment_intent ? String(stripeSession.payment_intent) : undefined,
        status: 'completed',
      };
      await paymentSession.save();

      if (!paymentSession.processed && stripeSession.payment_status === 'paid') {
        const actor = await User.findById(paymentSession.user).select('_id role email status');
        if (actor) {
          await processPaidSession({
            paymentSession,
            stripeSession,
            actor,
          });
        }
      }
    }
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    const orFilters = [{ 'stripe.paymentIntentId': paymentIntent.id }];
    const metadataSessionId = paymentIntent.metadata?.paymentSessionId;
    if (metadataSessionId && mongoose.Types.ObjectId.isValid(metadataSessionId)) {
      orFilters.push({ _id: metadataSessionId });
    }

    const paymentSession = await PaymentSession.findOne({ $or: orFilters });

    if (paymentSession) {
      paymentSession.stripe = {
        ...paymentSession.stripe,
        paymentIntentId: paymentIntent.id,
        status: 'completed',
      };
      await paymentSession.save();

      if (!paymentSession.processed) {
        const actor = await User.findById(paymentSession.user).select('_id role email status');
        if (actor) {
          await processPaidSession({
            paymentSession,
            stripeSession: {
              id: paymentIntent.id,
              payment_intent: paymentIntent.id,
              payment_status: 'paid',
            },
            actor,
          });
        }
      }
    }
  }

  if (event.type === 'payment_intent.canceled') {
    const paymentIntent = event.data.object;
    await PaymentSession.updateOne(
      { 'stripe.paymentIntentId': paymentIntent.id },
      {
        $set: {
          'stripe.status': 'canceled',
        },
      },
    );
  }

  if (event.type === 'checkout.session.expired') {
    const stripeSession = event.data.object;
    await PaymentSession.updateOne(
      { 'stripe.checkoutSessionId': stripeSession.id },
      {
        $set: {
          'stripe.status': 'expired',
        },
      },
    );
  }

  return res.status(200).json({ received: true });
});
