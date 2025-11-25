import mongoose from 'mongoose';
import Gym from '../../models/gym.model.js';
import GymMembership from '../../models/gymMembership.model.js';
import TrainerProgress from '../../models/trainerProgress.model.js';
import TrainerAssignment from '../../models/trainerAssignment.model.js';
import GymListingSubscription from '../../models/gymListingSubscription.model.js';
import Revenue from '../../models/revenue.model.js';
import Order from '../../models/order.model.js';
import User from '../../models/user.model.js';
import {
  loadAdminToggles,
} from '../../services/systemSettings.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';

const toObjectId = (value) => {
  try {
    return new mongoose.Types.ObjectId(value);
  } catch (_error) {
    return null;
  }
};

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
    if (!sponsorship || !sponsorship?.monthlyBudget) {
      return;
    }

    const start = toDate(sponsorship.startDate) || toDate(gym?.createdAt);
    const end = toDate(sponsorship.endDate) || new Date();

    if (!start || !end) {
      return;
    }

    const monthlyBudget = Number(sponsorship.monthlyBudget) || 0;
    if (monthlyBudget <= 0) {
      return;
    }

    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);

    while (cursor <= endMonth) {
      entries.push({ amount: monthlyBudget, date: new Date(cursor), source: 'sponsorship' });
      cursor.setMonth(cursor.getMonth() + 1, 1);
    }
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

    const label = `${weekStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
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
  bucket[key] += Number(amount) || 0;
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
  bucket[key] += Number(amount) || 0;
};

const ORDER_STATUS_KEYS = ['processing', 'in-transit', 'out-for-delivery', 'delivered'];

const REVENUE_EARNING_TYPES = ['membership', 'enrollment', 'renewal'];
const TRAINER_PLAN_CODES = ['trainer-access', 'trainerAccess', 'trainer'];

const normaliseOrderItemStatus = (status) => {
  if (!status) {
    return 'processing';
  }
  const value = status.toString().toLowerCase();
  if (ORDER_STATUS_KEYS.includes(value)) {
    return value;
  }
  if (value === 'shipped') {
    return 'in-transit';
  }
  if (value === 'placed' || value === 'cancelled') {
    return 'processing';
  }
  return 'processing';
};

const summariseOrderStatus = (order) => {
  const items = order?.orderItems || [];
  if (!items.length) {
    return 'processing';
  }

  const statuses = items.map((item) => normaliseOrderItemStatus(item.status));

  if (statuses.every((status) => status === 'delivered')) {
    return 'delivered';
  }
  if (statuses.some((status) => status === 'out-for-delivery')) {
    return 'out-for-delivery';
  }
  if (statuses.some((status) => status === 'in-transit')) {
    return 'in-transit';
  }
  return 'processing';
};

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

const groupProgressMetrics = (metrics = []) => {
  const grouped = metrics.reduce((acc, metricEntry) => {
    if (!metricEntry.metric) return acc;
    if (!acc[metricEntry.metric]) {
      acc[metricEntry.metric] = [];
    }
    acc[metricEntry.metric].push(metricEntry);
    return acc;
  }, {});

  return Object.entries(grouped).map(([metric, entries]) => {
    const sorted = entries.sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt));
    const latest = sorted[0];
    return {
      metric,
      latestValue: latest?.value ?? 0,
      unit: latest?.unit ?? '',
      recordedAt: latest?.recordedAt,
      history: sorted.slice(0, 10),
    };
  });
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
        metrics: groupProgressMetrics(progressDoc.progressMetrics || []).slice(0, 3),
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
          meals: latestDiet.meals ?? [],
          notes: latestDiet.notes,
          nextPlanDueIn: Math.max(0, daysBetween(new Date(), latestDiet.weekOf)),
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
  const progress = await TrainerProgress.findOne({ trainee: userId }).lean();

  if (!progress) {
    return res
      .status(200)
      .json(new ApiResponse(200, { attendance: null, metrics: [], feedback: [] }, 'No progress data yet.'));
  }

  const attendance = buildAttendanceSummary(progress.attendance || []);
  const metrics = groupProgressMetrics(progress.progressMetrics || []);
  const feedback = (progress.feedback || [])
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((entry) => ({ message: entry.message, category: entry.category, createdAt: entry.createdAt }))
    .slice(0, 10);

  const response = {
    attendance,
    metrics,
    rawAttendance: (progress.attendance || []).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 60),
    feedback,
  };

  return res.status(200).json(new ApiResponse(200, response, 'Trainee progress fetched successfully'));
});

export const getTraineeDiet = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const progress = await TrainerProgress.findOne({ trainee: userId }).lean();

  if (!progress || !(progress.dietPlans?.length)) {
    return res.status(200).json(
      new ApiResponse(200, { latest: null, upcoming: null, history: [] }, 'No diet plans assigned yet.'),
    );
  }

  const sorted = [...progress.dietPlans].sort((a, b) => new Date(b.weekOf) - new Date(a.weekOf));
  const latest = sorted[0];
  const upcoming = sorted.find((plan) => new Date(plan.weekOf) > new Date(latest.weekOf)) || null;

  const history = sorted.slice(1, 8).map((plan) => ({
    weekOf: plan.weekOf,
    mealsCount: plan.meals?.length ?? 0,
    notes: plan.notes,
  }));

  return res.status(200).json(
    new ApiResponse(200, {
      latest,
      upcoming,
      history,
    }, 'Diet plans fetched successfully'),
  );
});

export const getTraineeOrders = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const orders = await Order.find({ user: userId }).sort({ createdAt: -1 }).limit(20).lean();

  return res
    .status(200)
    .json(new ApiResponse(200, { orders: buildOrderSummary(orders) }, 'Orders fetched successfully'));
});

export const getGymOwnerOverview = asyncHandler(async (req, res) => {
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
    metrics: groupProgressMetrics(doc.progressMetrics || []).slice(0, 5),
  }));

  return res
    .status(200)
    .json(new ApiResponse(200, { updates }, 'Trainer updates fetched successfully'));
});

export const getAdminOverview = asyncHandler(async (_req, res) => {
  const [userCounts, gyms, orders, revenue, adminToggles] = await Promise.all([
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

  const orderStats = {
    totalOrders: orders?.[0]?.totalOrders ?? 0,
    totalRevenue: formatCurrency(orders?.[0]?.totalRevenue ?? 0),
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
  const pendingQuery = User.find({ status: 'pending', role: 'seller' })
    .select('name email role createdAt profile.location profile.headline')
    .lean();

  const recentQuery = User.find()
    .sort({ createdAt: -1 })
    .limit(20)
    .select('name email role status createdAt')
    .lean();

  const [pending, recent, adminToggles] = await Promise.all([
    pendingQuery,
    recentQuery,
    loadAdminToggles(),
  ]);

  return res.status(200).json(
    new ApiResponse(200, { pending, recent, adminToggles }, 'Admin user backlog fetched successfully'),
  );
});

export const getAdminGyms = asyncHandler(async (_req, res) => {
  const gymsQuery = Gym.find()
    .sort({ createdAt: -1 })
    .limit(25)
    .populate({ path: 'owner', select: 'name email' })
    .lean();

  const [gyms, adminToggles] = await Promise.all([
    gymsQuery,
    loadAdminToggles(),
  ]);

  const data = gyms.map((gym) => ({
    id: gym._id,
    name: gym.name,
    status: gym.status,
    isPublished: gym.isPublished,
    city: gym.location?.city,
    owner: gym.owner ? { id: gym.owner._id, name: gym.owner.name, email: gym.owner.email } : null,
    sponsorship: gym.sponsorship,
    analytics: gym.analytics,
    createdAt: gym.createdAt,
  }));

  return res
    .status(200)
    .json(new ApiResponse(200, { gyms: data, adminToggles }, 'Admin gym list fetched successfully'));
});

export const getAdminRevenue = asyncHandler(async (_req, res) => {
  const [aggregates, adminToggles] = await Promise.all([
    Revenue.aggregate([
      {
        $group: {
          _id: {
            month: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
            type: '$type',
          },
          amount: { $sum: '$amount' },
        },
      },
    ]),
    loadAdminToggles(),
  ]);

  const series = aggregates.reduce((acc, item) => {
    const month = item._id.month;
    if (!acc[month]) {
      acc[month] = {};
    }
    acc[month][item._id.type] = item.amount;
    return acc;
  }, {});

  const trend = Object.entries(series)
    .sort(([a], [b]) => (a > b ? 1 : -1))
    .map(([label, values]) => ({ label, ...values }));

  return res
    .status(200)
    .json(new ApiResponse(200, { trend, adminToggles }, 'Admin revenue trend fetched successfully'));
});

export const getAdminMarketplace = asyncHandler(async (_req, res) => {
  const ordersQuery = Order.find()
    .sort({ createdAt: -1 })
    .limit(20)
    .populate({ path: 'user', select: 'name email' })
    .lean();

  const [orders, adminToggles] = await Promise.all([
    ordersQuery,
    loadAdminToggles(),
  ]);

  const data = orders.map((order) => ({
    id: order._id,
    orderNumber: order.orderNumber,
    total: formatCurrency(order.total, 'INR'),
    status: summariseOrderStatus(order),
    createdAt: order.createdAt,
    user: order.user ? { id: order.user._id, name: order.user.name, email: order.user.email } : null,
    items: order.orderItems?.map((item) => ({ name: item.name, quantity: item.quantity, price: item.price })) ?? [],
  }));

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

  const ageDistribution = ageAggregation.map((entry) => ({
    label: entry._id,
    value: entry.count,
  }));

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

