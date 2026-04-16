import mongoose from 'mongoose';
import Booking from '../../models/booking.model.js';
import GymMembership from '../../models/gymMembership.model.js';
import TrainerAvailability from '../../models/trainerAvailability.model.js';
import { createNotifications } from '../../services/notification.service.js';
import { recordAuditLog } from '../../services/audit.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';

const ACTIVE_MEMBERSHIP_STATUSES = ['active', 'paused'];
const ACTIVE_BOOKING_STATUSES = ['pending', 'confirmed'];
const TRAINEE_ROLES = ['trainee', 'member'];
const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const NON_BOOKABLE_PLAN_CODES = ['trainer-access', 'traineraccess', 'trainer'];

const toObjectId = (value, label) => {
  if (!value) {
    throw new ApiError(400, `${label} is required.`);
  }

  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new ApiError(400, `${label} is invalid.`);
  }

  return new mongoose.Types.ObjectId(value);
};

const parseDateOnly = (value, label = 'Booking date') => {
  if (!value) {
    throw new ApiError(400, `${label} is required.`);
  }

  const [year, month, day] = String(value).split('-').map(Number);
  if (!year || !month || !day) {
    throw new ApiError(400, `${label} is invalid.`);
  }

  const normalized = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
  if (Number.isNaN(normalized.getTime())) {
    throw new ApiError(400, `${label} is invalid.`);
  }

  return normalized;
};

const startOfUtcDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
};

const endOfUtcDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
};

const addUtcDays = (value, days) => {
  const date = startOfUtcDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
};

const formatDateKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString().slice(0, 10);
};

const buildUtcDateTime = (dateValue, timeValue = '00:00') => {
  const date = dateValue instanceof Date ? dateValue : parseDateOnly(dateValue);
  const [hours, minutes] = String(timeValue || '00:00').split(':').map(Number);

  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    Number.isFinite(hours) ? hours : 0,
    Number.isFinite(minutes) ? minutes : 0,
    0,
    0,
  ));
};

const normalizeSlotValue = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, '-');

const buildAvailabilitySlotKey = (slot = {}) => [
  slot.dayOfWeek,
  slot.startTime,
  slot.endTime,
  normalizeSlotValue(slot.sessionType || 'personal-training'),
  normalizeSlotValue(slot.locationLabel || 'gym-floor'),
].join('|');

const toUserSummary = (user) => (user?._id
  ? {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      profilePicture: user.profilePicture ?? null,
    }
  : null);

const toGymSummary = (gym) => (gym?._id
  ? {
      id: String(gym._id),
      name: gym.name,
      city: gym.location?.city ?? '',
      address: gym.location?.address ?? '',
    }
  : null);

const mapBooking = (booking) => ({
  id: String(booking._id),
  status: booking.status,
  day: booking.day,
  startTime: booking.startTime,
  endTime: booking.endTime,
  bookingDate: booking.bookingDate,
  availabilitySlotKey: booking.availabilitySlotKey,
  timezone: booking.timezone || 'Asia/Calcutta',
  sessionType: booking.sessionType || 'personal-training',
  locationLabel: booking.locationLabel || '',
  type: booking.type,
  paymentStatus: booking.paymentStatus,
  price: booking.price ?? 0,
  notes: booking.notes || '',
  cancellationReason: booking.cancellationReason || '',
  gym: booking.gym?._id
    ? toGymSummary(booking.gym)
    : {
        id: String(booking.gym),
        name: booking.gymName,
      },
  trainee: toUserSummary(booking.user),
  trainer: toUserSummary(booking.trainer),
  createdAt: booking.createdAt,
  updatedAt: booking.updatedAt,
});

const loadBookableMembership = async ({ userId, gymId = null, trainerId = null } = {}) => {
  const filter = {
    trainee: userId,
    status: { $in: ACTIVE_MEMBERSHIP_STATUSES },
    plan: {
      $nin: NON_BOOKABLE_PLAN_CODES,
    },
  };

  if (gymId) {
    filter.gym = gymId;
  }
  if (trainerId) {
    filter.trainer = trainerId;
  }

  return GymMembership.findOne(filter)
    .sort({ createdAt: -1 })
    .populate({ path: 'gym', select: 'name location' })
    .populate({ path: 'trainer', select: 'name email role profilePicture' })
    .lean();
};

