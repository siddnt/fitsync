import mongoose from 'mongoose';
import AuditLog from '../../models/auditLog.model.js';
import Booking from '../../models/booking.model.js';
import Gym from '../../models/gym.model.js';
import GymMembership from '../../models/gymMembership.model.js';
import TrainerProgress from '../../models/trainerProgress.model.js';
import TrainerAssignment from '../../models/trainerAssignment.model.js';
import GymListingSubscription from '../../models/gymListingSubscription.model.js';
import Revenue from '../../models/revenue.model.js';
import Order from '../../models/order.model.js';
import Product from '../../models/product.model.js';
import ProductReview from '../../models/productReview.model.js';
import Review from '../../models/review.model.js';
import User from '../../models/user.model.js';
import Contact from '../../models/contact.model.js';
import {
  loadAdminToggles,
} from '../../services/systemSettings.service.js';
import { listAuditLogs } from '../../services/audit.service.js';
import { getCacheStatus } from '../../services/cache.service.js';
import { getGymImpressionCountsSince } from '../../services/gymImpression.service.js';
import { getObservabilitySnapshot } from '../../services/observability.service.js';
import { getSearchStatus } from '../../services/search.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import {
  buildGymPricingSnapshot,
  getDefaultDisplayMembershipPlan,
  getLowestPricedMembershipPlan,
  getMembershipPlanDefinition,
  sortMembershipPlans,
} from '../../utils/membershipPlans.js';

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

const getImpressionCountFromMap = (counts, gymId) => counts.get(String(gymId))?.count ?? 0;
const getOpenCountFromMap = (counts, gymId) => counts.get(String(gymId))?.openCount ?? 0;

const OWNER_REVENUE_SHARE = 0.5;
const TRAINER_REVENUE_SHARE = 0.5;
const SELLER_REVENUE_SHARE = 0.85;
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

const ORDER_STATUS_KEYS = ['processing', 'in-transit', 'out-for-delivery', 'delivered'];

const REVENUE_EARNING_TYPES = ['membership', 'enrollment', 'renewal'];
const TRAINER_PLAN_CODES = ['trainer-access', 'trainerAccess', 'trainer'];
const ACTIVE_GYM_MEMBERSHIP_STATUSES = ['active', 'pending', 'paused'];

const isTrainerPlanCode = (planCode) => {
  const normalised = String(planCode || '').trim().toLowerCase();
  return TRAINER_PLAN_CODES.some(
    (candidate) => String(candidate || '').trim().toLowerCase() === normalised,
  );
};

const isPaidBillingStatus = (status) => String(status || '').trim().toLowerCase() === 'paid';

const getMapLikeValue = (source, key) => {
  if (!source || !key) {
    return undefined;
  }

  if (source instanceof Map) {
    return source.get(key);
  }

  if (typeof source.get === 'function') {
    try {
      return source.get(key);
    } catch (_error) {
      return undefined;
    }
  }

  if (Object.prototype.hasOwnProperty.call(source, key)) {
    return source[key];
  }

  return undefined;
};

const getMetadataValue = (metadata, ...keys) => {
  for (const key of keys) {
    const value = getMapLikeValue(metadata, key);
    if (value !== undefined && value !== null && value !== '') {
      return String(value);
    }
  }

  return '';
};

const buildListingRevenueEntries = (subscriptions = []) => {
  const entries = [];

  subscriptions.forEach((subscription) => {
    const invoices = Array.isArray(subscription?.invoices) ? subscription.invoices : [];

    if (invoices.length) {
      invoices.forEach((invoice, index) => {
        const amount = Number(invoice?.amount) || 0;
        const date = toDate(invoice?.paidOn) || toDate(subscription?.periodStart) || toDate(subscription?.createdAt);

        if (amount <= 0 || !date) {
          return;
        }

        entries.push({
          id: `${subscription?._id || 'listing'}-invoice-${index}`,
          amount,
          currency: invoice?.currency || subscription?.currency || 'INR',
          date,
          status: invoice?.status || 'paid',
          source: 'listing',
        });
      });
      return;
    }

    const amount = Number(subscription?.amount) || 0;
    const date = toDate(subscription?.periodStart) || toDate(subscription?.createdAt);

    if (amount <= 0 || !date) {
      return;
    }

    entries.push({
      id: `${subscription?._id || 'listing'}-fallback`,
      amount,
      currency: subscription?.currency || 'INR',
      date,
      status: subscription?.status || 'paid',
      source: 'listing',
    });
  });

  return entries;
};

const buildGymRevenueTrend = ({
  memberships = [],
  listingEntries = [],
  sponsorshipEvents = [],
  referenceDate = new Date(),
} = {}) => {
  const monthlyTimeline = createMonthlyTimeline(12, referenceDate).map((entry) => ({
    ...entry,
    total: 0,
    membership: 0,
    listing: 0,
    sponsorship: 0,
  }));

  memberships.forEach((membership) => {
    if (isTrainerPlanCode(membership?.plan) || !isPaidBillingStatus(membership?.billing?.status)) {
      return;
    }

    const amount = Number(membership?.billing?.amount) || 0;
    const date = toDate(membership?.startDate) || toDate(membership?.createdAt);

    if (amount <= 0 || !date) {
      return;
    }

    applyMonthlyAmount(monthlyTimeline, date, 'membership', amount);
    applyMonthlyAmount(monthlyTimeline, date, 'total', amount);
  });

  listingEntries.forEach((entry) => {
    if ((Number(entry?.amount) || 0) <= 0 || !entry?.date) {
      return;
    }

    applyMonthlyAmount(monthlyTimeline, entry.date, 'listing', entry.amount);
    applyMonthlyAmount(monthlyTimeline, entry.date, 'total', entry.amount);
  });

  sponsorshipEvents.forEach((event) => {
    const amount = Number(event?.amount) || 0;
    const date = toDate(event?.createdAt);

    if (amount <= 0 || !date) {
      return;
    }

    applyMonthlyAmount(monthlyTimeline, date, 'sponsorship', amount);
    applyMonthlyAmount(monthlyTimeline, date, 'total', amount);
  });

  return monthlyTimeline.map((entry) => ({
    id: entry.id,
    label: entry.label,
    fullLabel: entry.fullLabel,
    total: Number(entry.total) || 0,
    membership: Number(entry.membership) || 0,
    listing: Number(entry.listing) || 0,
    sponsorship: Number(entry.sponsorship) || 0,
  }));
};

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

const buildOrderItemStatusHistory = (item = {}) => {
  const history = Array.isArray(item?.statusHistory) ? item.statusHistory : [];

  if (history.length) {
    return [...history]
      .sort((left, right) => new Date(left?.updatedAt ?? 0) - new Date(right?.updatedAt ?? 0))
      .map((entry) => ({
        status: normaliseOrderItemStatus(entry?.status),
        note: entry?.note ?? '',
        updatedAt: entry?.updatedAt ?? null,
      }));
  }

  return [{
    status: normaliseOrderItemStatus(item?.status),
    note: '',
    updatedAt: item?.lastStatusAt ?? item?.updatedAt ?? null,
  }];
};

const buildOrderItemTrackingSnapshot = (item = {}) => {
  if (!item?.tracking?.carrier && !item?.tracking?.trackingNumber && !item?.tracking?.trackingUrl) {
    return null;
  }

  return {
    carrier: item?.tracking?.carrier ?? '',
    trackingNumber: item?.tracking?.trackingNumber ?? '',
    trackingUrl: item?.tracking?.trackingUrl ?? '',
    updatedAt: item?.tracking?.updatedAt ?? item?.lastStatusAt ?? null,
    status: normaliseOrderItemStatus(item?.status),
  };
};

const buildOrderItemReturnRequest = (item = {}) => {
  const request = item?.returnRequest ?? {};
  return {
    status: request?.status ?? 'none',
    reason: request?.reason ?? '',
    requestedAt: request?.requestedAt ?? null,
    reviewedAt: request?.reviewedAt ?? null,
    refundAmount: Number(request?.refundAmount) || 0,
    note: request?.note ?? '',
  };
};


const toEntityIdString = (value) => {
  if (!value) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'object' && value._id) {
    return String(value._id);
  }
  return String(value);
};

const filterOrderItemsBySeller = (orderItems = [], sellerId = null) => {
  const items = Array.isArray(orderItems) ? orderItems : [];
  const sellerKey = toEntityIdString(sellerId);

  if (!sellerKey) {
    return items;
  }

  return items.filter((item) => toEntityIdString(item?.seller) === sellerKey);
};

const buildOrderItemSummaries = (orderItems = [], { sellerId = null } = {}) =>
  filterOrderItemsBySeller(orderItems, sellerId).map((item) => {
    const quantity = Number(item?.quantity) || 0;
    const price = Number(item?.price) || 0;

    return {
      id: item?._id || null,
      productId: item?.product?._id || item?.product || null,
      sellerId: item?.seller?._id || item?.seller || null,
      name: item?.name || '',
      quantity,
      price,
      subtotal: price * quantity,
      status: normaliseOrderItemStatus(item?.status),
      lastStatusAt: item?.lastStatusAt || null,
    };
  });

