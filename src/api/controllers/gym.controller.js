import mongoose from 'mongoose';
import Gym from '../../models/gym.model.js';
import GymListingSubscription from '../../models/gymListingSubscription.model.js';
import Revenue from '../../models/revenue.model.js';
import Review from '../../models/review.model.js';
import GymMembership from '../../models/gymMembership.model.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { resolveListingPlan } from '../../config/monetisation.config.js';
import {
  buildCacheKey,
  getOrSetCache,
  invalidateCacheByTags,
  shouldBypassCache,
} from '../../services/cache.service.js';
import { syncGymAnalyticsSnapshot } from '../../services/gymMetrics.service.js';
import { queueGymImpression } from '../../services/gymImpression.service.js';
import { enqueueOutboxEvents } from '../../services/outbox.service.js';
import {
  searchGymIndex,
} from '../../services/search.service.js';
import { applyPublicCacheHeaders } from '../../utils/httpCache.js';
import {
  buildCursorFilter,
  buildCursorSortStage,
  encodeCursorToken,
} from '../../utils/cursorPagination.js';

const GYM_PUBLIC_SELECT = [
  'name',
  'owner',
  'location',
  'pricing',
  'contact',
  'schedule',
  'keyFeatures',
  'amenities',
  'tags',
  'description',
  'gallery',
  'sponsorship',
  'analytics',
  'status',
  'isPublished',
  'createdAt',
  'updatedAt',
].join(' ');
const GYM_PUBLIC_OWNER_SELECT = 'name firstName lastName';
const GYM_REVIEW_USER_SELECT = 'name firstName lastName email profile avatar';

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

const normalizeSearchTerm = (value) => String(value ?? '').trim().replace(/\s+/g, ' ');
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildFilters = ({ city, amenities }) => {
  const filter = { status: 'active', isPublished: true };

  if (city) {
    filter['location.city'] = { $regex: city, $options: 'i' };
  }

  if (amenities?.length) {
    filter.amenities = { $all: amenities };
  }

  return filter;
};

const DEFAULT_GYM_SORT = {
  'sponsorship.status': -1,
  'analytics.impressions': -1,
  createdAt: -1,
};

const TEXT_GYM_SORT = {
  score: { $meta: 'textScore' },
  'analytics.impressions': -1,
  createdAt: -1,
};

const GYM_CURSOR_SORT_FIELDS = [
  { field: 'sponsorship.status', order: -1, type: 'string' },
  { field: 'analytics.impressions', order: -1, type: 'number' },
  { field: 'createdAt', order: -1, type: 'date' },
  { field: '_id', order: -1, type: 'objectId' },
];

const applyCacheHeaders = (res, meta = {}) => {
  res.set('X-Cache', String(meta.state ?? 'miss').toUpperCase());
  res.set('X-Cache-Provider', meta.provider ?? 'memory');
};

const buildGymCacheTags = (
  gymId,
  {
    includeList = true,
    includeDetail = true,
    includeReviews = true,
  } = {},
) => {
  const tags = [];

  if (includeList) {
    tags.push('gyms:list');
  }
  if (gymId && includeDetail) {
    tags.push(`gym:${gymId}`);
  }
  if (gymId && includeReviews) {
    tags.push(`gym:${gymId}:reviews`);
  }

  return tags;
};

const buildGymOutboxEvents = (gymId, { deleted = false } = {}) => ([
  {
    topic: 'gym.cache.invalidate',
    aggregateType: 'gym',
    aggregateId: String(gymId),
    payload: { tags: buildGymCacheTags(gymId, { includeReviews: true }) },
  },
  {
    topic: deleted ? 'gym.search.delete' : 'gym.search.upsert',
    aggregateType: 'gym',
    aggregateId: String(gymId),
    payload: {},
  },
]);

const invalidateGymCaches = async (gymId, options) =>
  invalidateCacheByTags(buildGymCacheTags(gymId, options));

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
    .select('rating comment user createdAt updatedAt')
    .sort({ updatedAt: -1 })
    .limit(limit)
    .populate({ path: 'user', select: GYM_REVIEW_USER_SELECT })
    .lean();

  return reviews.map(mapReview);
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
  createdAt: gym.createdAt,
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

