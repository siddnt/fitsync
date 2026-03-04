import Stripe from 'stripe';
import { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } from '../../config/stripe.config.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import Order from '../../models/order.model.js';
import PaymentSession from '../../models/paymentSession.model.js';
import Gym from '../../models/gym.model.js';
import GymMembership from '../../models/gymMembership.model.js';
import GymListingSubscription from '../../models/gymListingSubscription.model.js';
import Revenue from '../../models/revenue.model.js';

const stripe = new Stripe(STRIPE_SECRET_KEY);

/**
 * Create a Stripe checkout session for an order
 * POST /api/payments/create-checkout-session
 */
export const createCheckoutSession = asyncHandler(async (req, res) => {
  const { items, orderId, shippingAddress } = req.body;
  const userId = req.user?._id;

  if (!userId) {
    throw new ApiError(401, 'User must be authenticated to create a payment session');
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, 'Cart items are required');
  }

  // Transform items for Stripe
  const lineItems = items.map((item) => {
    const productData = {
      name: item.name || 'Product',
      images: item.imageUrl ? [item.imageUrl] : [],
    };

    // Only include description if it exists and is non-empty
    if (item.description && item.description.trim()) {
      productData.description = item.description.substring(0, 100);
    }

    return {
      price_data: {
        currency: 'inr',
        product_data: productData,
        unit_amount: Math.round(item.price * 100), // Convert to smallest currency unit (paise for INR)
      },
      quantity: item.quantity,
    };
  });

  // Create Stripe checkout session
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: lineItems,
    mode: 'payment',
    success_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/payments/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/payments/cancelled`,
    customer_email: req.user.email,
    metadata: {
      userId: userId.toString(),
      orderId: orderId || '',
      shippingAddress: JSON.stringify(shippingAddress || {}),
    },
  });

  // Calculate total from items
  const totalAmount = items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 0), 0);

  // Save payment session to database
  await PaymentSession.create({
    user: userId,
    type: 'shop',
    amount: totalAmount,
    currency: 'inr',
    stripe: {
      checkoutSessionId: session.id,
      paymentIntentId: session.payment_intent,
      status: 'open',
    },
    orderSnapshot: {
      items: items.map((item) => ({
        product: item.productId,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        image: item.imageUrl || undefined,
      })),
      subtotal: totalAmount,
      tax: 0,
      shippingCost: 0,
      total: totalAmount,
      shippingAddress: shippingAddress || {},
    },
    metadata: {
      orderId: orderId || null,
    },
  });

  return res
    .status(200)
    .json(
      new ApiResponse(200, { sessionId: session.id, url: session.url }, 'Checkout session created')
    );
});

/**
 * Handle Stripe webhook events
 * POST /payments/webhook (note: this is not under /api because it needs raw body)
 */
export const handleWebhook = asyncHandler(async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const rawBody = req.rawBody;

  let event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    throw new ApiError(400, `Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      await handleSuccessfulPayment(session);
      break;
    }
    case 'payment_intent.succeeded': {
      const paymentIntent = event.data.object;
      console.log('PaymentIntent was successful:', paymentIntent.id);
      break;
    }
    case 'payment_intent.payment_failed': {
      const paymentIntent = event.data.object;
      await handleFailedPayment(paymentIntent);
      break;
    }
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  return res.status(200).json(new ApiResponse(200, { received: true }));
});

/**
 * Get payment session by session ID
 * GET /api/payments/session/:sessionId
 */
export const getPaymentSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;

  const paymentSession = await PaymentSession.findOne({ 'stripe.checkoutSessionId': sessionId });

  if (!paymentSession) {
    throw new ApiError(404, 'Payment session not found');
  }

  // Also fetch from Stripe to get latest status
  const stripeSession = await stripe.checkout.sessions.retrieve(sessionId);

  return res.status(200).json(
    new ApiResponse(200, {
      session: paymentSession,
      stripeStatus: stripeSession.payment_status,
    })
  );
});

