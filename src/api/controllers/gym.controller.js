import mongoose from 'mongoose';
import Gym from '../../models/gym.model.js';
import GymListingSubscription from '../../models/gymListingSubscription.model.js';
import Revenue from '../../models/revenue.model.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { resolveListingPlan } from '../../config/monetisation.config.js';

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

const buildFilters = ({ search, city, amenities }) => {
  const filter = { status: 'active', isPublished: true };

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { tags: { $regex: search, $options: 'i' } },
    ];
  }

  if (city) {
    filter['location.city'] = { $regex: city, $options: 'i' };
  }

  if (amenities?.length) {
    filter.amenities = { $all: amenities };
  }

  return filter;
};

const mapGym = (gym) => ({
  id: gym._id,
  name: gym.name,
  owner: gym.owner
    ? {
        id: gym.owner._id,
        name: gym.owner.name,
        firstName: gym.owner.firstName,
        lastName: gym.owner.lastName,
      }
    : undefined,
  city: gym.location?.city,
  location: {
    address: [
      gym.location?.addressLine1,
      gym.location?.addressLine2,
      gym.location?.city,
      gym.location?.state,
      gym.location?.postalCode,
    ]
      .filter(Boolean)
      .join(', '),
  },
  pricing: gym.pricing,
  contact: gym.contact,
  schedule: gym.schedule,
  features: gym.keyFeatures?.length ? gym.keyFeatures : gym.amenities,
  amenities: gym.amenities,
  description: gym.description,
  gallery: gym.gallery,
  sponsorship: gym.sponsorship,
  analytics: gym.analytics,
  reviews: gym.analytics?.ratingCount
    ? [
        {
          id: `${gym._id}-aggregate`,
          rating: gym.analytics.rating,
          comment: `${gym.analytics.ratingCount} members rated this gym`,
        },
      ]
    : [],
});

export const listGyms = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const filters = buildFilters(req.query);

  const [gyms, total] = await Promise.all([
    Gym.find(filters)
      .populate({ path: 'owner', select: 'name firstName lastName role' })
      .sort({ 'sponsorship.status': -1, 'analytics.impressions': -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit)),
    Gym.countDocuments(filters),
  ]);

  const payload = {
    gyms: gyms.map(mapGym),
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit) || 1),
    },
  };

  return res.status(200).json(new ApiResponse(200, payload, 'Gyms fetched successfully'));
});

export const getGymById = asyncHandler(async (req, res) => {
  const { gymId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(gymId)) {
    throw new ApiError(400, 'Invalid gym id');
  }

  const gym = await Gym.findById(gymId).populate({
    path: 'owner',
    select: 'name firstName lastName email contactNumber profile',
  });

  if (!gym) {
    throw new ApiError(404, 'Gym not found');
  }

  return res
    .status(200)
    .json(new ApiResponse(200, { gym: mapGym(gym) }, 'Gym fetched successfully'));
});

export const recordImpression = asyncHandler(async (req, res) => {
  const { gymId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(gymId)) {
    throw new ApiError(400, 'Invalid gym id');
  }

  const gym = await Gym.findByIdAndUpdate(
    gymId,
    {
      $inc: { 'analytics.impressions': 1 },
      $set: { 'analytics.lastImpressionAt': new Date() },
    },
    { new: true },
  );

  if (!gym) {
    throw new ApiError(404, 'Gym not found');
  }

  return res.status(204).send();
});

export const createGym = asyncHandler(async (req, res) => {
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
    subscription,
  } = req.body;

  if (!name || !location?.city) {
    throw new ApiError(400, 'Gym name and city are required');
  }

  const planCode = subscription?.planCode ?? req.body?.planCode;
  const paymentReference = subscription?.paymentReference ?? req.body?.paymentReference;
  const autoRenew = subscription?.autoRenew ?? req.body?.autoRenew ?? false;
  const plan = resolveListingPlan(planCode);

  if (!plan) {
    throw new ApiError(400, 'Select a valid listing plan to register your gym.');
  }

  if (!paymentReference) {
    throw new ApiError(400, 'Payment reference is required to activate the listing.');
  }

  const sanitizedLocation = normalizeLocationInput(location) ?? {};

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + plan.durationMonths);

  const gym = await Gym.create({
    owner: req.user._id,
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
    status: 'active',
    isPublished: true,
    approvedAt: now,
    lastUpdatedBy: req.user._id,
  });

  try {
    await GymListingSubscription.create({
      gym: gym._id,
      owner: req.user._id,
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
        },
      ],
      metadata: new Map([
        ['planLabel', plan.label],
        ['durationMonths', String(plan.durationMonths)],
      ]),
      createdBy: req.user._id,
    });

    await Revenue.create({
      amount: plan.amount,
      user: req.user._id,
      type: 'listing',
      description: `${plan.label} activation for ${name}`,
      metadata: new Map([
        ['gymId', String(gym._id)],
        ['planCode', plan.planCode],
        ['paymentReference', paymentReference],
      ]),
    });
  } catch (error) {
    await Promise.all([
      Gym.findByIdAndDelete(gym._id),
      GymListingSubscription.deleteMany({ gym: gym._id }),
    ]);
    throw error;
  }

  const populated = await gym.populate({ path: 'owner', select: 'name firstName lastName role' });

  return res
    .status(201)
    .json(new ApiResponse(201, { gym: mapGym(populated) }, 'Gym created successfully'));
});

export const updateGym = asyncHandler(async (req, res) => {
  const { gymId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(gymId)) {
    throw new ApiError(400, 'Invalid gym id');
  }

  const gym = await Gym.findById(gymId);
  if (!gym) {
    throw new ApiError(404, 'Gym not found');
  }

  if (req.user.role !== 'admin' && String(gym.owner) !== String(req.user._id)) {
    throw new ApiError(403, 'You do not have permission to update this gym');
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
    tags,
    status,
    isPublished,
  } = req.body ?? {};

  if (name !== undefined) gym.name = name;
  if (description !== undefined) gym.description = description;
  if (keyFeatures !== undefined) gym.keyFeatures = keyFeatures;
  if (amenities !== undefined) gym.amenities = amenities;
  if (pricing !== undefined) gym.pricing = pricing;
  if (contact !== undefined) gym.contact = contact;
  if (schedule !== undefined) gym.schedule = schedule;
  if (gallery !== undefined) gym.gallery = gallery;
  if (tags !== undefined) gym.tags = tags;
  if (status !== undefined) gym.status = status;
  if (isPublished !== undefined) gym.isPublished = isPublished;
  if (location !== undefined) {
    const sanitizedLocation = normalizeLocationInput(location);
    if (sanitizedLocation) {
      gym.location = { ...gym.location.toObject?.(), ...sanitizedLocation };
    }
  }

  gym.lastUpdatedBy = req.user._id;

  await gym.save();

  const populated = await gym.populate({ path: 'owner', select: 'name firstName lastName role' });

  return res
    .status(200)
    .json(new ApiResponse(200, { gym: mapGym(populated) }, 'Gym updated successfully'));
});