const orderGymsByIds = (gyms = [], ids = []) => {
  const orderMap = new Map(ids.map((id, index) => [String(id), index]));
  return [...gyms].sort((left, right) =>
    (orderMap.get(String(left._id)) ?? Number.MAX_SAFE_INTEGER)
      - (orderMap.get(String(right._id)) ?? Number.MAX_SAFE_INTEGER));
};

const resolveGymLastModified = (gyms = []) =>
  gyms.reduce((latest, gym) => {
    const candidates = [
      gym.updatedAt,
      gym.analytics?.lastImpressionAt,
      gym.analytics?.lastReviewAt,
    ]
      .map((value) => new Date(value ?? 0).getTime())
      .filter((value) => !Number.isNaN(value));

    return Math.max(latest, ...candidates, 0);
  }, 0);

const buildGymCollectionVersion = (gyms = [], pagination = {}, searchStrategy = 'browse') =>
  JSON.stringify({
    ids: gyms.map((gym) => String(gym.id ?? gym._id)),
    updatedAt: gyms.map((gym) => ({
      updatedAt: gym.updatedAt ?? null,
      lastImpressionAt: gym.analytics?.lastImpressionAt ?? null,
      lastReviewAt: gym.analytics?.lastReviewAt ?? null,
    })),
    total: pagination.total ?? gyms.length,
    page: pagination.page ?? 1,
    limit: pagination.limit ?? gyms.length,
    searchStrategy,
  });

const resolveReviewCollectionLastModified = (reviews = []) =>
  reviews.reduce((latest, review) => {
    const updatedAt = new Date(review.updatedAt ?? review.createdAt ?? 0).getTime();
    return Math.max(latest, Number.isNaN(updatedAt) ? 0 : updatedAt);
  }, 0);

const buildGymDetailVersion = (gym) =>
  JSON.stringify({
    id: String(gym?.id ?? gym?._id ?? ''),
    updatedAt: gym?.updatedAt ?? null,
    lastImpressionAt: gym?.analytics?.lastImpressionAt ?? null,
    lastReviewAt: gym?.analytics?.lastReviewAt ?? null,
    reviewCount: gym?.reviews?.length ?? 0,
  });

const resolveGymSearchPlan = async (query = {}, { offset = 0, limit = 20 } = {}) => {
  const baseFilters = buildFilters(query);
  const search = normalizeSearchTerm(query.search);

  if (!search) {
    return {
      filters: baseFilters,
      sortStage: DEFAULT_GYM_SORT,
      total: null,
      searchStrategy: 'browse',
    };
  }

  const external = await searchGymIndex(search, {
    city: query.city,
    amenities: query.amenities ?? [],
    offset,
    limit,
  });

  if (external.ids.length > 0) {
    return {
      filters: { _id: { $in: external.ids } },
      sortStage: DEFAULT_GYM_SORT,
      total: external.total,
      searchStrategy: external.provider === 'meilisearch' ? 'meilisearch' : 'partial-index',
      orderedIds: external.ids,
    };
  }

  const textFilters = {
    ...baseFilters,
    $text: { $search: search },
  };

  const textTotal = await Gym.countDocuments(textFilters);
  if (textTotal > 0) {
    return {
      filters: textFilters,
      sortStage: TEXT_GYM_SORT,
      total: textTotal,
      searchStrategy: 'text',
    };
  }

  const partialRegex = new RegExp(escapeRegex(search), 'i');
  const partialFilters = {
    ...baseFilters,
    $or: [
      { name: partialRegex },
      { description: partialRegex },
      { tags: partialRegex },
      { amenities: partialRegex },
      { keyFeatures: partialRegex },
      { 'location.city': partialRegex },
    ],
  };

  const partialTotal = await Gym.countDocuments(partialFilters);
  if (partialTotal > 0) {
    return {
      filters: partialFilters,
      sortStage: DEFAULT_GYM_SORT,
      total: partialTotal,
      searchStrategy: 'partial',
    };
  }

  return {
    filters: { _id: { $in: [] } },
    sortStage: DEFAULT_GYM_SORT,
    total: 0,
    searchStrategy: external.provider === 'disabled' ? 'no-match' : `no-match:${external.provider}`,
  };
};


