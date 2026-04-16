import Gym from '../../models/gym.model.js';
import GymMembership from '../../models/gymMembership.model.js';
import Revenue from '../../models/revenue.model.js';
import { listAuditLogs } from '../../services/audit.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';
import { sendReportResponse } from '../../utils/reportExport.js';

const NON_BOOKABLE_PLAN_CODES = ['trainer-access', 'traineraccess', 'trainer'];

const formatMoney = (amount = 0, currency = 'INR') =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);

const formatDate = (value) => {
  if (!value) {
    return '';
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const formatDateTime = (value) => {
  if (!value) {
    return '';
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getMetadataValue = (metadata, ...keys) => {
  if (!metadata) {
    return '';
  }

  for (const key of keys) {
    if (metadata instanceof Map && metadata.has(key)) {
      return metadata.get(key);
    }
    if (typeof metadata.get === 'function') {
      try {
        const value = metadata.get(key);
        if (value !== undefined && value !== null && value !== '') {
          return value;
        }
      } catch (_error) {
        // Ignore map-like access failures.
      }
    }
    if (Object.prototype.hasOwnProperty.call(metadata, key)) {
      const value = metadata[key];
      if (value !== undefined && value !== null && value !== '') {
        return value;
      }
    }
  }

  return '';
};

const ensureReportFormat = (value) => {
  const format = String(value || 'csv').trim().toLowerCase();
  if (!['csv', 'pdf'].includes(format)) {
    throw new ApiError(400, 'Report format must be csv or pdf.');
  }
  return format;
};

const summarizeRevenueTypes = (events = []) =>
  events.reduce((acc, event) => {
    const key = String(event.type || 'other').trim().toLowerCase() || 'other';
    acc[key] = (acc[key] || 0) + (Number(event.amount) || 0);
    return acc;
  }, {});

const buildMembershipRenewalLookup = (memberships = []) => {
  const flags = {};
  const previousByMemberGym = new Map();

  [...memberships]
    .sort((left, right) => {
      const leftTime = new Date(left.startDate || left.createdAt || 0).getTime();
      const rightTime = new Date(right.startDate || right.createdAt || 0).getTime();
      return leftTime - rightTime;
    })
    .forEach((membership) => {
      const key = `${membership.trainee?._id || membership.trainee}-${membership.gym?._id || membership.gym}`;
      flags[String(membership._id)] = previousByMemberGym.has(key);
      previousByMemberGym.set(key, membership.startDate || membership.createdAt || new Date());
    });

  return flags;
};

export const exportAdminRevenueReport = asyncHandler(async (req, res) => {
  const format = ensureReportFormat(req.query?.format);
  const since = req.query?.since ? new Date(req.query.since) : (() => {
    const value = new Date();
    value.setMonth(value.getMonth() - 12);
    return value;
  })();

  const revenueEvents = await Revenue.find({
    createdAt: { $gte: since },
    type: { $ne: 'seller' },
  })
    .sort({ createdAt: -1 })
    .populate({ path: 'user', select: 'name email role' })
    .lean();

  const totalsByType = summarizeRevenueTypes(revenueEvents);
  const totalAmount = revenueEvents.reduce((sum, event) => sum + (Number(event.amount) || 0), 0);

  const columns = [
    { key: 'createdAt', label: 'Recorded At' },
    { key: 'type', label: 'Type' },
    { key: 'amount', label: 'Amount' },
    { key: 'user', label: 'Account' },
    { key: 'description', label: 'Description' },
    { key: 'reference', label: 'Reference' },
  ];

  const rows = revenueEvents.map((event) => ({
    createdAt: formatDateTime(event.createdAt),
    type: event.type || 'other',
    amount: formatMoney(event.amount, 'INR'),
    user: event.user?.name
      ? `${event.user.name}${event.user.email ? ` (${event.user.email})` : ''}`
      : 'Platform',
    description: event.description || '',
    reference: getMetadataValue(
      event.metadata,
      'paymentReference',
      'gymId',
      'orderId',
      'membershipId',
    ),
  }));

  const summary = [
    `Window starts: ${formatDate(since)}`,
    `Revenue events: ${revenueEvents.length}`,
    `Total tracked revenue: ${formatMoney(totalAmount, 'INR')}`,
    ...Object.entries(totalsByType)
      .sort((left, right) => right[1] - left[1])
      .map(([type, amount]) => `${type}: ${formatMoney(amount, 'INR')}`),
  ];

  return sendReportResponse(res, {
    format,
    fileBaseName: 'admin-revenue-report',
    title: 'FitSync Admin Revenue Report',
    summary,
    columns,
    rows,
  });
});

export const exportGymOwnerMembershipsReport = asyncHandler(async (req, res) => {
  const format = ensureReportFormat(req.query?.format);
  const requestedGymId = String(req.query?.gymId || '').trim();

  const gyms = await Gym.find({ owner: req.user?._id })
    .select('name location')
    .lean();

  const scopedGyms = requestedGymId
    ? gyms.filter((gym) => String(gym._id) === requestedGymId)
    : gyms;

  if (requestedGymId && !scopedGyms.length) {
    throw new ApiError(404, 'Gym not found for this owner.');
  }

  const gymIds = scopedGyms.map((gym) => gym._id);
  const memberships = await GymMembership.find({
    gym: { $in: gymIds },
    plan: { $nin: NON_BOOKABLE_PLAN_CODES },
  })
    .sort({ startDate: -1, createdAt: -1 })
    .populate({ path: 'gym', select: 'name location' })
    .populate({ path: 'trainee', select: 'name email' })
    .populate({ path: 'trainer', select: 'name email' })
    .lean();

  const renewalLookup = buildMembershipRenewalLookup(memberships);
  const totalBilled = memberships.reduce((sum, membership) => sum + (Number(membership.billing?.amount) || 0), 0);
  const renewalCount = memberships.filter((membership) => renewalLookup[String(membership._id)]).length;

  const columns = [
    { key: 'joinedAt', label: 'Joined' },
    { key: 'gym', label: 'Gym' },
    { key: 'member', label: 'Member' },
    { key: 'trainer', label: 'Trainer' },
    { key: 'plan', label: 'Plan' },
    { key: 'status', label: 'Status' },
    { key: 'renewal', label: 'Renewal' },
    { key: 'autoRenew', label: 'Auto Renew' },
    { key: 'billing', label: 'Billing' },
    { key: 'endDate', label: 'Ends' },
  ];

  const rows = memberships.map((membership) => ({
    joinedAt: formatDate(membership.startDate || membership.createdAt),
    gym: membership.gym?.name || 'Unknown gym',
    member: membership.trainee?.name
      ? `${membership.trainee.name}${membership.trainee.email ? ` (${membership.trainee.email})` : ''}`
      : 'Unknown member',
    trainer: membership.trainer?.name
      ? `${membership.trainer.name}${membership.trainer.email ? ` (${membership.trainer.email})` : ''}`
      : 'Unassigned',
    plan: membership.plan || '',
    status: membership.status || '',
    renewal: renewalLookup[String(membership._id)] ? 'Yes' : 'No',
    autoRenew: membership.autoRenew ? 'Enabled' : 'Disabled',
    billing: membership.billing ? formatMoney(membership.billing.amount, membership.billing.currency || 'INR') : '',
    endDate: formatDate(membership.endDate),
  }));

  const summary = [
    `Gyms covered: ${scopedGyms.length}`,
    `Membership records: ${memberships.length}`,
    `Renewals detected: ${renewalCount}`,
    `Total billed value: ${formatMoney(totalBilled, 'INR')}`,
  ];

  return sendReportResponse(res, {
    format,
    fileBaseName: 'gym-owner-memberships-report',
    title: 'FitSync Gym Membership Report',
    summary,
    columns,
    rows,
  });
});

export const exportGymOwnerSponsorshipsReport = asyncHandler(async (req, res) => {
  const format = ensureReportFormat(req.query?.format);
  const requestedGymId = String(req.query?.gymId || '').trim();

  const gyms = await Gym.find({ owner: req.user?._id })
    .select('name location sponsorship updatedAt')
    .lean();

  const scopedGyms = requestedGymId
    ? gyms.filter((gym) => String(gym._id) === requestedGymId)
    : gyms;

  if (requestedGymId && !scopedGyms.length) {
    throw new ApiError(404, 'Gym not found for this owner.');
  }

  const gymIds = scopedGyms.map((gym) => String(gym._id));
  const revenueEvents = await Revenue.find({
    user: req.user?._id,
    type: 'sponsorship',
  })
    .sort({ createdAt: -1 })
    .lean();

  const sponsorshipRevenueByGym = revenueEvents.reduce((acc, event) => {
    const gymId = String(getMetadataValue(event.metadata, 'gymId') || '');
    if (!gymId || (gymIds.length && !gymIds.includes(gymId))) {
      return acc;
    }

    if (!acc[gymId]) {
      acc[gymId] = {
        total: 0,
        lastPurchasedAt: null,
      };
    }

    acc[gymId].total += Number(event.amount) || 0;
    if (!acc[gymId].lastPurchasedAt || new Date(event.createdAt) > new Date(acc[gymId].lastPurchasedAt)) {
      acc[gymId].lastPurchasedAt = event.createdAt;
    }

    return acc;
  }, {});

  const sponsorshipRows = scopedGyms
    .filter((gym) => (
      (gym.sponsorship?.tier && gym.sponsorship.tier !== 'none')
      || sponsorshipRevenueByGym[String(gym._id)]
    ))
    .map((gym) => {
      const gymId = String(gym._id);
      const sponsorship = gym.sponsorship || {};
      const revenueSummary = sponsorshipRevenueByGym[gymId] || { total: 0, lastPurchasedAt: null };

      return {
        gym: gym.name,
        city: gym.location?.city || '',
        tier: sponsorship.tier || sponsorship.package || 'none',
        status: sponsorship.status || 'none',
        startDate: formatDate(sponsorship.startDate),
        endDate: formatDate(sponsorship.endDate || sponsorship.expiresAt),
        monthlyBudget: sponsorship.monthlyBudget ? formatMoney(sponsorship.monthlyBudget, 'INR') : '',
        lifetimeSpend: formatMoney(revenueSummary.total, 'INR'),
        lastPurchasedAt: formatDateTime(revenueSummary.lastPurchasedAt),
        lifetimeSpendAmount: revenueSummary.total,
      };
    });

  const totalSpend = sponsorshipRows.reduce((sum, row) => sum + (Number(row.lifetimeSpendAmount) || 0), 0);
  const rows = sponsorshipRows.map(({ lifetimeSpendAmount, ...row }) => row);

  const columns = [
    { key: 'gym', label: 'Gym' },
    { key: 'city', label: 'City' },
    { key: 'tier', label: 'Tier' },
    { key: 'status', label: 'Status' },
    { key: 'startDate', label: 'Started' },
    { key: 'endDate', label: 'Ends' },
    { key: 'monthlyBudget', label: 'Monthly Budget' },
    { key: 'lifetimeSpend', label: 'Lifetime Spend' },
    { key: 'lastPurchasedAt', label: 'Last Purchased' },
  ];

  const summary = [
    `Gyms covered: ${scopedGyms.length}`,
    `Tracked sponsorship rows: ${rows.length}`,
    `Total sponsorship spend: ${formatMoney(totalSpend, 'INR')}`,
  ];

  return sendReportResponse(res, {
    format,
    fileBaseName: 'gym-owner-sponsorships-report',
    title: 'FitSync Sponsorship Report',
    summary,
    columns,
    rows,
  });
});

export const exportAuditLogsReport = asyncHandler(async (req, res) => {
  const format = ensureReportFormat(req.query?.format);
  const { entityType, entityId, actor, action, search } = req.query ?? {};
  const limit = Math.min(Math.max(Number(req.query?.limit) || 100, 1), 500);

  const logs = await listAuditLogs({
    entityType,
    entityId,
    actor,
    action,
    search,
    limit,
  });

  const columns = [
    { key: 'createdAt', label: 'Timestamp' },
    { key: 'action', label: 'Action' },
    { key: 'entityType', label: 'Entity Type' },
    { key: 'entityId', label: 'Entity Id' },
    { key: 'actor', label: 'Actor' },
    { key: 'summary', label: 'Summary' },
    { key: 'metadata', label: 'Metadata' },
  ];

  const rows = logs.map((log) => ({
    createdAt: formatDateTime(log.createdAt),
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    actor: log.actor?.name
      ? `${log.actor.name}${log.actor.email ? ` (${log.actor.email})` : ''}`
      : (log.actorRole || 'System'),
    summary: log.summary || '',
    metadata: log.metadata ? JSON.stringify(log.metadata) : '',
  }));

  const summary = [
    `Exported logs: ${logs.length}`,
    entityType ? `Entity type filter: ${entityType}` : null,
    action ? `Action filter: ${action}` : null,
    search ? `Search filter: ${search}` : null,
  ].filter(Boolean);

  return sendReportResponse(res, {
    format,
    fileBaseName: 'admin-audit-log-report',
    title: 'FitSync Audit Log Report',
    summary,
    columns,
    rows,
  });
});
