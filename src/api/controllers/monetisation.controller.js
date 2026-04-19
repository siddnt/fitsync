import mongoose from 'mongoose';
import Gym from '../../models/gym.model.js';
import GymListingSubscription from '../../models/gymListingSubscription.model.js';
import PaymentSession from '../../models/paymentSession.model.js';
import Revenue from '../../models/revenue.model.js';
import stripe from '../../services/stripe.service.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { invalidateCacheByTags } from '../../services/cache.service.js';
import {
  LISTING_PLANS,
  SPONSORSHIP_PACKAGES,
  resolveListingPlan,
  resolveSponsorshipPackage,
} from '../../config/monetisation.config.js';

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

const assertGymAccess = async (user, gymId) => {
  const gym = await Gym.findById(gymId).select('owner sponsorship analytics name location lastUpdatedBy');
  if (!gym) {
    throw new ApiError(404, 'Gym not found.');
  }

  if (user.role !== 'admin' && String(gym.owner) !== String(user._id)) {
    throw new ApiError(403, 'You do not have access to manage this gym.');
  }

  return gym;
};

const cancelActiveSubscriptions = async (gymId) => {
  await GymListingSubscription.updateMany(
    { gym: gymId, status: { $in: ['active', 'grace'] } },
    { $set: { status: 'cancelled', autoRenew: false } },
  );
};

const recordRevenue = async ({ amount, user, type, description, metadata }) => {
  await Revenue.create({
    amount,
    user,
    type,
    description,
    metadata,
  });
};

const buildInternalReference = ({ prefix, gymId, ownerId, planCode }) => {
  const normalizedPrefix = String(prefix || 'PAY').trim().toUpperCase();
  const normalizedPlan = String(planCode || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '');
  const timeToken = Date.now().toString().slice(-8);
  const shortGymId = String(gymId || '').slice(-4).toUpperCase();
  const shortOwnerId = String(ownerId || '').slice(-4).toUpperCase();

  return [normalizedPrefix, normalizedPlan || 'PLAN', timeToken, shortGymId, shortOwnerId]
    .filter(Boolean)
    .join('-');
};

const getFrontendUrl = () => process.env.FRONTEND_URL || 'http://localhost:5173';

const toCheckoutCurrency = (value) =>
  String(value || 'INR').trim().toLowerCase() || 'inr';

const toDisplayCurrency = (value) =>
  String(value || 'INR').trim().toUpperCase() || 'INR';

const buildStripePaymentReference = ({ paymentIntentId, stripeSessionId, fallback }) =>
  String(paymentIntentId || stripeSessionId || fallback || '').trim();

const buildOwnerSuccessUrl = ({ flow, gymId }) => {
  const params = new URLSearchParams({
    session_id: '{CHECKOUT_SESSION_ID}',
    flow,
  });

  if (gymId) {
    params.set('gymId', String(gymId));
  }

  return `${getFrontendUrl()}/payments/success?${params.toString()}`;
};

const buildOwnerCancelUrl = ({ flow, gymId }) => {
  const params = new URLSearchParams({ flow });

  if (gymId) {
    params.set('gymId', String(gymId));
  }

  return `${getFrontendUrl()}/payments/cancelled?${params.toString()}`;
};

const createStripeCheckoutForOwnerPayment = async ({
  user,
  gym,
  type,
  amount,
  currency,
  metadata,
  lineItemName,
  lineItemDescription,
}) => {
  const session = await mongoose.startSession();
  let paymentSessionId;
  let stripeSession;

  try {
    await session.withTransaction(async () => {
      const [paymentSession] = await PaymentSession.create([{
        user: user._id,
        owner: gym.owner,
        gym: gym._id,
        type,
        amount,
        currency: toCheckoutCurrency(currency),
        metadata,
      }], { session });

      paymentSessionId = paymentSession._id;

      stripeSession = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: toCheckoutCurrency(currency),
            product_data: {
              name: lineItemName,
              description: lineItemDescription,
            },
            unit_amount: Math.round(Number(amount || 0) * 100),
          },
          quantity: 1,
        }],
        mode: 'payment',
        customer_email: user?.email || undefined,
        metadata: {
          paymentSessionId: String(paymentSessionId),
          userId: String(user._id),
          type: metadata.flow,
        },
        success_url: buildOwnerSuccessUrl({ flow: metadata.flow, gymId: gym._id }),
        cancel_url: buildOwnerCancelUrl({ flow: metadata.flow, gymId: gym._id }),
      });

      await PaymentSession.findByIdAndUpdate(
        paymentSessionId,
        {
          'stripe.checkoutSessionId': stripeSession.id,
          'stripe.status': 'open',
        },
        { session },
      );
    });
  } finally {
    await session.endSession();
  }

  return {
    checkoutUrl: stripeSession.url,
    sessionId: stripeSession.id,
  };
};