const loadAvailabilityForMembership = async (membership) => {
  if (!membership?.trainer?._id || !membership?.gym?._id) {
    return null;
  }

  return TrainerAvailability.findOne({
    trainer: membership.trainer._id,
    gym: membership.gym._id,
  })
    .populate({ path: 'gym', select: 'name location' })
    .lean();
};

const ensureFutureSlot = ({ bookingDate, startTime }) => {
  const startAt = buildUtcDateTime(bookingDate, startTime);
  if (startAt.getTime() <= Date.now()) {
    throw new ApiError(422, 'You can only book future session slots.');
  }
};

const buildCapacityLookup = (bookings = []) =>
  bookings.reduce((acc, booking) => {
    const dateKey = formatDateKey(booking.bookingDate);
    const slotKey = booking.availabilitySlotKey || [
      booking.day,
      booking.startTime,
      booking.endTime,
      normalizeSlotValue(booking.sessionType || 'personal-training'),
      normalizeSlotValue(booking.locationLabel || 'gym-floor'),
    ].join('|');
    const key = `${dateKey}::${slotKey}`;

    if (!acc[key]) {
      acc[key] = {
        bookedCount: 0,
        myBooking: null,
      };
    }

    acc[key].bookedCount += 1;
    if (booking.user) {
      acc[key].myBooking = booking;
    }

    return acc;
  }, {});

const buildMembershipSummary = (membership) => {
  if (!membership) {
    return null;
  }

  return {
    id: String(membership._id),
    status: membership.status,
    plan: membership.plan,
    gym: toGymSummary(membership.gym),
    trainer: toUserSummary(membership.trainer),
    endDate: membership.endDate,
  };
};

const resolveStatusTransition = ({ actorRole, currentStatus, nextStatus }) => {
  const role = String(actorRole || '').trim().toLowerCase();

  if (TRAINEE_ROLES.includes(role)) {
    if (nextStatus !== 'cancelled') {
      throw new ApiError(403, 'Trainees can only cancel their own bookings.');
    }
    if (!['pending', 'confirmed'].includes(currentStatus)) {
      throw new ApiError(409, 'Only upcoming bookings can be cancelled.');
    }
    return true;
  }

  if (role === 'trainer') {
    const allowedTransitions = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['completed', 'cancelled'],
      completed: [],
      cancelled: [],
    };

    if (!allowedTransitions[currentStatus]?.includes(nextStatus)) {
      throw new ApiError(409, `Cannot change booking from ${currentStatus} to ${nextStatus}.`);
    }

    return true;
  }

  throw new ApiError(403, 'You do not have permission to change this booking.');
};