// Helper function to handle successful payment
async function handleSuccessfulPayment(session) {
  try {
    // Update payment session in database
    const paymentSession = await PaymentSession.findOne({ 'stripe.checkoutSessionId': session.id });
    
    if (paymentSession) {
      paymentSession.stripe.paymentIntentId = session.payment_intent;
      paymentSession.stripe.status = 'completed';
      paymentSession.processed = true;
      await paymentSession.save();

      // Handle different payment types
      const metadata = session.metadata || {};
      const paymentType = metadata.type;

      // Handle marketplace order
      if (metadata.orderId) {
        const order = await Order.findById(metadata.orderId);
        if (order) {
          order.paymentStatus = 'paid';
          order.status = 'processing';
          order.paymentMethod = 'Card Payment (Stripe)';
          await order.save();
        }
      }

      // Handle gym membership payment
      if (paymentType === 'gym-membership') {
        await handleGymMembershipPayment(metadata, session);
      }

      // Handle gym listing subscription payment
      if (paymentType === 'gym-listing') {
        await handleGymListingPayment(metadata, session, paymentSession);
      }
    }

    console.log('✅ Payment successful for session:', session.id);
  } catch (error) {
    console.error('Error handling successful payment:', error);
  }
}

// Helper function to handle failed payment
async function handleFailedPayment(paymentIntent) {
  try {
    const paymentSession = await PaymentSession.findOne({
      'stripe.paymentIntentId': paymentIntent.id,
    });

    if (paymentSession) {
      paymentSession.stripe.status = 'expired';
      paymentSession.processed = true;
      await paymentSession.save();
    }

    console.log('❌ Payment failed for intent:', paymentIntent.id);
  } catch (error) {
    console.error('Error handling failed payment:', error);
  }
}

// Helper function to handle gym membership payment
async function handleGymMembershipPayment(metadata, session) {
  const { userId, gymId, trainerId, autoRenew } = metadata;

  const gym = await Gym.findById(gymId).select('name pricing owner analytics');
  if (!gym) {
    console.error('Gym not found for membership payment:', gymId);
    return;
  }

  const now = new Date();
  const endDate = new Date(now);
  endDate.setMonth(endDate.getMonth() + 1);

  const monthlyPrice = gym.pricing?.monthlyPrice || gym.pricing?.monthlyMrp || 0;

  // Create gym membership
  const membership = await GymMembership.create({
    trainee: userId,
    gym: gymId,
    trainer: trainerId || undefined,
    plan: 'monthly',
    startDate: now,
    endDate,
    status: 'active',
    autoRenew: autoRenew === 'true',
    billing: {
      amount: monthlyPrice,
      currency: 'INR',
      paymentGateway: 'stripe',
      paymentReference: session.id,
      status: 'paid',
    },
  });

  // Update gym analytics
  if (gym.analytics) {
    gym.analytics.totalMembers = (gym.analytics.totalMembers || 0) + 1;
    gym.analytics.activeMemberships = (gym.analytics.activeMemberships || 0) + 1;
    await gym.save();
  }

  // Record revenue
  await Revenue.create({
    amount: monthlyPrice,
    user: gym.owner,
    type: 'membership',
    description: `Monthly membership for ${gym.name}`,
    metadata: new Map([
      ['gymId', gymId.toString()],
      ['membershipId', membership._id.toString()],
      ['paymentReference', session.id],
    ]),
  });

  console.log('✅ Gym membership created:', membership._id);
}

