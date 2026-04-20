import mongoose from 'mongoose';
import Gym from '../../models/gym.model.js';
import Gallery from '../../models/gallery.model.js';
import GymListingSubscription from '../../models/gymListingSubscription.model.js';
import Review from '../../models/review.model.js';
import GymMembership from '../../models/gymMembership.model.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { uploadOnCloudinary } from '../../utils/fileUpload.js';
import { resolveListingPlan } from '../../config/monetisation.config.js';
import { invalidatePrefix } from '../../services/redis.service.js';
import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

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
    // Use MongoDB $text search for full-word matches (uses the text index)
    // Fall back to $regex for partial / short queries
    if (search.trim().length >= 3) {
      filter.$text = { $search: search };
    } else {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } },
      ];
    }
  }

  if (city) {
    filter['location.city'] = { $regex: city, $options: 'i' };
  }

  if (amenities?.length) {
    filter.amenities = { $all: amenities };
  }

  return filter;
};

const formatMemberName = (profile) => {
  if (!profile) {
    return 'Member';
  }

  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ');
  return fullName || profile.name || profile.email || 'Member';
};

const mapReview = (review) => ({
  id: review._id,
  rating: review.rating,
  comment: review.comment,
  authorId: review.user?._id,
  authorName: formatMemberName(review.user),
  authorAvatar: review.user?.profile?.avatar ?? null,
  createdAt: review.createdAt,
  updatedAt: review.updatedAt,
});

const fetchGymReviews = async (gymId, limit = 12) => {
  const reviews = await Review.find({ gym: gymId })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .populate({ path: 'user', select: 'name firstName lastName email profile avatar' });

  return reviews.map(mapReview);
};

const recalculateGymRating = async (gymId) => {
  const [stats] = await Review.aggregate([
    { $match: { gym: new mongoose.Types.ObjectId(gymId) } },
    {
      $group: {
        _id: '$gym',
        avgRating: { $avg: '$rating' },
        totalReviews: { $sum: 1 },
      },
    },
  ]);

  const avgRating = stats ? Number(stats.avgRating.toFixed(1)) : 0;
  const totalReviews = stats?.totalReviews ?? 0;

  await Gym.findByIdAndUpdate(gymId, {
    $set: {
      'analytics.rating': avgRating,
      'analytics.ratingCount': totalReviews,
      'analytics.lastReviewAt': new Date(),
    },
  });

  return { rating: avgRating, ratingCount: totalReviews };
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
    address: gym.location?.address
      || [gym.location?.city, gym.location?.state, gym.location?.postalCode]
        .filter(Boolean)
        .join(', '),
    city: gym.location?.city,
    state: gym.location?.state,
  },
  pricing: {
    mrp: gym.pricing?.monthlyMrp,
    discounted: gym.pricing?.monthlyPrice,
    monthlyMrp: gym.pricing?.monthlyMrp,
    monthlyPrice: gym.pricing?.monthlyPrice,
    currency: gym.pricing?.currency ?? 'INR',
  },
  contact: gym.contact,
  schedule: {
    open: gym.schedule?.openTime,
    close: gym.schedule?.closeTime,
    openTime: gym.schedule?.openTime,
    closeTime: gym.schedule?.closeTime,
    workingDays: gym.schedule?.workingDays,
  },
  features: gym.keyFeatures?.length ? gym.keyFeatures : gym.amenities,
  keyFeatures: gym.keyFeatures,
  amenities: gym.amenities,
  tags: gym.tags,
  description: gym.description,
  gallery: gym.gallery,
  sponsorship: gym.sponsorship,
  analytics: gym.analytics,
  status: gym.status,
  isPublished: gym.isPublished,
  updatedAt: gym.updatedAt,
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

  const reviews = await fetchGymReviews(gym._id);
  const mappedGym = mapGym(gym);
  mappedGym.reviews = reviews;

  return res
    .status(200)
    .json(new ApiResponse(200, { gym: mappedGym }, 'Gym fetched successfully'));
});

export const listGymReviews = asyncHandler(async (req, res) => {
  const { gymId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(gymId)) {
    throw new ApiError(400, 'Invalid gym id');
  }

  const reviews = await fetchGymReviews(gymId, Number(req.query?.limit) || 20);

  return res
    .status(200)
    .json(new ApiResponse(200, { reviews }, 'Reviews fetched successfully'));
});