const loadListingSubscriptionSummary = async (subscriptionId) => {
  const subscription = await GymListingSubscription.findById(subscriptionId)
    .populate({ path: 'gym', select: 'name location status' })
    .lean();

  if (!subscription) {
    return null;
  }

  return {
    id: subscription._id,
    gym: subscription.gym?._id
      ? {
          id: subscription.gym._id,
          name: subscription.gym.name,
          city: subscription.gym.location?.city,
          status: subscription.gym.status,
        }
      : null,
    planCode: subscription.planCode,
    amount: {
      amount: Number(subscription.amount) || 0,
      currency: subscription.currency || 'INR',
    },
    status: subscription.status,
    periodStart: subscription.periodStart,
    periodEnd: subscription.periodEnd,
    autoRenew: Boolean(subscription.autoRenew),
    invoices: (subscription.invoices ?? []).map((invoice, index) => ({
      id: `${subscription._id}-invoice-${index}`,
      amount: Number(invoice?.amount) || 0,
      currency: invoice?.currency || subscription.currency || 'INR',
      paidOn: invoice?.paidOn || null,
      paymentReference: invoice?.paymentReference || '',
      status: invoice?.status || 'paid',
    })),
    createdAt: subscription.createdAt,
    updatedAt: subscription.updatedAt,
  };
};

const loadSponsorshipSummary = async (gymId) => {
  const gym = await Gym.findById(gymId).select('name location sponsorship').lean();

  if (!gym?.sponsorship) {
    return null;
  }

  return {
    gym: {
      id: gym._id,
      name: gym.name,
      city: gym.location?.city,
    },
    sponsorship: {
      tier: gym.sponsorship.tier,
      package: gym.sponsorship.package,
      label: gym.sponsorship.label,
      status: gym.sponsorship.status,
      startDate: gym.sponsorship.startDate,
      endDate: gym.sponsorship.endDate,
      amount: Number(gym.sponsorship.amount) || 0,
      monthlyBudget: Number(gym.sponsorship.monthlyBudget) || 0,
      reach: Number(gym.sponsorship.reach) || 0,
    },
  };
};

