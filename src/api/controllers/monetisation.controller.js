import Gym from '../../models/gym.model.js';
import GymListingSubscription from '../../models/gymListingSubscription.model.js';
import Revenue from '../../models/revenue.model.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import toObjectId from '../../utils/toObjectId.js';
import {
  LISTING_PLANS,
  SPONSORSHIP_PACKAGES,
  resolveListingPlan,
  resolveSponsorshipPackage,
} from '../../config/monetisation.config.js';
import { invalidatePrefix } from '../../services/redis.service.js';
import Stripe from 'stripe';
import dotenv from 'dotenv';
dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

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

export const checkoutListingSubscription = asyncHandler(async (req, res) => {
  const { gymId: gymIdRaw, planCode, autoRenew = true } = req.body ?? {};

  const plan = resolveListingPlan(planCode);
  if (!plan) {
    throw new ApiError(400, 'Unknown subscription plan selected.');
  }

  const gymId = toObjectId(gymIdRaw, 'Gym id');
  const gym = await assertGymAccess(req.user, gymId);

  await cancelActiveSubscriptions(gymId);

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + plan.durationMonths);
  
  const stripeSession = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    line_items: [{
      price_data: {
        currency: 'inr',
        product_data: {
          name: `Listing Subscription for ${gym.name}`,
          description: plan.label,
        },
        unit_amount: Math.round(plan.amount * 100),
      },
      quantity: 1,
    }],
    success_url: `http://localhost:5173/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `http://localhost:5173/dashboard/gym-owner/subscriptions`,
    metadata: {
      type: 'listing_subscription',
      planCode: plan.planCode,
      gymId: String(gymId),
      source: 'owner-subscription-checkout',
      ownerId: String(req.user._id),
    },
  });

  const subscription = await GymListingSubscription.create({
    gym: gymId,
    owner: gym.owner,
    planCode: plan.planCode,
    amount: plan.amount,
    currency: plan.currency,
    periodStart: now,
    periodEnd,
    status: 'pending', // Pending payment
    autoRenew,
    invoices: [
      {
        amount: plan.amount,
        currency: plan.currency,
        paidOn: now,
        paymentReference: stripeSession.id,
        receiptUrl: null,
        status: 'pending',
      },
    ],
    metadata: new Map([
      ['planLabel', plan.label],
      ['features', plan.features.join(', ')],
    ]),
    createdBy: req.user._id,
  });

  return res.status(201).json(new ApiResponse(201, { checkoutUrl: stripeSession.url }, 'Redirecting to checkout.'));
});

/**
 * Fulfills a Gym Listing Subscription post-checkout. Called by payment.controller.js.
 */
export const fulfillListingSubscription = async (subscriptionId, { sessionId, receiptUrl } = {}) => {
  const subscription = await GymListingSubscription.findById(subscriptionId).populate('gym');
  if (!subscription || subscription.status !== 'pending') return null;

  subscription.status = 'active';

  if (!Array.isArray(subscription.invoices)) {
    subscription.invoices = [];
  }

  let invoice = null;

  if (sessionId) {
    invoice = subscription.invoices.find((entry) => entry?.paymentReference === sessionId) ?? null;
  }

  if (!invoice) {
    invoice = subscription.invoices.find((entry) => entry?.status === 'pending') ?? null;
  }

  if (!invoice) {
    invoice = {
      amount: subscription.amount,
      currency: subscription.currency,
      paidOn: new Date(),
      paymentReference: sessionId ?? null,
      receiptUrl: receiptUrl ?? null,
      status: 'paid',
    };
    subscription.invoices.push(invoice);
  } else {
    invoice.status = 'paid';
    invoice.paidOn = invoice.paidOn ?? new Date();
    if (sessionId) {
      invoice.paymentReference = sessionId;
    }
    if (receiptUrl) {
      invoice.receiptUrl = receiptUrl;
    }
  }

  const source = subscription.metadata?.get?.('source');
  if (source === 'gym-create' && subscription.gym) {
    await Gym.updateOne(
      { _id: subscription.gym._id },
      {
        $set: {
          status: 'active',
          isPublished: true,
          approvalStatus: 'approved',
          approvedAt: new Date(),
          lastUpdatedBy: subscription.owner,
        },
      },
    );
  }

  await subscription.save();

  await recordRevenue({
    amount: subscription.amount,
    user: subscription.createdBy,
    type: 'listing',
    description: `${subscription.metadata.get('planLabel') || 'Listing'} subscription for ${subscription.gym.name}`,
    metadata: new Map([
      ['gymId', String(subscription.gym._id)],
      ['planCode', subscription.planCode],
      ['stripeSessionId', sessionId || subscription.invoices[0]?.paymentReference || 'none'],
    ]),
  });

  await Promise.all([
    invalidatePrefix('cache:gymowner-overview'),
    invalidatePrefix('cache:gymowner-gyms'),
    invalidatePrefix('cache:gymowner-subscriptions'),
    invalidatePrefix('cache:gymowner-analytics'),
    invalidatePrefix('cache:admin-subscriptions'),
    invalidatePrefix('cache:gyms:'),
    invalidatePrefix('cache:gym-detail:'),
  ]);

  return subscription;
};

