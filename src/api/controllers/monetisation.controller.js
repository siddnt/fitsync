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
  const { gymId: gymIdRaw, planCode, autoRenew = true, paymentReference } = req.body ?? {};

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

  const subscription = await GymListingSubscription.create({
    gym: gymId,
    owner: gym.owner,
    planCode: plan.planCode,
    amount: plan.amount,
    currency: plan.currency,
    periodStart: now,
    periodEnd,
    status: 'active',
    autoRenew,
    invoices: [
      {
        amount: plan.amount,
        currency: plan.currency,
        paidOn: now,
        paymentReference,
        status: 'paid',
      },
    ],
    metadata: new Map([
      ['planLabel', plan.label],
      ['features', plan.features.join(', ')],
    ]),
    createdBy: req.user._id,
  });

  await recordRevenue({
    amount: plan.amount,
    user: req.user._id,
    type: 'listing',
    description: `${plan.label} subscription for ${gym.name}`,
    metadata: new Map([
      ['gymId', String(gymId)],
      ['planCode', plan.planCode],
    ]),
  });

  const response = await GymListingSubscription.findById(subscription._id)
    .populate({ path: 'gym', select: 'name location status' })
    .lean();

  return res
    .status(201)
    .json(new ApiResponse(201, { subscription: response }, 'Subscription activated successfully.'));
});

export const purchaseSponsorship = asyncHandler(async (req, res) => {
  const { gymId: gymIdRaw, tier, paymentReference } = req.body ?? {};
  const packageDetails = resolveSponsorshipPackage(tier);

  if (!packageDetails) {
    throw new ApiError(400, 'Unknown sponsorship package.');
  }

  const gymId = toObjectId(gymIdRaw, 'Gym id');
  const gym = await assertGymAccess(req.user, gymId);

  const now = new Date();
  const endDate = new Date(now);
  endDate.setMonth(endDate.getMonth() + packageDetails.durationMonths);

  gym.sponsorship = {
    tier: packageDetails.tier,
    status: 'active',
    startDate: now,
    endDate,
    amount: packageDetails.amount,
    monthlyBudget: packageDetails.monthlyBudget,
  };

  gym.lastUpdatedBy = req.user._id;
  await gym.save();

  await recordRevenue({
    amount: packageDetails.amount,
    user: req.user._id,
    type: 'sponsorship',
    description: `${packageDetails.label} sponsorship for ${gym.name}`,
    metadata: new Map([
      ['gymId', String(gymId)],
      ['tier', packageDetails.tier],
      ['paymentReference', paymentReference ?? 'manual'],
    ]),
  });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        {
          sponsorship: {
            tier: packageDetails.tier,
            startDate: now,
            endDate,
            status: 'active',
            amount: packageDetails.amount,
            monthlyBudget: packageDetails.monthlyBudget,
            reach: packageDetails.reach,
          },
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
