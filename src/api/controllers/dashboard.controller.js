import mongoose from 'mongoose';
import Gym from '../../models/gym.model.js';
import GymMembership from '../../models/gymMembership.model.js';
import TrainerProgress from '../../models/trainerProgress.model.js';
import TrainerAssignment from '../../models/trainerAssignment.model.js';
import GymListingSubscription from '../../models/gymListingSubscription.model.js';
import Revenue from '../../models/revenue.model.js';
import Order from '../../models/order.model.js';
import Product from '../../models/product.model.js';
import ProductReview from '../../models/productReview.model.js';
import User from '../../models/user.model.js';
import Review from '../../models/review.model.js';
import Gallery from '../../models/gallery.model.js';
import {
  loadAdminToggles,
} from '../../services/systemSettings.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import toObjectId from '../../utils/toObjectId.js';
import { normaliseOrderItemStatus, summariseOrderStatus } from '../../utils/orderStatus.js';

const daysBetween = (from, to) => {
  const start = from instanceof Date ? from : new Date(from);
  const end = to instanceof Date ? to : new Date(to);
  return Math.round((end - start) / (1000 * 60 * 60 * 24));
};

const formatCurrency = (amount = 0, currency = 'INR') => ({ amount, currency });

const toDate = (value) => {
  if (value instanceof Date) {
    return value;
  }
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const OWNER_REVENUE_SHARE = 0.5;
const TRAINER_REVENUE_SHARE = 0.5;
const DIET_MEAL_SLOTS = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'snack', label: 'Snack' },
  { key: 'dinner', label: 'Dinner' },
];

const calculateRevenueShare = (amount = 0, ratio = OWNER_REVENUE_SHARE) => {
  const value = Number(amount) || 0;
  if (value <= 0) {
    return 0;
  }
  const clampedRatio = Number.isFinite(ratio) ? Math.min(Math.max(ratio, 0), 1) : OWNER_REVENUE_SHARE;
  return Math.max(Math.round(value * clampedRatio), 0);
};

const buildSubscriptionExpenseEntries = (subscriptions = []) => {
  const entries = [];

  subscriptions.forEach((subscription) => {
    const invoices = Array.isArray(subscription?.invoices) ? subscription.invoices : [];

    if (invoices.length) {
      invoices.forEach((invoice) => {
        const when = toDate(invoice?.paidOn) || toDate(invoice?.createdAt) || toDate(subscription?.periodStart);
        if (!when) {
          return;
        }
        entries.push({ amount: Number(invoice?.amount) || 0, date: when, source: 'listing' });
      });
      return;
    }

    const fallbackDate = toDate(subscription?.periodStart) || toDate(subscription?.createdAt);
    if (!fallbackDate) {
      return;
    }
    entries.push({ amount: Number(subscription?.amount) || 0, date: fallbackDate, source: 'listing' });
  });

  return entries;
};

const buildSponsorshipExpenseEntries = (gyms = []) => {
  const entries = [];

  gyms.forEach((gym) => {
    const sponsorship = gym?.sponsorship;
    if (!sponsorship) {
      return;
    }

    const when = toDate(sponsorship.startDate) || toDate(gym?.createdAt);
    if (!when) {
      return;
    }

    const paidAmount = Number(sponsorship.amount ?? sponsorship.monthlyBudget) || 0;
    if (paidAmount <= 0) {
      return;
    }

    entries.push({ amount: paidAmount, date: when, source: 'sponsorship' });
  });

  return entries;
};

const collectOwnerExpenseEntries = ({ subscriptions = [], gyms = [] } = {}) => {
  const entries = [
    ...buildSubscriptionExpenseEntries(subscriptions),
    ...buildSponsorshipExpenseEntries(gyms),
  ];

  return entries.filter((entry) => entry.amount > 0 && entry.date instanceof Date);
};

const mapDietMeals = (meals = []) => {
  const lookup = meals.reduce((acc, meal) => {
    if (!meal?.mealType) {
      return acc;
    }
    acc[meal.mealType] = meal;
    return acc;
  }, {});

  return DIET_MEAL_SLOTS.map((slot) => {
    const entry = lookup[slot.key] ?? null;
    return {
      mealType: slot.key,
      label: slot.label,
      item: entry?.item ?? null,
      calories: entry?.calories ?? null,
      protein: entry?.protein ?? null,
      fat: entry?.fat ?? null,
      notes: entry?.notes ?? null,
    };
  });
};

const createMonthlyTimeline = (months, referenceDate = new Date()) => {
  const timeline = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const date = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1);
    const id = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    timeline.push({
      id,
      label: date.toLocaleDateString('en-IN', { month: 'short' }),
      fullLabel: date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
      referenceDate: date,
      revenue: 0,
      expenses: 0,
      memberships: 0,
    });
  }
  return timeline;
};