export const getAvailableBookingSlots = asyncHandler(async (req, res) => {
  const gymId = req.query?.gymId ? toObjectId(req.query.gymId, 'Gym id') : null;
  const trainerId = req.query?.trainerId ? toObjectId(req.query.trainerId, 'Trainer id') : null;
  const days = Math.min(Math.max(Number(req.query?.days) || 14, 1), 31);
  const fromDate = req.query?.from ? parseDateOnly(req.query.from, 'Start date') : startOfUtcDate(new Date());

  const membership = await loadBookableMembership({
    userId: req.user?._id,
    gymId,
    trainerId,
  });

  if (!membership) {
    return res.status(200).json(
      new ApiResponse(
        200,
        { membership: null, slots: [], timezone: 'Asia/Calcutta', notes: '' },
        'No active membership is available for booking.',
      ),
    );
  }

  const availability = await loadAvailabilityForMembership(membership);
  if (!availability?.slots?.length) {
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          membership: buildMembershipSummary(membership),
          slots: [],
          timezone: availability?.timezone || 'Asia/Calcutta',
          notes: availability?.notes || '',
        },
        'No trainer availability has been published yet.',
      ),
    );
  }

  const lastDate = addUtcDays(fromDate, days - 1);
  const bookedSlots = await Booking.find({
    trainer: membership.trainer._id,
    gym: membership.gym._id,
    bookingDate: {
      $gte: startOfUtcDate(fromDate),
      $lte: endOfUtcDate(lastDate),
    },
    status: { $in: ACTIVE_BOOKING_STATUSES },
  })
    .select('availabilitySlotKey bookingDate status startTime endTime day sessionType locationLabel user')
    .lean();

  const capacityLookup = buildCapacityLookup(
    bookedSlots.map((booking) => ({
      ...booking,
      user: String(booking.user) === String(req.user?._id) ? booking.user : null,
    })),
  );

  const slots = [];
  for (let offset = 0; offset < days; offset += 1) {
    const date = addUtcDays(fromDate, offset);
    const dayOfWeek = date.getUTCDay();
    const dayName = DAY_NAMES[dayOfWeek];

    availability.slots
      .filter((slot) => Number(slot.dayOfWeek) === dayOfWeek)
      .forEach((slot) => {
        const slotKey = buildAvailabilitySlotKey(slot);
        const lookupKey = `${formatDateKey(date)}::${slotKey}`;
        const slotUsage = capacityLookup[lookupKey] ?? { bookedCount: 0, myBooking: null };
        const capacity = Math.max(Number(slot.capacity) || 1, 1);
        const remainingCapacity = Math.max(capacity - slotUsage.bookedCount, 0);
        const startsAt = buildUtcDateTime(date, slot.startTime);

        if (startsAt.getTime() <= Date.now()) {
          return;
        }

        slots.push({
          date: formatDateKey(date),
          bookingDate: date,
          day: dayName,
          startTime: slot.startTime,
          endTime: slot.endTime,
          availabilitySlotKey: slotKey,
          sessionType: slot.sessionType || 'personal-training',
          locationLabel: slot.locationLabel || '',
          timezone: availability.timezone || 'Asia/Calcutta',
          capacity,
          bookedCount: slotUsage.bookedCount,
          remainingCapacity,
          isSoldOut: remainingCapacity <= 0,
          myBooking: slotUsage.myBooking
            ? {
                status: slotUsage.myBooking.status,
              }
            : null,
        });
      });
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        membership: buildMembershipSummary(membership),
        slots,
        timezone: availability.timezone || 'Asia/Calcutta',
        notes: availability.notes || '',
      },
      'Available trainer sessions fetched successfully.',
    ),
  );
});

export const getMyBookings = asyncHandler(async (req, res) => {
  const statuses = String(req.query?.statuses || '')
    .split(',')
    .map((status) => status.trim().toLowerCase())
    .filter(Boolean);
  const role = String(req.user?.role || '').trim().toLowerCase();
  const upcomingOnly = String(req.query?.upcomingOnly || '').trim().toLowerCase() === 'true';
  const limit = Math.min(Math.max(Number(req.query?.limit) || 50, 1), 200);

  const filter = role === 'trainer'
    ? { trainer: req.user?._id }
    : { user: req.user?._id };

  if (statuses.length) {
    filter.status = { $in: statuses };
  }
  if (upcomingOnly) {
    filter.bookingDate = { $gte: startOfUtcDate(new Date()) };
  }

  const bookings = await Booking.find(filter)
    .sort({ bookingDate: 1, startTime: 1, createdAt: -1 })
    .limit(limit)
    .populate({ path: 'user', select: 'name email role profilePicture' })
    .populate({ path: 'trainer', select: 'name email role profilePicture' })
    .populate({ path: 'gym', select: 'name location' })
    .lean();

  const summary = bookings.reduce((acc, booking) => {
    acc.total += 1;
    acc[booking.status] = (acc[booking.status] || 0) + 1;
    return acc;
  }, {
    total: 0,
    pending: 0,
    confirmed: 0,
    cancelled: 0,
    completed: 0,
  });

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        bookings: bookings.map(mapBooking),
        summary,
      },
      'Bookings fetched successfully.',
    ),
  );
});