export const finalizeListingSubscriptionPaymentSession = async ({
  paymentSessionId,
  stripeSessionId,
  paymentIntentId,
}) => {
  const paymentSession = await PaymentSession.findById(paymentSessionId);

  if (!paymentSession) {
    throw new ApiError(404, 'Payment session not found.');
  }

  if (paymentSession.subscription) {
    return loadListingSubscriptionSummary(paymentSession.subscription);
  }

  if (paymentSession.stripe?.status === 'expired') {
    throw new ApiError(400, 'This checkout session has expired.');
  }

  const metadata = paymentSession.metadata ?? {};
  const gym = await Gym.findById(paymentSession.gym).select('owner name location status');

  if (!gym) {
    throw new ApiError(404, 'Gym not found.');
  }

  const durationMonths = Number(metadata.durationMonths) || 1;
  const periodStart = new Date();
  const periodEnd = new Date(periodStart);
  periodEnd.setMonth(periodEnd.getMonth() + durationMonths);

  const paymentReference = buildStripePaymentReference({
    paymentIntentId,
    stripeSessionId,
    fallback: buildInternalReference({
      prefix: 'SUB',
      gymId: gym._id,
      ownerId: gym.owner,
      planCode: metadata.planCode,
    }),
  });

  await cancelActiveSubscriptions(gym._id);

  const subscription = await GymListingSubscription.create({
    gym: gym._id,
    owner: gym.owner,
    planCode: metadata.planCode,
    amount: Number(metadata.amount) || Number(paymentSession.amount) || 0,
    currency: toDisplayCurrency(metadata.currency || paymentSession.currency),
    periodStart,
    periodEnd,
    status: 'active',
    autoRenew: false,
    invoices: [
      {
        amount: Number(metadata.amount) || Number(paymentSession.amount) || 0,
        currency: toDisplayCurrency(metadata.currency || paymentSession.currency),
        paidOn: periodStart,
        paymentReference,
        status: 'paid',
      },
    ],
    metadata: new Map([
      ['planLabel', String(metadata.planLabel || metadata.label || metadata.planCode || 'Listing plan')],
      ['features', Array.isArray(metadata.features) ? metadata.features.join(', ') : ''],
      ['paymentGateway', 'stripe'],
    ]),
    createdBy: paymentSession.user,
  });

  await recordRevenue({
    amount: Number(metadata.amount) || Number(paymentSession.amount) || 0,
    user: paymentSession.user,
    type: 'listing',
    description: `${metadata.planLabel || metadata.label || 'Listing subscription'} for ${gym.name}`,
    metadata: new Map([
      ['gymId', String(gym._id)],
      ['planCode', String(metadata.planCode || '')],
      ['paymentReference', paymentReference],
      ['paymentGateway', 'stripe'],
    ]),
  });

  paymentSession.stripe = paymentSession.stripe || {};
  paymentSession.subscription = subscription._id;
  paymentSession.processed = true;
  paymentSession.stripe.checkoutSessionId = stripeSessionId || paymentSession.stripe?.checkoutSessionId;
  paymentSession.stripe.paymentIntentId = paymentIntentId || paymentSession.stripe?.paymentIntentId;
  paymentSession.stripe.status = 'completed';
  paymentSession.metadata = {
    ...metadata,
    paymentReference,
  };
  await paymentSession.save();

  return loadListingSubscriptionSummary(subscription._id);
};

export const finalizeSponsorshipPaymentSession = async ({
  paymentSessionId,
  stripeSessionId,
  paymentIntentId,
}) => {
  const paymentSession = await PaymentSession.findById(paymentSessionId);

  if (!paymentSession) {
    throw new ApiError(404, 'Payment session not found.');
  }

  if (paymentSession.processed && paymentSession.stripe?.status === 'completed') {
    return loadSponsorshipSummary(paymentSession.gym);
  }

  if (paymentSession.stripe?.status === 'expired') {
    throw new ApiError(400, 'This checkout session has expired.');
  }

  const metadata = paymentSession.metadata ?? {};
  const gym = await Gym.findById(paymentSession.gym).select('owner name sponsorship lastUpdatedBy');

  if (!gym) {
    throw new ApiError(404, 'Gym not found.');
  }

  const now = new Date();
  const endDate = new Date(now);
  endDate.setMonth(endDate.getMonth() + (Number(metadata.durationMonths) || 1));

  const paymentReference = buildStripePaymentReference({
    paymentIntentId,
    stripeSessionId,
    fallback: buildInternalReference({
      prefix: 'SPN',
      gymId: gym._id,
      ownerId: gym.owner,
      planCode: metadata.tier,
    }),
  });

  gym.sponsorship = {
    tier: metadata.tier,
    package: metadata.label || metadata.package || metadata.tier,
    label: metadata.label || metadata.package || metadata.tier,
    status: 'active',
    startDate: now,
    endDate,
    expiresAt: endDate,
    amount: Number(metadata.amount) || Number(paymentSession.amount) || 0,
    monthlyBudget: Number(metadata.monthlyBudget) || 0,
    reach: Number(metadata.reach) || 0,
  };

  gym.lastUpdatedBy = paymentSession.user;
  await gym.save();
  await invalidateCacheByTags(['gyms:list', `gym:${gym._id}`]);

  await recordRevenue({
    amount: Number(metadata.amount) || Number(paymentSession.amount) || 0,
    user: paymentSession.user,
    type: 'sponsorship',
    description: `${metadata.label || metadata.package || 'Sponsorship'} for ${gym.name}`,
    metadata: new Map([
      ['gymId', String(gym._id)],
      ['tier', String(metadata.tier || '')],
      ['paymentReference', paymentReference],
      ['paymentGateway', 'stripe'],
    ]),
  });

  paymentSession.stripe = paymentSession.stripe || {};
  paymentSession.processed = true;
  paymentSession.stripe.checkoutSessionId = stripeSessionId || paymentSession.stripe?.checkoutSessionId;
  paymentSession.stripe.paymentIntentId = paymentIntentId || paymentSession.stripe?.paymentIntentId;
  paymentSession.stripe.status = 'completed';
  paymentSession.metadata = {
    ...metadata,
    paymentReference,
  };
  await paymentSession.save();

  return loadSponsorshipSummary(gym._id);
};