export const listGyms = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor.trim() : '';
  const paginationMode = String(req.query.pagination ?? '').trim().toLowerCase();
  const cacheKey = buildCacheKey('gyms:list', req.query);

  const { value: payload, meta } = await getOrSetCache(
    {
      key: cacheKey,
      ttlSeconds: 120,
      staleWhileRevalidateSeconds: 180,
      tags: ['gyms:list'],
      bypass: shouldBypassCache(req),
    },
    async () => {
      const resolvedPage = Math.max(Number(page) || 1, 1);
      const resolvedLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
      const skip = (resolvedPage - 1) * resolvedLimit;

      const searchPlan = await resolveGymSearchPlan(req.query, {
        offset: skip,
        limit: resolvedLimit,
      });

      const useCursorPagination = paginationMode === 'cursor' && searchPlan.searchStrategy === 'browse';

      if (useCursorPagination) {
        const cursorFilters = buildCursorFilter({
          baseFilter: searchPlan.filters,
          cursor,
          sortFields: GYM_CURSOR_SORT_FIELDS,
        });

        if (!cursorFilters) {
          throw new ApiError(400, 'Invalid cursor');
        }

        const gyms = await Gym.find(cursorFilters)
          .select(GYM_PUBLIC_SELECT)
          .populate({ path: 'owner', select: GYM_PUBLIC_OWNER_SELECT })
          .sort(buildCursorSortStage(GYM_CURSOR_SORT_FIELDS))
          .limit(resolvedLimit + 1)
          .lean();

        const hasMore = gyms.length > resolvedLimit;
        const pageItems = hasMore ? gyms.slice(0, resolvedLimit) : gyms;
        const nextCursor = hasMore
          ? encodeCursorToken({ document: pageItems[pageItems.length - 1], sortFields: GYM_CURSOR_SORT_FIELDS })
          : null;

        return {
          gyms: pageItems.map(mapGym),
          pagination: {
            mode: 'cursor',
            limit: resolvedLimit,
            hasMore,
            nextCursor,
          },
          searchStrategy: searchPlan.searchStrategy,
        };
      }

      const gymQuery = Gym.find(searchPlan.filters)
        .select(GYM_PUBLIC_SELECT)
        .populate({ path: 'owner', select: GYM_PUBLIC_OWNER_SELECT });

      if (!searchPlan.orderedIds?.length) {
        gymQuery.sort(searchPlan.sortStage).skip(skip).limit(resolvedLimit);
      }

      const [gyms, total] = await Promise.all([
        gymQuery.lean(),
        searchPlan.total === null ? Gym.countDocuments(searchPlan.filters) : Promise.resolve(searchPlan.total),
      ]);

      const orderedGyms = searchPlan.orderedIds?.length
        ? orderGymsByIds(gyms, searchPlan.orderedIds)
        : gyms;

      return {
        gyms: orderedGyms.map(mapGym),
        pagination: {
          total,
          page: resolvedPage,
          limit: resolvedLimit,
          totalPages: Math.max(1, Math.ceil(total / resolvedLimit)),
        },
        searchStrategy: searchPlan.searchStrategy,
      };
    },
  );

  applyCacheHeaders(res, meta);
  if (applyPublicCacheHeaders(req, res, {
    scope: 'gyms:list',
    version: buildGymCollectionVersion(payload.gyms, payload.pagination, payload.searchStrategy),
    lastModified: resolveGymLastModified(payload.gyms),
    maxAgeSeconds: 60,
    staleWhileRevalidateSeconds: 180,
  })) {
    return;
  }

  return res.status(200).json(new ApiResponse(200, payload, 'Gyms fetched successfully'));
});

