import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/app.js';
import connectDB from '../../src/db/index.js';
import User from '../../src/models/user.model.js';
import Gym from '../../src/models/gym.model.js';
import GymMembership from '../../src/models/gymMembership.model.js';
import TrainerAssignment from '../../src/models/trainerAssignment.model.js';
import TrainerAvailability from '../../src/models/trainerAvailability.model.js';
import TrainerProgress from '../../src/models/trainerProgress.model.js';
import Booking from '../../src/models/booking.model.js';
import Product from '../../src/models/product.model.js';
import Order from '../../src/models/order.model.js';
import Revenue from '../../src/models/revenue.model.js';
import GymListingSubscription from '../../src/models/gymListingSubscription.model.js';
import Notification from '../../src/models/notification.model.js';
import Contact from '../../src/models/contact.model.js';
import InternalConversation from '../../src/models/internalConversation.model.js';
import Review from '../../src/models/review.model.js';
import ProductReview from '../../src/models/productReview.model.js';
import PaymentSession from '../../src/models/paymentSession.model.js';
import AuditLog from '../../src/models/auditLog.model.js';
import OutboxEvent from '../../src/models/outboxEvent.model.js';
import GymImpressionDaily from '../../src/models/gymImpressionDaily.model.js';
import SystemSetting from '../../src/models/systemSetting.model.js';
import { DEFAULT_ADMIN_TOGGLES } from '../../src/services/systemSettings.service.js';
import { flushGymImpressions } from '../../src/services/gymImpression.service.js';