export const checkoutListingSubscription = asyncHandler(async (req, res) => {
  const { gymId: gymIdRaw, planCode } = req.body ?? {};

  const plan = resolveListingPlan(planCode);
  if (!plan) {
    throw new ApiError(400, 'Unknown subscription plan selected.');
  }

  const gymId = toObjectId(gymIdRaw, 'Gym id');
  const gym = await assertGymAccess(req.user, gymId);

  const response = await createStripeCheckoutForOwnerPayment({
    user: req.user,
    gym,
    type: 'gym-subscription',
    amount: plan.amount,
    currency: plan.currency,
    metadata: {
      flow: 'listing-subscription',
      gymId: String(gym._id),
      gymName: gym.name,
      planCode: plan.planCode,
      planLabel: plan.label,
      amount: Number(plan.amount) || 0,
      currency: toDisplayCurrency(plan.currency),
      durationMonths: Number(plan.durationMonths) || 1,
      features: Array.isArray(plan.features) ? [...plan.features] : [],
    },
    lineItemName: `${plan.label} listing subscription`,
    lineItemDescription: `Stripe test payment for ${gym.name}`,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, response, 'Listing subscription checkout session created.'));
});

export const purchaseSponsorship = asyncHandler(async (req, res) => {
  const { gymId: gymIdRaw, tier } = req.body ?? {};
  const packageDetails = resolveSponsorshipPackage(tier);

  if (!packageDetails) {
    throw new ApiError(400, 'Unknown sponsorship package.');
  }

  const gymId = toObjectId(gymIdRaw, 'Gym id');
  const gym = await assertGymAccess(req.user, gymId);

  const response = await createStripeCheckoutForOwnerPayment({
    user: req.user,
    gym,
    type: 'sponsorship',
    amount: packageDetails.amount,
    currency: packageDetails.currency,
    metadata: {
      flow: 'gym-sponsorship',
      gymId: String(gym._id),
      gymName: gym.name,
      tier: packageDetails.tier,
      label: packageDetails.label,
      amount: Number(packageDetails.amount) || 0,
      currency: toDisplayCurrency(packageDetails.currency),
      durationMonths: Number(packageDetails.durationMonths) || 1,
      monthlyBudget: Number(packageDetails.monthlyBudget) || 0,
      reach: Number(packageDetails.reach) || 0,
    },
    lineItemName: `${packageDetails.label} sponsorship`,
    lineItemDescription: `Stripe test payment for ${gym.name}`,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, response, 'Sponsorship checkout session created.'));
});

export const getMonetisationOptions = asyncHandler(async (_req, res) => {
  const listingPlans = Object.values(LISTING_PLANS).map((plan) => ({
    ...plan,
    features: [...(plan.features ?? [])],
  }));

  const sponsorshipPackages = Object.values(SPONSORSHIP_PACKAGES).map((pkg) => ({ ...pkg }));

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { listingPlans, sponsorshipPackages },
        'Monetisation options fetched successfully.',
      ),
    );
});