// Helper function to handle gym listing subscription payment
async function handleGymListingPayment(metadata, session, paymentSession) {
  const { userId, gymId, planCode, autoRenew } = metadata;

  const plans = {
    'listing-1m': { label: '1 Month', amount: 999, durationMonths: 1 },
    'listing-3m': { label: '3 Months', amount: 2499, durationMonths: 3 },
    'listing-6m': { label: '6 Months', amount: 4499, durationMonths: 6 },
    'listing-12m': { label: '12 Months', amount: 7999, durationMonths: 12 },
  };

  const plan = plans[planCode];
  if (!plan) {
    console.error('Invalid plan code:', planCode);
    return;
  }

  let resolvedGymId = gymId;
  let gym = null;

  // Check if this is a new gym creation flow
  const dbMetadata = paymentSession?.metadata || {};
  if (dbMetadata.isNewGym && dbMetadata.gymData) {
    const gymData = dbMetadata.gymData;

    // Parse tags if provided as a string
    let tags = [];
    if (typeof gymData.tags === 'string') {
      tags = gymData.tags.split(',').map((t) => t.trim()).filter(Boolean);
    } else if (Array.isArray(gymData.tags)) {
      tags = gymData.tags;
    }

    // Create the new gym
    gym = await Gym.create({
      name: gymData.name?.trim(),
      description: gymData.description?.trim() || '',
      city: gymData.location?.city?.trim() || '',
      location: {
        city: gymData.location?.city?.trim() || '',
        state: gymData.location?.state?.trim() || '',
      },
      pricing: {
        monthlyMrp: Number(gymData.pricing?.mrp) || 0,
        monthlyPrice: Number(gymData.pricing?.discounted) || Number(gymData.pricing?.mrp) || 0,
      },
      contact: {
        phone: gymData.contact?.phone?.trim() || '',
      },
      schedule: {
        openTime: gymData.schedule?.open || '',
        closeTime: gymData.schedule?.close || '',
      },
      amenities: Array.isArray(gymData.keyFeatures) ? gymData.keyFeatures : [],
      keyFeatures: Array.isArray(gymData.keyFeatures) ? gymData.keyFeatures : [],
      tags,
      owner: userId,
      status: 'active',
      isPublished: true,
    });

    resolvedGymId = gym._id.toString();

    // Update the PaymentSession to reference the new gym
    if (paymentSession) {
      paymentSession.gym = gym._id;
      await paymentSession.save();
    }

    console.log('✅ New gym created via Stripe payment:', gym._id, gym.name);
  } else {
    // Existing gym flow
    gym = await Gym.findById(resolvedGymId).select('name owner');
    if (!gym) {
      console.error('Gym not found for listing payment:', resolvedGymId);
      return;
    }
  }

  // Cancel any active subscriptions for this gym
  await GymListingSubscription.updateMany(
    { gym: resolvedGymId, status: { $in: ['active', 'grace'] } },
    { $set: { status: 'cancelled', autoRenew: false } },
  );

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + plan.durationMonths);

  // Create gym listing subscription
  const subscription = await GymListingSubscription.create({
    gym: resolvedGymId,
    owner: gym.owner || userId,
    planCode,
    amount: plan.amount,
    currency: 'INR',
    periodStart: now,
    periodEnd,
    status: 'active',
    autoRenew: autoRenew === 'true',
    invoices: [
      {
        amount: plan.amount,
        currency: 'INR',
        paidOn: now,
        paymentReference: session.id,
        status: 'paid',
      },
    ],
    metadata: new Map([
      ['planLabel', plan.label],
      ['paymentMethod', 'stripe'],
    ]),
    createdBy: userId,
  });

  // Record revenue
  await Revenue.create({
    amount: plan.amount,
    user: userId,
    type: 'listing',
    description: `${plan.label} subscription for ${gym.name}`,
    metadata: new Map([
      ['gymId', resolvedGymId.toString()],
      ['planCode', planCode],
      ['subscriptionId', subscription._id.toString()],
    ]),
  });

  console.log('✅ Gym listing subscription created:', subscription._id);
}

/**
 * Create a Stripe checkout session for gym membership
 * POST /api/payments/gym-membership/checkout
 */