export const submitGymReview = asyncHandler(async (req, res) => {
  const { gymId } = req.params;
  const { rating, comment } = req.body ?? {};

  if (!mongoose.Types.ObjectId.isValid(gymId)) {
    throw new ApiError(400, 'Invalid gym id');
  }

  const parsedRating = Number(rating);
  if (!Number.isFinite(parsedRating) || parsedRating < 1 || parsedRating > 5) {
    throw new ApiError(400, 'Please provide a rating between 1 and 5 stars.');
  }

  const trimmedComment = comment?.trim();
  if (!trimmedComment) {
    throw new ApiError(400, 'Please add a short comment with your rating.');
  }

  const gym = await Gym.findById(gymId);
  if (!gym) {
    throw new ApiError(404, 'Gym not found');
  }

  const membership = await GymMembership.findOne({
    trainee: req.user._id,
    gym: gymId,
    status: { $nin: ['pending', 'cancelled'] },
  });

  if (!membership) {
    throw new ApiError(403, 'You can only review gyms you are enrolled in.');
  }

  const review = await Review.findOneAndUpdate(
    { user: req.user._id, gym: gymId },
    { rating: parsedRating, comment: trimmedComment },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  ).populate({ path: 'user', select: 'name firstName lastName email profile avatar' });

  const analytics = await recalculateGymRating(gymId);

  // Invalidate gym & review caches
  await invalidatePrefix('cache:gym-detail:');
  await invalidatePrefix('cache:gym-reviews:');
  await invalidatePrefix('cache:gyms:');

  return res.status(200).json(
    new ApiResponse(
      200,
      { review: mapReview(review), analytics },
      'Thank you for sharing your experience with this gym.',
    ),
  );
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
  const autoRenew = subscription?.autoRenew ?? req.body?.autoRenew ?? false;
  const plan = resolveListingPlan(planCode);

  if (!plan) {
    throw new ApiError(400, 'Select a valid listing plan to register your gym.');
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
    status: 'suspended',
    isPublished: false,
    approvalStatus: 'pending',
    lastUpdatedBy: req.user._id,
  });

  try {
    const subscriptionRecord = await GymListingSubscription.create({
      gym: gym._id,
      owner: req.user._id,
      planCode: plan.planCode,
      amount: plan.amount,
      currency: plan.currency,
      periodStart: now,
      periodEnd,
      status: 'pending',
      autoRenew: Boolean(autoRenew),
      invoices: [
        {
          amount: plan.amount,
          currency: plan.currency,
          paidOn: now,
          paymentReference: null,
          receiptUrl: null,
          status: 'pending',
        },
      ],
      metadata: new Map([
        ['planLabel', plan.label],
        ['durationMonths', String(plan.durationMonths)],
        ['source', 'gym-create'],
      ]),
      createdBy: req.user._id,
    });

    const stripeSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'inr',
            product_data: {
              name: `Gym Listing Activation: ${name}`,
              description: plan.label,
            },
            unit_amount: Math.round(plan.amount * 100),
          },
          quantity: 1,
        },
      ],
      success_url: 'http://localhost:5173/payment/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'http://localhost:5173/dashboard/gym-owner/gyms',
      metadata: {
        type: 'listing_subscription',
        planCode: plan.planCode,
        gymId: String(gym._id),
        subscriptionId: String(subscriptionRecord._id),
        source: 'gym-create',
        ownerId: String(req.user._id),
      },
    });

    subscriptionRecord.invoices = [
      {
        amount: plan.amount,
        currency: plan.currency,
        paidOn: now,
        paymentReference: stripeSession.id,
        receiptUrl: null,
        status: 'pending',
      },
    ];
    await subscriptionRecord.save();

    return res.status(201).json(
      new ApiResponse(
        201,
        {
          checkoutUrl: stripeSession.url,
          gymId: gym._id,
          subscriptionId: subscriptionRecord._id,
        },
        'Redirecting to secure checkout',
      ),
    );
  } catch (error) {
    await Promise.all([
      Gym.findByIdAndDelete(gym._id),
      GymListingSubscription.deleteMany({ gym: gym._id }),
    ]);
    throw error;
  }
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

  // Invalidate gym caches
  await invalidatePrefix('cache:gyms:');
  await invalidatePrefix('cache:gym-detail:');

  return res
    .status(200)
    .json(new ApiResponse(200, { gym: mapGym(populated) }, 'Gym updated successfully'));
});