export const getGymById = asyncHandler(async (req, res) => {
  const { gymId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(gymId)) {
    throw new ApiError(400, 'Invalid gym id');
  }

  const { value: payload, meta } = await getOrSetCache(
    {
      key: buildCacheKey('gyms:detail', { gymId }),
      ttlSeconds: 120,
      staleWhileRevalidateSeconds: 180,
      tags: [`gym:${gymId}`],
      bypass: shouldBypassCache(req),
    },
    async () => {
      const gym = await Gym.findById(gymId)
        .select(GYM_PUBLIC_SELECT)
        .populate({
          path: 'owner',
          select: GYM_PUBLIC_OWNER_SELECT,
        })
        .lean();

      if (!gym) {
        throw new ApiError(404, 'Gym not found');
      }

      const reviews = await fetchGymReviews(gymId);
      const mappedGym = mapGym(gym);
      mappedGym.reviews = reviews;

      return { gym: mappedGym };
    },
  );

  applyCacheHeaders(res, meta);
  if (applyPublicCacheHeaders(req, res, {
    scope: 'gyms:detail',
    version: buildGymDetailVersion(payload.gym),
    lastModified: resolveGymLastModified([payload.gym]),
    maxAgeSeconds: 90,
    staleWhileRevalidateSeconds: 180,
  })) {
    return;
  }

  return res
    .status(200)
    .json(new ApiResponse(200, payload, 'Gym fetched successfully'));
});

export const listGymReviews = asyncHandler(async (req, res) => {
  const { gymId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(gymId)) {
    throw new ApiError(400, 'Invalid gym id');
  }

  const limit = Math.min(Math.max(Number(req.query?.limit) || 20, 1), 50);
  const { value: payload, meta } = await getOrSetCache(
    {
      key: buildCacheKey('gyms:reviews', { gymId, limit }),
      ttlSeconds: 90,
      staleWhileRevalidateSeconds: 180,
      tags: [`gym:${gymId}`, `gym:${gymId}:reviews`],
      bypass: shouldBypassCache(req),
    },
    async () => ({ reviews: await fetchGymReviews(gymId, limit) }),
  );

  applyCacheHeaders(res, meta);
  if (applyPublicCacheHeaders(req, res, {
    scope: 'gyms:reviews',
    version: JSON.stringify((payload.reviews ?? []).map((review) => ({
      id: review.id,
      updatedAt: review.updatedAt ?? review.createdAt ?? null,
    }))),
    lastModified: resolveReviewCollectionLastModified(payload.reviews),
    maxAgeSeconds: 45,
    staleWhileRevalidateSeconds: 180,
  })) {
    return;
  }

  return res
    .status(200)
    .json(new ApiResponse(200, payload, 'Reviews fetched successfully'));
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
  ).populate({ path: 'user', select: GYM_REVIEW_USER_SELECT });

  const analytics = await syncGymAnalyticsSnapshot(gymId);
  await invalidateGymCaches(gymId, { includeReviews: false });

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

  const gymExists = await Gym.exists({ _id: gymId });
  if (!gymExists) {
    throw new ApiError(404, 'Gym not found');
  }

  await queueGymImpression(gymId);

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

  const session = await mongoose.startSession();
  let gym;
  try {
    await session.withTransaction(async () => {
      [gym] = await Gym.create([
        {
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
        },
      ], { session });

      await GymListingSubscription.create([
        {
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
        },
      ], { session });

      await Revenue.create([
        {
          amount: plan.amount,
          user: req.user._id,
          type: 'listing',
          description: `${plan.label} activation for ${name}`,
          metadata: new Map([
            ['gymId', String(gym._id)],
            ['planCode', plan.planCode],
            ['paymentReference', paymentReference],
          ]),
        },
      ], { session });

      await enqueueOutboxEvents(buildGymOutboxEvents(gym._id), { session });
    });
  } finally {
    await session.endSession();
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
  await enqueueOutboxEvents(buildGymOutboxEvents(gymId));

  return res
    .status(200)
    .json(new ApiResponse(200, { gym: mapGym(populated) }, 'Gym updated successfully'));
});