export const runId = `smoke_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
const toggleKeys = Object.keys(DEFAULT_ADMIN_TOGGLES);

export const ctx = {
  users: {},
  tokens: {},
  gyms: {},
  assignments: {},
  memberships: {},
  products: {},
  notifications: {},
  auth: {},
  ids: {
    users: new Set(),
    gyms: new Set(),
    products: new Set(),
    orders: new Set(),
    memberships: new Set(),
    assignments: new Set(),
    bookings: new Set(),
    contacts: new Set(),
    conversations: new Set(),
  },
  originalSystemSettings: [],
};

const normalizeSlotValue = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, '-');

export const buildAvailabilitySlotKey = ({
  dayOfWeek,
  startTime,
  endTime,
  sessionType = 'personal-training',
  locationLabel = '',
}) => [
  dayOfWeek,
  startTime,
  endTime,
  normalizeSlotValue(sessionType),
  normalizeSlotValue(locationLabel || 'gym-floor'),
].join('|');

export const buildFutureSlot = (offsetDays = 2, overrides = {}) => {
  const now = new Date();
  const target = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + offsetDays,
    0,
    0,
    0,
    0,
  ));
  const slot = {
    dateString: target.toISOString().slice(0, 10),
    dayOfWeek: target.getUTCDay(),
    startTime: '18:00',
    endTime: '19:00',
    sessionType: 'personal-training',
    locationLabel: 'Studio A',
    capacity: 1,
    ...overrides,
  };

  return {
    ...slot,
    availabilitySlotKey: buildAvailabilitySlotKey(slot),
  };
};

export const dateDaysFromNow = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

export const dateMonthsFromNow = (months) => {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return date;
};

export const dateDaysAgo = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

export const withHeaders = (req, token = null) => {
  req.set('x-load-test-mode', 'true');
  if (token) {
    req.set('Authorization', `Bearer ${token}`);
  }
  return req;
};

export const apiCall = (method, url, { token = null, agent = null } = {}) => {
  const client = agent ?? request(app);
  return withHeaders(client[method](url), token);
};

export const exportExpectations = (res, format) => {
  expect(res.status).toBe(200);
  expect(res.headers['content-disposition']).toContain(`.${format}`);
  if (format === 'csv') {
    expect(res.headers['content-type']).toContain('text/csv');
  } else {
    expect(res.headers['content-type']).toContain('application/pdf');
  }
};

const buildUserName = (label) => `${runId} ${label}`;
const buildUserEmail = (label) => `${runId}.${label.replace(/\s+/g, '.').toLowerCase()}@fitsync.dev`;

const buildBilling = (reference, amount) => ({
  amount,
  currency: 'INR',
  paymentGateway: 'internal',
  paymentReference: `${runId}-${reference}`,
  status: 'paid',
});

const buildGymPayload = ({
  name,
  ownerId,
  city = 'Mumbai',
  monthlyMrp = 3200,
  monthlyPrice = 2600,
}) => ({
  owner: ownerId,
  name,
  description: `${name} description`,
  location: {
    address: `${name} Address`,
    city,
    state: 'MH',
    postalCode: '400001',
  },
  pricing: {
    monthlyMrp,
    monthlyPrice,
    currency: 'INR',
    membershipPlans: [
      {
        code: 'monthly',
        label: 'Monthly',
        durationMonths: 1,
        mrp: monthlyMrp,
        price: monthlyPrice,
        currency: 'INR',
        isActive: true,
      },
      {
        code: 'quarterly',
        label: 'Quarterly',
        durationMonths: 3,
        mrp: monthlyMrp * 3,
        price: monthlyPrice * 3 - 600,
        currency: 'INR',
        isActive: true,
      },
    ],
  },
  contact: {
    phone: '9999999999',
    email: `${runId}.${name.replace(/\s+/g, '').toLowerCase()}@gym.dev`,
    website: 'https://example.com',
  },
  schedule: {
    openTime: '06:00',
    closeTime: '22:00',
    workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  },
  keyFeatures: ['Strength floor', 'Personal training'],
  amenities: ['Weights', 'Cardio', 'Locker room'],
  tags: ['premium', 'city-center'],
  images: ['https://example.com/gym-cover.jpg'],
  gallery: ['https://example.com/gym-gallery.jpg'],
  analytics: {
    impressions: 12,
    opens: 3,
    memberships: 1,
    trainers: 1,
    rating: 4.5,
    ratingCount: 1,
  },
  status: 'active',
  isPublished: true,
  isActive: true,
  approvalStatus: 'approved',
  approvedAt: new Date(),
  lastUpdatedBy: ownerId,
});

export const trackId = (bucket, value) => {
  if (value) {
    ctx.ids[bucket].add(String(value));
  }
};

const createUser = async ({
  label,
  role,
  status = 'active',
  address = 'Mumbai',
  age = 30,
  gender = 'unspecified',
  extra = {},
}) => {
  const [firstName, ...rest] = label.split(' ');
  const user = await User.create({
    firstName,
    lastName: rest.join(' ') || 'Smoke',
    name: buildUserName(label),
    email: buildUserEmail(label),
    password: 'Test1234!',
    role,
    status,
    address,
    age,
    gender,
    contactNumber: '9999999999',
    profile: {
      headline: `${label} headline`,
      about: `${label} about`,
      location: address,
      company: 'FitSync QA',
      socialLinks: { website: 'https://example.com' },
    },
    ...extra,
  });

  trackId('users', user._id);
  return user;
};

const createGymDoc = async (payload) => {
  const gym = await Gym.create(payload);
  trackId('gyms', gym._id);
  return gym;
};

const createAssignmentDoc = async (payload) => {
  const assignment = await TrainerAssignment.create(payload);
  trackId('assignments', assignment._id);
  return assignment;
};

const createMembershipDoc = async (payload) => {
  const membership = await GymMembership.create(payload);
  trackId('memberships', membership._id);
  return membership;
};

const createProductDoc = async (payload) => {
  const product = await Product.create(payload);
  trackId('products', product._id);
  return product;
};

const seedCoreData = async () => {
  ctx.users.admin = await createUser({ label: 'Admin', role: 'admin', status: 'active', age: 34, gender: 'male' });
  ctx.users.manager = await createUser({ label: 'Manager', role: 'manager', status: 'active', age: 32, gender: 'female' });
  ctx.users.owner = await createUser({ label: 'Owner', role: 'gym-owner', status: 'active', age: 38, gender: 'male' });
  ctx.users.trainer = await createUser({
    label: 'Trainer Main',
    role: 'trainer',
    status: 'active',
    age: 29,
    gender: 'female',
    extra: {
      experienceYears: 6,
      specializations: ['strength', 'mobility'],
      certifications: ['ACE CPT'],
      mentoredCount: 9,
    },
  });
  ctx.users.trainerApprove = await createUser({ label: 'Trainer Approve', role: 'trainer', status: 'active' });
  ctx.users.trainerDecline = await createUser({ label: 'Trainer Decline', role: 'trainer', status: 'active' });
  ctx.users.trainerRemove = await createUser({ label: 'Trainer Remove', role: 'trainer', status: 'active' });
  ctx.users.trainee = await createUser({
    label: 'Trainee Main',
    role: 'trainee',
    status: 'active',
    age: 27,
    gender: 'female',
    extra: { fitnessGoals: ['strength'] },
  });
  ctx.users.traineeJoin = await createUser({ label: 'Trainee Join', role: 'trainee', status: 'active', age: 25, gender: 'male' });
  ctx.users.traineeRemove = await createUser({ label: 'Trainee Remove', role: 'trainee', status: 'active', age: 24, gender: 'female' });
  ctx.users.seller = await createUser({ label: 'Seller Active', role: 'seller', status: 'active', age: 31, gender: 'male' });
  ctx.users.pendingSeller = await createUser({ label: 'Seller Pending', role: 'seller', status: 'pending', age: 26, gender: 'male' });
  ctx.users.deleteTarget = await createUser({ label: 'Delete Target', role: 'trainee', status: 'active', age: 22, gender: 'male' });

  Object.entries(ctx.users).forEach(([key, user]) => {
    ctx.tokens[key] = user.generateAccessToken();
  });

  ctx.gyms.main = await createGymDoc(buildGymPayload({
    name: `${runId} Main Gym`,
    ownerId: ctx.users.owner._id,
  }));
  ctx.gyms.secondary = await createGymDoc(buildGymPayload({
    name: `${runId} Secondary Gym`,
    ownerId: ctx.users.owner._id,
    monthlyMrp: 2800,
    monthlyPrice: 2200,
  }));
  ctx.gyms.deleteTarget = await createGymDoc(buildGymPayload({
    name: `${runId} Delete Gym`,
    ownerId: ctx.users.owner._id,
    monthlyMrp: 2400,
    monthlyPrice: 2000,
  }));

  ctx.assignments.main = await createAssignmentDoc({
    trainer: ctx.users.trainer._id,
    gym: ctx.gyms.main._id,
    status: 'active',
    requestedAt: dateDaysAgo(30),
    approvedAt: dateDaysAgo(29),
    trainees: [{
      trainee: ctx.users.trainee._id,
      status: 'active',
      assignedAt: dateDaysAgo(10),
      goals: ['strength', 'fat loss'],
    }],
  });
  ctx.assignments.approve = await createAssignmentDoc({
    trainer: ctx.users.trainerApprove._id,
    gym: ctx.gyms.main._id,
    status: 'pending',
    requestedAt: dateDaysAgo(2),
    trainees: [],
  });
  ctx.assignments.decline = await createAssignmentDoc({
    trainer: ctx.users.trainerDecline._id,
    gym: ctx.gyms.main._id,
    status: 'pending',
    requestedAt: dateDaysAgo(1),
    trainees: [],
  });
  ctx.assignments.remove = await createAssignmentDoc({
    trainer: ctx.users.trainerRemove._id,
    gym: ctx.gyms.secondary._id,
    status: 'active',
    requestedAt: dateDaysAgo(20),
    approvedAt: dateDaysAgo(19),
    trainees: [{
      trainee: ctx.users.traineeRemove._id,
      status: 'active',
      assignedAt: dateDaysAgo(6),
      goals: ['conditioning'],
    }],
  });

  ctx.memberships.previous = await createMembershipDoc({
    trainee: ctx.users.trainee._id,
    gym: ctx.gyms.main._id,
    trainer: ctx.users.trainer._id,
    plan: 'monthly',
    startDate: dateDaysAgo(120),
    endDate: dateDaysAgo(90),
    status: 'expired',
    autoRenew: false,
    billing: buildBilling('membership-previous', 2100),
  });
  ctx.memberships.main = await createMembershipDoc({
    trainee: ctx.users.trainee._id,
    gym: ctx.gyms.main._id,
    trainer: ctx.users.trainer._id,
    plan: 'monthly',
    startDate: dateDaysAgo(12),
    endDate: dateDaysFromNow(18),
    status: 'active',
    autoRenew: true,
    billing: buildBilling('membership-main', 2500),
    benefits: ['trainer-guidance'],
  });
  ctx.memberships.remove = await createMembershipDoc({
    trainee: ctx.users.traineeRemove._id,
    gym: ctx.gyms.secondary._id,
    trainer: ctx.users.trainerRemove._id,
    plan: 'monthly',
    startDate: dateDaysAgo(7),
    endDate: dateDaysFromNow(23),
    status: 'active',
    autoRenew: true,
    billing: buildBilling('membership-remove', 2200),
  });
  ctx.memberships.approve = await createMembershipDoc({
    trainee: ctx.users.trainerApprove._id,
    gym: ctx.gyms.main._id,
    plan: 'trainer-access',
    startDate: dateDaysAgo(2),
    endDate: dateMonthsFromNow(6),
    status: 'pending',
    autoRenew: false,
    benefits: ['trainer-roster'],
  });
  ctx.memberships.decline = await createMembershipDoc({
    trainee: ctx.users.trainerDecline._id,
    gym: ctx.gyms.main._id,
    plan: 'trainer-access',
    startDate: dateDaysAgo(1),
    endDate: dateMonthsFromNow(6),
    status: 'pending',
    autoRenew: false,
    benefits: ['trainer-roster'],
  });

  await Promise.all([
    User.updateOne({ _id: ctx.users.trainer._id }, {
      $set: { 'trainerMetrics.activeTrainees': 1, 'trainerMetrics.gyms': [ctx.gyms.main._id] },
    }),
    User.updateOne({ _id: ctx.users.trainerRemove._id }, {
      $set: { 'trainerMetrics.activeTrainees': 1, 'trainerMetrics.gyms': [ctx.gyms.secondary._id] },
    }),
    User.updateOne({ _id: ctx.users.trainee._id }, {
      $set: { 'traineeMetrics.activeMemberships': 1, 'traineeMetrics.primaryGym': ctx.gyms.main._id },
    }),
    User.updateOne({ _id: ctx.users.traineeRemove._id }, {
      $set: { 'traineeMetrics.activeMemberships': 1, 'traineeMetrics.primaryGym': ctx.gyms.secondary._id },
    }),
    User.updateOne({ _id: ctx.users.owner._id }, {
      $set: { 'ownerMetrics.totalGyms': 3, 'ownerMetrics.totalImpressions': 20, 'ownerMetrics.monthlyEarnings': 2500 },
    }),
  ]);

  await GymListingSubscription.create({
    gym: ctx.gyms.main._id,
    owner: ctx.users.owner._id,
    planCode: 'listing-1m',
    amount: 1499,
    currency: 'INR',
    periodStart: dateDaysAgo(5),
    periodEnd: dateDaysFromNow(25),
    status: 'active',
    autoRenew: false,
    invoices: [{
      amount: 1499,
      currency: 'INR',
      paidOn: dateDaysAgo(5),
      paymentReference: `${runId}-listing-main`,
      status: 'paid',
    }],
    createdBy: ctx.users.owner._id,
  });

  await Revenue.create([
    {
      amount: 1499,
      user: ctx.users.owner._id,
      type: 'listing',
      description: `${runId} listing subscription`,
      metadata: new Map([['gymId', String(ctx.gyms.main._id)], ['paymentReference', `${runId}-listing-main`]]),
    },
    {
      amount: 1250,
      user: ctx.users.owner._id,
      type: 'membership',
      description: `${runId} owner membership share`,
      metadata: new Map([['gymId', String(ctx.gyms.main._id)], ['membershipId', String(ctx.memberships.main._id)]]),
    },
    {
      amount: 1250,
      user: ctx.users.trainer._id,
      type: 'membership',
      description: `${runId} trainer membership share`,
      metadata: new Map([['gymId', String(ctx.gyms.main._id)], ['membershipId', String(ctx.memberships.main._id)]]),
    },
    {
      amount: 1050,
      user: ctx.users.owner._id,
      type: 'renewal',
      description: `${runId} renewal revenue`,
      metadata: new Map([['gymId', String(ctx.gyms.main._id)], ['membershipId', String(ctx.memberships.main._id)]]),
    },
  ]);

  ctx.products.main = await createProductDoc({
    seller: ctx.users.seller._id,
    name: `${runId} Whey Protein`,
    description: 'Primary catalogue product',
    price: 2100,
    mrp: 2500,
    image: 'https://example.com/product-main.jpg',
    category: 'supplements',
    stock: 20,
    status: 'available',
    isPublished: true,
  });
  ctx.products.update = await createProductDoc({
    seller: ctx.users.seller._id,
    name: `${runId} Resistance Band`,
    description: 'Update target product',
    price: 900,
    mrp: 1200,
    image: 'https://example.com/product-update.jpg',
    category: 'equipment',
    stock: 10,
    status: 'available',
    isPublished: true,
  });
  ctx.products.delete = await createProductDoc({
    seller: ctx.users.seller._id,
    name: `${runId} Delete Product`,
    description: 'Delete target product',
    price: 700,
    mrp: 950,
    image: 'https://example.com/product-delete.jpg',
    category: 'accessories',
    stock: 5,
    status: 'available',
    isPublished: true,
  });
};

export const setupControllerSmoke = async () => {
  await connectDB();
  ctx.originalSystemSettings = await SystemSetting.find({ key: { $in: toggleKeys } }).lean();
  await seedCoreData();
};

export const flushTrackedGymImpressions = async () => {
  await flushGymImpressions();
};

export const teardownControllerSmoke = async () => {
  try {
    const toObjectIds = (values) => values
      .filter((value) => mongoose.Types.ObjectId.isValid(value))
      .map((value) => new mongoose.Types.ObjectId(value));
    const userIds = toObjectIds([...ctx.ids.users]);
    const gymIds = toObjectIds([...ctx.ids.gyms]);
    const productIds = toObjectIds([...ctx.ids.products]);
    const orderIds = toObjectIds([...ctx.ids.orders]);
    const membershipIds = toObjectIds([...ctx.ids.memberships]);
    const assignmentIds = toObjectIds([...ctx.ids.assignments]);
    const bookingIds = toObjectIds([...ctx.ids.bookings]);
    const contactIds = toObjectIds([...ctx.ids.contacts]);
    const conversationIds = toObjectIds([...ctx.ids.conversations]);
    const idStrings = [
      ...ctx.ids.users,
      ...ctx.ids.gyms,
      ...ctx.ids.products,
      ...ctx.ids.orders,
      ...ctx.ids.memberships,
      ...ctx.ids.assignments,
      ...ctx.ids.bookings,
      ...ctx.ids.contacts,
      ...ctx.ids.conversations,
    ];
    const gymIdStrings = [...ctx.ids.gyms];

    await SystemSetting.deleteMany({ key: { $in: toggleKeys } });
    if (ctx.originalSystemSettings.length) {
      await SystemSetting.insertMany(ctx.originalSystemSettings.map((doc) => {
        const { _id, createdAt, updatedAt, ...rest } = doc;
        return rest;
      }));
    }

    await Promise.all([
      OutboxEvent.deleteMany({ aggregateId: { $in: idStrings } }),
      PaymentSession.deleteMany({
        $or: [
          { user: { $in: userIds } },
          { owner: { $in: userIds } },
          { gym: { $in: gymIds } },
          { orderId: { $in: orderIds } },
        ],
      }),
      Notification.deleteMany({ user: { $in: userIds } }),
      AuditLog.deleteMany({
        $or: [
          { actor: { $in: userIds } },
          { entityId: { $in: idStrings } },
          { summary: { $regex: runId, $options: 'i' } },
        ],
      }),
      GymImpressionDaily.deleteMany({ gym: { $in: gymIds } }),
      ProductReview.deleteMany({
        $or: [
          { product: { $in: productIds } },
          { user: { $in: userIds } },
          { order: { $in: orderIds } },
        ],
      }),
      Review.deleteMany({ $or: [{ gym: { $in: gymIds } }, { user: { $in: userIds } }] }),
      Booking.deleteMany({
        $or: [
          { _id: { $in: bookingIds } },
          { user: { $in: userIds } },
          { trainer: { $in: userIds } },
          { gym: { $in: gymIds } },
        ],
      }),
      TrainerProgress.deleteMany({
        $or: [
          { trainer: { $in: userIds } },
          { trainee: { $in: userIds } },
          { gym: { $in: gymIds } },
        ],
      }),
      TrainerAvailability.deleteMany({ $or: [{ trainer: { $in: userIds } }, { gym: { $in: gymIds } }] }),
      TrainerAssignment.deleteMany({
        $or: [
          { _id: { $in: assignmentIds } },
          { trainer: { $in: userIds } },
          { gym: { $in: gymIds } },
          { 'trainees.trainee': { $in: userIds } },
        ],
      }),
      GymMembership.deleteMany({
        $or: [
          { _id: { $in: membershipIds } },
          { trainee: { $in: userIds } },
          { trainer: { $in: userIds } },
          { gym: { $in: gymIds } },
        ],
      }),
      Contact.deleteMany({
        $or: [
          { _id: { $in: contactIds } },
          { email: { $regex: runId, $options: 'i' } },
          { name: { $regex: runId, $options: 'i' } },
          { subject: { $regex: runId, $options: 'i' } },
          { assignedTo: { $in: userIds } },
          { gym: { $in: gymIds } },
        ],
      }),
      InternalConversation.deleteMany({
        $or: [
          { _id: { $in: conversationIds } },
          { 'participants.user': { $in: userIds } },
          { gym: { $in: gymIds } },
          { subject: { $regex: runId, $options: 'i' } },
        ],
      }),
      Revenue.deleteMany({
        $or: [
          { user: { $in: userIds } },
          { order: { $in: orderIds } },
          { description: { $regex: runId, $options: 'i' } },
          { 'metadata.gymId': { $in: gymIdStrings } },
          { 'metadata.gym': { $in: gymIdStrings } },
        ],
      }),
      GymListingSubscription.deleteMany({
        $or: [
          { owner: { $in: userIds } },
          { gym: { $in: gymIds } },
          { createdBy: { $in: userIds } },
          { 'invoices.paymentReference': { $regex: runId, $options: 'i' } },
        ],
      }),
      Order.deleteMany({
        $or: [
          { _id: { $in: orderIds } },
          { user: { $in: userIds } },
          { seller: { $in: userIds } },
          { 'orderItems.seller': { $in: userIds } },
          { 'orderItems.product': { $in: productIds } },
          { orderNumber: { $regex: runId, $options: 'i' } },
        ],
      }),
      Product.deleteMany({
        $or: [
          { _id: { $in: productIds } },
          { seller: { $in: userIds } },
          { name: { $regex: runId, $options: 'i' } },
        ],
      }),
      Gym.deleteMany({
        $or: [
          { _id: { $in: gymIds } },
          { owner: { $in: userIds } },
          { name: { $regex: runId, $options: 'i' } },
        ],
      }),
      User.deleteMany({ _id: { $in: userIds } }),
    ]);
  } finally {
    await mongoose.connection.close();
  }
};
