import Notification from '../models/notification.model.js';
import GymMembership from '../models/gymMembership.model.js';

const ensureArray = (value) => (Array.isArray(value) ? value.filter(Boolean) : [value].filter(Boolean));

export const createNotification = async (notification, options = {}) => {
  if (!notification?.user) {
    return null;
  }

  const [created] = await Notification.create([notification], options.session ? { session: options.session } : undefined);
  return created;
};

export const createNotifications = async (notifications = [], options = {}) => {
  const valid = notifications.filter((entry) => entry?.user);
  if (!valid.length) {
    return [];
  }

  return Notification.insertMany(valid, options.session ? { session: options.session, ordered: false } : { ordered: false });
};

export const markNotificationsRead = async ({ userId, ids = [] }) => {
  if (!userId) {
    return { modifiedCount: 0 };
  }

  const filter = { user: userId, readAt: null };
  if (ids.length) {
    filter._id = { $in: ids };
  }

  return Notification.updateMany(filter, { $set: { readAt: new Date() } });
};

export const ensureMembershipReminderNotifications = async (userId) => {
  if (!userId) {
    return [];
  }

  const now = new Date();
  const inSevenDays = new Date(now);
  inSevenDays.setDate(inSevenDays.getDate() + 7);

  const memberships = await GymMembership.find({
    trainee: userId,
    status: { $in: ['active', 'paused'] },
    endDate: { $gte: now, $lte: inSevenDays },
    renewalReminderSent: false,
  })
    .populate({ path: 'gym', select: 'name' });

  if (!memberships.length) {
    return [];
  }

  const notifications = memberships.map((membership) => ({
    user: membership.trainee,
    type: 'membership-reminder',
    title: 'Membership renewal reminder',
    message: `${membership.gym?.name ?? 'Your gym'} membership expires on ${new Date(membership.endDate).toLocaleDateString('en-IN')}.`,
    link: membership.gym?._id ? `/gyms/${membership.gym._id}` : null,
    metadata: {
      membershipId: membership._id,
      gymId: membership.gym?._id ?? null,
      expiresAt: membership.endDate,
    },
  }));

  await createNotifications(notifications);
  await GymMembership.updateMany(
    { _id: { $in: memberships.map((membership) => membership._id) } },
    { $set: { renewalReminderSent: true } },
  );

  return notifications;
};

export const listNotificationsForUser = async (userId, { limit = 25, unreadOnly = false } = {}) => {
  await ensureMembershipReminderNotifications(userId);

  const filter = { user: userId };
  if (unreadOnly) {
    filter.readAt = null;
  }

  return Notification.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};