/* ── Gallery ── */

const mapGalleryPhoto = (photo) => ({
  id: photo._id,
  imageUrl: photo.imageUrl,
  title: photo.title,
  description: photo.description,
  category: photo.category,
  uploadedBy: photo.uploadedBy
    ? {
      id: photo.uploadedBy._id,
      name: photo.uploadedBy.name,
      role: photo.uploadedBy.role,
    }
    : null,
  createdAt: photo.createdAt,
});

export const uploadGymGalleryPhoto = asyncHandler(async (req, res) => {
  const { gymId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(gymId)) {
    throw new ApiError(400, 'Invalid gym id');
  }

  const gym = await Gym.findById(gymId);
  if (!gym) {
    throw new ApiError(404, 'Gym not found');
  }

  if (!req.file) {
    throw new ApiError(400, 'Please select an image to upload');
  }

  const userRole = req.user.role;
  const userId = req.user._id;

  if (userRole === 'gym-owner') {
    if (String(gym.owner) !== String(userId)) {
      throw new ApiError(403, 'You can only upload photos to your own gym');
    }
  } else if (userRole === 'trainee') {
    const membership = await GymMembership.findOne({
      trainee: userId,
      gym: gymId,
      status: { $in: ['active', 'paused'] },
    });
    if (!membership) {
      throw new ApiError(403, 'You must be a member of this gym to upload photos');
    }
  } else if (userRole !== 'admin') {
    throw new ApiError(403, 'You do not have permission to upload photos');
  }

  const result = await uploadOnCloudinary(req.file.path, { folder: 'fitsync/gym-gallery' });
  const imageUrl = result?.url;

  if (!imageUrl) {
    throw new ApiError(500, 'File upload failed');
  }

  const category = userRole === 'trainee' ? 'member' : 'gym';

  const galleryEntry = await Gallery.create({
    title: req.body.title || `${gym.name} photo`,
    description: req.body.description || '',
    imageUrl,
    uploadedBy: userId,
    category,
    gym: gymId,
    isPublic: true,
  });

  if (userRole === 'gym-owner' || userRole === 'admin') {
    gym.gallery.push(imageUrl);
    await gym.save();
  }

  const populated = await Gallery.findById(galleryEntry._id)
    .populate('uploadedBy', 'name role profile');

  return res
    .status(201)
    .json(new ApiResponse(201, { photo: mapGalleryPhoto(populated) }, 'Photo uploaded successfully'));
});

export const getGymGallery = asyncHandler(async (req, res) => {
  const { gymId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(gymId)) {
    throw new ApiError(400, 'Invalid gym id');
  }

  const gym = await Gym.findById(gymId).select('name gallery');
  if (!gym) {
    throw new ApiError(404, 'Gym not found');
  }

  const galleryPhotos = await Gallery.find({ gym: gymId, isPublic: true })
    .populate('uploadedBy', 'name role profile')
    .sort({ createdAt: -1 });

  const ownerPhotos = galleryPhotos
    .filter((p) => ['gym', 'facility', 'event'].includes(p.category))
    .map(mapGalleryPhoto);

  const memberPhotos = galleryPhotos
    .filter((p) => p.category === 'member')
    .map(mapGalleryPhoto);

  const galleryModelUrls = new Set(galleryPhotos.map((p) => p.imageUrl));
  const legacyPhotos = (gym.gallery || [])
    .filter((url) => !galleryModelUrls.has(url))
    .map((url, idx) => ({
      id: `legacy-${idx}`,
      imageUrl: url,
      title: `${gym.name} photo`,
      category: 'gym',
      uploadedBy: null,
      createdAt: null,
    }));

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        {
          gymPhotos: [...legacyPhotos, ...ownerPhotos],
          memberPhotos,
        },
        'Gallery fetched successfully',
      ),
    );
});