const summariseOrderItemsStatus = (items = []) => {
  if (!items.length) {
    return 'processing';
  }

  const statuses = items.map((item) => normaliseOrderItemStatus(item?.status));

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

const summariseOrderStatus = (order, sellerId = null) =>
  summariseOrderItemsStatus(buildOrderItemSummaries(order?.orderItems, { sellerId }));

const buildOrderSummary = (orders = [], { sellerId = null, mapExtra = null } = {}) =>
  orders.map((order) => {
    const items = buildOrderItemSummaries(order?.orderItems, { sellerId });
    const itemsCount = items.reduce((total, item) => total + (item.quantity || 0), 0);
    const sellerSubtotal = items.reduce((total, item) => total + (item.subtotal || 0), 0);

    const summary = {
      id: order._id,
      orderNumber: order.orderNumber,
      total: sellerId ? sellerSubtotal : (Number(order?.total) || 0),
      orderTotal: Number(order?.total) || 0,
      currency: 'INR',
      status: summariseOrderItemsStatus(items),
      createdAt: order.createdAt,
      itemsCount,
      items,
    };

    if (typeof mapExtra === 'function') {
      return {
        ...summary,
        ...(mapExtra(order) || {}),
      };
    }

    return summary;
  });

const buildDerivedSellerRevenueEvents = (orders = [], sellerId = null) =>
  orders
    .map((order) => {
      const items = buildOrderItemSummaries(order?.orderItems, { sellerId });
      if (!items.length || !items.every((item) => item.status === 'delivered')) {
        return null;
      }

      const grossAmount = items.reduce((sum, item) => sum + (Number(item?.subtotal) || 0), 0);
      const payoutAmount = calculateRevenueShare(grossAmount, SELLER_REVENUE_SHARE);

      if (payoutAmount <= 0) {
        return null;
      }

      const deliveredAt = items.reduce((latestDate, item) => {
        const candidate = toDate(item?.lastStatusAt);
        if (!candidate) {
          return latestDate;
        }
        if (!latestDate || candidate > latestDate) {
          return candidate;
        }
        return latestDate;
      }, null);

      return {
        id: `derived-seller-${order?._id}`,
        type: 'seller',
        amount: payoutAmount,
        currency: 'INR',
        description: `Order ${order?.orderNumber ?? order?._id} delivered items seller share (derived from order fulfillment)`,
        createdAt: deliveredAt || order?.createdAt || null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

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

const pricingSnapshotHasPlans = (pricing = {}) => {
  const plans = Array.isArray(pricing?.plans) ? pricing.plans : [];
  if (plans.length) {
    return true;
  }

  return Boolean(
    Number(pricing?.monthlyPrice ?? pricing?.price ?? 0)
      || Number(pricing?.startingAt ?? 0),
  );
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
    .populate({ path: 'orderItems.seller', select: 'name email role' })
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
        seller: item.seller?._id
          ? {
              id: String(item.seller._id),
              name: item.seller.name,
              email: item.seller.email,
              role: item.seller.role,
            }
          : null,
        name: item.name ?? item.product?.name ?? 'Marketplace item',
        image: item.image ?? item.product?.image ?? null,
        quantity: item.quantity ?? 0,
        price: formatCurrency(item.price ?? 0, 'INR'),
        subtotal: formatCurrency((Number(item.price) || 0) * (Number(item.quantity) || 0), 'INR'),
        status,
        statusHistory: buildOrderItemStatusHistory(item),
        tracking: buildOrderItemTrackingSnapshot(item),
        returnRequest: buildOrderItemReturnRequest(item),
        reviewed,
        canReview,
      };
    });

    return {
      id: order._id,
      orderNumber: order.orderNumber,
      subtotal: formatCurrency(order.subtotal, 'INR'),
      discountAmount: formatCurrency(order.discountAmount ?? 0, 'INR'),
      tax: formatCurrency(order.tax, 'INR'),
      shippingCost: formatCurrency(order.shippingCost, 'INR'),
      total: formatCurrency(order.total, 'INR'),
      status: summariseOrderStatus(order),
      paymentMethod: order.paymentMethod ?? 'Cash on Delivery',
      createdAt: order.createdAt,
      promo: order.promo
        ? {
            code: order.promo.code ?? '',
            label: order.promo.label ?? '',
            description: order.promo.description ?? '',
            discountAmount: formatCurrency(order.promo.discountAmount ?? 0, 'INR'),
          }
        : null,
      itemsCount: items.reduce((total, item) => total + (item.quantity || 0), 0),
      shippingAddress: order.shippingAddress ?? null,
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
          revenue30d: 0,
          expenses30d: 0,
          profit30d: 0,
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
  const impressionCounts30d = await getGymImpressionCountsSince(gymIds, thirtyDaysAgo);

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
    const impressions30d = getImpressionCountFromMap(impressionCounts30d, gym._id);
    return {
      id: gym._id,
      name: gym.name,
      city: gym.location?.city,
      status: gym.status,
      isPublished: gym.isPublished,
      members,
      impressions: impressions30d,
      lifetimeImpressions: Number(gym.analytics?.impressions) || 0,
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
    revenue30d,
    expenses30d,
    profit30d,
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
    .select('name description location contact schedule status isPublished analytics sponsorship pricing createdAt updatedAt tags keyFeatures gallery')
    .lean();

  const gymIds = gyms.map((gym) => gym._id);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const impressionCounts30d = await getGymImpressionCountsSince(gymIds, thirtyDaysAgo);

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
    const completenessChecks = [
      Boolean(String(gym.description ?? '').trim()),
      Boolean(String(gym.location?.address ?? '').trim()),
      Boolean(String(gym.contact?.phone ?? '').trim() || String(gym.contact?.email ?? '').trim()),
      Boolean(Array.isArray(gym.gallery) && gym.gallery.filter(Boolean).length),
      Boolean(Array.isArray(gym.keyFeatures) && gym.keyFeatures.length),
      Boolean((pricingSnapshotHasPlans(gym.pricing))),
    ];
    const listingCompleteness = Math.round(
      (completenessChecks.filter(Boolean).length / completenessChecks.length) * 100,
    );

    return {
      id: gym._id,
      name: gym.name,
      description: gym.description ?? '',
      city: gym.location?.city,
      location: {
        address: gym.location?.address ?? '',
        city: gym.location?.city ?? '',
        state: gym.location?.state ?? '',
      },
      contact: {
        phone: gym.contact?.phone ?? '',
        email: gym.contact?.email ?? '',
        website: gym.contact?.website ?? '',
      },
      schedule: {
        open: gym.schedule?.openTime ?? gym.schedule?.open ?? '',
        close: gym.schedule?.closeTime ?? gym.schedule?.close ?? '',
        workingDays: Array.isArray(gym.schedule?.workingDays) ? gym.schedule.workingDays : [],
      },
      status: gym.status,
      isPublished: gym.isPublished,
      tags: gym.tags,
      keyFeatures: gym.keyFeatures,
      gallery: Array.isArray(gym.gallery) ? gym.gallery.filter(Boolean) : [],
      analytics: {
        ...gym.analytics,
        impressions30d: getImpressionCountFromMap(impressionCounts30d, gym._id),
      },
      sponsorship: gym.sponsorship,
      pricing: gym.pricing,
      createdAt: gym.createdAt,
      updatedAt: gym.updatedAt,
      listingCompleteness,
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

  const [assignmentDocs, membershipDocs, progressDocs] = await Promise.all([
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

    TrainerProgress.find({ gym: { $in: gymIds } })
      .select('gym trainee attendance updatedAt')
      .lean(),
  ]);

  const progressMap = progressDocs.reduce((acc, doc) => {
    const gymId = doc.gym ? String(doc.gym) : '';
    const traineeId = doc.trainee ? String(doc.trainee) : '';
    if (!gymId || !traineeId) {
      return acc;
    }

    acc[`${gymId}:${traineeId}`] = doc;
    return acc;
  }, {});

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

    const traineeId = membership.trainee?._id ? String(membership.trainee._id) : '';
    const progressDoc = traineeId ? progressMap[`${gymId}:${traineeId}`] : null;
    const attendanceSummary = progressDoc ? buildAttendanceSummary(progressDoc.attendance || []) : null;
    const latestAttendance = Array.isArray(progressDoc?.attendance) && progressDoc.attendance.length
      ? [...progressDoc.attendance].sort((left, right) => new Date(right.date) - new Date(left.date))[0]
      : null;

    rosterMap[gymId].trainees.push({
      membershipId: membership._id,
      id: membership.trainee?._id ?? null,
      name: membership.trainee?.name ?? 'Member',
      email: membership.trainee?.email ?? '',
      profilePicture: membership.trainee?.profilePicture ?? null,
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
      attendance: attendanceSummary
        ? {
            streak: attendanceSummary.streak ?? 0,
            presentPercentage: attendanceSummary.presentPercentage ?? 0,
            latePercentage: attendanceSummary.latePercentage ?? 0,
            absentPercentage: attendanceSummary.absentPercentage ?? 0,
            recentCount: attendanceSummary.records?.length ?? 0,
          }
        : null,
      checkIn: {
        lastDate: latestAttendance?.date ?? null,
        lastStatus: latestAttendance?.status ?? null,
      },
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
    amount: {
      amount: Number(subscription.amount) || 0,
      currency: subscription.currency ?? 'INR',
    },
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
  const gymIds = gyms.map((gym) => gym._id);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [impressionCounts30d, membershipHistoryDocs] = await Promise.all([
    getGymImpressionCountsSince(gymIds, thirtyDaysAgo),
    GymMembership.find({
      gym: { $in: gymIds },
      plan: { $nin: TRAINER_PLAN_CODES },
    })
      .select('gym trainee startDate createdAt')
      .lean(),
  ]);

  const joinsByGym = {};
  membershipHistoryDocs.forEach((membership) => {
    const when = toDate(membership.startDate) || toDate(membership.createdAt);
    if (!when || when < thirtyDaysAgo) {
      return;
    }

    const gymKey = String(membership.gym);
    joinsByGym[gymKey] = (joinsByGym[gymKey] || 0) + 1;
  });

  const toRate = (value, previous) => {
    if (!previous) {
      return 0;
    }
    return Number(((Number(value) / Number(previous)) * 100).toFixed(1));
  };

  const data = gyms
    .filter((gym) => gym.sponsorship && gym.sponsorship.tier && gym.sponsorship.tier !== 'none')
    .map((gym) => {
      const impressions30d = getImpressionCountFromMap(impressionCounts30d, gym._id);
      const opens30d = getOpenCountFromMap(impressionCounts30d, gym._id);
      const joins30d = joinsByGym[String(gym._id)] || 0;
      const monthlySpend = Number(gym.sponsorship?.monthlyBudget) || Number(gym.sponsorship?.amount) || 0;

      return {
        id: gym._id,
        name: gym.name,
        city: gym.location?.city,
        impressions: gym.analytics?.impressions ?? 0,
        impressions30d,
        opens30d,
        joins30d,
        impressionToOpenRate30d: toRate(opens30d, impressions30d),
        openToJoinRate30d: toRate(joins30d, opens30d),
        spendPerOpen: opens30d ? Math.round(monthlySpend / opens30d) : 0,
        spendPerJoin: joins30d ? Math.round(monthlySpend / joins30d) : 0,
        reachUtilization30d: toRate(impressions30d, gym.sponsorship?.reach ?? 0),
        sponsorship: gym.sponsorship,
      };
    });

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
    .select('_id name analytics sponsorship createdAt location')
    .lean();

  const gymIds = gyms.map((gym) => gym._id);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const impressionCounts30d = await getGymImpressionCountsSince(gymIds, thirtyDaysAgo);

  const monthlyTimeline = createMonthlyTimeline(12, referenceDate);
  const weeklyTimeline = createWeeklyTimeline(12, referenceDate);

  const earliestMonthly = monthlyTimeline[0]?.referenceDate ?? referenceDate;
  const earliestWeekly = weeklyTimeline[0]?.start ?? referenceDate;
  const earliestDate = earliestMonthly < earliestWeekly ? earliestMonthly : earliestWeekly;

  const [membershipDocs, membershipHistoryDocs, revenueEvents, subscriptions] = await Promise.all([
    GymMembership.find({
      gym: { $in: gymIds },
      status: { $in: ['active', 'paused'] },
      startDate: { $gte: earliestDate },
      plan: { $nin: TRAINER_PLAN_CODES },
    })
      .select('startDate createdAt billing')
      .lean(),
    GymMembership.find({
      gym: { $in: gymIds },
      plan: { $nin: TRAINER_PLAN_CODES },
    })
      .select('gym trainee startDate createdAt billing plan status')
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
      .select('gym amount periodStart periodEnd createdAt invoices')
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

  const membershipHistory = [...membershipHistoryDocs].sort(
    (left, right) => new Date(left.startDate || left.createdAt || 0) - new Date(right.startDate || right.createdAt || 0),
  );
  const priorMembershipByKey = new Map();
  const joinsByGym = {};
  const renewalsByGym = {};
  let joins30d = 0;
  let renewals30d = 0;

  membershipHistory.forEach((membership) => {
    const when = toDate(membership.startDate) || toDate(membership.createdAt);
    if (!when) {
      return;
    }

    const memberKey = `${membership.trainee}-${membership.gym}`;
    const gymKey = String(membership.gym);
    const isRenewal = priorMembershipByKey.has(memberKey);
    priorMembershipByKey.set(memberKey, when);

    if (when < thirtyDaysAgo) {
      return;
    }

    joins30d += 1;
    joinsByGym[gymKey] = (joinsByGym[gymKey] || 0) + 1;

    if (isRenewal) {
      renewals30d += 1;
      renewalsByGym[gymKey] = (renewalsByGym[gymKey] || 0) + 1;
    }
  });

  const listingSpend30d = expenseEntries
    .filter((entry) => entry.source === 'listing' && entry.date >= thirtyDaysAgo)
    .reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0);
  const sponsorshipSpend30d = expenseEntries
    .filter((entry) => entry.source === 'sponsorship' && entry.date >= thirtyDaysAgo)
    .reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0);
  const totalSpend30d = listingSpend30d + sponsorshipSpend30d;
  const totalImpressions30d = gyms.reduce(
    (sum, gym) => sum + getImpressionCountFromMap(impressionCounts30d, gym._id),
    0,
  );
  const totalOpens30d = gyms.reduce(
    (sum, gym) => sum + getOpenCountFromMap(impressionCounts30d, gym._id),
    0,
  );

  const toRate = (value, previous) => {
    if (!previous) {
      return 0;
    }
    return Number(((Number(value) / Number(previous)) * 100).toFixed(1));
  };

  const conversionFunnel = {
    periodDays: 30,
    totals: {
      impressions: totalImpressions30d,
      gymOpens: totalOpens30d,
      joins: joins30d,
      renewals: renewals30d,
      listingSpend: listingSpend30d,
      sponsorshipSpend: sponsorshipSpend30d,
      totalSpend: totalSpend30d,
      costPerJoin: joins30d ? Math.round(totalSpend30d / joins30d) : 0,
      costPerRenewal: renewals30d ? Math.round(totalSpend30d / renewals30d) : 0,
    },
    steps: [
      {
        id: 'impressions',
        label: 'Impressions',
        value: totalImpressions30d,
        conversionFromPrevious: null,
      },
      {
        id: 'gym-opens',
        label: 'Gym opens',
        value: totalOpens30d,
        conversionFromPrevious: toRate(totalOpens30d, totalImpressions30d),
      },
      {
        id: 'joins',
        label: 'Joins',
        value: joins30d,
        conversionFromPrevious: toRate(joins30d, totalOpens30d),
      },
      {
        id: 'renewals',
        label: 'Renewals',
        value: renewals30d,
        conversionFromPrevious: toRate(renewals30d, joins30d),
      },
    ],
  };

  const analytics = {
    revenueTrend,
    revenueSummary: {
      monthly: monthlySummary,
      weekly: weeklySummary,
    },
    membershipTrend,
    expenseBreakdown,
    conversionFunnel,
    gyms: gyms.map((gym) => ({
      id: gym._id,
      name: gym.name,
      city: gym.location?.city ?? '',
      impressions: gym.analytics?.impressions ?? 0,
      impressions30d: getImpressionCountFromMap(impressionCounts30d, gym._id),
      opens: gym.analytics?.opens ?? 0,
      opens30d: getOpenCountFromMap(impressionCounts30d, gym._id),
      memberships: gym.analytics?.memberships ?? 0,
      joins30d: joinsByGym[String(gym._id)] || 0,
      renewals30d: renewalsByGym[String(gym._id)] || 0,
      joinConversionRate30d: toRate(
        joinsByGym[String(gym._id)] || 0,
        getOpenCountFromMap(impressionCounts30d, gym._id),
      ),
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
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setHours(23, 59, 59, 999);
  const overdueFeedbackThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [memberships, assignmentDocs, progressDocs, revenueAggregate, todayBookings] = await Promise.all([
    GymMembership.find({ trainer: trainerId, status: { $in: ['active', 'paused'] } })
      .populate({ path: 'gym', select: 'name location' })
      .populate({ path: 'trainee', select: 'name profilePicture role' })
      .lean(),
    TrainerAssignment.find({ trainer: trainerId }).lean(),
    TrainerProgress.find({ trainer: trainerId })
      .populate({ path: 'trainee', select: 'name profilePicture role' })
      .populate({ path: 'gym', select: 'name location' })
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
    Booking.find({
      trainer: trainerFilter,
      bookingDate: { $gte: todayStart, $lte: todayEnd },
      status: { $in: ['pending', 'confirmed'] },
    })
      .populate({ path: 'user', select: 'name profilePicture role' })
      .populate({ path: 'gym', select: 'name location' })
      .sort({ bookingDate: 1, startTime: 1 })
      .lean(),
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

  const overdueProgressUpdates = progressDocs
    .map((doc) => {
      const latestFeedback = (doc.feedback || [])
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
      const latestAttendance = (doc.attendance || [])
        .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
      const latestMetric = groupProgressMetrics(doc.progressMetrics || [], doc.bodyMetrics || [])[0] ?? null;
      const latestCoachUpdateDate = latestFeedback?.createdAt ? new Date(latestFeedback.createdAt) : null;
      const isOverdue = !latestCoachUpdateDate || latestCoachUpdateDate < overdueFeedbackThreshold;
      const referenceDate = latestCoachUpdateDate ?? latestAttendance?.date ?? doc.updatedAt ?? doc.createdAt ?? null;
      const daysSinceUpdate = referenceDate
        ? Math.max(0, Math.floor((Date.now() - new Date(referenceDate).getTime()) / (1000 * 60 * 60 * 24)))
        : null;

      return {
        trainee: doc.trainee
          ? {
            id: doc.trainee._id,
            name: doc.trainee.name,
            profilePicture: doc.trainee.profilePicture,
          }
          : null,
        gym: doc.gym
          ? {
            id: doc.gym._id,
            name: doc.gym.name,
            city: doc.gym.location?.city,
          }
          : null,
        latestFeedbackAt: latestFeedback?.createdAt ?? null,
        latestAttendance,
        latestMetric,
        daysSinceUpdate,
        isOverdue,
      };
    })
    .filter((item) => item.isOverdue)
    .sort((left, right) => (right.daysSinceUpdate ?? 0) - (left.daysSinceUpdate ?? 0));

  const todaysSessions = todayBookings.map((booking) => ({
    id: booking._id,
    trainee: booking.user
      ? {
        id: booking.user._id,
        name: booking.user.name,
        profilePicture: booking.user.profilePicture,
      }
      : null,
    gym: booking.gym
      ? {
        id: booking.gym._id,
        name: booking.gym.name,
        city: booking.gym.location?.city,
      }
      : null,
    bookingDate: booking.bookingDate,
    startTime: booking.startTime,
    endTime: booking.endTime,
    status: booking.status,
    sessionType: booking.sessionType,
    notes: booking.notes,
  }));

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
      pendingUpdates: overdueProgressUpdates.length,
      earnings30d: trainerRevenue30d,
      todaysSessions: todaysSessions.length,
    },
    activeAssignments: activeTrainees,
    upcomingCheckIns,
    todaySessions: todaysSessions,
    overdueProgressUpdates,
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
  const pendingQuery = User.find({ status: 'pending', role: { $in: ['seller', 'manager'] } })
    .select('name email role createdAt profile.location profile.headline')
    .lean();

  const recentQuery = User.find()
    .sort({ createdAt: -1 })
    .limit(200)
    .select('name email role status createdAt profilePicture')
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

export const getAdminUserDetails = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const parsedUserId = toObjectId(userId);

  if (!parsedUserId) {
    throw new ApiError(400, 'Invalid user id.');
  }

  const [user, adminToggles] = await Promise.all([
    User.findById(parsedUserId)
      .select('-password -refreshToken')
      .lean(),
    loadAdminToggles(),
  ]);

  if (!user) {
    throw new ApiError(404, 'User not found.');
  }

  const normalizedRole = String(user?.role || '').toLowerCase();
  const isOwnerRole = normalizedRole === 'gym-owner';
  const isSellerRole = normalizedRole === 'seller';
  const isTrainerRole = normalizedRole === 'trainer';
  const isTraineeRole = ['trainee', 'user', 'member'].includes(normalizedRole);

  const toUserSummary = (entity) => (entity?._id
    ? {
      id: entity._id,
      name: entity.name,
      email: entity.email,
      role: entity.role,
      status: entity.status,
      profilePicture: entity.profilePicture || '',
    }
    : null);

  const toGymSummary = (gym) => (gym?._id
    ? {
      id: gym._id,
      name: gym.name,
      city: gym.location?.city || '',
      state: gym.location?.state || '',
    }
    : null);

  const primaryGymId = user?.traineeMetrics?.primaryGym;

  const [
    membershipCount,
    orderCount,
    recentOrders,
    gymsOwnedCount,
    trainerTraineeRows,
    traineeMembershipDocs,
    trainerAssignmentDocs,
    trainerMembershipDocs,
    primaryGymDoc,
    sellerProductDocs,
    sellerRevenueDocs,
    sellerOrdersCount,
    ownerGymDocs,
    ownerRevenueDocs,
    ownerSubscriptionDocs,
    ownerRevenueEventDocs,
    sellerOrderDocs,
    sellerRevenueEventDocs,
    traineeGymReviewDocs,
    traineeProductReviewDocs,
    trainerProgressAsTrainerDocs,
    trainerProgressAsTraineeDocs,
  ] = await Promise.all([
    GymMembership.countDocuments({
      trainee: parsedUserId,
      status: { $in: ['active', 'pending', 'paused'] },
    }),
    Order.countDocuments({ user: parsedUserId }),
    Order.find({ user: parsedUserId })
      .sort({ createdAt: -1 })
      .limit(25)
      .select('orderNumber total status createdAt orderItems.name orderItems.quantity orderItems.status orderItems.price orderItems.product orderItems.seller')
      .lean(),
    Gym.countDocuments({ owner: parsedUserId }),
    TrainerAssignment.aggregate([
      {
        $match: {
          trainer: parsedUserId,
          status: { $in: ['active', 'pending'] },
        },
      },
      { $unwind: { path: '$trainees', preserveNullAndEmptyArrays: false } },
      { $match: { 'trainees.status': 'active' } },
      {
        $group: {
          _id: '$trainer',
          traineeIds: { $addToSet: '$trainees.trainee' },
        },
      },
      { $project: { count: { $size: '$traineeIds' } } },
    ]),
    GymMembership.find({
      trainee: parsedUserId,
      status: { $in: ['active', 'pending', 'paused'] },
    })
      .sort({ createdAt: -1 })
      .populate({ path: 'gym', select: 'name location' })
      .populate({ path: 'trainer', select: 'name email role status profilePicture' })
      .lean(),
    TrainerAssignment.find({
      trainer: parsedUserId,
      status: { $in: ['active', 'pending', 'inactive'] },
    })
      .sort({ updatedAt: -1, createdAt: -1 })
      .populate({ path: 'gym', select: 'name location' })
      .populate({ path: 'trainees.trainee', select: 'name email role status profilePicture' })
      .lean(),
    GymMembership.find({
      trainer: parsedUserId,
      status: { $in: ['active', 'pending', 'paused'] },
    })
      .sort({ createdAt: -1 })
      .populate({ path: 'gym', select: 'name location' })
      .populate({ path: 'trainee', select: 'name email role status profilePicture' })
      .lean(),
    primaryGymId
      ? Gym.findById(primaryGymId).select('name location').lean()
      : Promise.resolve(null),
    Product.find({ seller: parsedUserId })
      .select('name price stock image status isPublished metrics createdAt')
      .sort({ createdAt: -1 })
      .lean(),
    Revenue.aggregate([
      { $match: { user: parsedUserId, type: 'seller' } },
      { $group: { _id: null, totalAmount: { $sum: '$amount' } } }
    ]),
    Order.countDocuments({ 'orderItems.seller': parsedUserId }),
    Gym.find({ owner: parsedUserId })
      .select('name location pricing status isPublished analytics sponsorship createdAt')
      .sort({ createdAt: -1 })
      .lean(),
    Revenue.aggregate([
      { $match: { user: parsedUserId, type: { $in: ['membership', 'enrollment', 'renewal'] } } },
      { $group: { _id: null, totalAmount: { $sum: '$amount' } } }
    ]),
    isOwnerRole
      ? GymListingSubscription.find({ owner: parsedUserId })
        .sort({ createdAt: -1 })
        .limit(100)
        .populate({ path: 'gym', select: 'name location' })
        .lean()
      : Promise.resolve([]),
    isOwnerRole
      ? Revenue.find({
        user: parsedUserId,
        type: { $in: REVENUE_EARNING_TYPES },
      })
        .sort({ createdAt: -1 })
        .limit(100)
        .select('amount type description createdAt')
        .lean()
      : Promise.resolve([]),
    isSellerRole
      ? Order.find({ 'orderItems.seller': parsedUserId })
        .sort({ createdAt: -1 })
        .limit(100)
        .select('orderNumber total status createdAt orderItems user')
        .populate({ path: 'user', select: 'name email role status profilePicture' })
        .lean()
      : Promise.resolve([]),
    isSellerRole
      ? Revenue.find({ user: parsedUserId, type: 'seller' })
        .sort({ createdAt: -1 })
        .limit(100)
        .select('amount type description createdAt')
        .lean()
      : Promise.resolve([]),
    isTraineeRole
      ? Review.find({ user: parsedUserId })
        .sort({ updatedAt: -1 })
        .limit(100)
        .select('gym rating comment createdAt updatedAt')
        .populate({ path: 'gym', select: 'name location' })
        .lean()
      : Promise.resolve([]),
    isTraineeRole
      ? ProductReview.find({ user: parsedUserId })
        .sort({ updatedAt: -1 })
        .limit(100)
        .select('product rating title comment isVerifiedPurchase createdAt updatedAt')
        .populate({ path: 'product', select: 'name category price' })
        .lean()
      : Promise.resolve([]),
    isTrainerRole
      ? TrainerProgress.find({ trainer: parsedUserId })
        .sort({ updatedAt: -1 })
        .limit(100)
        .populate({ path: 'trainee', select: 'name email role status profilePicture' })
        .populate({ path: 'gym', select: 'name location' })
        .lean()
      : Promise.resolve([]),
    isTraineeRole
      ? TrainerProgress.find({ trainee: parsedUserId })
        .sort({ updatedAt: -1 })
        .limit(100)
        .populate({ path: 'trainer', select: 'name email role status profilePicture' })
        .populate({ path: 'gym', select: 'name location' })
        .lean()
      : Promise.resolve([]),
  ]);

  let ownerMembershipsDocs = [];
  const ownerGymIds = (ownerGymDocs ?? []).map((gym) => gym._id);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  if (ownerGymDocs?.length) {
    ownerMembershipsDocs = await GymMembership.find({
      gym: { $in: ownerGymIds },
      status: { $in: ['active', 'pending', 'paused'] },
      plan: { $nin: TRAINER_PLAN_CODES },
    })
      .sort({ createdAt: -1 })
      .populate({ path: 'gym', select: 'name location' })
      .populate({ path: 'trainee', select: 'name email role status profilePicture' })
      .lean();
  }

  let ownerRevenue30dDocs = [];
  let ownerMembershipRevenueAggregates = [];
  let ownerMembershipRevenueEventDocs = [];

  if (isOwnerRole) {
    [ownerRevenue30dDocs, ownerMembershipRevenueAggregates, ownerMembershipRevenueEventDocs] = await Promise.all([
      Revenue.aggregate([
        {
          $match: {
            user: parsedUserId,
            type: { $in: REVENUE_EARNING_TYPES },
            createdAt: { $gte: thirtyDaysAgo },
          },
        },
        { $group: { _id: null, totalAmount: { $sum: '$amount' } } },
      ]),
      ownerGymIds.length
        ? GymMembership.aggregate([
          {
            $match: {
              gym: { $in: ownerGymIds },
              plan: { $nin: TRAINER_PLAN_CODES },
              'billing.status': 'paid',
              'billing.amount': { $gt: 0 },
            },
          },
          {
            $group: {
              _id: null,
              totalCollected: { $sum: '$billing.amount' },
              recentCollected: {
                $sum: {
                  $cond: [{ $gte: ['$createdAt', thirtyDaysAgo] }, '$billing.amount', 0],
                },
              },
            },
          },
        ])
        : Promise.resolve([]),
      ownerGymIds.length
        ? GymMembership.find({
          gym: { $in: ownerGymIds },
          plan: { $nin: TRAINER_PLAN_CODES },
          'billing.status': 'paid',
          'billing.amount': { $gt: 0 },
        })
          .sort({ createdAt: -1 })
          .limit(100)
          .select('gym trainee plan status billing createdAt')
          .populate({ path: 'gym', select: 'name location' })
          .populate({ path: 'trainee', select: 'name email role status profilePicture' })
          .lean()
        : Promise.resolve([]),
    ]);
  }

  const activeTrainees = Number(trainerTraineeRows?.[0]?.count) || 0;

  const traineeMemberships = (traineeMembershipDocs ?? []).map((membership) => ({
    id: membership._id,
    gym: toGymSummary(membership.gym),
    trainer: toUserSummary(membership.trainer),
    plan: membership.plan || 'monthly',
    status: membership.status,
    startDate: membership.startDate,
    endDate: membership.endDate,
  }));

  const trainerAssignments = (trainerAssignmentDocs ?? []).map((assignment) => ({
    id: assignment._id,
    gym: toGymSummary(assignment.gym),
    status: assignment.status || 'pending',
    requestedAt: assignment.requestedAt || assignment.createdAt,
    approvedAt: assignment.approvedAt || null,
    trainees: (assignment.trainees ?? []).map((entry) => ({
      trainee: toUserSummary(entry.trainee),
      status: entry.status || 'active',
      assignedAt: entry.assignedAt,
    })),
  }));

  const trainerGymsMap = {};
  trainerAssignments.forEach((assignment) => {
    if (!assignment.gym?.id) return;
    trainerGymsMap[String(assignment.gym.id)] = assignment.gym;
  });
  (trainerMembershipDocs ?? []).forEach((membership) => {
    const gymSummary = toGymSummary(membership.gym);
    if (!gymSummary?.id) return;
    trainerGymsMap[String(gymSummary.id)] = gymSummary;
  });
  const trainerGyms = Object.values(trainerGymsMap);

  const trainerTraineesMap = {};
  trainerAssignments.forEach((assignment) => {
    (assignment.trainees ?? []).forEach((entry) => {
      if (!entry.trainee?.id) return;
      const key = String(entry.trainee.id);
      if (!trainerTraineesMap[key]) {
        trainerTraineesMap[key] = { ...entry.trainee, assignmentCount: 0 };
      }
      trainerTraineesMap[key].assignmentCount += 1;
    });
  });
  (trainerMembershipDocs ?? []).forEach((membership) => {
    const traineeSummary = toUserSummary(membership.trainee);
    if (!traineeSummary?.id) return;
    const key = String(traineeSummary.id);
    if (!trainerTraineesMap[key]) {
      trainerTraineesMap[key] = { ...traineeSummary, assignmentCount: 0 };
    }
  });
  const trainerTrainees = Object.values(trainerTraineesMap);

  const ownerMemberships = ownerMembershipsDocs.map((membership) => ({
    id: membership._id,
    gym: toGymSummary(membership.gym),
    trainee: toUserSummary(membership.trainee),
    plan: membership.plan || 'monthly',
    status: membership.status,
    startDate: membership.startDate,
    endDate: membership.endDate,
    billingAmount: Number(membership?.billing?.amount) || 0,
    billingCurrency: membership?.billing?.currency || 'INR',
    billingStatus: membership?.billing?.status || 'pending',
    createdAt: membership.createdAt,
  }));

  const ownerSubscriptions = (ownerSubscriptionDocs ?? []).map((subscription) => ({
    id: subscription._id,
    gym: toGymSummary(subscription.gym),
    planCode: subscription.planCode,
    amount: Number(subscription.amount) || 0,
    currency: subscription.currency || 'INR',
    status: subscription.status,
    periodStart: subscription.periodStart,
    periodEnd: subscription.periodEnd,
    invoiceCount: Array.isArray(subscription.invoices) ? subscription.invoices.length : 0,
    autoRenew: Boolean(subscription.autoRenew),
    daysRemaining: subscription.periodEnd ? daysBetween(new Date(), subscription.periodEnd) : null,
  }));

  const mapRevenueEvent = (entry) => ({
    id: entry._id,
    type: entry.type || 'other',
    amount: Number(entry.amount) || 0,
    currency: entry.currency || 'INR',
    description: entry.description || '',
    createdAt: entry.createdAt,
  });

  const derivedOwnerRevenueEvents = (ownerMembershipRevenueEventDocs ?? []).map((membership) => ({
    id: membership._id,
    type: 'membership-share',
    amount: calculateRevenueShare(membership?.billing?.amount, OWNER_REVENUE_SHARE),
    currency: membership?.billing?.currency || 'INR',
    description: [membership?.trainee?.name || membership?.trainee?.email || 'Member', membership?.gym?.name]
      .filter(Boolean)
      .join(' - '),
    createdAt: membership.createdAt,
  })).filter((entry) => entry.amount > 0);

  const ownerRevenueEvents = (ownerRevenueEventDocs ?? []).length
    ? (ownerRevenueEventDocs ?? []).map(mapRevenueEvent)
    : derivedOwnerRevenueEvents;

  const sellerProducts = (sellerProductDocs ?? []).map((product) => ({
    id: product._id,
    name: product.name,
    price: Number(product.price) || 0,
    mrp: Number(product.mrp) || Number(product.price) || 0,
    stock: Number(product.stock) || 0,
    image: product.image || '',
    status: product.status,
    isPublished: Boolean(product.isPublished),
    totalSold: Number(product?.metrics?.sales?.totalSold) || 0,
    reviewCount: Number(product?.metrics?.reviews?.count) || 0,
    averageRating: Number(product?.metrics?.reviews?.averageRating) || 0,
    createdAt: product.createdAt,
  }));

  const sellerOrders = buildOrderSummary(sellerOrderDocs ?? [], {
    sellerId: parsedUserId,
    mapExtra: (order) => ({
      buyer: toUserSummary(order.user),
    }),
  });

  const derivedSellerRevenueEvents = buildDerivedSellerRevenueEvents(
    sellerOrderDocs ?? [],
    parsedUserId,
  );
  const sellerRevenueEvents = (sellerRevenueEventDocs ?? []).length
    ? (sellerRevenueEventDocs ?? []).map(mapRevenueEvent)
    : derivedSellerRevenueEvents;

  const ownerMembershipsByGym = ownerMembershipsDocs.reduce((acc, membership) => {
    const gymKey = toEntityIdString(membership?.gym);
    if (!gymKey) {
      return acc;
    }

    if (!acc[gymKey]) {
      acc[gymKey] = { totalMembers: 0, activeMembers: 0 };
    }

    acc[gymKey].totalMembers += 1;
    if (membership?.status === 'active') {
      acc[gymKey].activeMembers += 1;
    }

    return acc;
  }, {});

  const ownerSubscriptionByGym = (ownerSubscriptionDocs ?? []).reduce((acc, subscription) => {
    const gymKey = toEntityIdString(subscription?.gym);
    if (!gymKey) {
      return acc;
    }

    const existing = acc[gymKey];
    const candidateDate = toDate(subscription?.periodEnd)?.getTime() || 0;
    const existingDate = toDate(existing?.periodEnd)?.getTime() || 0;

    if (!existing || candidateDate >= existingDate) {
      acc[gymKey] = subscription;
    }

    return acc;
  }, {});

  const ownerGyms = (ownerGymDocs ?? []).map((gym) => {
    const gymKey = toEntityIdString(gym?._id);
    const membershipSummary = ownerMembershipsByGym[gymKey] || { totalMembers: 0, activeMembers: 0 };
    const listing = ownerSubscriptionByGym[gymKey];

    return {
      id: gym._id,
      name: gym.name,
      city: gym.location?.city || '',
      state: gym.location?.state || '',
      address: gym.location?.address || '',
      status: gym.status,
      isPublished: Boolean(gym.isPublished),
      impressions: Number(gym?.analytics?.impressions) || 0,
      memberships: membershipSummary.activeMembers,
      totalMembers: membershipSummary.totalMembers,
      rating: Number(gym?.analytics?.rating) || 0,
      ratingCount: Number(gym?.analytics?.ratingCount) || 0,
      monthlyPrice: Number(gym?.pricing?.monthlyPrice) || 0,
      monthlyMrp: Number(gym?.pricing?.monthlyMrp) || 0,
      currency: gym?.pricing?.currency || 'INR',
      listing: listing
        ? {
          id: listing._id,
          planCode: listing.planCode,
          amount: Number(listing.amount) || 0,
          currency: listing.currency || 'INR',
          status: listing.status,
          periodStart: listing.periodStart,
          periodEnd: listing.periodEnd,
          autoRenew: Boolean(listing.autoRenew),
        }
        : null,
      sponsorship: {
        status: gym?.sponsorship?.status || 'none',
        package: gym?.sponsorship?.package || '',
        expiresAt: gym?.sponsorship?.expiresAt || null,
      },
      createdAt: gym.createdAt,
    };
  });

  const traineeGymReviews = (traineeGymReviewDocs ?? []).map((entry) => ({
    id: entry._id,
    gym: toGymSummary(entry.gym),
    rating: Number(entry.rating) || 0,
    comment: entry.comment || '',
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  }));

  const traineeProductReviews = (traineeProductReviewDocs ?? []).map((entry) => ({
    id: entry._id,
    product: entry.product?._id
      ? {
        id: entry.product._id,
        name: entry.product.name,
        category: entry.product.category,
        price: Number(entry.product.price) || 0,
      }
      : null,
    rating: Number(entry.rating) || 0,
    title: entry.title || '',
    comment: entry.comment || '',
    isVerifiedPurchase: Boolean(entry.isVerifiedPurchase),
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  }));

  const trainerMemberships = (trainerMembershipDocs ?? []).map((membership) => ({
    id: membership._id,
    gym: toGymSummary(membership.gym),
    trainee: toUserSummary(membership.trainee),
    plan: membership.plan || 'monthly',
    status: membership.status,
    startDate: membership.startDate,
    endDate: membership.endDate,
  }));

  const trainerProgressAsTrainer = (trainerProgressAsTrainerDocs ?? []).map((progress) => ({
    id: progress._id,
    gym: toGymSummary(progress.gym),
    trainee: toUserSummary(progress.trainee),
    attendanceCount: Array.isArray(progress.attendance) ? progress.attendance.length : 0,
    progressMetricCount: Array.isArray(progress.progressMetrics) ? progress.progressMetrics.length : 0,
    feedbackCount: Array.isArray(progress.feedback) ? progress.feedback.length : 0,
    updatedAt: progress.updatedAt,
  }));

  const trainerProgressAsTrainee = (trainerProgressAsTraineeDocs ?? []).map((progress) => ({
    id: progress._id,
    gym: toGymSummary(progress.gym),
    trainer: toUserSummary(progress.trainer),
    attendanceCount: Array.isArray(progress.attendance) ? progress.attendance.length : 0,
    progressMetricCount: Array.isArray(progress.progressMetrics) ? progress.progressMetrics.length : 0,
    feedbackCount: Array.isArray(progress.feedback) ? progress.feedback.length : 0,
    updatedAt: progress.updatedAt,
  }));

  const ownerDerivedTotalRevenue = calculateRevenueShare(
    ownerMembershipRevenueAggregates?.[0]?.totalCollected,
    OWNER_REVENUE_SHARE,
  );
  const ownerDerivedRevenue30d = calculateRevenueShare(
    ownerMembershipRevenueAggregates?.[0]?.recentCollected,
    OWNER_REVENUE_SHARE,
  );
  const ownerTotalGyms = Number(gymsOwnedCount) || ownerGyms.length || 0;
  const ownerTotalImpressions = ownerGyms.reduce(
    (sum, gym) => sum + (Number(gym?.impressions) || 0),
    0,
  );
  const ownerTotalActiveMembers = ownerGyms.reduce(
    (sum, gym) => sum + (Number(gym?.memberships) || 0),
    0,
  );
  const ownerTotalRevenue = Number(ownerRevenueDocs?.[0]?.totalAmount) || ownerDerivedTotalRevenue;
  const ownerRevenue30d = Number(ownerRevenue30dDocs?.[0]?.totalAmount) || ownerDerivedRevenue30d;
  const ownerExpenseEntries = collectOwnerExpenseEntries({
    subscriptions: ownerSubscriptionDocs,
    gyms: ownerGymDocs,
  });
  const ownerMonthlySpend = ownerExpenseEntries
    .filter((entry) => entry.date >= thirtyDaysAgo)
    .reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0);
  const ownerPublishedGyms = ownerGyms.filter((gym) => gym.isPublished).length;
  const ownerSponsoredGyms = ownerGyms.filter((gym) => gym?.sponsorship?.status === 'active').length;
  const ownerActiveListingSubscriptions = ownerSubscriptions.filter((subscription) => ['active', 'grace'].includes(subscription.status)).length;
  const ownerExpiringSubscriptions = ownerSubscriptions.filter(
    (subscription) => subscription.daysRemaining !== null && subscription.daysRemaining <= 14,
  ).length;
  const sellerTotalUnitsSold = sellerOrders.reduce((sum, order) => sum + (Number(order?.itemsCount) || 0), 0);
  const sellerOrdersFulfilled = sellerOrders.filter((order) => order.status === 'delivered').length;
  const sellerActiveProducts = sellerProducts.filter(
    (product) => product.isPublished && product.status === 'available',
  ).length;
  const sellerReviewedProductsCount = sellerProducts.filter(
    (product) => Number(product?.reviewCount) > 0,
  ).length;
  const sellerCatalogStock = sellerProducts.reduce(
    (sum, product) => sum + (Number(product?.stock) || 0),
    0,
  );
  const sellerReviewAggregate = sellerProducts.reduce(
    (acc, product) => {
      const count = Number(product?.reviewCount) || 0;
      const average = Number(product?.averageRating) || 0;

      acc.totalReviews += count;
      acc.weightedRatings += average * count;
      return acc;
    },
    { totalReviews: 0, weightedRatings: 0 },
  );
  const sellerAverageRating = sellerReviewAggregate.totalReviews
    ? Number((sellerReviewAggregate.weightedRatings / sellerReviewAggregate.totalReviews).toFixed(1))
    : null;
  const derivedSellerRevenueTotal = derivedSellerRevenueEvents.reduce(
    (sum, entry) => sum + (Number(entry?.amount) || 0),
    0,
  );
  const sellerRevenueEventsCount = sellerRevenueEvents.length;
  const sellerTotalRevenue = Number(sellerRevenueDocs?.[0]?.totalAmount) || derivedSellerRevenueTotal;

  const enrichedUser = {
    ...user,
    id: user._id,
    memberships: Number(membershipCount) || user?.traineeMetrics?.activeMemberships || 0,
    orders: Number(orderCount) || 0,
    gymsOwned: Number(gymsOwnedCount) || ownerGyms.length || user?.ownerMetrics?.totalGyms || 0,
    ownerMetrics: {
      ...(user?.ownerMetrics ?? {}),
      totalGyms: ownerTotalGyms,
      totalImpressions: ownerTotalImpressions,
      totalRevenue: ownerTotalRevenue,
      totalActiveMembers: ownerTotalActiveMembers,
      monthlySpend: ownerMonthlySpend,
      monthlyEarnings: ownerRevenue30d,
      monthlyProfit: ownerRevenue30d - ownerMonthlySpend,
      publishedGyms: ownerPublishedGyms,
      sponsoredGyms: ownerSponsoredGyms,
      activeListingSubscriptions: ownerActiveListingSubscriptions,
      expiringSubscriptions: ownerExpiringSubscriptions,
    },
    sellerMetrics: {
      ...(user?.sellerMetrics ?? {}),
      totalRevenue: sellerTotalRevenue,
      ordersFulfilled: sellerOrdersFulfilled,
      productsCount: sellerProducts.length,
      ordersCount: Number(sellerOrdersCount) || sellerOrders.length,
      unitsSold: sellerTotalUnitsSold,
      activeProducts: sellerActiveProducts,
      reviewedProductsCount: sellerReviewedProductsCount,
      catalogStock: sellerCatalogStock,
      averageRating: sellerAverageRating,
      revenueEventsCount: sellerRevenueEventsCount,
    },
    trainerMetrics: {
      ...(user?.trainerMetrics ?? {}),
      activeTrainees: activeTrainees || user?.trainerMetrics?.activeTrainees || 0,
      associatedGyms: trainerGyms.length,
      assignmentsCount: trainerAssignments.length,
      progressRecordsCount: trainerProgressAsTrainer.length,
    },
    relationships: {
      primaryGym: toGymSummary(primaryGymDoc),
      traineeMemberships,
      trainerMemberships,
      trainerAssignments,
      trainerGyms,
      trainerTrainees,
      trainerProgressAsTrainer,
      trainerProgressAsTrainee,
      orderHistory: buildOrderSummary(recentOrders ?? []),
      traineeGymReviews,
      traineeProductReviews,
      sellerProducts,
      sellerOrders,
      sellerRevenueEvents,
      ownerGyms,
      ownerMemberships: ownerMemberships || [],
      ownerSubscriptions,
      ownerRevenueEvents,
    },
  };

  return res.status(200).json(
    new ApiResponse(200, { user: enrichedUser, adminToggles }, 'User details fetched successfully'),
  );
});

export const getAdminGyms = asyncHandler(async (_req, res) => {
  const gymsQuery = Gym.find()
    .sort({ createdAt: -1 })
    .limit(25)
    .populate({ path: 'owner', select: 'name email role' })
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

export const getAdminGymDetails = asyncHandler(async (req, res) => {
  const { gymId } = req.params;
  const parsedGymId = toObjectId(gymId);
  const gymIdString = String(parsedGymId || '');

  if (!parsedGymId) {
    throw new ApiError(400, 'Invalid gym id.');
  }

  const [gym, listingSubscriptionDocs, adminToggles] = await Promise.all([
    Gym.findById(parsedGymId)
      .populate({ path: 'owner', select: 'name email contactNumber role status profile' })
      .populate({ path: 'trainers', select: 'name email role status' })
      .populate({ path: 'lastUpdatedBy', select: 'name email role status' })
      .lean(),
    GymListingSubscription.find({ gym: parsedGymId }).sort({ createdAt: -1 }).lean(),
    loadAdminToggles(),
  ]);

  if (!gym) {
    throw new ApiError(404, 'Gym not found.');
  }

  const [membershipDocs, assignmentDocs, reviewCount, revenueDocs] = await Promise.all([
    GymMembership.find({ gym: parsedGymId })
      .sort({ createdAt: -1 })
      .populate({ path: 'trainee', select: 'name email role status profilePicture' })
      .populate({ path: 'trainer', select: 'name email role status profilePicture' })
      .lean(),
    TrainerAssignment.find({ gym: parsedGymId })
      .sort({ updatedAt: -1, createdAt: -1 })
      .populate({ path: 'trainer', select: 'name email role status profilePicture' })
      .populate({ path: 'trainees.trainee', select: 'name email role status profilePicture' })
      .lean(),
    Review.countDocuments({ gym: parsedGymId }),
    Revenue.find({
      $or: [
        { 'metadata.gymId': gymIdString },
        { 'metadata.gym': gymIdString },
      ],
    })
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  const toUserSummary = (entity) => (entity?._id
    ? { id: entity._id, name: entity.name, email: entity.email, role: entity.role, status: entity.status, profilePicture: entity.profilePicture || '' }
    : null);

  const activeMembershipDocs = membershipDocs.filter((membership) =>
    ACTIVE_GYM_MEMBERSHIP_STATUSES.includes(membership?.status));

  const memberships = activeMembershipDocs.map((m) => ({
    id: m._id,
    trainee: toUserSummary(m.trainee),
    trainer: toUserSummary(m.trainer),
    plan: m.plan || 'monthly',
    status: m.status,
    startDate: m.startDate,
    endDate: m.endDate,
    createdAt: m.createdAt,
    billingAmount: Number(m?.billing?.amount) || 0,
    billingCurrency: m?.billing?.currency || 'INR',
    billingStatus: m?.billing?.status || 'pending',
  }));

  const isTraineeRole = (role) => {
    const normalised = String(role || '').toLowerCase();
    return !normalised || ['trainee', 'user', 'member'].includes(normalised);
  };

  const assignments = assignmentDocs.map((a) => ({
    id: a._id,
    trainer: toUserSummary(a.trainer),
    status: a.status || 'pending',
    requestedAt: a.requestedAt || a.createdAt,
    approvedAt: a.approvedAt || null,
    trainees: (a.trainees ?? []).map((e) => ({
      trainee: toUserSummary(e.trainee),
      status: e.status || 'active',
      assignedAt: e.assignedAt,
    })),
  }));

  const activeAssignments = assignments.filter((a) => ['active', 'pending'].includes(a.status));

  const assignedTrainerMap = {};
  activeAssignments.forEach((a) => {
    if (a.trainer?.id) assignedTrainerMap[String(a.trainer.id)] = a.trainer;
  });

  const assignedTraineeMap = {};
  activeAssignments.forEach((a) => {
    (a.trainees ?? []).forEach((e) => {
      if (!e.trainee?.id || e.status !== 'active' || !isTraineeRole(e.trainee.role)) return;
      const key = String(e.trainee.id);
      if (!assignedTraineeMap[key]) assignedTraineeMap[key] = { ...e.trainee, assignmentCount: 0 };
      assignedTraineeMap[key].assignmentCount += 1;
    });
  });

  const traineeMap = {};
  memberships.forEach((m) => {
    if (m.trainee?.id && isTraineeRole(m.trainee.role)) traineeMap[String(m.trainee.id)] = m.trainee;
  });

  const trainerMap = {};
  (Array.isArray(gym.trainers) ? gym.trainers : []).forEach((t) => {
    const s = toUserSummary(t);
    if (s?.id) trainerMap[String(s.id)] = s;
  });
  memberships.forEach((m) => { if (m.trainer?.id) trainerMap[String(m.trainer.id)] = m.trainer; });
  Object.values(assignedTrainerMap).forEach((t) => { if (t?.id) trainerMap[String(t.id)] = t; });

  const analyticsRating = Number(gym.analytics?.rating ?? 0);
  const imageGallery = Array.isArray(gym.gallery) ? gym.gallery : [];
  const imageAssets = Array.isArray(gym.images) ? gym.images : [];
  const pricingSnapshot = buildGymPricingSnapshot(gym.pricing || {});
  const pricingPlans = pricingSnapshot.membershipPlans ?? [];
  const pricingCurrency = pricingSnapshot.currency || gym.pricing?.currency || 'INR';
  const defaultPricingPlan = getDefaultDisplayMembershipPlan(pricingPlans);
  const startingPricingPlan = getLowestPricedMembershipPlan(pricingPlans) || defaultPricingPlan;
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const impressionCounts30d = await getGymImpressionCountsSince([parsedGymId], thirtyDaysAgo);
  const impressions30d = getImpressionCountFromMap(impressionCounts30d, parsedGymId);

  const listingSubscriptions = (listingSubscriptionDocs ?? []).map((subscription) => {
    const invoices = (subscription.invoices ?? []).map((invoice, index) => ({
      id: `${subscription._id}-invoice-${index}`,
      amount: Number(invoice?.amount) || 0,
      currency: invoice?.currency || subscription.currency || pricingCurrency,
      paidOn: invoice?.paidOn || null,
      status: invoice?.status || 'paid',
      paymentReference: invoice?.paymentReference || '',
    }));
    const collectedTotal = invoices.length
      ? invoices.reduce((sum, invoice) => sum + (Number(invoice.amount) || 0), 0)
      : Number(subscription.amount) || 0;

    return {
      id: subscription._id,
      planCode: subscription.planCode,
      amount: Number(subscription.amount) || 0,
      currency: subscription.currency || pricingCurrency,
      status: subscription.status,
      periodStart: subscription.periodStart,
      periodEnd: subscription.periodEnd,
      autoRenew: Boolean(subscription.autoRenew),
      createdAt: subscription.createdAt,
      updatedAt: subscription.updatedAt,
      invoiceCount: invoices.length,
      collectedTotal,
      invoices,
      daysRemaining: subscription.periodEnd ? daysBetween(new Date(), subscription.periodEnd) : null,
      latestInvoice: invoices
        .slice()
        .sort((left, right) => new Date(right.paidOn || 0) - new Date(left.paidOn || 0))[0] || null,
    };
  });
  const latestListingSubscription = listingSubscriptions[0] ?? null;
  const listingRevenueEntries = buildListingRevenueEntries(listingSubscriptionDocs ?? []);
  const listingRevenueTotal = listingRevenueEntries.reduce(
    (sum, entry) => sum + (Number(entry.amount) || 0),
    0,
  );
  const listingRevenue30d = listingRevenueEntries.reduce((sum, entry) => {
    const date = toDate(entry.date);
    if (!date) {
      return sum;
    }
    return date >= thirtyDaysAgo ? sum + (Number(entry.amount) || 0) : sum;
  }, 0);

  const paidMembershipDocs = membershipDocs.filter((membership) =>
    !isTrainerPlanCode(membership?.plan)
    && isPaidBillingStatus(membership?.billing?.status)
    && (Number(membership?.billing?.amount) || 0) > 0);
  const paidMembershipRevenueTotal = paidMembershipDocs.reduce(
    (sum, membership) => sum + (Number(membership?.billing?.amount) || 0),
    0,
  );
  const paidMembershipRevenue30d = paidMembershipDocs.reduce((sum, membership) => {
    const date = toDate(membership?.startDate) || toDate(membership?.createdAt);
    if (!date) {
      return sum;
    }
    return date >= thirtyDaysAgo ? sum + (Number(membership?.billing?.amount) || 0) : sum;
  }, 0);
  const membershipStatusBreakdown = membershipDocs.reduce((acc, membership) => {
    if (isTrainerPlanCode(membership?.plan)) {
      return acc;
    }

    const status = membership?.status || 'unknown';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
  const membershipOfferingMap = pricingPlans.reduce((acc, plan) => {
    acc[plan.code] = {
      id: plan.code,
      planCode: plan.code,
      label: plan.label,
      durationMonths: plan.durationMonths,
      mrp: plan.mrp,
      configuredPrice: plan.price,
      currency: plan.currency || pricingCurrency,
      activeCount: 0,
      totalCount: 0,
      paidCount: 0,
      totalCollected: 0,
      latestPurchasedAt: null,
    };
    return acc;
  }, {});
  membershipDocs.reduce((acc, membership) => {
    if (isTrainerPlanCode(membership?.plan)) {
      return acc;
    }

    const planCode = membership?.plan || 'monthly';
    const key = String(planCode);
    const amount = Number(membership?.billing?.amount) || 0;
    const purchasedAt = membership?.startDate || membership?.createdAt || null;
    const definition = getMembershipPlanDefinition(planCode);

    if (!acc[key]) {
      acc[key] = {
        id: key,
        planCode,
        label: definition?.label || planCode,
        durationMonths: definition?.durationMonths || 1,
        mrp: 0,
        configuredPrice: 0,
        currency: membership?.billing?.currency || pricingCurrency,
        activeCount: 0,
        totalCount: 0,
        paidCount: 0,
        totalCollected: 0,
        latestPurchasedAt: null,
      };
    }

    acc[key].totalCount += 1;

    if (ACTIVE_GYM_MEMBERSHIP_STATUSES.includes(membership?.status)) {
      acc[key].activeCount += 1;
    }

    if (isPaidBillingStatus(membership?.billing?.status) && amount > 0) {
      acc[key].paidCount += 1;
      acc[key].totalCollected += amount;

      if (!acc[key].latestPurchasedAt || new Date(purchasedAt) > new Date(acc[key].latestPurchasedAt)) {
        acc[key].latestPurchasedAt = purchasedAt;
      }
    }

    return acc;
  }, membershipOfferingMap);
  const membershipOfferings = sortMembershipPlans(Object.values(membershipOfferingMap)
    .map((entry) => ({
      ...entry,
      discountPercent: Number(entry.mrp) > 0
        ? Math.round(((Number(entry.mrp) - Number(entry.configuredPrice || 0)) / Number(entry.mrp)) * 100)
        : 0,
      averageTicketSize: entry.paidCount ? Math.round(entry.totalCollected / entry.paidCount) : 0,
    }))
  );

  const revenueEvents = (revenueDocs ?? []).map((event) => ({
    id: event._id,
    type: event.type || 'other',
    amount: Number(event.amount) || 0,
    description: event.description || '',
    createdAt: event.createdAt,
    share: getMetadataValue(event.metadata, 'share'),
    planCode: getMetadataValue(event.metadata, 'planCode', 'plan'),
    tier: getMetadataValue(event.metadata, 'tier', 'package'),
    paymentReference: getMetadataValue(event.metadata, 'paymentReference'),
    memberId: getMetadataValue(event.metadata, 'memberId'),
    trainerId: getMetadataValue(event.metadata, 'trainerId'),
  }));
  const sponsorshipEvents = revenueEvents.filter((event) => event.type === 'sponsorship');
  const sponsorshipRevenueTotal = sponsorshipEvents.reduce(
    (sum, event) => sum + (Number(event.amount) || 0),
    0,
  );
  const sponsorshipRevenue30d = sponsorshipEvents.reduce((sum, event) => {
    const date = toDate(event.createdAt);
    if (!date) {
      return sum;
    }
    return date >= thirtyDaysAgo ? sum + (Number(event.amount) || 0) : sum;
  }, 0);
  const membershipShareEvents = revenueEvents.filter((event) => REVENUE_EARNING_TYPES.includes(event.type));
  const membershipGymShareTotal = membershipShareEvents.reduce((sum, event) => (
    event.share === 'gym' ? sum + (Number(event.amount) || 0) : sum
  ), 0);
  const membershipTrainerShareTotal = membershipShareEvents.reduce((sum, event) => (
    event.share === 'trainer' ? sum + (Number(event.amount) || 0) : sum
  ), 0);
  const revenueTrend = buildGymRevenueTrend({
    memberships: membershipDocs,
    listingEntries: listingRevenueEntries,
    sponsorshipEvents,
    referenceDate: new Date(),
  });
  const sponsorshipHistory = sponsorshipEvents.map((event) => ({
    id: event.id,
    amount: event.amount,
    createdAt: event.createdAt,
    description: event.description,
    tier: event.tier || null,
    paymentReference: event.paymentReference || '',
  }));
  const currentSponsorshipPackage = gym.sponsorship?.package || gym.sponsorship?.tier || sponsorshipHistory[0]?.tier || null;
  const currentSponsorshipExpiry = gym.sponsorship?.expiresAt || gym.sponsorship?.endDate || gym.sponsorExpiresAt || null;
  const membershipOfferSummary = {
    monthlyMrp: Number(pricingSnapshot.monthlyMrp) || 0,
    monthlyPrice: Number(pricingSnapshot.monthlyPrice) || 0,
    currency: pricingCurrency,
    discountPercent: Number(pricingSnapshot.monthlyMrp) > 0
      ? Math.round(
        ((Number(pricingSnapshot.monthlyMrp) - Number(pricingSnapshot.monthlyPrice || 0)) / Number(pricingSnapshot.monthlyMrp)) * 100,
      )
      : 0,
    configuredPlanCount: pricingPlans.length,
    configuredPlans: pricingPlans.map((plan) => ({
      code: plan.code,
      label: plan.label,
      durationMonths: plan.durationMonths,
      mrp: plan.mrp,
      price: plan.price,
      currency: plan.currency || pricingCurrency,
      isActive: plan.isActive !== false,
      discountPercent: Number(plan.mrp) > 0
        ? Math.round(((Number(plan.mrp) - Number(plan.price || 0)) / Number(plan.mrp)) * 100)
        : 0,
    })),
    defaultPlan: defaultPricingPlan
      ? {
        code: defaultPricingPlan.code,
        label: defaultPricingPlan.label,
        durationMonths: defaultPricingPlan.durationMonths,
        mrp: defaultPricingPlan.mrp,
        price: defaultPricingPlan.price,
        currency: defaultPricingPlan.currency || pricingCurrency,
      }
      : null,
    startingPlan: startingPricingPlan
      ? {
        code: startingPricingPlan.code,
        label: startingPricingPlan.label,
        durationMonths: startingPricingPlan.durationMonths,
        mrp: startingPricingPlan.mrp,
        price: startingPricingPlan.price,
        currency: startingPricingPlan.currency || pricingCurrency,
      }
      : null,
    activeCount: activeMembershipDocs.filter((membership) => !isTrainerPlanCode(membership?.plan)).length,
    paidCount: paidMembershipDocs.length,
    totalCollected: paidMembershipRevenueTotal,
    collectedLast30Days: paidMembershipRevenue30d,
    averageTicketSize: paidMembershipDocs.length ? Math.round(paidMembershipRevenueTotal / paidMembershipDocs.length) : 0,
    latestPurchasedAt: paidMembershipDocs[0]?.startDate || paidMembershipDocs[0]?.createdAt || null,
    statusBreakdown: membershipStatusBreakdown,
    offerings: membershipOfferings,
  };
  const listingSummary = {
    activeCount: listingSubscriptions.filter((subscription) => ['active', 'grace'].includes(subscription.status)).length,
    totalCount: listingSubscriptions.length,
    totalCollected: listingRevenueTotal,
    collectedLast30Days: listingRevenue30d,
    invoiceCount: listingSubscriptions.reduce((sum, subscription) => sum + (Number(subscription.invoiceCount) || 0), 0),
    autoRenewEnabled: listingSubscriptions.filter((subscription) => subscription.autoRenew).length,
    latestPlanCode: latestListingSubscription?.planCode || null,
    latestPeriodEnd: latestListingSubscription?.periodEnd || null,
  };
  const sponsorshipSummary = {
    status: gym.sponsorship?.status || 'none',
    package: currentSponsorshipPackage,
    amount: Number(gym.sponsorship?.amount ?? gym.sponsorship?.monthlyBudget) || 0,
    expiresAt: currentSponsorshipExpiry,
    totalCollected: sponsorshipRevenueTotal,
    collectedLast30Days: sponsorshipRevenue30d,
    purchases: sponsorshipHistory.length,
    latestPurchasedAt: sponsorshipHistory[0]?.createdAt || null,
  };
  const totalTrackedValue = paidMembershipRevenueTotal + listingRevenueTotal + sponsorshipRevenueTotal;

  const details = {
    id: gym._id,
    name: gym.name,
    description: gym.description || '',
    status: gym.status,
    isPublished: Boolean(gym.isPublished),
    isActive: Boolean(gym.isActive),
    approvalStatus: gym.approvalStatus || 'approved',
    createdAt: gym.createdAt,
    updatedAt: gym.updatedAt,
    approvedAt: gym.approvedAt || null,
    lastUpdatedBy: toUserSummary(gym.lastUpdatedBy),
    owner: gym.owner ? {
      id: gym.owner._id,
      name: gym.owner.name,
      email: gym.owner.email,
      contactNumber: gym.owner.contactNumber || '',
      role: gym.owner.role,
      status: gym.owner.status,
      profile: gym.owner.profile || {},
    } : null,
    trainers: Object.values(trainerMap),
    members: memberships,
    trainees: Object.values(traineeMap),
    assignments,
    assignedTrainers: Object.values(assignedTrainerMap),
    assignedTrainees: Object.values(assignedTraineeMap),
    location: { address: gym.location?.address || '', city: gym.location?.city || '', state: gym.location?.state || '', postalCode: gym.location?.postalCode || '', coordinates: gym.location?.coordinates || null },
    contact: { phone: gym.contact?.phone || '', email: gym.contact?.email || '', website: gym.contact?.website || '', whatsapp: gym.contact?.whatsapp || '' },
    pricing: {
      monthlyMrp: Number(pricingSnapshot.monthlyMrp) || 0,
      monthlyPrice: Number(pricingSnapshot.monthlyPrice) || 0,
      currency: pricingCurrency,
      plans: pricingPlans.map((plan) => ({
        code: plan.code,
        label: plan.label,
        durationMonths: plan.durationMonths,
        mrp: plan.mrp,
        price: plan.price,
        currency: plan.currency || pricingCurrency,
        isActive: plan.isActive !== false,
      })),
      defaultPlanCode: defaultPricingPlan?.code || null,
      startingAt: startingPricingPlan?.price || 0,
      startingAtMrp: startingPricingPlan?.mrp || 0,
      startingPlanCode: startingPricingPlan?.code || null,
    },
    schedule: { openTime: gym.schedule?.openTime || '', closeTime: gym.schedule?.closeTime || '', workingDays: Array.isArray(gym.schedule?.workingDays) ? gym.schedule.workingDays : [] },
    features: Array.isArray(gym.features) ? gym.features : [],
    amenities: Array.isArray(gym.amenities) ? gym.amenities : [],
    keyFeatures: Array.isArray(gym.keyFeatures) ? gym.keyFeatures : [],
    tags: Array.isArray(gym.tags) ? gym.tags : [],
    images: imageAssets,
    gallery: imageGallery,
    sponsorship: {
      status: gym.sponsorship?.status || 'none',
      package: currentSponsorshipPackage,
      amount: Number(gym.sponsorship?.amount ?? gym.sponsorship?.monthlyBudget) || 0,
      expiresAt: currentSponsorshipExpiry,
    },
    listingSubscription: latestListingSubscription ? {
      id: latestListingSubscription.id, planCode: latestListingSubscription.planCode, amount: Number(latestListingSubscription.amount) || 0,
      currency: latestListingSubscription.currency || pricingCurrency, status: latestListingSubscription.status, periodStart: latestListingSubscription.periodStart,
      periodEnd: latestListingSubscription.periodEnd, autoRenew: Boolean(latestListingSubscription.autoRenew),
      invoiceCount: Number(latestListingSubscription.invoiceCount) || 0,
    } : null,
    listingSubscriptions,
    sponsorshipHistory,
    subscriptionInsights: {
      memberships: membershipOfferSummary,
      listings: listingSummary,
      sponsorships: sponsorshipSummary,
    },
    revenue: {
      totals: {
        trackedValue: totalTrackedValue,
        membershipSubscriptions: paidMembershipRevenueTotal,
        listingSubscriptions: listingRevenueTotal,
        sponsorships: sponsorshipRevenueTotal,
        platformMonetisation: listingRevenueTotal + sponsorshipRevenueTotal,
        gymShare: membershipGymShareTotal,
        trainerShare: membershipTrainerShareTotal,
      },
      recent30Days: {
        trackedValue: paidMembershipRevenue30d + listingRevenue30d + sponsorshipRevenue30d,
        membershipSubscriptions: paidMembershipRevenue30d,
        listingSubscriptions: listingRevenue30d,
        sponsorships: sponsorshipRevenue30d,
      },
      counts: {
        paidMemberships: paidMembershipDocs.length,
        listingPurchases: listingSubscriptions.length,
        sponsorshipPurchases: sponsorshipHistory.length,
        revenueEvents: revenueEvents.length,
      },
      trend: {
        monthly: revenueTrend,
      },
      events: revenueEvents,
    },
    analytics: {
      impressions: Number(gym.analytics?.impressions) || 0,
      impressions30d,
      rating: Number(analyticsRating.toFixed(1)),
      ratingCount: Number(gym.analytics?.ratingCount) || Number(reviewCount) || 0,
      lastImpressionAt: gym.analytics?.lastImpressionAt || null,
      lastReviewAt: gym.analytics?.lastReviewAt || null,
    },
    metrics: {
      activeMembers: memberships.length,
      activeTrainers: Object.keys(trainerMap).length,
      totalTrainees: Object.keys(traineeMap).length,
      activeAssignments: activeAssignments.length,
      assignedTrainers: Object.keys(assignedTrainerMap).length,
      activeTrainees: Object.keys(assignedTraineeMap).length,
      imageAssets: imageAssets.length,
      galleryAssets: imageGallery.length,
      mediaAssets: imageAssets.length + imageGallery.length,
      reviewCount: Number(reviewCount) || 0,
      paidMemberships: paidMembershipDocs.length,
      listingSubscriptions: listingSubscriptions.length,
      revenueEvents: revenueEvents.length,
    },
  };

  return res.status(200).json(new ApiResponse(200, {
    gym: details,
    adminToggles,
    generatedAt: new Date(),
  }, 'Admin gym details fetched successfully'));
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
    .limit(20)
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
      subtotal: formatCurrency(order.subtotal, 'INR'),
      discountAmount: formatCurrency(order.discountAmount ?? 0, 'INR'),
      tax: formatCurrency(order.tax, 'INR'),
      shippingCost: formatCurrency(order.shippingCost, 'INR'),
      total: formatCurrency(order.total, 'INR'),
      status: summariseOrderStatus(order),
      paymentMethod: order.paymentMethod ?? 'Cash on Delivery',
      createdAt: order.createdAt,
      shippingAddress: order.shippingAddress ?? null,
      promo: order.promo
        ? {
            code: order.promo.code ?? '',
            label: order.promo.label ?? '',
            description: order.promo.description ?? '',
            discountAmount: formatCurrency(order.promo.discountAmount ?? 0, 'INR'),
          }
        : null,
      user: toContact(order.user),
      seller: toContact(sellerEntity),
      items: order.orderItems?.map((item) => ({
        id: item._id,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        category: item.product?.category,
        status: normaliseOrderItemStatus(item.status),
        tracking: buildOrderItemTrackingSnapshot(item),
        returnRequest: buildOrderItemReturnRequest(item),
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

export const getAdminOpsStatus = asyncHandler(async (_req, res) => {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  const observability = getObservabilitySnapshot();
  const cache = getCacheStatus();
  const search = getSearchStatus();
  const adminToggles = await loadAdminToggles();

  const staleSupportTicketHours = Math.max(1, Number(adminToggles?.staleSupportTicketHours) || 24);
  const shipmentBacklogHours = Math.max(1, Number(adminToggles?.shipmentBacklogHours) || 48);
  const searchQueueWarningDepth = Math.max(1, Number(adminToggles?.searchQueueWarningDepth) || 6);
  const auditSpikeThreshold = Math.max(1, Number(adminToggles?.auditSpikeThreshold) || 10);
  const supportQueueWarningDepth = Math.max(1, Number(adminToggles?.supportQueueWarningDepth) || 5);
  const staleSupportCutoff = new Date(now.getTime() - staleSupportTicketHours * 60 * 60 * 1000);
  const shipmentBacklogCutoff = new Date(now.getTime() - shipmentBacklogHours * 60 * 60 * 1000);

  const [
    openSupportTicketsCount,
    staleSupportTicketsCount,
    pendingBookings,
    todaysBookings,
    sellerShipmentBacklogCount,
    pendingReturnRequestsCount,
    recentAuditLogs,
    auditLast24HoursCount,
    auditPrevious24HoursCount,
  ] = await Promise.all([
    Contact.countDocuments({ status: { $in: ['new', 'read', 'in-progress', 'responded'] } }),
    Contact.countDocuments({
      status: { $in: ['new', 'read', 'in-progress', 'responded'] },
      updatedAt: { $lte: staleSupportCutoff },
    }),
    Booking.countDocuments({ status: 'pending' }),
    Booking.countDocuments({
      bookingDate: {
        $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
        $lte: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1),
      },
    }),
    Order.countDocuments({
      createdAt: { $lte: shipmentBacklogCutoff },
      'orderItems.status': 'processing',
    }),
    Order.countDocuments({ 'orderItems.returnRequest.status': 'requested' }),
    listAuditLogs({ limit: 10 }),
    AuditLog.countDocuments({ createdAt: { $gte: oneDayAgo } }),
    AuditLog.countDocuments({ createdAt: { $gte: twoDaysAgo, $lt: oneDayAgo } }),
  ]);

  const uptimeHours = Math.max(
    0,
    Math.round((Date.now() - new Date(observability.startedAt).getTime()) / (1000 * 60 * 60)),
  );

  const topRoutes = Object.entries(observability.requests?.byRoute ?? {})
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6)
    .map(([route, count]) => ({ route, count }));

  const topQueryOperations = Object.entries(observability.queries?.byOperation ?? {})
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6)
    .map(([operation, count]) => ({ operation, count }));

  const auditDelta = auditLast24HoursCount - auditPrevious24HoursCount;
  const alerts = [];

  if (search.configured && !search.ready) {
    alerts.push({
      id: 'search-down',
      severity: 'critical',
      title: 'Search indexing offline',
      message: 'Meilisearch is configured but not ready. Search-based discovery is degraded.',
    });
  }

  if (cache.redisConfigured && cache.provider === 'memory') {
    alerts.push({
      id: 'cache-fallback',
      severity: 'warning',
      title: 'Cache fallback active',
      message: 'Redis is configured but the platform is currently serving from memory cache.',
    });
  }

  if (staleSupportTicketsCount > 0) {
    alerts.push({
      id: 'support-backlog',
      severity: 'warning',
      title: 'Support follow-up backlog',
      message: `${staleSupportTicketsCount} support ticket${staleSupportTicketsCount === 1 ? ' is' : 's are'} idle for more than ${staleSupportTicketHours} hours.`,
    });
  }

  if (openSupportTicketsCount >= supportQueueWarningDepth) {
    alerts.push({
      id: 'support-volume',
      severity: 'info',
      title: 'Support queue depth rising',
      message: `${openSupportTicketsCount} open support ticket${openSupportTicketsCount === 1 ? '' : 's'} are in the queue, above the warning depth of ${supportQueueWarningDepth}.`,
    });
  }

  if (sellerShipmentBacklogCount > 0) {
    alerts.push({
      id: 'shipment-backlog',
      severity: 'warning',
      title: 'Seller shipment backlog',
      message: `${sellerShipmentBacklogCount} order${sellerShipmentBacklogCount === 1 ? '' : 's'} still have processing items older than ${shipmentBacklogHours} hours.`,
    });
  }

  if ((observability.queries?.slowSamples?.length ?? 0) > 0) {
    alerts.push({
      id: 'slow-queries',
      severity: 'info',
      title: 'Slow query samples captured',
      message: `${observability.queries.slowSamples.length} recent slow query sample${observability.queries.slowSamples.length === 1 ? '' : 's'} are available for inspection.`,
    });
  }

  if ((search.queue?.depth ?? 0) >= searchQueueWarningDepth) {
    alerts.push({
      id: 'search-queue',
      severity: 'warning',
      title: 'Search sync queue depth high',
      message: `${search.queue.depth} search sync job${search.queue.depth === 1 ? '' : 's'} are queued, above the warning depth of ${searchQueueWarningDepth}.`,
    });
  }

  if (auditLast24HoursCount >= auditSpikeThreshold || auditDelta >= auditSpikeThreshold) {
    alerts.push({
      id: 'audit-spike',
      severity: 'info',
      title: 'Audit activity spike detected',
      message: `${auditLast24HoursCount} audit event${auditLast24HoursCount === 1 ? '' : 's'} were captured in the last 24 hours with a delta of ${auditDelta} against the prior window.`,
    });
  }

  return res.status(200).json(new ApiResponse(200, {
    generatedAt: now,
    adminToggles,
    thresholds: {
      supportQueueWarningDepth,
      staleSupportTicketHours,
      shipmentBacklogHours,
      searchQueueWarningDepth,
      auditSpikeThreshold,
    },
    services: {
      uptimeHours,
      cache,
      search,
      requests: {
        total: observability.requests?.total ?? 0,
        averageDurationMs: observability.requests?.averageDurationMs ?? 0,
        maxDurationMs: observability.requests?.durationMsMax ?? 0,
        topRoutes,
      },
      queries: {
        total: observability.queries?.total ?? 0,
        averageDurationMs: observability.queries?.averageDurationMs ?? 0,
        maxDurationMs: observability.queries?.durationMsMax ?? 0,
        topOperations: topQueryOperations,
        slowSamples: observability.queries?.slowSamples ?? [],
      },
      httpCache: observability.httpCache ?? { freshResponses: 0, notModifiedResponses: 0 },
    },
    backlog: {
      openSupportTickets: openSupportTicketsCount,
      staleSupportTickets: staleSupportTicketsCount,
      pendingBookings,
      todaysBookings,
      sellerShipmentBacklog: sellerShipmentBacklogCount,
      pendingReturnRequests: pendingReturnRequestsCount,
    },
    audit: {
      last24Hours: auditLast24HoursCount,
      previous24Hours: auditPrevious24HoursCount,
      delta: auditDelta,
      recent: recentAuditLogs.map((log) => ({
        id: log._id,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        summary: log.summary,
        actor: log.actor ? {
          id: log.actor._id,
          name: log.actor.name,
          email: log.actor.email,
          role: log.actor.role,
        } : null,
        createdAt: log.createdAt,
      })),
    },
    alerts,
  }, 'Admin ops status fetched successfully'));
});

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
    newMessages,
    flaggedGyms,
    recentPending,
  ] = await Promise.all([
    User.countDocuments({ status: 'pending', role: { $in: ['seller', 'manager'] } }),
    User.countDocuments({ role: 'seller', status: 'active' }),
    User.countDocuments({ role: 'gym-owner', status: 'active' }),
    Gym.countDocuments({ status: 'active' }),
    Order.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
    Contact.countDocuments({ status: { $in: ['new', 'in-progress'] } }),
    Contact.countDocuments({ status: 'new' }),
    Gym.countDocuments({
      $or: [
        { isPublished: { $ne: true } },
        { status: { $ne: 'active' } },
      ],
    }),
    User.find({ status: 'pending', role: { $in: ['seller', 'manager'] } })
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
        newMessages,
        flaggedGyms,
      },
      recentPending,
    }, 'Manager overview fetched successfully.'),
  );
});

