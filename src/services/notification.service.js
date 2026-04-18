import Booking from '../models/booking.model.js';
import Contact from '../models/contact.model.js';
import Notification from '../models/notification.model.js';
import Order from '../models/order.model.js';
import GymMembership from '../models/gymMembership.model.js';

const ensureArray = (value) => (Array.isArray(value) ? value.filter(Boolean) : [value].filter(Boolean));

const toEntityId = (value) => {
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

const buildReminderKey = (...parts) =>
  parts
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(':');

const formatDateValue = (value, options = {}) =>
  new Date(value).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    ...options,
  });

const buildDateTimeFromBooking = (booking) => {
  if (!booking?.bookingDate) {
    return null;
  }

  const scheduledAt = new Date(booking.bookingDate);
  const [hours, minutes] = String(booking.startTime || '')
    .split(':')
    .map((token) => Number(token));

  if (Number.isFinite(hours) && Number.isFinite(minutes)) {
    scheduledAt.setHours(hours, minutes, 0, 0);
  }

  return Number.isNaN(scheduledAt.getTime()) ? null : scheduledAt;
};

const createUniqueNotifications = async (notifications = []) => {
  const prepared = [];
  const seenKeys = new Set();

  for (const notification of notifications) {
    const userId = toEntityId(notification?.user);
    const reminderKey = notification?.metadata?.reminderKey;

    if (!userId) {
      continue;
    }

    const dedupeKey = reminderKey
      ? `${userId}:${notification.type}:${reminderKey}`
      : `${userId}:${notification.type}:${notification.title}:${notification.message}`;

    if (seenKeys.has(dedupeKey)) {
      continue;
    }

    if (reminderKey) {
      // eslint-disable-next-line no-await-in-loop
      const exists = await Notification.exists({
        user: notification.user,
        type: notification.type,
        'metadata.reminderKey': reminderKey,
      });

      if (exists) {
        seenKeys.add(dedupeKey);
        continue;
      }
    }

    seenKeys.add(dedupeKey);
    prepared.push(notification);
  }

  if (!prepared.length) {
    return [];
  }

  return Notification.insertMany(prepared, { ordered: false });
};

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
      reminderKey: buildReminderKey('membership', membership._id, 'renewal'),
    },
  }));

  await createUniqueNotifications(notifications);
  await GymMembership.updateMany(
    { _id: { $in: memberships.map((membership) => membership._id) } },
    { $set: { renewalReminderSent: true } },
  );

  return notifications;
};

export const ensureSessionReminderNotifications = async (userId) => {
  if (!userId) {
    return [];
  }

  const now = new Date();
  const nextDay = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const bookings = await Booking.find({
    $or: [{ user: userId }, { trainer: userId }],
    status: { $in: ['pending', 'confirmed'] },
    bookingDate: {
      $gte: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1),
      $lte: nextDay,
    },
  })
    .populate({ path: 'gym', select: 'name' })
    .populate({ path: 'trainer', select: 'name' })
    .populate({ path: 'user', select: 'name' });

  const notifications = bookings.flatMap((booking) => {
    const scheduledAt = buildDateTimeFromBooking(booking);
    if (!scheduledAt || scheduledAt < now || scheduledAt > nextDay) {
      return [];
    }

    const trainerView = toEntityId(booking.trainer) === toEntityId(userId);
    const counterpartyName = trainerView ? booking.user?.name : booking.trainer?.name;
    const reminderKey = buildReminderKey('booking', booking._id, trainerView ? 'trainer' : 'trainee', 'upcoming');

    return [{
      user: userId,
      type: 'session-reminder',
      title: trainerView ? 'Upcoming coaching session' : 'Upcoming training session',
      message: `${trainerView ? 'Session with' : 'Your session with'} ${counterpartyName ?? 'your coach'} at ${booking.gym?.name ?? booking.gymName ?? 'the gym'} starts ${formatDateValue(scheduledAt)}.`,
      link: trainerView ? '/dashboard/trainer/updates' : '/dashboard/trainee/sessions',
      metadata: {
        bookingId: booking._id,
        gymId: booking.gym?._id ?? booking.gym ?? null,
        scheduledAt,
        reminderKey,
      },
    }];
  });

  return createUniqueNotifications(notifications);
};