export const purchaseSponsorship = asyncHandler(async (req, res) => {
  const { gymId: gymIdRaw, tier } = req.body ?? {};
  const packageDetails = resolveSponsorshipPackage(tier);

  if (!packageDetails) {
    throw new ApiError(400, 'Unknown sponsorship package.');
  }

  const gymId = toObjectId(gymIdRaw, 'Gym id');
  const gym = await assertGymAccess(req.user, gymId);

  const now = new Date();
  const endDate = new Date(now);
  endDate.setMonth(endDate.getMonth() + packageDetails.durationMonths);

  const stripeSession = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    line_items: [{
      price_data: {
        currency: 'inr',
        product_data: {
          name: `Sponsorship Package for ${gym.name}`,
          description: packageDetails.label,
        },
        unit_amount: Math.round(packageDetails.amount * 100),
      },
      quantity: 1,
    }],
    success_url: `http://localhost:5173/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `http://localhost:5173/dashboard/gym-owner/sponsorship`,
    metadata: {
      type: 'sponsorship',
      gymId: String(gymId),
      tier: packageDetails.tier,
      source: 'owner-sponsorship-checkout',
      ownerId: String(req.user._id),
    },
  });

  const previousInvoices = Array.isArray(gym.sponsorship?.invoices)
    ? gym.sponsorship.invoices.filter((invoice) => invoice?.status !== 'pending')
    : [];

  gym.sponsorship = {
    tier: packageDetails.tier,
    package: packageDetails.label,
    status: 'pending',
    startDate: now,
    endDate,
    expiresAt: endDate,
    amount: packageDetails.amount,
    monthlyBudget: packageDetails.monthlyBudget,
    invoices: [
      ...previousInvoices,
      {
        amount: packageDetails.amount,
        currency: packageDetails.currency,
        paidOn: now,
        paymentReference: stripeSession.id,
        receiptUrl: null,
        status: 'pending',
        metadata: new Map([
          ['tier', packageDetails.tier],
          ['label', packageDetails.label],
        ]),
      },
    ],
  };

  gym.lastUpdatedBy = req.user._id;
  await gym.save();

  return res.status(200).json(new ApiResponse(200, { checkoutUrl: stripeSession.url }, 'Redirecting to checkout.'));
});

/**
 * Fulfills a Gym Sponsorship post-checkout. Called by payment.controller.js.
 */
export const fulfillSponsorship = async (gymId, tier, sessionId, ownerId, receiptUrl) => {
  const packageDetails = resolveSponsorshipPackage(tier);
  if (!packageDetails) return null;

  const gym = await Gym.findById(gymId);
  if (!gym || gym.sponsorship?.status !== 'pending') return null;

  const now = new Date();

  if (!Array.isArray(gym.sponsorship.invoices)) {
    gym.sponsorship.invoices = [];
  }

  let invoice = gym.sponsorship.invoices.find((entry) => entry?.paymentReference === sessionId) ?? null;
  if (!invoice) {
    invoice = gym.sponsorship.invoices.find((entry) => entry?.status === 'pending') ?? null;
  }

  if (!invoice) {
    invoice = {
      amount: packageDetails.amount,
      currency: packageDetails.currency,
      paidOn: now,
      paymentReference: sessionId,
      receiptUrl: receiptUrl ?? null,
      status: 'paid',
      metadata: new Map([
        ['tier', packageDetails.tier],
        ['label', packageDetails.label],
      ]),
    };
    gym.sponsorship.invoices.push(invoice);
  } else {
    invoice.status = 'paid';
    invoice.paidOn = invoice.paidOn ?? now;
    invoice.paymentReference = sessionId;
    if (receiptUrl) {
      invoice.receiptUrl = receiptUrl;
    }
  }

  const resolvedEndDate = gym.sponsorship?.endDate
    ? new Date(gym.sponsorship.endDate)
    : (() => {
      const target = new Date(now);
      target.setMonth(target.getMonth() + packageDetails.durationMonths);
      return target;
    })();

  gym.sponsorship.tier = packageDetails.tier;
  gym.sponsorship.package = packageDetails.label;
  gym.sponsorship.status = 'active';
  gym.sponsorship.startDate = gym.sponsorship.startDate ?? now;
  gym.sponsorship.endDate = resolvedEndDate;
  gym.sponsorship.expiresAt = resolvedEndDate;
  gym.sponsorship.amount = packageDetails.amount;
  gym.sponsorship.monthlyBudget = packageDetails.monthlyBudget;
  await gym.save();

  await recordRevenue({
    amount: packageDetails.amount,
    user: ownerId || gym.owner,
    type: 'sponsorship',
    description: `${packageDetails.label} sponsorship for ${gym.name}`,
    metadata: new Map([
      ['gymId', String(gymId)],
      ['tier', packageDetails.tier],
      ['stripeSessionId', sessionId],
    ]),
  });

  await Promise.all([
    invalidatePrefix('cache:gymowner-overview'),
    invalidatePrefix('cache:gymowner-gyms'),
    invalidatePrefix('cache:gymowner-sponsorships'),
    invalidatePrefix('cache:gymowner-analytics'),
    invalidatePrefix('cache:admin-subscriptions'),
    invalidatePrefix('cache:gyms:'),
    invalidatePrefix('cache:gym-detail:'),
  ]);

  return gym.sponsorship;
};

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