const createWeeklyTimeline = (weeks, referenceDate = new Date()) => {
  const timeline = [];
  const end = new Date(referenceDate);
  end.setHours(23, 59, 59, 999);

  for (let i = weeks - 1; i >= 0; i -= 1) {
    const weekEnd = new Date(end);
    weekEnd.setDate(end.getDate() - (weeks - 1 - i) * 7);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekEnd.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);
    weekEnd.setHours(23, 59, 59, 999);

    const label = `${weekEnd.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
    const fullLabel = `${weekStart.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
    })} – ${weekEnd.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })}`;

    timeline.push({
      id: weekStart.toISOString().slice(0, 10),
      label,
      fullLabel,
      start: weekStart,
      end: weekEnd,
      revenue: 0,
      expenses: 0,
      memberships: 0,
    });
  }

  return timeline.reverse();
};

const applyMonthlyAmount = (timeline, date, key, amount) => {
  const targetDate = toDate(date);
  if (!targetDate) {
    return;
  }

  const id = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;
  const bucket = timeline.find((entry) => entry.id === id);
  if (!bucket) {
    return;
  }
  bucket[key] = (bucket[key] || 0) + (Number(amount) || 0);
};

const applyWeeklyAmount = (timeline, date, key, amount) => {
  const targetDate = toDate(date);
  if (!targetDate) {
    return;
  }

  const bucket = timeline.find((entry) => targetDate >= entry.start && targetDate <= entry.end);
  if (!bucket) {
    return;
  }
  bucket[key] = (bucket[key] || 0) + (Number(amount) || 0);
};

const REVENUE_EARNING_TYPES = ['membership', 'enrollment', 'renewal'];
const TRAINER_PLAN_CODES = ['trainer-access', 'trainerAccess', 'trainer'];

const buildOrderSummary = (orders = []) =>
  orders.map((order) => ({
    id: order._id,
    orderNumber: order.orderNumber,
    total: formatCurrency(order.total, 'INR'),
    status: summariseOrderStatus(order),
    createdAt: order.createdAt,
    itemsCount: order.orderItems?.reduce((total, item) => total + (item.quantity || 0), 0) ?? 0,
  }));

const computeAttendanceStreak = (attendance = []) => {
  if (!attendance.length) return 0;
  const sorted = [...attendance].sort((a, b) => new Date(b.date) - new Date(a.date));
  let streak = 0;
  for (const entry of sorted) {
    if (entry.status === 'present') {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
};

const buildAttendanceSummary = (attendance = []) => {
  const today = new Date();
  const last30 = attendance.filter((record) => daysBetween(record.date, today) <= 30);
  const counters = last30.reduce(
    (acc, record) => {
      acc[record.status] = (acc[record.status] || 0) + 1;
      return acc;
    },
    { present: 0, late: 0, absent: 0 },
  );

  const total = last30.length || 1;

  return {
    streak: computeAttendanceStreak(attendance),
    presentPercentage: Math.round((counters.present / total) * 100),
    latePercentage: Math.round((counters.late / total) * 100),
    absentPercentage: Math.round((counters.absent / total) * 100),
    records: last30
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 30)
      .map((record) => ({
        date: record.date,
        status: record.status,
        notes: record.notes,
      })),
  };
};

const buildBodyMetricSummaries = (bodyMetrics = []) => {
  if (!Array.isArray(bodyMetrics) || !bodyMetrics.length) {
    return [];
  }

  const sorted = [...bodyMetrics].sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt));
  const limitedHistory = sorted.slice(0, 20);

  const toHistory = (selector, unit) =>
    limitedHistory
      .filter((entry) => selector(entry) !== undefined && selector(entry) !== null)
      .map((entry) => ({
        value: selector(entry),
        unit,
        recordedAt: entry.recordedAt,
      }));

  const latest = sorted[0];

  const summaries = [
    {
      metric: 'weight',
      latestValue: latest?.weightKg,
      unit: 'kg',
      recordedAt: latest?.recordedAt,
      history: toHistory((entry) => entry.weightKg, 'kg'),
    },
    {
      metric: 'height',
      latestValue: latest?.heightCm,
      unit: 'cm',
      recordedAt: latest?.recordedAt,
      history: toHistory((entry) => entry.heightCm, 'cm'),
    },
    {
      metric: 'bmi',
      latestValue: latest?.bmi,
      unit: '',
      recordedAt: latest?.recordedAt,
      history: toHistory((entry) => entry.bmi, ''),
    },
  ];

  return summaries.filter((summary) => summary.latestValue !== undefined && summary.latestValue !== null);
};

const serializeBodyMetrics = (bodyMetrics = []) => {
  if (!Array.isArray(bodyMetrics) || !bodyMetrics.length) {
    return [];
  }

  return [...bodyMetrics]
    .filter((entry) => entry?.recordedAt)
    .sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt))
    .map((entry) => ({
      weightKg: entry.weightKg,
      heightCm: entry.heightCm,
      bmi: entry.bmi,
      recordedAt: entry.recordedAt,
    }));
};

const groupProgressMetrics = (metrics = [], bodyMetrics = []) => {
  const grouped = metrics.reduce((acc, metricEntry) => {
    if (!metricEntry.metric) return acc;
    const key = metricEntry.metric.toLowerCase();
    if (!acc[key]) {
      acc[key] = { metric: metricEntry.metric, entries: [] };
    }
    acc[key].entries.push(metricEntry);
    return acc;
  }, {});

  const summaries = Object.values(grouped).map((group) => {
    const sorted = group.entries.sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt));
    const latest = sorted[0];
    return {
      metric: group.metric,
      latestValue: latest?.value ?? 0,
      unit: latest?.unit ?? '',
      recordedAt: latest?.recordedAt,
      history: sorted.slice(0, 10),
    };
  });

  const upsertSummary = (entry) => {
    if (!entry?.metric) {
      return;
    }
    const key = entry.metric.toLowerCase();
    const existingIndex = summaries.findIndex((item) => item.metric?.toLowerCase() === key);
    if (existingIndex >= 0) {
      summaries[existingIndex] = entry;
    } else {
      summaries.push(entry);
    }
  };

  buildBodyMetricSummaries(bodyMetrics).forEach(upsertSummary);

  return summaries;
};

export const getTraineeOverview = asyncHandler(async (req, res) => {
  const userId = req.user?._id;

  const membershipPromise = GymMembership.findOne({
    trainee: userId,
    status: { $in: ['active', 'paused'] },
  })
    .sort({ endDate: -1 })
    .populate({ path: 'gym', select: 'name location pricing sponsorship analytics' })
    .populate({ path: 'trainer', select: 'name profilePicture role' })
    .lean();

  const progressPromise = TrainerProgress.findOne({ trainee: userId })
    .populate({ path: 'trainer', select: 'name profilePicture role' })
    .lean();

  const ordersPromise = Order.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

  const [membershipDoc, progressDoc, orders] = await Promise.all([
    membershipPromise,
    progressPromise,
    ordersPromise,
  ]);

  const membership = membershipDoc
    ? {
      id: membershipDoc._id,
      plan: membershipDoc.plan,
      status: membershipDoc.status,
      startDate: membershipDoc.startDate,
      endDate: membershipDoc.endDate,
      daysRemaining: Math.max(0, daysBetween(new Date(), membershipDoc.endDate)),
      autoRenew: membershipDoc.autoRenew,
      benefits: membershipDoc.benefits ?? [],
      trainer: membershipDoc.trainer
        ? {
          id: membershipDoc.trainer._id,
          name: membershipDoc.trainer.name,
          profilePicture: membershipDoc.trainer.profilePicture,
        }
        : null,
      gym: membershipDoc.gym
        ? {
          id: membershipDoc.gym._id,
          name: membershipDoc.gym.name,
          city: membershipDoc.gym.location?.city,
          pricing: membershipDoc.gym.pricing,
          sponsorship: membershipDoc.gym.sponsorship,
          analytics: membershipDoc.gym.analytics,
        }
        : null,
      billing: membershipDoc.billing
        ? formatCurrency(membershipDoc.billing.amount, membershipDoc.billing.currency)
        : null,
    }
    : null;

  const attendanceSummary = progressDoc ? buildAttendanceSummary(progressDoc.attendance) : null;

  const progressSummary = progressDoc
    ? {
      streak: attendanceSummary?.streak ?? 0,
      lastCheckIn: progressDoc.attendance?.length
        ? [...progressDoc.attendance].sort((a, b) => new Date(b.date) - new Date(a.date))[0].date
        : null,
      attendance: attendanceSummary,
      metrics: groupProgressMetrics(progressDoc.progressMetrics || [], progressDoc.bodyMetrics || []).slice(0, 3),
      bodyMetrics: serializeBodyMetrics(progressDoc.bodyMetrics || []),
      feedback: progressDoc.feedback
        ?.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 3),
    }
    : null;

  const latestDiet = progressDoc?.dietPlans
    ?.slice()
    .sort((a, b) => new Date(b.weekOf) - new Date(a.weekOf))[0];

  const data = {
    membership,
    progress: progressSummary,
    diet: latestDiet
      ? {
        weekOf: latestDiet.weekOf,
        meals: mapDietMeals(latestDiet.meals || []),
        notes: latestDiet.notes,
      }
      : null,
    recentOrders: buildOrderSummary(orders),
  };

  return res
    .status(200)
    .json(new ApiResponse(200, data, 'Trainee overview fetched successfully'));
});

export const getTraineeProgress = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const progressDocs = await TrainerProgress.find({ trainee: userId })
    .sort({ updatedAt: -1 })
    .populate({ path: 'trainer', select: 'name profilePicture' })
    .populate({ path: 'gym', select: 'name location.city' })
    .lean();

  if (!progressDocs.length) {
    return res
      .status(200)
      .json(new ApiResponse(200, { attendance: null, metrics: [], feedback: [], trainerFeedbackTargets: [], trainerFeedbackHistory: [] }, 'No progress data yet.'));
  }

  const primaryProgress = progressDocs[0];

  const attendance = buildAttendanceSummary(primaryProgress.attendance || []);
  const metrics = groupProgressMetrics(primaryProgress.progressMetrics || [], primaryProgress.bodyMetrics || []);
  const bodyMetrics = serializeBodyMetrics(primaryProgress.bodyMetrics || []);
  const feedback = (primaryProgress.feedback || [])
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((entry) => ({ message: entry.message, category: entry.category, createdAt: entry.createdAt }))
    .slice(0, 10);

  const trainerFeedbackTargets = progressDocs
    .filter((doc) => doc.trainer)
    .map((doc) => ({
      trainerId: doc.trainer?._id ? String(doc.trainer._id) : doc.trainer ? String(doc.trainer) : null,
      trainerName: doc.trainer?.name ?? 'Trainer',
      gymId: doc.gym?._id ? String(doc.gym._id) : doc.gym ? String(doc.gym) : null,
      gymName: doc.gym?.name ?? null,
    }))
    .filter((entry) => entry.trainerId);

  const trainerFeedbackHistory = progressDocs
    .flatMap((doc) => {
      const trainerId = doc.trainer?._id ? String(doc.trainer._id) : doc.trainer ? String(doc.trainer) : null;
      const trainerName = doc.trainer?.name ?? 'Trainer';
      const gymName = doc.gym?.name ?? null;
      if (!trainerId || !Array.isArray(doc.traineeFeedback)) {
        return [];
      }
      return doc.traineeFeedback.map((entry) => ({
        id: entry._id ? String(entry._id) : `${trainerId}-${entry.createdAt?.toISOString?.() ?? Date.now()}`,
        trainerId,
        trainerName,
        gymName,
        message: entry.message,
        createdAt: entry.createdAt,
      }));
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 20);

  const response = {
    attendance,
    metrics,
    bodyMetrics,
    rawAttendance: (primaryProgress.attendance || []).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 60),
    feedback,
    trainerFeedbackTargets,
    trainerFeedbackHistory,
  };

  return res.status(200).json(new ApiResponse(200, response, 'Trainee progress fetched successfully'));
});

export const getTraineeDiet = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const progress = await TrainerProgress.findOne({ trainee: userId }).lean();

  if (!progress || !(progress.dietPlans?.length)) {
    return res.status(200).json(
      new ApiResponse(200, { latest: null, history: [] }, 'No diet plans assigned yet.'),
    );
  }

  const sorted = [...progress.dietPlans].sort((a, b) => new Date(b.weekOf) - new Date(a.weekOf));
  const latest = sorted[0];

  const history = sorted.slice(1, 6).map((plan) => ({
    weekOf: plan.weekOf,
    meals: mapDietMeals(plan.meals || []),
    notes: plan.notes,
  }));

  return res.status(200).json(
    new ApiResponse(200, {
      latest: latest
        ? {
          weekOf: latest.weekOf,
          meals: mapDietMeals(latest.meals || []),
          notes: latest.notes,
        }
        : null,
      history,
    }, 'Diet plans fetched successfully'),
  );
});

export const getTraineeOrders = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const orders = await Order.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(20)
    .populate({ path: 'orderItems.product', select: 'name image' })
    .lean();

  const productIds = orders.flatMap((order) => (order.orderItems || [])
    .map((item) => (item.product?._id ?? item.product))
    .filter(Boolean));

  const reviewedProducts = productIds.length
    ? await ProductReview.find({ user: userId, product: { $in: productIds } })
      .select('product')
      .lean()
    : [];

  const reviewedSet = new Set(reviewedProducts.map((review) => String(review.product)));

  const detailedOrders = orders.map((order) => {
    const items = (order.orderItems || []).map((item) => {
      const productId = item.product?._id ?? item.product;
      const status = normaliseOrderItemStatus(item.status);
      const reviewed = productId ? reviewedSet.has(String(productId)) : false;
      const canReview = Boolean(productId) && status === 'delivered' && !reviewed;

      return {
        id: item._id ?? `${order._id}-${productId}`,
        productId,
        name: item.name ?? item.product?.name ?? 'Marketplace item',
        image: item.image ?? item.product?.image ?? null,
        quantity: item.quantity ?? 0,
        status,
        reviewed,
        canReview,
      };
    });

    return {
      id: order._id,
      orderNumber: order.orderNumber,
      total: formatCurrency(order.total, 'INR'),
      status: summariseOrderStatus(order),
      createdAt: order.createdAt,
      itemsCount: items.reduce((total, item) => total + (item.quantity || 0), 0),
      items,
    };
  });

  return res
    .status(200)
    .json(new ApiResponse(200, { orders: detailedOrders }, 'Orders fetched successfully'));
});

export const submitTrainerFeedback = asyncHandler(async (req, res) => {
  const traineeId = req.user?._id;
  const { trainerId, message } = req.body ?? {};

  if (!trainerId || !mongoose.Types.ObjectId.isValid(trainerId)) {
    throw new ApiError(400, 'A valid trainer id is required.');
  }

  const trimmedMessage = (message ?? '').trim();
  if (!trimmedMessage) {
    throw new ApiError(400, 'Feedback message is required.');
  }

  const membership = await GymMembership.findOne({
    trainee: traineeId,
    trainer: trainerId,
    status: { $in: ['pending', 'active', 'paused', 'expired'] },
  })
    .populate({ path: 'trainer', select: 'name profilePicture' })
    .populate({ path: 'gym', select: 'name location.city' })
    .lean();

  if (!membership) {
    throw new ApiError(403, 'You can only share feedback with trainers you are assigned to.');
  }

  const progress = await TrainerProgress.findOneAndUpdate(
    { trainee: traineeId, trainer: trainerId },
    {
      $setOnInsert: { trainee: traineeId, trainer: trainerId },
      $set: { gym: membership.gym?._id ?? membership.gym },
    },
    { new: true, upsert: true },
  );

  if (!Array.isArray(progress.traineeFeedback)) {
    progress.traineeFeedback = [];
  }

  const feedbackEntry = {
    message: trimmedMessage,
    createdAt: new Date(),
  };

  progress.traineeFeedback.push(feedbackEntry);
  progress.markModified('traineeFeedback');
  await progress.save();

  const savedEntry = progress.traineeFeedback[progress.traineeFeedback.length - 1];

  return res.status(201).json(
    new ApiResponse(
      201,
      {
        feedback: {
          id: savedEntry._id,
          trainer: {
            id: membership.trainer?._id ? String(membership.trainer._id) : String(trainerId),
            name: membership.trainer?.name ?? 'Trainer',
          },
          gym: membership.gym
            ? {
              id: membership.gym._id ? String(membership.gym._id) : String(membership.gym),
              name: membership.gym.name,
            }
            : null,
          message: savedEntry.message,
          createdAt: savedEntry.createdAt,
        },
      },
      'Feedback shared with your trainer.',
    ),
  );
});

export const getTrainerFeedbackInbox = asyncHandler(async (req, res) => {
  const trainerId = req.user?._id;
  const progressDocs = await TrainerProgress.find({ trainer: trainerId, 'traineeFeedback.0': { $exists: true } })
    .select('traineeFeedback trainee gym')
    .populate({ path: 'trainee', select: 'name email profilePicture' })
    .populate({ path: 'gym', select: 'name location.city' })
    .lean();

  const feedback = progressDocs
    .flatMap((doc) => {
      const traineeId = doc.trainee?._id ? String(doc.trainee._id) : doc.trainee ? String(doc.trainee) : null;
      const traineeName = doc.trainee?.name ?? 'Trainee';
      const gymName = doc.gym?.name ?? '—';
      const gymId = doc.gym?._id ? String(doc.gym._id) : doc.gym ? String(doc.gym) : null;

      if (!traineeId || !Array.isArray(doc.traineeFeedback)) {
        return [];
      }

      return doc.traineeFeedback.map((entry) => ({
        id: entry._id ? String(entry._id) : `${traineeId}-${entry.createdAt?.toISOString?.() ?? Date.now()}`,
        trainee: {
          id: traineeId,
          name: traineeName,
        },
        gym: {
          id: gymId,
          name: gymName,
        },
        message: entry.message,
        createdAt: entry.createdAt,
      }));
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return res
    .status(200)
    .json(new ApiResponse(200, { feedback }, 'Trainer feedback inbox fetched successfully'));
});


export const getGymOwnerOverview = asyncHandler(async (req, res) => {
  if (req.user?.status !== 'active' && req.user?.role !== 'admin') {
    throw new ApiError(403, 'Your gym-owner account is awaiting approval.');
  }

  const ownerId = req.user?._id;
  const ownerObjectId = toObjectId(ownerId);
  const ownerFilter = ownerObjectId ?? ownerId;

  const gyms = await Gym.find({ owner: ownerFilter })
    .select('name location status isPublished analytics sponsorship pricing updatedAt')
    .lean();

  if (!gyms.length) {
    return res.status(200).json(
      new ApiResponse(200, {
        stats: {
          totalGyms: 0,
          publishedGyms: 0,
          pendingGyms: 0,
          activeMemberships: 0,
          revenue30d: formatCurrency(0),
          expenses30d: formatCurrency(0),
          profit30d: formatCurrency(0),
          impressions30d: 0,
          sponsoredGyms: 0,
        },
        gyms: [],
        expiringSubscriptions: [],
      }, 'No gyms found for this owner.'),
    );
  }

  const gymIds = gyms.map((gym) => gym._id);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    membershipAggregates,
    subscriptionDocs,
    revenueAggregate,
    recentJoiners,
    membershipBillings,
  ] = await Promise.all([
    GymMembership.aggregate([
      { $match: { gym: { $in: gymIds }, status: 'active', plan: { $nin: TRAINER_PLAN_CODES } } },
      { $group: { _id: '$gym', activeMembers: { $sum: 1 } } },
    ]),
    GymListingSubscription.find({ owner: ownerFilter, status: { $in: ['active', 'grace'] } })
      .populate({ path: 'gym', select: 'name location' })
      .lean(),
    Revenue.aggregate([
      {
        $match: {
          user: ownerFilter,
          type: { $in: REVENUE_EARNING_TYPES },
          createdAt: { $gte: thirtyDaysAgo },
        },
      },
      { $group: { _id: null, totalAmount: { $sum: '$amount' } } },
    ]),
    GymMembership.find({ gym: { $in: gymIds }, status: 'active', plan: { $nin: TRAINER_PLAN_CODES } })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate({ path: 'trainee', select: 'name email profilePicture' })
      .populate({ path: 'gym', select: 'name' })
      .lean(),
    GymMembership.find({
      gym: { $in: gymIds },
      status: { $in: ['active', 'paused'] },
      createdAt: { $gte: thirtyDaysAgo },

      plan: { $nin: TRAINER_PLAN_CODES },
      'billing.status': 'paid',
      'billing.amount': { $gt: 0 },
    })
      .select('billing')
      .lean(),
  ]);

  const membershipMap = membershipAggregates.reduce((acc, item) => {
    acc[item._id.toString()] = item.activeMembers;
    return acc;
  }, {});

  const derivedOwnerRevenue30d = membershipBillings.reduce((sum, membership) => {
    const amount = membership?.billing?.amount;
    return sum + calculateRevenueShare(amount, OWNER_REVENUE_SHARE);
  }, 0);

  let revenue30d = revenueAggregate?.[0]?.totalAmount ?? 0;
  if (revenue30d <= 0 && derivedOwnerRevenue30d > 0) {
    revenue30d = derivedOwnerRevenue30d;
  }

  const enrichedGyms = gyms.map((gym) => {
    const members = membershipMap[gym._id.toString()] ?? 0;
    const impressions30d = gym.analytics?.impressions ?? 0;
    return {
      id: gym._id,
      name: gym.name,
      city: gym.location?.city,
      status: gym.status,
      isPublished: gym.isPublished,
      members,
      impressions: impressions30d,
      sponsorship: gym.sponsorship,
      pricing: gym.pricing,
      updatedAt: gym.updatedAt,
    };
  });

  const expiringSubscriptions = subscriptionDocs
    .filter((subscription) => daysBetween(new Date(), subscription.periodEnd) <= 14)
    .map((subscription) => ({
      id: subscription._id,
      planCode: subscription.planCode,
      periodEnd: subscription.periodEnd,
      gym: subscription.gym
        ? { id: subscription.gym._id, name: subscription.gym.name, city: subscription.gym.location?.city }
        : null,
    }));

  const sponsoredGyms = gyms.filter((gym) => gym.sponsorship?.tier && gym.sponsorship.tier !== 'none').length;
  const expenseEntries = collectOwnerExpenseEntries({ subscriptions: subscriptionDocs, gyms });
  const expenses30d = expenseEntries
    .filter((entry) => entry.date >= thirtyDaysAgo)
    .reduce((sum, entry) => sum + entry.amount, 0);
  const profit30d = revenue30d - expenses30d;

  const stats = {
    totalGyms: gyms.length,
    publishedGyms: gyms.filter((gym) => gym.isPublished).length,
    pendingGyms: gyms.filter((gym) => gym.status !== 'active').length,
    activeMemberships: membershipAggregates.reduce((sum, item) => sum + item.activeMembers, 0),
    revenue30d: formatCurrency(revenue30d),
    expenses30d: formatCurrency(expenses30d),
    profit30d: formatCurrency(profit30d),
    impressions30d: enrichedGyms.reduce((sum, gym) => sum + (gym.impressions ?? 0), 0),
    sponsoredGyms,
  };

  const recentMembers = recentJoiners.map((membership) => ({
    id: membership._id,
    user: membership.trainee
      ? {
        id: membership.trainee._id,
        name: membership.trainee.name,
        email: membership.trainee.email,
        profilePicture: membership.trainee.profilePicture,
      }
      : null,
    gym: membership.gym ? { id: membership.gym._id, name: membership.gym.name } : null,
    joinedAt: membership.createdAt,
    planType: membership.planType,
  }));

  return res
    .status(200)
    .json(new ApiResponse(200, { stats, gyms: enrichedGyms, expiringSubscriptions, recentMembers }, 'Gym owner overview fetched successfully'));
});

export const getGymOwnerGyms = asyncHandler(async (req, res) => {
  const ownerId = req.user?._id;

  const gyms = await Gym.find({ owner: ownerId })
    .select('name location status isPublished analytics sponsorship pricing createdAt updatedAt tags keyFeatures')
    .lean();

  const gymIds = gyms.map((gym) => gym._id);

  const membershipAggregates = await GymMembership.aggregate([
    { $match: { gym: { $in: gymIds }, status: { $in: ['active', 'paused'] }, plan: { $nin: TRAINER_PLAN_CODES } } },
    {
      $group: {
        _id: '$gym',
        activeMembers: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
        pausedMembers: { $sum: { $cond: [{ $eq: ['$status', 'paused'] }, 1, 0] } },
        expiringSoon: {
          $sum: {
            $cond: [
              {
                $lte: [
                  '$endDate',
                  new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
  ]);

  const membershipMap = membershipAggregates.reduce((acc, item) => {
    acc[item._id.toString()] = item;
    return acc;
  }, {});

  const data = gyms.map((gym) => {
    const membershipInfo = membershipMap[gym._id.toString()] ?? {};
    return {
      id: gym._id,
      name: gym.name,
      city: gym.location?.city,
      status: gym.status,
      isPublished: gym.isPublished,
      tags: gym.tags,
      keyFeatures: gym.keyFeatures,
      analytics: gym.analytics,
      sponsorship: gym.sponsorship,
      pricing: gym.pricing,
      createdAt: gym.createdAt,
      updatedAt: gym.updatedAt,
      members: {
        active: membershipInfo.activeMembers ?? 0,
        paused: membershipInfo.pausedMembers ?? 0,
        expiringSoon: membershipInfo.expiringSoon ?? 0,
      },
    };
  });

  return res
    .status(200)
    .json(new ApiResponse(200, { gyms: data }, 'Gym list fetched successfully'));
});

export const getGymOwnerRoster = asyncHandler(async (req, res) => {
  const ownerId = req.user?._id;
  const ownerObjectId = toObjectId(ownerId);
  const ownerFilter = ownerObjectId ?? ownerId;

  const gyms = await Gym.find({ owner: ownerFilter })
    .select('name location status isPublished createdAt')
    .lean();

  if (!gyms.length) {
    return res
      .status(200)
      .json(new ApiResponse(200, { gyms: [] }, 'No gyms found for this owner.'));
  }

  const gymIds = gyms.map((gym) => gym._id);

  const [assignmentDocs, membershipDocs] = await Promise.all([
    TrainerAssignment.find({ gym: { $in: gymIds }, status: { $in: ['pending', 'active'] } })
      .populate({ path: 'trainer', select: 'name email profilePicture status role' })
      .lean(),

    GymMembership.find({
      gym: { $in: gymIds },
      status: { $in: ['pending', 'active', 'paused'] },
      plan: { $nin: TRAINER_PLAN_CODES },
    })
      .populate({ path: 'trainee', select: 'name email profilePicture role' })
      .populate({ path: 'trainer', select: 'name email profilePicture role' })
      .lean(),
  ]);

  const rosterMap = gyms.reduce((acc, gym) => {
    acc[gym._id.toString()] = {
      id: gym._id,
      name: gym.name,
      city: gym.location?.city ?? '',
      status: gym.status,
      isPublished: gym.isPublished,
      trainers: [],
      trainees: [],
    };
    return acc;
  }, {});

  assignmentDocs.forEach((assignment) => {
    const gymId = assignment.gym ? assignment.gym.toString() : null;
    if (!gymId || !rosterMap[gymId]) {
      return;
    }

    rosterMap[gymId].trainers.push({
      assignmentId: assignment._id,
      id: assignment.trainer?._id ?? null,
      name: assignment.trainer?.name ?? 'Trainer',
      email: assignment.trainer?.email ?? '',
      status: assignment.status,
      profilePicture: assignment.trainer?.profilePicture ?? null,
      requestedAt: assignment.requestedAt,
      approvedAt: assignment.approvedAt,
    });
  });

  membershipDocs.forEach((membership) => {
    const gymId = membership.gym ? membership.gym.toString() : null;
    if (!gymId || !rosterMap[gymId]) {
      return;
    }

    rosterMap[gymId].trainees.push({
      membershipId: membership._id,
      id: membership.trainee?._id ?? null,
      name: membership.trainee?.name ?? 'Member',
      email: membership.trainee?.email ?? '',
      status: membership.status,
      plan: membership.plan,
      startDate: membership.startDate,
      endDate: membership.endDate,
      autoRenew: membership.autoRenew,
      trainer: membership.trainer
        ? {
          id: membership.trainer._id,
          name: membership.trainer.name,
        }
        : null,
    });
  });

  const roster = Object.values(rosterMap).map((gym) => ({
    ...gym,
    trainers: gym.trainers.sort((a, b) => new Date(b.approvedAt || b.requestedAt) - new Date(a.approvedAt || a.requestedAt)),
    trainees: gym.trainees.sort((a, b) => new Date(b.startDate) - new Date(a.startDate)),
  }));

  return res
    .status(200)
    .json(new ApiResponse(200, { gyms: roster }, 'Gym roster fetched successfully'));
});

export const getGymOwnerSubscriptions = asyncHandler(async (req, res) => {
  const ownerId = req.user?._id;

  const subscriptions = await GymListingSubscription.find({ owner: ownerId })
    .sort({ periodEnd: 1 })
    .populate({ path: 'gym', select: 'name location status' })
    .lean();

  const data = subscriptions.map((subscription) => ({
    id: subscription._id,
    planCode: subscription.planCode,
    amount: formatCurrency(subscription.amount, subscription.currency),
    periodStart: subscription.periodStart,
    periodEnd: subscription.periodEnd,
    status: subscription.status,
    autoRenew: subscription.autoRenew,
    invoices: subscription.invoices ?? [],
    gym: subscription.gym
      ? {
        id: subscription.gym._id,
        name: subscription.gym.name,
        city: subscription.gym.location?.city,
        status: subscription.gym.status,
      }
      : null,
  }));

  return res
    .status(200)
    .json(new ApiResponse(200, { subscriptions: data }, 'Subscriptions fetched successfully'));
});

export const getGymOwnerSponsorship = asyncHandler(async (req, res) => {
  const ownerId = req.user?._id;
  const gyms = await Gym.find({ owner: ownerId })
    .select('name sponsorship location analytics')
    .lean();

  const data = gyms
    .filter((gym) => gym.sponsorship && gym.sponsorship.tier && gym.sponsorship.tier !== 'none')
    .map((gym) => ({
      id: gym._id,
      name: gym.name,
      city: gym.location?.city,
      impressions: gym.analytics?.impressions ?? 0,
      sponsorship: gym.sponsorship,
    }));

  return res
    .status(200)
    .json(new ApiResponse(200, { sponsorships: data }, 'Sponsorship data fetched successfully'));
});

export const getGymOwnerAnalytics = asyncHandler(async (req, res) => {
  const ownerId = req.user?._id;
  const ownerObjectId = toObjectId(ownerId);
  const ownerFilter = ownerObjectId ?? ownerId;
  const referenceDate = new Date();
  referenceDate.setHours(23, 59, 59, 999);

  const gyms = await Gym.find({ owner: ownerFilter })
    .select('_id name analytics sponsorship createdAt')
    .lean();

  const gymIds = gyms.map((gym) => gym._id);

  const monthlyTimeline = createMonthlyTimeline(12, referenceDate);
  const weeklyTimeline = createWeeklyTimeline(12, referenceDate);

  const earliestMonthly = monthlyTimeline[0]?.referenceDate ?? referenceDate;
  const earliestWeekly = weeklyTimeline[0]?.start ?? referenceDate;
  const earliestDate = earliestMonthly < earliestWeekly ? earliestMonthly : earliestWeekly;

  const [membershipDocs, revenueEvents, subscriptions] = await Promise.all([
    GymMembership.find({
      gym: { $in: gymIds },
      status: { $in: ['active', 'paused'] },
      startDate: { $gte: earliestDate },
      plan: { $nin: TRAINER_PLAN_CODES },
    })
      .select('startDate createdAt billing')
      .lean(),
    Revenue.find({
      user: ownerFilter,
      type: { $in: REVENUE_EARNING_TYPES },
      createdAt: { $gte: earliestDate },
    })
      .select('amount createdAt type')
      .lean(),
    GymListingSubscription.find({
      owner: ownerFilter,
      periodEnd: { $gte: earliestDate },
    })
      .select('amount periodStart periodEnd createdAt invoices')
      .lean(),
  ]);

  const fallbackRevenueEntries = [];

  membershipDocs.forEach((membership) => {
    const when = membership.startDate || membership.createdAt;
    applyMonthlyAmount(monthlyTimeline, when, 'memberships', 1);
    applyWeeklyAmount(weeklyTimeline, when, 'memberships', 1);

    const ownerShareAmount = calculateRevenueShare(membership?.billing?.amount, OWNER_REVENUE_SHARE);
    if (ownerShareAmount > 0) {
      fallbackRevenueEntries.push({ amount: ownerShareAmount, date: when });
    }
  });

  revenueEvents.forEach((event) => {
    applyMonthlyAmount(monthlyTimeline, event.createdAt, 'revenue', event.amount);
    applyWeeklyAmount(weeklyTimeline, event.createdAt, 'revenue', event.amount);
  });

  if (!revenueEvents.length && fallbackRevenueEntries.length) {
    fallbackRevenueEntries.forEach((entry) => {
      applyMonthlyAmount(monthlyTimeline, entry.date, 'revenue', entry.amount);
      applyWeeklyAmount(weeklyTimeline, entry.date, 'revenue', entry.amount);
    });
  }

  const expenseEntries = collectOwnerExpenseEntries({ subscriptions, gyms });
  expenseEntries.forEach((entry) => {
    applyMonthlyAmount(monthlyTimeline, entry.date, 'expenses', entry.amount);
    applyWeeklyAmount(weeklyTimeline, entry.date, 'expenses', entry.amount);
  });

  const shapeTimeline = (timeline) =>
    timeline.map((entry) => {
      const revenue = Number(entry.revenue) || 0;
      const expenses = Number(entry.expenses) || 0;
      const profit = revenue - expenses;
      return {
        id: entry.id,
        label: entry.label,
        fullLabel: entry.fullLabel,
        revenue,
        expenses,
        profit,
        memberships: Number(entry.memberships) || 0,
      };
    });

  const monthlyTrend = shapeTimeline(monthlyTimeline);
  const weeklyTrend = shapeTimeline(weeklyTimeline);

  const summarise = (timeline) => {
    if (!timeline.length) {
      return {
        totalRevenue: 0,
        totalExpenses: 0,
        totalProfit: 0,
        bestPeriod: null,
      };
    }

    return timeline.reduce(
      (acc, entry) => {
        const revenue = entry.revenue;
        const expenses = entry.expenses;
        const profit = entry.profit;

        const cumRevenue = acc.totalRevenue + revenue;
        const cumExpenses = acc.totalExpenses + expenses;
        const cumProfit = acc.totalProfit + profit;

        const best =
          profit > (acc.bestPeriod?.profit ?? Number.NEGATIVE_INFINITY)
            ? { label: entry.fullLabel, profit }
            : acc.bestPeriod;

        return {
          totalRevenue: cumRevenue,
          totalExpenses: cumExpenses,
          totalProfit: cumProfit,
          bestPeriod: best,
        };
      },
      { totalRevenue: 0, totalExpenses: 0, totalProfit: 0, bestPeriod: null },
    );
  };

  const monthlySummary = summarise(monthlyTrend);
  const weeklySummary = summarise(weeklyTrend);

  const membershipTrend = {
    monthly: monthlyTrend.map((entry) => ({
      id: entry.id,
      label: entry.label,
      fullLabel: entry.fullLabel,
      value: entry.memberships,
    })),
    weekly: weeklyTrend.map((entry) => ({
      id: entry.id,
      label: entry.label,
      fullLabel: entry.fullLabel,
      value: entry.memberships,
    })),
  };

  const revenueTrend = {
    monthly: monthlyTrend.map(({ id, label, fullLabel, revenue, expenses, profit }) => ({
      id,
      label,
      fullLabel,
      revenue,
      expenses,
      profit,
    })),
    weekly: weeklyTrend.map(({ id, label, fullLabel, revenue, expenses, profit }) => ({
      id,
      label,
      fullLabel,
      revenue,
      expenses,
      profit,
    })),
  };

  const expenseAggregate = expenseEntries.reduce((acc, entry) => {
    const key = entry.source || 'other';
    acc[key] = (acc[key] || 0) + (Number(entry.amount) || 0);
    return acc;
  }, {});

  const expenseBreakdown = Object.entries(expenseAggregate).map(([key, value]) => {
    let label = 'Other';
    if (key === 'listing') {
      label = 'Listing plans';
    } else if (key === 'sponsorship') {
      label = 'Sponsorship campaigns';
    }

    return {
      id: key,
      label,
      value,
    };
  });

  const analytics = {
    revenueTrend,
    revenueSummary: {
      monthly: monthlySummary,
      weekly: weeklySummary,
    },
    membershipTrend,
    expenseBreakdown,
    gyms: gyms.map((gym) => ({
      id: gym._id,
      name: gym.name,
      impressions: gym.analytics?.impressions ?? 0,
      memberships: gym.analytics?.memberships ?? 0,
      trainers: gym.analytics?.trainers ?? 0,
    })),
  };

  return res
    .status(200)
    .json(new ApiResponse(200, analytics, 'Analytics fetched successfully'));
});

export const getTrainerOverview = asyncHandler(async (req, res) => {
  const trainerId = req.user?._id;
  const trainerObjectId = toObjectId(trainerId);
  const trainerFilter = trainerObjectId ?? trainerId;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [memberships, assignmentDocs, progressDocs, revenueAggregate] = await Promise.all([
    GymMembership.find({ trainer: trainerId, status: { $in: ['active', 'paused'] } })
      .populate({ path: 'gym', select: 'name location' })
      .populate({ path: 'trainee', select: 'name profilePicture role' })
      .lean(),
    TrainerAssignment.find({ trainer: trainerId }).lean(),
    TrainerProgress.find({ trainer: trainerId })
      .populate({ path: 'trainee', select: 'name profilePicture role' })
      .lean(),
    Revenue.aggregate([
      {
        $match: {
          user: trainerFilter,
          type: { $in: REVENUE_EARNING_TYPES },
          createdAt: { $gte: thirtyDaysAgo },
        },
      },
      { $group: { _id: null, totalAmount: { $sum: '$amount' } } },
    ]),
  ]);

  const assignmentByGym = assignmentDocs.reduce((acc, doc) => {
    if (doc?.gym) {
      acc[String(doc.gym)] = doc;
    }
    return acc;
  }, {});

  const activeTrainees = memberships.map((membership) => {
    const gymInfo = membership.gym
      ? {
        id: membership.gym._id,
        name: membership.gym.name,
        city: membership.gym.location?.city,
      }
      : null;

    const assignment = assignmentByGym[String(membership.gym?._id)] ?? null;
    const goals = (() => {
      if (!assignment?.trainees?.length) {
        return [];
      }
      const record = assignment.trainees.find(
        (entry) => String(entry.trainee) === String(membership.trainee?._id),
      );
      return record?.goals ?? [];
    })();

    return {
      trainee: membership.trainee
        ? {
          id: membership.trainee._id,
          name: membership.trainee.name,
          profilePicture: membership.trainee.profilePicture,
        }
        : null,
      gym: gymInfo,
      assignedAt: membership.startDate,
      goals,
      status: membership.status,
    };
  });

  const upcomingCheckIns = progressDocs
    .map((doc) => {
      const nextFeedback = (doc.feedback || [])
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
      const latestAttendance = (doc.attendance || [])
        .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
      return {
        trainee: doc.trainee,
        nextFeedback,
        latestAttendance,
        summary: doc.summary,
      };
    })
    .filter(Boolean);

  const derivedTrainerRevenue30d = memberships.reduce((sum, membership) => {
    const referenceDate = membership.startDate || membership.createdAt;
    if (!referenceDate || new Date(referenceDate) < thirtyDaysAgo) {
      return sum;
    }
    return sum + calculateRevenueShare(membership?.billing?.amount, TRAINER_REVENUE_SHARE);
  }, 0);

  let trainerRevenue30d = revenueAggregate?.[0]?.totalAmount ?? 0;
  if (trainerRevenue30d <= 0 && derivedTrainerRevenue30d > 0) {
    trainerRevenue30d = derivedTrainerRevenue30d;
  }

  const response = {
    totals: {
      gyms: new Set(memberships.map((membership) => String(membership.gym?._id))).size,
      activeTrainees: activeTrainees.length,
      pendingUpdates: upcomingCheckIns.filter((item) => !item.nextFeedback).length,
      earnings30d: formatCurrency(trainerRevenue30d),
    },
    activeAssignments: activeTrainees,
    upcomingCheckIns,
  };

  return res
    .status(200)
    .json(new ApiResponse(200, response, 'Trainer overview fetched successfully'));
});

export const getTrainerTrainees = asyncHandler(async (req, res) => {
  const trainerId = req.user?._id;
  const [memberships, assignmentDocs] = await Promise.all([
    GymMembership.find({ trainer: trainerId, status: { $in: ['active', 'paused'] } })
      .populate({ path: 'gym', select: 'name location' })
      .populate({ path: 'trainee', select: 'name email profilePicture role' })
      .lean(),
    TrainerAssignment.find({ trainer: trainerId }).lean(),
  ]);

  const assignmentByGym = assignmentDocs.reduce((acc, doc) => {
    if (doc?.gym) {
      acc[String(doc.gym)] = doc;
    }
    return acc;
  }, {});

  const grouped = new Map();

  memberships.forEach((membership) => {
    const gymId = membership.gym?._id ? String(membership.gym._id) : `membership-${membership._id}`;
    const assignment = assignmentByGym[gymId] ?? null;

    if (!grouped.has(gymId)) {
      grouped.set(gymId, {
        id: assignment?._id ?? gymId,
        gym: membership.gym
          ? { id: membership.gym._id, name: membership.gym.name, city: membership.gym.location?.city }
          : null,
        status: assignment?.status ?? membership.status,
        trainees: [],
      });
    }

    const container = grouped.get(gymId);
    const goals = (() => {
      if (!assignment?.trainees?.length) {
        return [];
      }
      const record = assignment.trainees.find(
        (entry) => String(entry.trainee) === String(membership.trainee?._id),
      );
      return record?.goals ?? [];
    })();

    container.trainees.push({
      id: membership.trainee?._id ?? membership.trainee,
      name: membership.trainee?.name,
      email: membership.trainee?.email,
      status: membership.status,
      assignedAt: membership.startDate,
      goals,
      membershipId: membership._id,
    });
  });

  const data = Array.from(grouped.values());

  return res
    .status(200)
    .json(new ApiResponse(200, { assignments: data }, 'Trainer trainees fetched successfully'));
});

export const getTrainerUpdates = asyncHandler(async (req, res) => {
  const trainerId = req.user?._id;

  const progressDocs = await TrainerProgress.find({ trainer: trainerId })
    .populate({ path: 'trainee', select: 'name email' })
    .lean();

  const updates = progressDocs.map((doc) => ({
    trainee: doc.trainee,
    pendingFeedback: (doc.feedback || []).filter((feedback) => !feedback.reviewedAt),
    attendance: doc.attendance?.slice(-5) ?? [],
    metrics: groupProgressMetrics(doc.progressMetrics || [], doc.bodyMetrics || []).slice(0, 5),
  }));

  return res
    .status(200)
    .json(new ApiResponse(200, { updates }, 'Trainer updates fetched successfully'));
});

export const getAdminOverview = asyncHandler(async (_req, res) => {
  const [userCounts, gyms, orders, revenue, productCount, adminToggles] = await Promise.all([
    User.aggregate([
      { $group: { _id: '$role', count: { $sum: 1 } } },
    ]),
    Gym.find().select('status isPublished analytics sponsorship').lean(),
    Order.aggregate([
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: '$total' },
        },
      },
    ]),
    Revenue.aggregate([
      { $match: { type: { $ne: 'seller' } } },
      {
        $group: {
          _id: '$type',
          amount: { $sum: '$amount' },
        },
      },
    ]),
    Product.countDocuments(),
    loadAdminToggles(),
  ]);

  const roleCounts = userCounts.reduce((acc, item) => {
    acc[item._id] = item.count;
    return acc;
  }, {});

  const gymStats = {
    total: gyms.length,
    published: gyms.filter((gym) => gym.isPublished).length,
    sponsored: gyms.filter((gym) => gym.sponsorship?.status === 'active').length,
    totalImpressions: gyms.reduce((sum, gym) => sum + (gym.analytics?.impressions ?? 0), 0),
  };

  const marketplaceRevenue = revenue.find((r) => r._id === 'marketplace')?.amount || 0;

  const orderStats = {
    totalOrders: orders?.[0]?.totalOrders ?? 0,
    totalRevenue: formatCurrency(marketplaceRevenue),
    totalItems: productCount,
  };

  const revenueBreakdown = revenue.map((entry) => ({ type: entry._id, amount: formatCurrency(entry.amount) }));

  return res.status(200).json(
    new ApiResponse(200, {
      users: roleCounts,
      gyms: gymStats,
      marketplace: orderStats,
      revenue: revenueBreakdown,
      adminToggles,
    }, 'Admin overview fetched successfully'),
  );
});

export const getAdminUsers = asyncHandler(async (_req, res) => {
  const pendingQuery = User.find({ status: 'pending', role: { $in: ['seller', 'gym-owner', 'manager'] } })
    .select('name email role createdAt profile.location profile.headline')
    .lean();

  const recentQuery = User.find()
    .sort({ createdAt: -1 })
    .select('name email role status createdAt profilePicture contactNumber')
    .lean();

  const [pending, recent, adminToggles, membershipCounts, orderCounts, gymCounts] = await Promise.all([
    pendingQuery,
    recentQuery,
    loadAdminToggles(),
    GymMembership.aggregate([
      { $group: { _id: '$trainee', count: { $sum: 1 } } },
    ]),
    Order.aggregate([
      { $group: { _id: '$user', count: { $sum: 1 } } },
    ]),
    Gym.aggregate([
      { $group: { _id: '$owner', count: { $sum: 1 } } },
    ]),
  ]);

  const memMap = membershipCounts.reduce((a, i) => { a[i._id?.toString()] = i.count; return a; }, {});
  const ordMap = orderCounts.reduce((a, i) => { a[i._id?.toString()] = i.count; return a; }, {});
  const gymMap = gymCounts.reduce((a, i) => { a[i._id?.toString()] = i.count; return a; }, {});

  const enriched = recent.map((user) => ({
    ...user,
    memberships: memMap[user._id?.toString()] ?? 0,
    orders: ordMap[user._id?.toString()] ?? 0,
    gymsOwned: gymMap[user._id?.toString()] ?? 0,
  }));

  return res.status(200).json(
    new ApiResponse(200, { pending, recent: enriched, adminToggles }, 'Admin user backlog fetched successfully'),
  );
});

export const getAdminGyms = asyncHandler(async (_req, res) => {
  const gymsQuery = Gym.find()
    .sort({ createdAt: -1 })
    .populate({ path: 'owner', select: 'name email' })
    .lean();

  const [gyms, adminToggles, memberCounts, trainerCounts] = await Promise.all([
    gymsQuery,
    loadAdminToggles(),
    GymMembership.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$gym', count: { $sum: 1 } } },
    ]),
    TrainerAssignment.aggregate([
      { $match: { status: 'active' } },
      { $group: { _id: '$gym', count: { $sum: 1 } } },
    ]),
  ]);

  const memberMap = memberCounts.reduce((a, i) => { a[i._id?.toString()] = i.count; return a; }, {});
  const trainerMap = trainerCounts.reduce((a, i) => { a[i._id?.toString()] = i.count; return a; }, {});

  const data = gyms.map((gym) => ({
    id: gym._id,
    name: gym.name,
    status: gym.status,
    isPublished: gym.isPublished,
    city: gym.location?.city,
    state: gym.location?.state,
    owner: gym.owner ? { id: gym.owner._id, name: gym.owner.name, email: gym.owner.email } : null,
    sponsorship: gym.sponsorship,
    analytics: gym.analytics,
    activeMembers: memberMap[gym._id?.toString()] ?? 0,
    activeTrainers: trainerMap[gym._id?.toString()] ?? 0,
    createdAt: gym.createdAt,
  }));

  return res
    .status(200)
    .json(new ApiResponse(200, { gyms: data, adminToggles }, 'Admin gym list fetched successfully'));
});

/* ── Admin: Gym Detail ── */
export const getAdminGymDetail = asyncHandler(async (req, res) => {
  const { gymId } = req.params;
  const oid = toObjectId(gymId, 'Gym id');

  const gym = await Gym.findById(oid)
    .populate({ path: 'owner', select: 'name email profilePicture contactNumber' })
    .populate({ path: 'trainers', select: 'name email profilePicture' })
    .lean();

  if (!gym) throw new ApiError(404, 'Gym not found');

  const [memberships, assignments, subscriptions, reviews, gallery] = await Promise.all([
    GymMembership.find({ gym: oid })
      .sort({ createdAt: -1 })
      .populate({ path: 'trainee', select: 'name email profilePicture' })
      .populate({ path: 'trainer', select: 'name email' })
      .lean(),
    TrainerAssignment.find({ gym: oid })
      .populate({ path: 'trainer', select: 'name email profilePicture' })
      .lean(),
    GymListingSubscription.find({ gym: oid }).sort({ createdAt: -1 }).lean(),
    Review.find({ gym: oid })
      .sort({ createdAt: -1 })
      .populate({ path: 'user', select: 'name email profilePicture' })
      .lean(),
    Gallery.find({ gym: oid }).sort({ createdAt: -1 }).lean(),
  ]);

  const data = {
    id: gym._id,
    name: gym.name,
    description: gym.description,
    status: gym.status,
    isPublished: gym.isPublished,
    approvalStatus: gym.approvalStatus,
    location: gym.location,
    pricing: gym.pricing,
    contact: gym.contact,
    schedule: gym.schedule,
    features: gym.features ?? [],
    keyFeatures: gym.keyFeatures ?? [],
    amenities: gym.amenities ?? [],
    tags: gym.tags ?? [],
    images: gym.images ?? [],
    galleryImages: gym.gallery ?? [],
    analytics: gym.analytics,
    sponsorship: gym.sponsorship,
    owner: gym.owner
      ? { id: gym.owner._id, name: gym.owner.name, email: gym.owner.email, profilePicture: gym.owner.profilePicture, contactNumber: gym.owner.contactNumber }
      : null,
    trainers: (gym.trainers ?? []).map((t) => ({
      id: t._id, name: t.name, email: t.email, profilePicture: t.profilePicture,
    })),
    members: memberships.map((m) => ({
      id: m._id,
      trainee: m.trainee ? { id: m.trainee._id, name: m.trainee.name, email: m.trainee.email, profilePicture: m.trainee.profilePicture } : null,
      trainer: m.trainer ? { id: m.trainer._id, name: m.trainer.name, email: m.trainer.email } : null,
      plan: m.plan,
      startDate: m.startDate,
      endDate: m.endDate,
      status: m.status,
      autoRenew: m.autoRenew,
      billing: m.billing,
      createdAt: m.createdAt,
    })),
    assignments: assignments.map((a) => ({
      id: a._id,
      trainer: a.trainer ? { id: a.trainer._id, name: a.trainer.name, email: a.trainer.email, profilePicture: a.trainer.profilePicture } : null,
      status: a.status,
      traineesCount: a.trainees?.length ?? 0,
      approvedAt: a.approvedAt,
      createdAt: a.createdAt,
    })),
    subscriptions: subscriptions.map((s) => ({
      id: s._id,
      planCode: s.planCode,
      amount: s.amount,
      currency: s.currency,
      periodStart: s.periodStart,
      periodEnd: s.periodEnd,
      status: s.status,
      autoRenew: s.autoRenew,
      createdAt: s.createdAt,
    })),
    reviews: reviews.map((r) => ({
      id: r._id,
      user: r.user ? { id: r.user._id, name: r.user.name, email: r.user.email, profilePicture: r.user.profilePicture } : null,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
    })),
    gallery: gallery.map((g) => ({
      id: g._id,
      title: g.title,
      description: g.description,
      imageUrl: g.imageUrl,
      category: g.category,
      createdAt: g.createdAt,
    })),
    createdAt: gym.createdAt,
    updatedAt: gym.updatedAt,
  };

  return res.status(200).json(new ApiResponse(200, data, 'Admin gym detail fetched successfully'));
});

export const getAdminRevenue = asyncHandler(async (_req, res) => {
  const referenceDate = new Date();
  referenceDate.setHours(23, 59, 59, 999);

  const monthlyTimeline = createMonthlyTimeline(12, referenceDate);
  const weeklyTimeline = createWeeklyTimeline(12, referenceDate);

  const earliestMonthly = monthlyTimeline[0]?.referenceDate ?? referenceDate;
  const earliestWeekly = weeklyTimeline[0]?.start ?? referenceDate;
  const earliestDate = earliestMonthly < earliestWeekly ? earliestMonthly : earliestWeekly;

  const [revenueEvents, adminToggles, marketplaceOrders] = await Promise.all([
    Revenue.find({
      createdAt: { $gte: earliestDate },
      type: { $ne: 'seller' },
    })
      .select('amount createdAt type')
      .lean(),
    loadAdminToggles(),
    Order.find({
      createdAt: { $gte: earliestDate },
    })
      .select('orderItems createdAt')
      .populate({
        path: 'orderItems.product',
        select: 'category',
      })
      .lean(),
  ]);

  revenueEvents.forEach((event) => {
    const type = event.type || 'other';
    applyMonthlyAmount(monthlyTimeline, event.createdAt, 'revenue', event.amount);
    applyWeeklyAmount(weeklyTimeline, event.createdAt, 'revenue', event.amount);

    applyMonthlyAmount(monthlyTimeline, event.createdAt, type, event.amount);
    applyWeeklyAmount(weeklyTimeline, event.createdAt, type, event.amount);
  });

  const categoryMapMonthly = {};
  const categoryMapWeekly = {};

  marketplaceOrders.forEach((order) => {
    if (!Array.isArray(order.orderItems) || !order.orderItems.length) {
      return;
    }

    const orderDate = new Date(order.createdAt);
    const isMonthly = orderDate >= earliestMonthly;
    const isWeekly = orderDate >= earliestWeekly;

    order.orderItems.forEach((item) => {
      const status = normaliseOrderItemStatus(item.status);
      if (status !== 'delivered') {
        return;
      }

      const category = item.product?.category;
      if (!category) {
        return;
      }

      const price = Number(item.price) || 0;
      const quantity = Number(item.quantity) || 0;
      if (price <= 0 || quantity <= 0) {
        return;
      }

      const commission = price * quantity * 0.15;

      if (isMonthly) {
        categoryMapMonthly[category] = (categoryMapMonthly[category] || 0) + commission;
      }
      if (isWeekly) {
        categoryMapWeekly[category] = (categoryMapWeekly[category] || 0) + commission;
      }
    });
  });

  const marketplaceDistribution = {
    monthly: Object.entries(categoryMapMonthly).map(([name, value]) => ({ name, value })),
    weekly: Object.entries(categoryMapWeekly).map(([name, value]) => ({ name, value })),
  };

  const shapeTimeline = (timeline) =>
    timeline.map((entry) => ({
      id: entry.id,
      label: entry.label,
      fullLabel: entry.fullLabel,
      value: Number(entry.revenue) || 0,
      listing: Number(entry.listing) || 0,
      sponsorship: Number(entry.sponsorship) || 0,
      marketplace: Number(entry.marketplace) || 0,
    }));

  const trend = {
    monthly: shapeTimeline(monthlyTimeline),
    weekly: shapeTimeline(weeklyTimeline),
  };

  return res
    .status(200)
    .json(new ApiResponse(200, { trend, marketplaceDistribution, adminToggles }, 'Admin revenue trend fetched successfully'));
});

export const getAdminMarketplace = asyncHandler(async (_req, res) => {
  const ordersQuery = Order.find()
    .sort({ createdAt: -1 })
    .populate({ path: 'user', select: 'name email' })
    .populate({ path: 'seller', select: 'name email' })
    .populate({ path: 'orderItems.seller', select: 'name email' })
    .populate({ path: 'orderItems.product', select: 'category' })
    .lean();

  const [orders, adminToggles] = await Promise.all([
    ordersQuery,
    loadAdminToggles(),
  ]);

  const toContact = (entity) => (entity?._id
    ? { id: entity._id, name: entity.name, email: entity.email }
    : null);

  const data = orders.map((order) => {
    const fallbackSeller = order.orderItems?.find((item) => item.seller?._id)?.seller;
    const sellerEntity = order.seller?._id ? order.seller : fallbackSeller;

    return {
      id: order._id,
      orderNumber: order.orderNumber,
      total: formatCurrency(order.total, 'INR'),
      status: summariseOrderStatus(order),
      createdAt: order.createdAt,
      user: toContact(order.user),
      seller: toContact(sellerEntity),
      items: order.orderItems?.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        category: item.product?.category,
        seller: toContact(item.seller),
      })) ?? [],
    };
  });

  return res
    .status(200)
    .json(new ApiResponse(200, { orders: data, adminToggles }, 'Admin marketplace activity fetched successfully'));
});

export const getAdminInsights = asyncHandler(async (_req, res) => {
  const now = new Date();

  const [geoAggregation, genderAggregation, ageAggregation, revenueEvents, adminToggles] = await Promise.all([
    Gym.aggregate([
      {
        $match: {
          status: { $in: ['active'] },
          isPublished: true,
          'location.country': 'India',
        },
      },
      {
        $group: {
          _id: {
            city: '$location.city',
            state: '$location.state',
            coordinates: '$location.coordinates.coordinates',
          },
          gyms: { $sum: 1 },
          impressions: { $sum: { $ifNull: ['$analytics.impressions', 0] } },
          memberships: { $sum: { $ifNull: ['$analytics.memberships', 0] } },
        },
      },
      { $sort: { gyms: -1 } },
    ]),
    User.aggregate([
      {
        $match: {
          role: { $in: ['trainee', 'gym-owner'] },
        },
      },
      {
        $group: {
          _id: { $ifNull: ['$gender', 'unspecified'] },
          count: { $sum: 1 },
        },
      },
    ]),
    User.aggregate([
      {
        $match: {
          age: { $ne: null },
        },
      },
      {
        $group: {
          _id: {
            $switch: {
              branches: [
                { case: { $lt: ['$age', 18] }, then: '<18' },
                { case: { $and: [{ $gte: ['$age', 18] }, { $lt: ['$age', 25] }] }, then: '18-24' },
                { case: { $and: [{ $gte: ['$age', 25] }, { $lt: ['$age', 35] }] }, then: '25-34' },
                { case: { $and: [{ $gte: ['$age', 35] }, { $lt: ['$age', 45] }] }, then: '35-44' },
                { case: { $and: [{ $gte: ['$age', 45] }, { $lt: ['$age', 60] }] }, then: '45-59' },
              ],
              default: '60+',
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]),
    Revenue.find()
      .sort({ createdAt: -1 })
      .limit(12)
      .lean(),
    loadAdminToggles(),
  ]);

  const geoPoints = geoAggregation
    .filter((entry) => Array.isArray(entry._id.coordinates) && entry._id.coordinates.length === 2)
    .map((entry) => ({
      city: entry._id.city,
      state: entry._id.state,
      latitude: entry._id.coordinates[1],
      longitude: entry._id.coordinates[0],
      gyms: entry.gyms,
      impressions: entry.impressions,
      memberships: entry.memberships,
    }));

  const totalGyms = geoAggregation.reduce((sum, entry) => sum + entry.gyms, 0);
  const totalImpressions = geoAggregation.reduce((sum, entry) => sum + (entry.impressions ?? 0), 0);

  const topLocations = geoAggregation
    .slice(0, 8)
    .map((entry) => ({
      city: entry._id.city,
      state: entry._id.state,
      gyms: entry.gyms,
      impressions: entry.impressions,
    }));

  const genderDistribution = genderAggregation.map((entry) => ({
    label: entry._id === 'unspecified' ? 'Unspecified' : entry._id,
    value: entry.count,
  }));

  const ageBucketOrder = ['<18', '18-24', '25-34', '35-44', '45-59', '60+'];
  const ageBucketMap = ageAggregation.reduce((acc, entry) => {
    acc[entry._id] = entry.count;
    return acc;
  }, {});

  const ageDistribution = ageBucketOrder
    .map((label) => ({
      label,
      value: ageBucketMap[label] ?? 0,
    }))
    .filter((bucket) => bucket.value > 0);

  const notifications = revenueEvents.map((event) => {
    const amount = event.amount ?? 0;
    let message = '';

    if (event.type === 'listing') {
      message = `New gym listing plan purchased for ₹${amount}`;
    } else if (event.type === 'sponsorship') {
      message = `Sponsorship activated worth ₹${amount}`;
    } else if (event.type === 'marketplace') {
      message = `Marketplace order settled for ₹${amount}`;
    } else if (event.type === 'seller') {
      message = `Seller payout recorded for ₹${amount}`;
    } else {
      message = `Revenue event (${event.type}) recorded`;
    }

    return {
      id: event._id,
      type: event.type,
      amount,
      message,
      createdAt: event.createdAt,
      metadata: event.metadata,
    };
  });

  const insights = {
    capturedAt: now,
    geoDensity: {
      totalGyms,
      totalImpressions,
      points: geoPoints,
      topLocations,
    },
    demographics: {
      gender: genderDistribution,
      ageBuckets: ageDistribution,
    },
    notifications,
    adminToggles,
  };

  return res
    .status(200)
    .json(new ApiResponse(200, insights, 'Admin insights fetched successfully'));
});

/* ── Admin: User Detail (role-aware) ── */

export const getAdminUserDetail = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const oid = toObjectId(userId, 'User id');

  const user = await User.findById(oid)
    .select('-password -refreshToken')
    .lean();
  if (!user) throw new ApiError(404, 'User not found');

  const detail = {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      profilePicture: user.profilePicture,
      contactNumber: user.contactNumber,
      age: user.age,
      gender: user.gender,
      profile: user.profile,
      createdAt: user.createdAt,
    },
  };

  const role = user.role;

  /* ══════════════════════════════════════════════
     SELLER – deep view
     ══════════════════════════════════════════════ */
  if (role === 'seller') {
    const [products, sellerOrders, revenue, productReviews] = await Promise.all([
      Product.find({ seller: oid })
        .sort({ createdAt: -1 })
        .lean(),
      Order.find({ 'orderItems.seller': oid })
        .populate({ path: 'user', select: 'name email' })
        .sort({ createdAt: -1 })
        .lean(),
      Revenue.find({ 'metadata.sellerId': userId, type: 'seller' })
        .sort({ createdAt: -1 })
        .lean(),
      ProductReview.find()
        .populate({ path: 'product', select: 'name seller' })
        .populate({ path: 'user', select: 'name' })
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    // filter reviews for this seller's products
    const productIds = new Set(products.map((p) => p._id.toString()));
    const sellerReviews = productReviews.filter((r) => productIds.has(r.product?._id?.toString()));

    // extract only order items belonging to this seller
    const sellerItems = [];
    for (const order of sellerOrders) {
      for (const item of order.orderItems || []) {
        if (item.seller?.toString() === userId) {
          sellerItems.push({
            orderId: order._id,
            orderNumber: order.orderNumber,
            buyer: order.user ? { name: order.user.name, email: order.user.email } : null,
            productName: item.name,
            image: item.image,
            quantity: item.quantity,
            price: item.price,
            status: item.status,
            lastStatusAt: item.lastStatusAt,
            orderDate: order.createdAt,
          });
        }
      }
    }

    const totalRevenue = sellerItems.reduce((s, i) => s + i.price * i.quantity, 0);
    const totalPayout = revenue.reduce((s, r) => s + (r.amount ?? 0), 0);

    detail.seller = {
      products: products.map((p) => ({
        id: p._id, name: p.name, description: p.description,
        price: p.price, mrp: p.mrp, image: p.image,
        category: p.category, stock: p.stock,
        status: p.status, isPublished: p.isPublished,
        createdAt: p.createdAt,
        reviewCount: sellerReviews.filter((r) => r.product?._id?.toString() === p._id.toString()).length,
      })),
      orders: sellerItems,
      reviews: sellerReviews.map((r) => ({
        id: r._id,
        product: r.product?.name ?? '—',
        reviewer: r.user?.name ?? '—',
        rating: r.rating,
        title: r.title,
        comment: r.comment,
        isVerifiedPurchase: r.isVerifiedPurchase,
        createdAt: r.createdAt,
      })),
      payouts: revenue.map((r) => ({
        id: r._id, amount: r.amount, type: r.type,
        metadata: r.metadata, createdAt: r.createdAt,
      })),
      stats: {
        totalProducts: products.length,
        publishedProducts: products.filter((p) => p.isPublished).length,
        totalItemsSold: sellerItems.length,
        deliveredItems: sellerItems.filter((i) => i.status === 'delivered').length,
        totalRevenue,
        totalPayout,
        totalReviews: sellerReviews.length,
        avgRating: sellerReviews.length
          ? +(sellerReviews.reduce((s, r) => s + r.rating, 0) / sellerReviews.length).toFixed(1)
          : 0,
      },
    };
  }

  /* ══════════════════════════════════════════════
     GYM OWNER – deep view
     ══════════════════════════════════════════════ */
  if (role === 'gym-owner') {
    const [gyms, subscriptions] = await Promise.all([
      Gym.find({ owner: oid }).lean(),
      GymListingSubscription.find({ owner: oid })
        .populate({ path: 'gym', select: 'name' })
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    const gymIds = gyms.map((g) => g._id);

    const [allMemberships, allAssignments, allReviews] = await Promise.all([
      GymMembership.find({ gym: { $in: gymIds } })
        .populate({ path: 'trainee', select: 'name email profilePicture contactNumber' })
        .populate({ path: 'trainer', select: 'name email' })
        .sort({ createdAt: -1 })
        .lean(),
      TrainerAssignment.find({ gym: { $in: gymIds } })
        .populate({ path: 'trainer', select: 'name email profilePicture contactNumber' })
        .populate({ path: 'trainees.trainee', select: 'name email' })
        .sort({ createdAt: -1 })
        .lean(),
      Review.find({ gym: { $in: gymIds } })
        .populate({ path: 'user', select: 'name email profilePicture' })
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    // index by gym
    const membersByGym = {};
    const trainersByGym = {};
    const reviewsByGym = {};
    for (const m of allMemberships) { const gid = m.gym?.toString(); (membersByGym[gid] ??= []).push(m); }
    for (const a of allAssignments) { const gid = a.gym?.toString(); (trainersByGym[gid] ??= []).push(a); }
    for (const r of allReviews) { const gid = r.gym?.toString(); (reviewsByGym[gid] ??= []).push(r); }

    detail.gymOwner = {
      gyms: gyms.map((g) => {
        const gid = g._id.toString();
        const members = membersByGym[gid] ?? [];
        const trainers = trainersByGym[gid] ?? [];
        const reviews = reviewsByGym[gid] ?? [];
        return {
          id: g._id,
          name: g.name,
          description: g.description,
          location: g.location,
          pricing: g.pricing,
          features: g.features,
          keyFeatures: g.keyFeatures,
          amenities: g.amenities,
          contact: g.contact,
          schedule: g.schedule,
          analytics: g.analytics,
          sponsorship: g.sponsorship,
          status: g.status,
          isPublished: g.isPublished,
          images: g.images,
          createdAt: g.createdAt,
          members: members.map((m) => ({
            id: m._id,
            trainee: m.trainee ? { id: m.trainee._id, name: m.trainee.name, email: m.trainee.email, profilePicture: m.trainee.profilePicture, contactNumber: m.trainee.contactNumber } : null,
            trainer: m.trainer ? { name: m.trainer.name, email: m.trainer.email } : null,
            plan: m.plan, status: m.status, startDate: m.startDate, endDate: m.endDate,
            autoRenew: m.autoRenew, billing: m.billing, benefits: m.benefits,
          })),
          trainers: trainers.map((a) => ({
            id: a._id,
            trainer: a.trainer ? { id: a.trainer._id, name: a.trainer.name, email: a.trainer.email, profilePicture: a.trainer.profilePicture, contactNumber: a.trainer.contactNumber } : null,
            status: a.status,
            trainees: (a.trainees || []).map((t) => ({
              trainee: t.trainee ? { name: t.trainee.name, email: t.trainee.email } : null,
              status: t.status, assignedAt: t.assignedAt, goals: t.goals,
            })),
            requestedAt: a.requestedAt, approvedAt: a.approvedAt,
          })),
          reviews: reviews.map((r) => ({
            id: r._id,
            user: r.user ? { name: r.user.name, profilePicture: r.user.profilePicture } : null,
            rating: r.rating, comment: r.comment, createdAt: r.createdAt,
          })),
          memberStats: {
            total: members.length,
            active: members.filter((m) => m.status === 'active').length,
          },
          trainerStats: {
            total: trainers.length,
            active: trainers.filter((a) => a.status === 'active').length,
          },
        };
      }),
      subscriptions: subscriptions.map((s) => ({
        id: s._id, gym: s.gym?.name, planCode: s.planCode, amount: s.amount,
        currency: s.currency, status: s.status, autoRenew: s.autoRenew,
        periodStart: s.periodStart, periodEnd: s.periodEnd,
        invoiceCount: (s.invoices || []).length, createdAt: s.createdAt,
      })),
      stats: {
        totalGyms: gyms.length,
        publishedGyms: gyms.filter((g) => g.isPublished).length,
        totalMembers: allMemberships.length,
        activeMembers: allMemberships.filter((m) => m.status === 'active').length,
        totalTrainers: allAssignments.length,
        activeTrainers: allAssignments.filter((a) => a.status === 'active').length,
        totalReviews: allReviews.length,
        totalImpressions: gyms.reduce((s, g) => s + (g.analytics?.impressions ?? 0), 0),
      },
    };
  }

  /* ══════════════════════════════════════════════
     TRAINER – deep view
     ══════════════════════════════════════════════ */
  if (role === 'trainer') {
    const [assignments, progress] = await Promise.all([
      TrainerAssignment.find({ trainer: oid })
        .populate({ path: 'gym', select: 'name location.city location.state images' })
        .populate({ path: 'trainees.trainee', select: 'name email profilePicture contactNumber age gender' })
        .sort({ createdAt: -1 })
        .lean(),
      TrainerProgress.find({ trainer: oid })
        .populate({ path: 'trainee', select: 'name' })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
    ]);

    detail.trainer = {
      assignments: assignments.map((a) => ({
        id: a._id,
        gym: a.gym ? { id: a.gym._id, name: a.gym.name, city: a.gym.location?.city, state: a.gym.location?.state } : null,
        status: a.status,
        trainees: (a.trainees || []).map((t) => ({
          trainee: t.trainee ? {
            id: t.trainee._id, name: t.trainee.name, email: t.trainee.email,
            profilePicture: t.trainee.profilePicture, contactNumber: t.trainee.contactNumber,
            age: t.trainee.age, gender: t.trainee.gender,
          } : null,
          status: t.status, assignedAt: t.assignedAt, goals: t.goals,
        })),
        requestedAt: a.requestedAt,
        approvedAt: a.approvedAt,
        notes: a.notes,
      })),
      recentProgress: progress.map((p) => ({
        id: p._id,
        trainee: p.trainee?.name ?? '—',
        update: p.update,
        date: p.date ?? p.createdAt,
      })),
      stats: {
        totalAssignments: assignments.length,
        activeAssignments: assignments.filter((a) => a.status === 'active').length,
        totalTrainees: assignments.reduce((s, a) => s + (a.trainees?.length ?? 0), 0),
        activeTrainees: assignments.reduce((s, a) => s + (a.trainees || []).filter((t) => t.status === 'active').length, 0),
      },
    };
  }

  /* ══════════════════════════════════════════════
     TRAINEE / USER – deep view
     ══════════════════════════════════════════════ */
  if (role === 'trainee' || role === 'user') {
    const [memberships, orders, gymReviews, productReviews, progress] = await Promise.all([
      GymMembership.find({ trainee: oid })
        .populate({ path: 'gym', select: 'name location.city location.state images pricing' })
        .populate({ path: 'trainer', select: 'name email profilePicture' })
        .sort({ createdAt: -1 })
        .lean(),
      Order.find({ user: oid })
        .populate({ path: 'orderItems.product', select: 'name image category' })
        .sort({ createdAt: -1 })
        .lean(),
      Review.find({ user: oid })
        .populate({ path: 'gym', select: 'name' })
        .sort({ createdAt: -1 })
        .lean(),
      ProductReview.find({ user: oid })
        .populate({ path: 'product', select: 'name image' })
        .sort({ createdAt: -1 })
        .lean(),
      TrainerProgress.find({ trainee: oid })
        .populate({ path: 'trainer', select: 'name' })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
    ]);

    detail.trainee = {
      memberships: memberships.map((m) => ({
        id: m._id,
        gym: m.gym ? { id: m.gym._id, name: m.gym.name, city: m.gym.location?.city, state: m.gym.location?.state } : null,
        trainer: m.trainer ? { name: m.trainer.name, email: m.trainer.email, profilePicture: m.trainer.profilePicture } : null,
        plan: m.plan, status: m.status, startDate: m.startDate, endDate: m.endDate,
        autoRenew: m.autoRenew, billing: m.billing, benefits: m.benefits, notes: m.notes,
      })),
      orders: orders.map((o) => ({
        id: o._id, orderNumber: o.orderNumber, total: o.total,
        status: o.status, createdAt: o.createdAt,
        shippingAddress: o.shippingAddress,
        items: (o.orderItems || []).map((item) => ({
          product: item.product?.name ?? item.name,
          image: item.product?.image ?? item.image,
          category: item.product?.category,
          quantity: item.quantity, price: item.price,
          status: item.status,
        })),
      })),
      gymReviews: gymReviews.map((r) => ({
        id: r._id, gym: r.gym?.name ?? '—', rating: r.rating,
        comment: r.comment, createdAt: r.createdAt,
      })),
      productReviews: productReviews.map((r) => ({
        id: r._id, product: r.product?.name ?? '—', image: r.product?.image,
        rating: r.rating, title: r.title, comment: r.comment,
        isVerifiedPurchase: r.isVerifiedPurchase, createdAt: r.createdAt,
      })),
      progress: progress.map((p) => ({
        id: p._id, trainer: p.trainer?.name ?? '—',
        update: p.update, date: p.date ?? p.createdAt,
      })),
      stats: {
        totalMemberships: memberships.length,
        activeMemberships: memberships.filter((m) => m.status === 'active').length,
        totalOrders: orders.length,
        totalSpent: orders.reduce((s, o) => s + (o.total ?? 0), 0),
        totalGymReviews: gymReviews.length,
        totalProductReviews: productReviews.length,
      },
    };
  }

  /* ── Manager ── */
  if (role === 'manager') {
    detail.manager = { note: 'Manager approval and moderation role.' };
  }

  /* ── Admin ── */
  if (role === 'admin') {
    detail.admin = { note: 'Platform administrator.' };
  }

  return res.status(200).json(new ApiResponse(200, detail, 'User detail fetched successfully'));
});

/* ── Admin: Memberships ── */

export const getAdminMemberships = asyncHandler(async (_req, res) => {
  const memberships = await GymMembership.find()
    .sort({ createdAt: -1 })
    .populate({ path: 'trainee', select: 'name email profilePicture role' })
    .populate({ path: 'gym', select: 'name location.city' })
    .populate({ path: 'trainer', select: 'name email' })
    .lean();

  const data = memberships.map((m) => ({
    id: m._id,
    trainee: m.trainee ? { id: m.trainee._id, name: m.trainee.name, email: m.trainee.email } : null,
    gym: m.gym ? { id: m.gym._id, name: m.gym.name, city: m.gym.location?.city } : null,
    trainer: m.trainer ? { id: m.trainer._id, name: m.trainer.name, email: m.trainer.email } : null,
    plan: m.plan,
    status: m.status,
    startDate: m.startDate,
    endDate: m.endDate,
    autoRenew: m.autoRenew,
    billing: m.billing ? { amount: m.billing.amount, currency: m.billing.currency, status: m.billing.status } : null,
    benefits: m.benefits,
    notes: m.notes,
    createdAt: m.createdAt,
  }));

  return res.status(200).json(new ApiResponse(200, { memberships: data }, 'Admin memberships fetched successfully'));
});

/* ── Admin: Products ── */

export const getAdminProducts = asyncHandler(async (_req, res) => {
  const [products, reviewStats] = await Promise.all([
    Product.find()
      .sort({ createdAt: -1 })
      .populate({ path: 'seller', select: 'name email profilePicture' })
      .lean(),
    ProductReview.aggregate([
      { $group: { _id: '$product', avgRating: { $avg: '$rating' }, reviewCount: { $sum: 1 } } },
    ]),
  ]);

  const reviewMap = reviewStats.reduce((acc, r) => {
    acc[r._id.toString()] = { avgRating: Math.round(r.avgRating * 10) / 10, reviewCount: r.reviewCount };
    return acc;
  }, {});

  const data = products.map((p) => ({
    id: p._id,
    name: p.name,
    description: p.description,
    price: p.price,
    mrp: p.mrp,
    image: p.image,
    category: p.category,
    stock: p.stock,
    status: p.status,
    isPublished: p.isPublished,
    seller: p.seller ? { id: p.seller._id, name: p.seller.name, email: p.seller.email } : null,
    reviews: reviewMap[p._id.toString()] ?? { avgRating: 0, reviewCount: 0 },
    createdAt: p.createdAt,
  }));

  return res.status(200).json(new ApiResponse(200, { products: data }, 'Admin products fetched successfully'));
});

/* ── Admin: Product Buyers ── */
export const getAdminProductBuyers = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const oid = toObjectId(productId, 'Product id');

  const product = await Product.findById(oid)
    .populate({ path: 'seller', select: 'name email profilePicture' })
    .lean();

  if (!product) throw new ApiError(404, 'Product not found');

  const [reviewStats] = await ProductReview.aggregate([
    { $match: { product: oid } },
    { $group: { _id: null, avgRating: { $avg: '$rating' }, reviewCount: { $sum: 1 } } },
  ]);

  const orders = await Order.find({ 'orderItems.product': oid })
    .sort({ createdAt: -1 })
    .populate({ path: 'user', select: 'name email profilePicture contactNumber' })
    .lean();

  const buyers = [];
  for (const order of orders) {
    const matchedItems = order.orderItems.filter(
      (item) => item.product?.toString() === oid.toString(),
    );
    for (const item of matchedItems) {
      buyers.push({
        orderId: order._id,
        orderNumber: order.orderNumber,
        user: order.user
          ? { id: order.user._id, name: order.user.name, email: order.user.email, profilePicture: order.user.profilePicture, contactNumber: order.user.contactNumber }
          : null,
        quantity: item.quantity,
        price: item.price,
        itemStatus: item.status,
        shippingAddress: order.shippingAddress
          ? { city: order.shippingAddress.city, state: order.shippingAddress.state }
          : null,
        total: order.total,
        orderDate: order.createdAt,
      });
    }
  }

  const productData = {
    id: product._id,
    name: product.name,
    description: product.description,
    price: product.price,
    mrp: product.mrp,
    image: product.image,
    category: product.category,
    stock: product.stock,
    status: product.status,
    isPublished: product.isPublished,
    seller: product.seller
      ? { id: product.seller._id, name: product.seller.name, email: product.seller.email, profilePicture: product.seller.profilePicture }
      : null,
    reviews: reviewStats
      ? { avgRating: Math.round(reviewStats.avgRating * 10) / 10, reviewCount: reviewStats.reviewCount }
      : { avgRating: 0, reviewCount: 0 },
    createdAt: product.createdAt,
  };

  return res.status(200).json(
    new ApiResponse(200, { product: productData, buyers, totalBuyers: buyers.length }, 'Product buyers fetched successfully'),
  );
});

/* ── Admin: Reviews (gym + product) ── */

export const getAdminReviews = asyncHandler(async (_req, res) => {
  const [gymReviews, productReviews] = await Promise.all([
    Review.find()
      .sort({ createdAt: -1 })
      .populate({ path: 'user', select: 'name email profilePicture' })
      .populate({ path: 'gym', select: 'name location.city' })
      .lean(),
    ProductReview.find()
      .sort({ createdAt: -1 })
      .populate({ path: 'user', select: 'name email profilePicture' })
      .populate({ path: 'product', select: 'name image category' })
      .lean(),
  ]);

  const gymData = gymReviews.map((r) => ({
    id: r._id,
    user: r.user ? { id: r.user._id, name: r.user.name, email: r.user.email } : null,
    gym: r.gym ? { id: r.gym._id, name: r.gym.name, city: r.gym.location?.city } : null,
    rating: r.rating,
    comment: r.comment,
    createdAt: r.createdAt,
  }));

  const productData = productReviews.map((r) => ({
    id: r._id,
    user: r.user ? { id: r.user._id, name: r.user.name, email: r.user.email } : null,
    product: r.product ? { id: r.product._id, name: r.product.name, category: r.product.category } : null,
    rating: r.rating,
    title: r.title,
    comment: r.comment,
    isVerifiedPurchase: r.isVerifiedPurchase,
    createdAt: r.createdAt,
  }));

  return res.status(200).json(new ApiResponse(200, { gymReviews: gymData, productReviews: productData }, 'Admin reviews fetched successfully'));
});

/* ── Admin: Subscriptions (listing + payment sessions) ── */

export const getAdminSubscriptions = asyncHandler(async (_req, res) => {
  const [listingSubs, sponsoredGyms] = await Promise.all([
    GymListingSubscription.find()
      .sort({ createdAt: -1 })
      .populate({ path: 'gym', select: 'name location.city' })
      .populate({ path: 'owner', select: 'name email' })
      .lean(),
    Gym.find({ 'sponsorship.status': { $in: ['active', 'expired'] } })
      .select('name location.city owner sponsorship createdAt')
      .populate({ path: 'owner', select: 'name email' })
      .sort({ 'sponsorship.expiresAt': -1 })
      .lean(),
  ]);

  const listingData = listingSubs.map((s) => ({
    id: s._id,
    gym: s.gym ? { id: s.gym._id, name: s.gym.name, city: s.gym.location?.city } : null,
    owner: s.owner ? { id: s.owner._id, name: s.owner.name, email: s.owner.email } : null,
    planCode: s.planCode,
    amount: s.amount,
    currency: s.currency,
    periodStart: s.periodStart,
    periodEnd: s.periodEnd,
    status: s.status,
    autoRenew: s.autoRenew,
    invoiceCount: (s.invoices || []).length,
    createdAt: s.createdAt,
  }));

  const sponsorshipData = sponsoredGyms.map((g) => ({
    id: g._id,
    gym: { id: g._id, name: g.name, city: g.location?.city },
    owner: g.owner ? { id: g.owner._id, name: g.owner.name, email: g.owner.email } : null,
    package: g.sponsorship?.package ?? 'N/A',
    status: g.sponsorship?.status ?? 'none',
    expiresAt: g.sponsorship?.expiresAt,
    createdAt: g.createdAt,
  }));

  return res.status(200).json(new ApiResponse(200, { listingSubscriptions: listingData, sponsorships: sponsorshipData }, 'Admin subscriptions fetched successfully'));
});

/* ═══════════════════════════════════════════════
   MANAGER DASHBOARD
   ═══════════════════════════════════════════════ */

const ensureManagerDashboard = (req) => {
  if (!req.user || req.user.role !== 'manager') {
    throw new ApiError(403, 'Only managers can access this resource.');
  }
  if (req.user.status !== 'active') {
    throw new ApiError(403, 'Your manager account is awaiting admin approval.');
  }
};

export const getManagerOverview = asyncHandler(async (req, res) => {
  ensureManagerDashboard(req);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    pendingApprovals,
    activeSellers,
    activeGymOwners,
    totalGyms,
    recentOrders,
    contactMessages,
    recentPending,
  ] = await Promise.all([
    User.countDocuments({ status: 'pending', role: { $in: ['seller', 'gym-owner'] } }),
    User.countDocuments({ role: 'seller', status: 'active' }),
    User.countDocuments({ role: 'gym-owner', status: 'active' }),
    Gym.countDocuments({ status: 'active' }),
    Order.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
    mongoose.connection.db.collection('contacts').countDocuments({ status: 'new' }),
    User.find({ status: 'pending', role: { $in: ['seller', 'gym-owner'] } })
      .select('name email role createdAt profilePicture')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
  ]);

  return res.status(200).json(
    new ApiResponse(200, {
      stats: {
        pendingApprovals,
        activeSellers,
        activeGymOwners,
        totalGyms,
        recentOrders,
        openMessages: contactMessages,
      },
      recentPending,
    }, 'Manager overview fetched successfully.'),
  );
});

export const getManagerSellers = asyncHandler(async (req, res) => {
  ensureManagerDashboard(req);

  const sellers = await User.find({ role: 'seller' })
    .select('name email status createdAt profilePicture profile.headline profile.location contactNumber')
    .sort({ createdAt: -1 })
    .lean();

  const sellerIds = sellers.map((s) => s._id);

  const productCounts = await Product.aggregate([
    { $match: { seller: { $in: sellerIds } } },
    {
      $group: {
        _id: '$seller',
        total: { $sum: 1 },
        published: { $sum: { $cond: ['$isPublished', 1, 0] } },
      },
    },
  ]);

  const orderCounts = await Order.aggregate([
    { $unwind: '$orderItems' },
    { $match: { 'orderItems.seller': { $in: sellerIds } } },
    { $group: { _id: '$orderItems.seller', orderCount: { $sum: 1 } } },
  ]);

  const productMap = productCounts.reduce((acc, item) => {
    acc[item._id.toString()] = { total: item.total, published: item.published };
    return acc;
  }, {});

  const orderMap = orderCounts.reduce((acc, item) => {
    acc[item._id.toString()] = item.orderCount;
    return acc;
  }, {});

  const enriched = sellers.map((seller) => ({
    ...seller,
    products: productMap[seller._id.toString()] ?? { total: 0, published: 0 },
    orderCount: orderMap[seller._id.toString()] ?? 0,
  }));

  return res
    .status(200)
    .json(new ApiResponse(200, { sellers: enriched }, 'Manager sellers fetched.'));
});

export const getManagerGymOwners = asyncHandler(async (req, res) => {
  ensureManagerDashboard(req);

  const owners = await User.find({ role: 'gym-owner' })
    .select('name email status createdAt profilePicture profile.headline profile.location contactNumber')
    .sort({ createdAt: -1 })
    .lean();

  const ownerIds = owners.map((o) => o._id);

  const gymCounts = await Gym.aggregate([
    { $match: { owner: { $in: ownerIds } } },
    {
      $group: {
        _id: '$owner',
        total: { $sum: 1 },
        published: { $sum: { $cond: ['$isPublished', 1, 0] } },
        totalImpressions: { $sum: { $ifNull: ['$analytics.impressions', 0] } },
      },
    },
  ]);

  const membershipCounts = await GymMembership.aggregate([
    {
      $lookup: {
        from: 'gyms',
        localField: 'gym',
        foreignField: '_id',
        as: 'gymInfo',
      },
    },
    { $unwind: '$gymInfo' },
    { $match: { 'gymInfo.owner': { $in: ownerIds }, status: 'active' } },
    { $group: { _id: '$gymInfo.owner', members: { $sum: 1 } } },
  ]);

  const gymMap = gymCounts.reduce((acc, item) => {
    acc[item._id.toString()] = {
      total: item.total,
      published: item.published,
      totalImpressions: item.totalImpressions,
    };
    return acc;
  }, {});

  const memberMap = membershipCounts.reduce((acc, item) => {
    acc[item._id.toString()] = item.members;
    return acc;
  }, {});

  const enriched = owners.map((owner) => ({
    ...owner,
    gyms: gymMap[owner._id.toString()] ?? { total: 0, published: 0, totalImpressions: 0 },
    totalMembers: memberMap[owner._id.toString()] ?? 0,
  }));

  return res
    .status(200)
    .json(new ApiResponse(200, { gymOwners: enriched }, 'Manager gym owners fetched.'));
});