export const ensureOrderReminderNotifications = async (userId) => {
  if (!userId) {
    return [];
  }

  const now = new Date();
  const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const [buyerOrders, sellerOrders] = await Promise.all([
    Order.find({
      user: userId,
      createdAt: { $gte: fourteenDaysAgo },
      orderItems: { $elemMatch: { status: { $in: ['in-transit', 'out-for-delivery'] } } },
    }).select('orderNumber orderItems createdAt'),
    Order.find({
      createdAt: { $gte: fourteenDaysAgo },
      'orderItems.seller': userId,
    }).select('orderNumber orderItems createdAt'),
  ]);

  const buyerNotifications = buyerOrders.flatMap((order) => {
    const hasOutForDelivery = (order.orderItems ?? []).some((item) => item?.status === 'out-for-delivery');
    const hasInTransit = (order.orderItems ?? []).some((item) => item?.status === 'in-transit');
    const stage = hasOutForDelivery ? 'out-for-delivery' : hasInTransit ? 'in-transit' : null;

    if (!stage) {
      return [];
    }

    return [{
      user: userId,
      type: 'order-reminder',
      title: stage === 'out-for-delivery' ? 'Order out for delivery' : 'Order in transit',
      message: stage === 'out-for-delivery'
        ? `Order ${order.orderNumber ?? order._id} is out for delivery today.`
        : `Order ${order.orderNumber ?? order._id} is in transit. Track it from your orders dashboard.`,
      link: '/dashboard/trainee/orders',
      metadata: {
        orderId: order._id,
        stage,
        reminderKey: buildReminderKey('buyer-order', order._id, stage),
      },
    }];
  });

  const sellerNotifications = sellerOrders.flatMap((order) => {
    if (!order?.createdAt || order.createdAt > twoDaysAgo) {
      return [];
    }

    const pendingItems = ensureArray(order.orderItems).filter((item) =>
      toEntityId(item?.seller) === toEntityId(userId) && item?.status === 'processing');

    if (!pendingItems.length) {
      return [];
    }

    return [{
      user: userId,
      type: 'order-reminder',
      title: 'Fulfillment follow-up',
      message: `Order ${order.orderNumber ?? order._id} still has ${pendingItems.length} item${pendingItems.length === 1 ? '' : 's'} waiting to ship.`,
      link: '/dashboard/seller/orders',
      metadata: {
        orderId: order._id,
        pendingItems: pendingItems.length,
        reminderKey: buildReminderKey('seller-order', order._id, 'fulfillment'),
      },
    }];
  });

  return createUniqueNotifications([...buyerNotifications, ...sellerNotifications]);
};

export const ensureSupportReminderNotifications = async (userId, role = '') => {
  if (!userId) {
    return [];
  }

  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const tickets = await Contact.find({
    assignedTo: userId,
    status: { $in: ['new', 'read', 'in-progress', 'responded'] },
    updatedAt: { $lte: oneDayAgo },
  })
    .select('subject status priority updatedAt gym')
    .populate({ path: 'gym', select: 'name' });

  const dashboardPath = role === 'manager' ? '/dashboard/manager/messages' : '/dashboard/admin/messages';

  const notifications = tickets.map((ticket) => {
    const idleHours = Math.max(1, Math.round((now - new Date(ticket.updatedAt)) / (1000 * 60 * 60)));
    return {
      user: userId,
      type: 'support-reminder',
      title: 'Support follow-up needed',
      message: `${ticket.subject || 'Assigned support ticket'} has been idle for ${idleHours} hour${idleHours === 1 ? '' : 's'} in ${ticket.status}.`,
      link: dashboardPath,
      metadata: {
        contactId: ticket._id,
        gymId: ticket.gym?._id ?? ticket.gym ?? null,
        priority: ticket.priority,
        reminderKey: buildReminderKey('support', ticket._id, ticket.status),
      },
    };
  });

  return createUniqueNotifications(notifications);
};

export const listNotificationsForUser = async (userContext, { limit = 25, unreadOnly = false } = {}) => {
  const userId = userContext?._id ?? userContext;
  const role = userContext?.role ?? '';

  await Promise.all([
    ensureMembershipReminderNotifications(userId),
    ensureSessionReminderNotifications(userId),
    ensureOrderReminderNotifications(userId),
    ensureSupportReminderNotifications(userId, role),
  ]);

  const filter = { user: userId };
  if (unreadOnly) {
    filter.readAt = null;
  }

  const [notifications, unreadCount] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean(),
    Notification.countDocuments({ user: userId, readAt: null }),
  ]);

  return { notifications, unreadCount };
};