export const createBooking = asyncHandler(async (req, res) => {
  const gymId = toObjectId(req.body?.gymId, 'Gym id');
  const trainerId = toObjectId(req.body?.trainerId, 'Trainer id');
  const bookingDate = parseDateOnly(req.body?.bookingDate);
  const requestedSlotKey = String(req.body?.availabilitySlotKey || '').trim();
  const notes = String(req.body?.notes || '').trim();
  const type = String(req.body?.type || 'in-person').trim().toLowerCase();

  if (!requestedSlotKey) {
    throw new ApiError(400, 'Availability slot key is required.');
  }

  if (!['in-person', 'virtual'].includes(type)) {
    throw new ApiError(400, 'Booking type must be in-person or virtual.');
  }

  const membership = await loadBookableMembership({
    userId: req.user?._id,
    gymId,
    trainerId,
  });

  if (!membership) {
    throw new ApiError(403, 'You need an active gym membership with this trainer before booking a session.');
  }

  const availability = await loadAvailabilityForMembership(membership);
  if (!availability?.slots?.length) {
    throw new ApiError(422, 'This trainer has not published availability yet.');
  }

  const slot = availability.slots.find(
    (entry) => buildAvailabilitySlotKey(entry) === requestedSlotKey,
  );

  if (!slot) {
    throw new ApiError(404, 'The selected availability slot is no longer available.');
  }

  if (Number(slot.dayOfWeek) !== bookingDate.getUTCDay()) {
    throw new ApiError(422, 'The chosen booking date does not match the trainer availability slot.');
  }

  ensureFutureSlot({ bookingDate, startTime: slot.startTime });

  const capacity = Math.max(Number(slot.capacity) || 1, 1);
  const existingBookings = await Booking.countDocuments({
    trainer: trainerId,
    gym: gymId,
    bookingDate: {
      $gte: startOfUtcDate(bookingDate),
      $lte: endOfUtcDate(bookingDate),
    },
    availabilitySlotKey: requestedSlotKey,
    status: { $in: ACTIVE_BOOKING_STATUSES },
  });

  if (existingBookings >= capacity) {
    throw new ApiError(409, 'This session is already fully booked.');
  }

  const duplicateBooking = await Booking.exists({
    user: req.user?._id,
    trainer: trainerId,
    gym: gymId,
    bookingDate: {
      $gte: startOfUtcDate(bookingDate),
      $lte: endOfUtcDate(bookingDate),
    },
    availabilitySlotKey: requestedSlotKey,
    status: { $in: ACTIVE_BOOKING_STATUSES },
  });

  if (duplicateBooking) {
    throw new ApiError(409, 'You already have a booking request for this session.');
  }

  const booking = await Booking.create({
    user: req.user?._id,
    trainer: trainerId,
    gym: gymId,
    gymName: membership.gym?.name || 'Gym session',
    availabilitySlotKey: requestedSlotKey,
    day: DAY_NAMES[Number(slot.dayOfWeek)],
    startTime: slot.startTime,
    endTime: slot.endTime,
    bookingDate,
    timezone: availability.timezone || 'Asia/Calcutta',
    sessionType: slot.sessionType || 'personal-training',
    locationLabel: slot.locationLabel || '',
    status: 'pending',
    type,
    paymentStatus: 'free',
    price: 0,
    notes,
  });

  const populatedBooking = await Booking.findById(booking._id)
    .populate({ path: 'user', select: 'name email role profilePicture' })
    .populate({ path: 'trainer', select: 'name email role profilePicture' })
    .populate({ path: 'gym', select: 'name location' });

  await Promise.all([
    createNotifications([
      {
        user: membership.trainer?._id,
        type: 'booking-requested',
        title: 'New session booking request',
        message: `${req.user?.name ?? 'A trainee'} requested a session on ${formatDateKey(bookingDate)} at ${slot.startTime}.`,
        link: '/dashboard/trainer/updates',
        metadata: { bookingId: booking._id, gymId, traineeId: req.user?._id },
      },
      {
        user: req.user?._id,
        type: 'booking-pending',
        title: 'Session request submitted',
        message: `Your session request for ${membership.gym?.name ?? 'the gym'} is awaiting trainer confirmation.`,
        link: '/dashboard/trainee/sessions',
        metadata: { bookingId: booking._id, gymId, trainerId },
      },
    ]),
    recordAuditLog({
      actor: req.user?._id,
      actorRole: req.user?.role,
      action: 'booking.created',
      entityType: 'booking',
      entityId: booking._id,
      summary: 'Session booking requested',
      metadata: {
        gymId: String(gymId),
        trainerId: String(trainerId),
        date: formatDateKey(bookingDate),
        slot: requestedSlotKey,
      },
    }),
  ]);

  return res.status(201).json(
    new ApiResponse(
      201,
      {
        booking: mapBooking(populatedBooking),
        remainingCapacity: Math.max(capacity - existingBookings - 1, 0),
      },
      'Session booking request created successfully.',
    ),
  );
});

