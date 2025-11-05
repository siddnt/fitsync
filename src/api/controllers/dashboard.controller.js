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

const buildOrderSummary = (orders = []) =>
  orders.map((order) => ({
    id: order._id,
    orderNumber: order.orderNumber,
    total: formatCurrency(order.total, 'INR'),
    status: order.status,
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

  const gyms = await Gym.find({ owner: ownerId })
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
          impressions30d: 0,
        },
        gyms: [],
        expiringSubscriptions: [],
      }, 'No gyms found for this owner.'),
    );
  }

  const gymIds = gyms.map((gym) => gym._id);

  const [membershipAggregates, subscriptionDocs, revenueAggregate, recentJoiners] = await Promise.all([
    GymMembership.aggregate([
      { $match: { gym: { $in: gymIds }, status: 'active' } },
      { $group: { _id: '$gym', activeMembers: { $sum: 1 } } },
    ]),
    GymListingSubscription.find({ owner: ownerId, status: { $in: ['active', 'grace'] } })
      .populate({ path: 'gym', select: 'name location' })
      .lean(),
    Revenue.aggregate([
      {
        $match: {
          user: ownerId,
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      },
      { $group: { _id: null, totalAmount: { $sum: '$amount' } } },
    ]),
    GymMembership.find({ gym: { $in: gymIds }, status: 'active' })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate({ path: 'trainee', select: 'name email profilePicture' })
      .populate({ path: 'gym', select: 'name' })
      .lean(),
  ]);

  const membershipMap = membershipAggregates.reduce((acc, item) => {
    acc[item._id.toString()] = item.activeMembers;
    return acc;
  }, {});

  const revenue30d = revenueAggregate?.[0]?.totalAmount ?? 0;

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

  const stats = {
    totalGyms: gyms.length,
    publishedGyms: gyms.filter((gym) => gym.isPublished).length,
    pendingGyms: gyms.filter((gym) => gym.status !== 'active').length,
    activeMemberships: membershipAggregates.reduce((sum, item) => sum + item.activeMembers, 0),
    revenue30d: formatCurrency(revenue30d),
    impressions30d: enrichedGyms.reduce((sum, gym) => sum + (gym.impressions ?? 0), 0),
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
    { $match: { gym: { $in: gymIds }, status: { $in: ['active', 'paused'] } } },
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
  const gyms = await Gym.find({ owner: ownerId }).select('_id name analytics').lean();

  const gymIds = gyms.map((gym) => gym._id);

  const membershipsByMonth = await GymMembership.aggregate([
    { $match: { gym: { $in: gymIds }, status: { $in: ['active', 'paused'] } } },
    {
      $group: {
        _id: {
          gym: '$gym',
          month: { $dateToString: { format: '%Y-%m', date: '$startDate' } },
        },
        count: { $sum: 1 },
      },
    },
  ]);

  const revenueByMonth = await Revenue.aggregate([
    {
      $match: {
        user: ownerId,
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
        amount: { $sum: '$amount' },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const membershipSeries = membershipsByMonth.reduce((acc, item) => {
    const key = item._id.month;
    if (!acc[key]) {
      acc[key] = 0;
    }
    acc[key] += item.count;
    return acc;
  }, {});

  const analytics = {
    membershipTrend: Object.entries(membershipSeries)
      .sort(([aKey], [bKey]) => (aKey > bKey ? 1 : -1))
      .map(([label, value]) => ({ label, value })),
    revenueTrend: revenueByMonth.map((entry) => ({ label: entry._id, value: entry.amount })),
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

  const assignments = await TrainerAssignment.find({ trainer: trainerId })
    .populate({ path: 'gym', select: 'name location' })
    .lean();

  const progressDocs = await TrainerProgress.find({ trainer: trainerId })
    .populate({ path: 'trainee', select: 'name profilePicture role' })
    .lean();

  const activeTrainees = assignments.flatMap((assignment) =>
    (assignment.trainees || [])
      .filter((trainee) => trainee.status === 'active')
      .map((trainee) => ({
        trainee: trainee.trainee,
        gym: assignment.gym,
        assignedAt: trainee.assignedAt,
        goals: trainee.goals,
      })),
  );

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

  const response = {
    totals: {
      gyms: assignments.length,
      activeTrainees: activeTrainees.length,
      pendingUpdates: upcomingCheckIns.filter((item) => !item.nextFeedback).length,
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
  const assignments = await TrainerAssignment.find({ trainer: trainerId })
    .populate({ path: 'gym', select: 'name location' })
    .populate({ path: 'trainees.trainee', select: 'name email profilePicture role' })
    .lean();

  const data = assignments.map((assignment) => ({
    id: assignment._id,
    gym: assignment.gym
      ? { id: assignment.gym._id, name: assignment.gym.name, city: assignment.gym.location?.city }
      : null,
    status: assignment.status,
    trainees: (assignment.trainees || []).map((record) => ({
      id: record.trainee?._id ?? record.trainee,
      name: record.trainee?.name,
      email: record.trainee?.email,
      status: record.status,
      assignedAt: record.assignedAt,
      goals: record.goals,
    })),
  }));

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
  const pendingQuery = User.find({ status: 'pending' })
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
    status: order.status,
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

