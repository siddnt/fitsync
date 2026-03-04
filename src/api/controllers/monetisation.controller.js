import mongoose from 'mongoose';
import Gym from '../../models/gym.model.js';
import GymListingSubscription from '../../models/gymListingSubscription.model.js';
import Revenue from '../../models/revenue.model.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
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

export const activateListingSubscription = async ({
  actor,
  gymId: gymIdRaw,
  planCode,
  autoRenew = true,
  paymentReference,
  paymentSource = 'manual',
  stripeSessionId,
  stripePaymentIntentId,
} = {}) => {
  const plan = resolveListingPlan(planCode);
  if (!plan) {
    throw new ApiError(400, 'Unknown subscription plan selected.');
  }

  if (!paymentReference) {
    throw new ApiError(400, 'Payment reference is required to activate subscription.');
  }

  const gymId = toObjectId(gymIdRaw, 'Gym id');
  const gym = await assertGymAccess(actor, gymId);

  await cancelActiveSubscriptions(gymId);

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + plan.durationMonths);

  const metadataEntries = [
    ['planLabel', plan.label],
    ['features', plan.features.join(', ')],
    ['paymentSource', String(paymentSource)],
  ];

  if (stripeSessionId) {
    metadataEntries.push(['stripeSessionId', String(stripeSessionId)]);
  }
  if (stripePaymentIntentId) {
    metadataEntries.push(['stripePaymentIntentId', String(stripePaymentIntentId)]);
  }

  const invoiceMetadataEntries = [];
  if (stripeSessionId) {
    invoiceMetadataEntries.push(['stripeSessionId', String(stripeSessionId)]);
  }
  if (stripePaymentIntentId) {
    invoiceMetadataEntries.push(['stripePaymentIntentId', String(stripePaymentIntentId)]);
  }
  if (paymentSource) {
    invoiceMetadataEntries.push(['paymentSource', String(paymentSource)]);
  }

  const subscription = await GymListingSubscription.create({
    gym: gymId,
    owner: gym.owner,
    planCode: plan.planCode,
    amount: plan.amount,
    currency: plan.currency,
    periodStart: now,
    periodEnd,
    status: 'active',
    autoRenew: parseBoolean(autoRenew, true),
    invoices: [
      {
        amount: plan.amount,
        currency: plan.currency,
        paidOn: now,
        paymentReference,
        status: 'paid',
        ...(invoiceMetadataEntries.length ? { metadata: new Map(invoiceMetadataEntries) } : {}),
      },
    ],
    metadata: new Map(metadataEntries),
    createdBy: actor._id,
  });

  await recordRevenue({
    amount: plan.amount,
    user: actor._id,
    type: 'listing',
    description: `${plan.label} subscription for ${gym.name}`,
    metadata: new Map([
      ['gymId', String(gymId)],
      ['planCode', plan.planCode],
      ['paymentSource', String(paymentSource)],
      ['paymentReference', String(paymentReference)],
      ...(stripeSessionId ? [['stripeSessionId', String(stripeSessionId)]] : []),
      ...(stripePaymentIntentId ? [['stripePaymentIntentId', String(stripePaymentIntentId)]] : []),
    ]),
  });

  const response = await GymListingSubscription.findById(subscription._id)
    .populate({ path: 'gym', select: 'name location status' })
    .lean();

  return response;
};

export const activateGymSponsorship = async ({
  actor,
  gymId: gymIdRaw,
  tier,
  paymentReference,
  paymentSource = 'manual',
  stripeSessionId,
  stripePaymentIntentId,
} = {}) => {
  const packageDetails = resolveSponsorshipPackage(tier);

  if (!packageDetails) {
    throw new ApiError(400, 'Unknown sponsorship package.');
  }

  if (!paymentReference) {
    throw new ApiError(400, 'Payment reference is required to activate sponsorship.');
  }

  const gymId = toObjectId(gymIdRaw, 'Gym id');
  const gym = await assertGymAccess(actor, gymId);

  const now = new Date();
  const endDate = new Date(now);
  endDate.setMonth(endDate.getMonth() + packageDetails.durationMonths);

  const sponsorshipPayload = {
    tier: packageDetails.tier,
    status: 'active',
    startDate: now,
    endDate,
    amount: packageDetails.amount,
    monthlyBudget: packageDetails.monthlyBudget,
    paymentReference,
    paymentSource,
  };

  if (stripeSessionId) {
    sponsorshipPayload.stripeSessionId = stripeSessionId;
  }
  if (stripePaymentIntentId) {
    sponsorshipPayload.stripePaymentIntentId = stripePaymentIntentId;
  }

  gym.sponsorship = sponsorshipPayload;
  gym.lastUpdatedBy = actor._id;
  await gym.save();

  await recordRevenue({
    amount: packageDetails.amount,
    user: actor._id,
    type: 'sponsorship',
    description: `${packageDetails.label} sponsorship for ${gym.name}`,
    metadata: new Map([
      ['gymId', String(gymId)],
      ['tier', packageDetails.tier],
      ['paymentSource', String(paymentSource)],
      ['paymentReference', String(paymentReference)],
      ...(stripeSessionId ? [['stripeSessionId', String(stripeSessionId)]] : []),
      ...(stripePaymentIntentId ? [['stripePaymentIntentId', String(stripePaymentIntentId)]] : []),
    ]),
  });

  return {
    tier: packageDetails.tier,
    startDate: now,
    endDate,
    status: 'active',
    amount: packageDetails.amount,
    monthlyBudget: packageDetails.monthlyBudget,
    reach: packageDetails.reach,
    paymentReference,
  };
};

export const checkoutListingSubscription = asyncHandler(async (req, res) => {
  const { gymId: gymIdRaw, planCode, autoRenew = true, paymentReference } = req.body ?? {};

  const response = await activateListingSubscription({
    actor: req.user,
    gymId: gymIdRaw,
    planCode,
    autoRenew,
    paymentReference,
    paymentSource: 'manual',
  });

  return res
    .status(201)
    .json(new ApiResponse(201, { subscription: response }, 'Subscription activated successfully.'));
});

export const purchaseSponsorship = asyncHandler(async (req, res) => {
  const { gymId: gymIdRaw, tier, paymentReference } = req.body ?? {};
  const sponsorship = await activateGymSponsorship({
    actor: req.user,
    gymId: gymIdRaw,
    tier,
    paymentReference,
    paymentSource: 'manual',
  });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        {
          sponsorship,
        },
        'Sponsorship activated successfully.',
      ),
    );
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