export const updateBookingStatus = asyncHandler(async (req, res) => {
  const bookingId = toObjectId(req.params.bookingId, 'Booking id');
  const nextStatus = String(req.body?.status || '').trim().toLowerCase();

  if (!nextStatus) {
    throw new ApiError(400, 'Next booking status is required.');
  }

  const booking = await Booking.findById(bookingId)
    .populate({ path: 'user', select: 'name email role profilePicture' })
    .populate({ path: 'trainer', select: 'name email role profilePicture' })
    .populate({ path: 'gym', select: 'name location' });

  if (!booking) {
    throw new ApiError(404, 'Booking not found.');
  }

  const role = String(req.user?.role || '').trim().toLowerCase();
  if (role === 'trainer' && String(booking.trainer?._id || booking.trainer) !== String(req.user?._id)) {
    throw new ApiError(403, 'You can only manage bookings assigned to you.');
  }
  if (TRAINEE_ROLES.includes(role) && String(booking.user?._id || booking.user) !== String(req.user?._id)) {
    throw new ApiError(403, 'You can only manage your own bookings.');
  }

  if (booking.status === nextStatus) {
    return res.status(200).json(
      new ApiResponse(200, { booking: mapBooking(booking) }, 'Booking status is already up to date.'),
    );
  }

  resolveStatusTransition({
    actorRole: role,
    currentStatus: booking.status,
    nextStatus,
  });

  if (nextStatus === 'confirmed') {
    ensureFutureSlot({ bookingDate: booking.bookingDate, startTime: booking.startTime });
  }

  booking.status = nextStatus;

  if (nextStatus === 'cancelled') {
    booking.cancellationReason = String(req.body?.cancellationReason || '').trim()
      || (role === 'trainer' ? 'Cancelled by trainer' : 'Cancelled by trainee');
  }

  await booking.save();

  const actionMessageMap = {
    confirmed: {
      title: 'Session confirmed',
      message: `${booking.trainer?.name ?? 'Your trainer'} confirmed your session for ${formatDateKey(booking.bookingDate)} at ${booking.startTime}.`,
      action: 'booking.confirmed',
    },
    cancelled: {
      title: 'Session cancelled',
      message: `Your session for ${formatDateKey(booking.bookingDate)} at ${booking.startTime} was cancelled.`,
      action: 'booking.cancelled',
    },
    completed: {
      title: 'Session completed',
      message: `Your session on ${formatDateKey(booking.bookingDate)} was marked as completed.`,
      action: 'booking.completed',
    },
  };

  const actionMeta = actionMessageMap[nextStatus] ?? {
    title: 'Session updated',
    message: `Your session was updated to ${nextStatus}.`,
    action: 'booking.updated',
  };

  const notifications = [];
  if (role === 'trainer') {
    notifications.push({
      user: booking.user?._id || booking.user,
      type: `booking-${nextStatus}`,
      title: actionMeta.title,
      message: actionMeta.message,
      link: '/dashboard/trainee/sessions',
      metadata: { bookingId: booking._id, gymId: booking.gym?._id || booking.gym },
    });
  } else if (TRAINEE_ROLES.includes(role)) {
    notifications.push({
      user: booking.trainer?._id || booking.trainer,
      type: 'booking-cancelled',
      title: 'Session cancelled by trainee',
      message: `${booking.user?.name ?? 'A trainee'} cancelled the ${formatDateKey(booking.bookingDate)} ${booking.startTime} session.`,
      link: '/dashboard/trainer/updates',
      metadata: { bookingId: booking._id, gymId: booking.gym?._id || booking.gym },
    });
  }

  await Promise.all([
    notifications.length ? createNotifications(notifications) : Promise.resolve([]),
    recordAuditLog({
      actor: req.user?._id,
      actorRole: req.user?.role,
      action: actionMeta.action,
      entityType: 'booking',
      entityId: booking._id,
      summary: `Booking ${nextStatus}`,
      metadata: {
        gymId: String(booking.gym?._id || booking.gym),
        trainerId: String(booking.trainer?._id || booking.trainer),
        traineeId: String(booking.user?._id || booking.user),
        date: formatDateKey(booking.bookingDate),
      },
    }),
  ]);

  return res.status(200).json(
    new ApiResponse(200, { booking: mapBooking(booking) }, 'Booking status updated successfully.'),
  );
});