export const createGymMembershipCheckout = asyncHandler(async (req, res) => {
  const { gymId, trainerId, autoRenew } = req.body;
  const userId = req.user?._id;

  if (!userId) {
    throw new ApiError(401, 'User must be authenticated');
  }

  if (!gymId) {
    throw new ApiError(400, 'Gym ID is required');
  }

  // Validate gym exists and get pricing
  const gym = await Gym.findById(gymId).select('name pricing location owner');
  if (!gym) {
    throw new ApiError(404, 'Gym not found');
  }

  if (String(gym.owner) === String(userId)) {
    throw new ApiError(400, 'Gym owners cannot join their own gym as a member');
  }

  const monthlyPrice = gym.pricing?.monthlyPrice || gym.pricing?.monthlyMrp || 0;
  if (monthlyPrice <= 0) {
    throw new ApiError(400, 'Gym pricing not available');
  }

  // Create Stripe checkout session
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'inr',
          product_data: {
            name: `${gym.name} - Monthly Membership`,
            description: `Monthly gym membership for ${gym.name} at ${gym.location?.city || 'your location'}`,
          },
          unit_amount: Math.round(monthlyPrice * 100),
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/gyms/${gymId}?payment=success`,
    cancel_url: `${process.env.CLIENT_URL || 'http://localhost:5173'}/gyms/${gymId}?payment=cancelled`,
    customer_email: req.user.email,
    metadata: {
      type: 'gym-membership',
      userId: userId.toString(),
      gymId: gymId.toString(),
      trainerId: trainerId?.toString() || '',
      autoRenew: String(autoRenew || false),
    },
  });

  // Save payment session to database
  await PaymentSession.create({
    user: userId,
    type: 'gym-subscription',
    amount: monthlyPrice,
    currency: 'INR',
    gym: gymId,
    stripe: {
      checkoutSessionId: session.id,
      paymentIntentId: session.payment_intent,
      status: 'open',
    },
    metadata: {
      gymId: gymId.toString(),
      trainerId: trainerId?.toString() || '',
      autoRenew: autoRenew || false,
    },
  });

  return res
    .status(200)
    .json(
      new ApiResponse(200, { sessionId: session.id, url: session.url }, 'Gym membership checkout session created')
    );
});

/**
 * Create a Stripe checkout session for gym listing subscription
 * POST /api/payments/gym-listing/checkout
 */
export const createGymListingCheckout = asyncHandler(async (req, res) => {
  const { gymId, planCode, autoRenew, gymData } = req.body;
  const userId = req.user?._id;

  if (!userId) {
    throw new ApiError(401, 'User must be authenticated');
  }

  if (!planCode) {
    throw new ApiError(400, 'Plan code is required');
  }

  // Either gymId (existing gym) or gymData (new gym creation) must be provided
  if (!gymId && !gymData) {
    throw new ApiError(400, 'Gym ID or gym data is required');
  }

  let gym = null;
  let gymName = 'New Gym';

  if (gymId) {
    // Existing gym flow - validate ownership
    gym = await Gym.findById(gymId).select('name owner');
    if (!gym) {
      throw new ApiError(404, 'Gym not found');
    }

    if (String(gym.owner) !== String(userId) && req.user.role !== 'admin') {
      throw new ApiError(403, 'You do not have access to manage this gym');
    }
    gymName = gym.name;
  } else {
    // New gym creation flow - validate required gym data
    if (!gymData.name?.trim()) {
      throw new ApiError(400, 'Gym name is required');
    }
    gymName = gymData.name.trim();
  }

  // Plan configuration (should match your monetisation.config.js)
  const plans = {
    'listing-1m': { label: '1 Month', amount: 999, durationMonths: 1 },
    'listing-3m': { label: '3 Months', amount: 2499, durationMonths: 3 },
    'listing-6m': { label: '6 Months', amount: 4499, durationMonths: 6 },
    'listing-12m': { label: '12 Months', amount: 7999, durationMonths: 12 },
  };

  const plan = plans[planCode];
  if (!plan) {
    throw new ApiError(400, 'Invalid plan code');
  }

  // Create Stripe checkout session
  const stripeMetadata = {
    type: 'gym-listing',
    userId: userId.toString(),
    planCode,
    autoRenew: String(autoRenew || false),
    isNewGym: gymId ? 'false' : 'true',
  };

  if (gymId) {
    stripeMetadata.gymId = gymId.toString();
  }

  const successUrl = gymId
    ? `${process.env.CLIENT_URL || 'http://localhost:5173'}/dashboard/gym-owner/subscriptions?payment=success`
    : `${process.env.CLIENT_URL || 'http://localhost:5173'}/dashboard/gym-owner/gyms?payment=success`;
  const cancelUrl = gymId
    ? `${process.env.CLIENT_URL || 'http://localhost:5173'}/dashboard/gym-owner/subscriptions?payment=cancelled`
    : `${process.env.CLIENT_URL || 'http://localhost:5173'}/dashboard/gym-owner/gyms?payment=cancelled`;

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'inr',
          product_data: {
            name: `${gymName} - Marketplace Listing`,
            description: `${plan.label} marketplace listing subscription for ${gymName}`,
          },
          unit_amount: Math.round(plan.amount * 100),
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: successUrl,
    cancel_url: cancelUrl,
    customer_email: req.user.email,
    metadata: stripeMetadata,
  });

  // Build PaymentSession metadata
  const paymentMetadata = {
    planCode,
    durationMonths: plan.durationMonths,
    autoRenew: autoRenew || false,
  };

  if (gymId) {
    paymentMetadata.gymId = gymId.toString();
  }

  if (gymData) {
    paymentMetadata.gymData = gymData;
    paymentMetadata.isNewGym = true;
  }

  // Save payment session to database
  await PaymentSession.create({
    user: userId,
    type: 'gym-subscription',
    amount: plan.amount,
    currency: 'INR',
    gym: gymId || undefined,
    stripe: {
      checkoutSessionId: session.id,
      paymentIntentId: session.payment_intent,
      status: 'open',
    },
    metadata: paymentMetadata,
  });

  return res
    .status(200)
    .json(
      new ApiResponse(200, { sessionId: session.id, url: session.url }, 'Gym listing checkout session created')
    );
});
