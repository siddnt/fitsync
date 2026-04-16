import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../db/index.js';
import User from '../models/user.model.js';
import Gym from '../models/gym.model.js';
import GymMembership from '../models/gymMembership.model.js';
import GymListingSubscription from '../models/gymListingSubscription.model.js';
import TrainerAssignment from '../models/trainerAssignment.model.js';
import TrainerAvailability from '../models/trainerAvailability.model.js';
import TrainerProgress from '../models/trainerProgress.model.js';
import Booking from '../models/booking.model.js';
import Revenue from '../models/revenue.model.js';
import Review from '../models/review.model.js';
import Product from '../models/product.model.js';
import Order from '../models/order.model.js';
import AuditLog from '../models/auditLog.model.js';
import Notification from '../models/notification.model.js';
import GymImpressionDaily from '../models/gymImpressionDaily.model.js';
import { recordAuditLog } from '../services/audit.service.js';

dotenv.config({ path: './.env' });

const analyticsOnly = process.argv.includes('--analytics-only');

const DEMO_EMAILS = [
  'admin.demo@fitsync.local',
  'manager.demo@fitsync.local',
  'owner.demo@fitsync.local',
  'trainer.alpha@fitsync.local',
  'trainer.beta@fitsync.local',
  'trainee.alpha@fitsync.local',
  'trainee.beta@fitsync.local',
  'seller.demo@fitsync.local',
];

const DEMO_GYM_NAMES = [
  'FitSync Demo Iron Temple',
  'FitSync Demo Flow Studio',
];

const daysAgo = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

const daysFromNow = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
};

const monthsAgo = (months, dayOffset = 0) => {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  date.setDate(date.getDate() + dayOffset);
  return date;
};

const monthsFromNow = (months, dayOffset = 0) => {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  date.setDate(date.getDate() + dayOffset);
  return date;
};

const buildAvailabilitySlotKey = (slot = {}) => [
  slot.dayOfWeek,
  slot.startTime,
  slot.endTime,
  String(slot.sessionType || 'personal-training').trim().toLowerCase().replace(/\s+/g, '-'),
  String(slot.locationLabel || 'gym-floor').trim().toLowerCase().replace(/\s+/g, '-'),
].join('|');

const nextWeekdayAtNoonUtc = (weekday) => {
  const date = new Date();
  const normalized = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12, 0, 0, 0));
  const delta = (weekday - normalized.getUTCDay() + 7) % 7 || 7;
  normalized.setUTCDate(normalized.getUTCDate() + delta);
  return normalized;
};

const cleanupExistingDemoData = async () => {
  const existingUsers = await User.find({ email: { $in: DEMO_EMAILS } }).select('_id').lean();
  const userIds = existingUsers.map((user) => user._id);

  const existingGyms = await Gym.find({
    $or: [
      { owner: { $in: userIds } },
      { name: { $in: DEMO_GYM_NAMES } },
    ],
  }).select('_id').lean();
  const gymIds = existingGyms.map((gym) => gym._id);

  await Promise.all([
    Booking.deleteMany({
      $or: [
        { user: { $in: userIds } },
        { trainer: { $in: userIds } },
        { gym: { $in: gymIds } },
      ],
    }),
    TrainerAvailability.deleteMany({
      $or: [
        { trainer: { $in: userIds } },
        { gym: { $in: gymIds } },
      ],
    }),
    TrainerAssignment.deleteMany({
      $or: [
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
    GymMembership.deleteMany({
      $or: [
        { trainee: { $in: userIds } },
        { trainer: { $in: userIds } },
        { gym: { $in: gymIds } },
      ],
    }),
    GymListingSubscription.deleteMany({
      $or: [
        { owner: { $in: userIds } },
        { gym: { $in: gymIds } },
      ],
    }),
    Revenue.deleteMany({
      $or: [
        { user: { $in: userIds } },
        { 'metadata.gymId': { $in: gymIds.map((id) => String(id)) } },
      ],
    }),
    Review.deleteMany({
      $or: [
        { user: { $in: userIds } },
        { gym: { $in: gymIds } },
      ],
    }),
    AuditLog.deleteMany({
      $or: [
        { actor: { $in: userIds } },
        { entityId: { $in: [...userIds, ...gymIds].map((id) => String(id)) } },
      ],
    }),
    Notification.deleteMany({ user: { $in: userIds } }),
    Order.deleteMany({
      $or: [
        { user: { $in: userIds } },
        { seller: { $in: userIds } },
        { 'orderItems.seller': { $in: userIds } },
      ],
    }),
    Product.deleteMany({ seller: { $in: userIds } }),
    GymImpressionDaily.deleteMany({ gym: { $in: gymIds } }),
    Gym.deleteMany({ _id: { $in: gymIds } }),
    User.deleteMany({ _id: { $in: userIds } }),
  ]);
};

const buildShippingAddress = (overrides = {}) => ({
  firstName: 'Demo',
  lastName: 'Buyer',
  email: 'buyer@fitsync.local',
  phone: '9999999999',
  address: '42 Wellness Avenue',
  city: 'Pune',
  state: 'Maharashtra',
  zipCode: '411001',
  ...overrides,
});

const seed = async () => {
  await cleanupExistingDemoData();

  const users = await User.create([
    {
      firstName: 'Admin',
      lastName: 'Demo',
      email: 'admin.demo@fitsync.local',
      password: 'Demo@123',
      role: 'admin',
      status: 'active',
      profile: { headline: 'Platform administrator' },
    },
    {
      firstName: 'Manager',
      lastName: 'Demo',
      email: 'manager.demo@fitsync.local',
      password: 'Demo@123',
      role: 'manager',
      status: 'active',
      profile: { headline: 'Ops manager' },
    },
    {
      firstName: 'Olivia',
      lastName: 'Owner',
      email: 'owner.demo@fitsync.local',
      password: 'Demo@123',
      role: 'gym-owner',
      status: 'active',
      profile: { headline: 'Multi-location gym owner' },
      ownerMetrics: {
        totalGyms: 2,
        totalImpressions: 0,
        monthlySpend: 0,
        monthlyEarnings: 0,
      },
    },
    {
      firstName: 'Arjun',
      lastName: 'Trainer',
      email: 'trainer.alpha@fitsync.local',
      password: 'Demo@123',
      role: 'trainer',
      status: 'active',
      experienceYears: 6,
      mentoredCount: 18,
      specializations: ['Strength', 'Mobility'],
      certifications: ['ACE CPT', 'Nutrition Basics'],
      profile: { headline: 'Strength and conditioning coach' },
      trainerMetrics: { activeTrainees: 1, gyms: [] },
      gender: 'male',
      age: 29,
      height: 178,
    },
    {
      firstName: 'Mira',
      lastName: 'Trainer',
      email: 'trainer.beta@fitsync.local',
      password: 'Demo@123',
      role: 'trainer',
      status: 'active',
      experienceYears: 4,
      mentoredCount: 11,
      specializations: ['Yoga', 'Functional'],
      certifications: ['RYT 200', 'Functional Mobility'],
      profile: { headline: 'Mobility and recovery specialist' },
      trainerMetrics: { activeTrainees: 1, gyms: [] },
      gender: 'female',
      age: 27,
      height: 170,
    },
    {
      firstName: 'Riya',
      lastName: 'Trainee',
      email: 'trainee.alpha@fitsync.local',
      password: 'Demo@123',
      role: 'trainee',
      status: 'active',
      traineeMetrics: { activeMemberships: 1 },
      fitnessGoals: ['Build strength', 'Improve consistency'],
      gender: 'female',
      age: 24,
      height: 164,
      weight: 58,
    },
    {
      firstName: 'Kabir',
      lastName: 'Trainee',
      email: 'trainee.beta@fitsync.local',
      password: 'Demo@123',
      role: 'trainee',
      status: 'active',
      traineeMetrics: { activeMemberships: 1 },
      fitnessGoals: ['Lose fat', 'Increase endurance'],
      gender: 'male',
      age: 31,
      height: 176,
      weight: 79,
    },
    {
      firstName: 'Sonal',
      lastName: 'Seller',
      email: 'seller.demo@fitsync.local',
      password: 'Demo@123',
      role: 'seller',
      status: 'active',
      profile: { headline: 'Supplements and gear merchant' },
    },
  ]);

  const [
    admin,
    manager,
    owner,
    trainerAlpha,
    trainerBeta,
    traineeAlpha,
    traineeBeta,
    seller,
  ] = users;

  const gyms = await Gym.create([
    {
      owner: owner._id,
      name: DEMO_GYM_NAMES[0],
      description: 'Strength-first flagship facility with premium coaching and small group training.',
      location: {
        address: '101 Atlas Road',
        city: 'Pune',
        state: 'Maharashtra',
        postalCode: '411001',
      },
      pricing: {
        monthlyMrp: 3600,
        monthlyPrice: 3200,
        currency: 'INR',
        membershipPlans: [
          { code: 'monthly', label: 'Monthly', durationMonths: 1, mrp: 3600, price: 3200, currency: 'INR' },
          { code: 'quarterly', label: 'Quarterly', durationMonths: 3, mrp: 10200, price: 9000, currency: 'INR' },
        ],
      },
      amenities: ['Strength floor', 'Recovery zone', 'Showers'],
      keyFeatures: ['Small-batch coaching', 'Olympic platforms'],
      gallery: ['/images/gyms/Strength_training.jpg'],
      contact: { phone: '9876543210', email: 'iron-temple@fitsync.local' },
      schedule: { openTime: '05:30', closeTime: '22:30', workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] },
      analytics: { impressions: 0, opens: 0, memberships: 1, trainers: 1, rating: 4.8, ratingCount: 1 },
      sponsorship: {
        tier: 'gold',
        package: 'Gold Launchpad',
        label: 'Gold Launchpad',
        status: 'active',
        startDate: daysAgo(8),
        endDate: monthsFromNow(3, -8),
        expiresAt: monthsFromNow(3, -8),
        amount: 24000,
        monthlyBudget: 8000,
        reach: 60000,
      },
      status: 'active',
      isPublished: true,
      approvedAt: daysAgo(120),
      lastUpdatedBy: owner._id,
    },
    {
      owner: owner._id,
      name: DEMO_GYM_NAMES[1],
      description: 'Community-first studio focused on flexibility, mobility, and sustainable routines.',
      location: {
        address: '22 Harmony Lane',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560001',
      },
      pricing: {
        monthlyMrp: 3000,
        monthlyPrice: 2600,
        currency: 'INR',
        membershipPlans: [
          { code: 'monthly', label: 'Monthly', durationMonths: 1, mrp: 3000, price: 2600, currency: 'INR' },
          { code: 'quarterly', label: 'Quarterly', durationMonths: 3, mrp: 8400, price: 7800, currency: 'INR' },
        ],
      },
      amenities: ['Yoga hall', 'Breathwork room', 'Smoothie bar'],
      keyFeatures: ['Low-impact training', 'Guided mobility classes'],
      gallery: ['/images/gyms/yoga.jpg'],
      contact: { phone: '9876501234', email: 'flow-studio@fitsync.local' },
      schedule: { openTime: '06:00', closeTime: '21:30', workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
      analytics: { impressions: 0, opens: 0, memberships: 1, trainers: 1, rating: 4.6, ratingCount: 1 },
      sponsorship: {
        tier: 'silver',
        package: 'Silver Spotlights',
        label: 'Silver Spotlights',
        status: 'active',
        startDate: daysAgo(3),
        endDate: monthsFromNow(1, -3),
        expiresAt: monthsFromNow(1, -3),
        amount: 9000,
        monthlyBudget: 9000,
        reach: 15000,
      },
      status: 'active',
      isPublished: true,
      approvedAt: daysAgo(90),
      lastUpdatedBy: owner._id,
    },
  ]);

  const [gymOne, gymTwo] = gyms;

  await User.updateMany(
    { _id: { $in: [trainerAlpha._id, trainerBeta._id] } },
    [
      {
        $set: {
          'trainerMetrics.gyms': {
            $cond: [
              { $eq: ['$_id', trainerAlpha._id] },
              [gymOne._id],
              [gymTwo._id],
            ],
          },
        },
      },
    ],
  );

  await GymListingSubscription.create([
    {
      gym: gymOne._id,
      owner: owner._id,
      planCode: 'listing-3m',
      amount: 18999,
      currency: 'INR',
      periodStart: daysAgo(20),
      periodEnd: monthsFromNow(3, -20),
      status: 'active',
      autoRenew: false,
      invoices: [
        {
          amount: 18999,
          currency: 'INR',
          paidOn: daysAgo(20),
          paymentReference: 'DEMO-LIST-IRON-001',
          status: 'paid',
        },
      ],
      createdBy: owner._id,
    },
    {
      gym: gymTwo._id,
      owner: owner._id,
      planCode: 'listing-1m',
      amount: 6999,
      currency: 'INR',
      periodStart: daysAgo(12),
      periodEnd: daysFromNow(18),
      status: 'active',
      autoRenew: false,
      invoices: [
        {
          amount: 6999,
          currency: 'INR',
          paidOn: daysAgo(12),
          paymentReference: 'DEMO-LIST-FLOW-001',
          status: 'paid',
        },
      ],
      createdBy: owner._id,
    },
  ]);

  const expiredMembership = await GymMembership.create({
    trainee: traineeAlpha._id,
    gym: gymOne._id,
    trainer: trainerAlpha._id,
    plan: 'monthly',
    startDate: monthsAgo(3, -5),
    endDate: monthsAgo(2, 5),
    status: 'expired',
    autoRenew: false,
    billing: {
      amount: 3000,
      currency: 'INR',
      paymentGateway: 'internal',
      paymentReference: 'DEMO-MEM-OLD-001',
      status: 'paid',
    },
  });

  const activeMembershipAlpha = await GymMembership.create({
    trainee: traineeAlpha._id,
    gym: gymOne._id,
    trainer: trainerAlpha._id,
    plan: 'monthly',
    startDate: daysAgo(10),
    endDate: daysFromNow(20),
    status: 'active',
    autoRenew: true,
    billing: {
      amount: 3200,
      currency: 'INR',
      paymentGateway: 'internal',
      paymentReference: 'DEMO-MEM-ALPHA-002',
      status: 'paid',
    },
  });

  const activeMembershipBeta = await GymMembership.create({
    trainee: traineeBeta._id,
    gym: gymTwo._id,
    trainer: trainerBeta._id,
    plan: 'quarterly',
    startDate: daysAgo(5),
    endDate: monthsFromNow(3, -5),
    status: 'active',
    autoRenew: false,
    billing: {
      amount: 7800,
      currency: 'INR',
      paymentGateway: 'internal',
      paymentReference: 'DEMO-MEM-BETA-001',
      status: 'paid',
    },
  });

  await GymMembership.create([
    {
      trainee: trainerAlpha._id,
      gym: gymOne._id,
      plan: 'trainer-access',
      startDate: daysAgo(45),
      endDate: monthsFromNow(5),
      status: 'active',
      autoRenew: false,
      benefits: ['trainer-roster'],
    },
    {
      trainee: trainerBeta._id,
      gym: gymTwo._id,
      plan: 'trainer-access',
      startDate: daysAgo(30),
      endDate: monthsFromNow(5),
      status: 'active',
      autoRenew: false,
      benefits: ['trainer-roster'],
    },
  ]);

  await TrainerAssignment.create([
    {
      trainer: trainerAlpha._id,
      gym: gymOne._id,
      status: 'active',
      requestedAt: daysAgo(50),
      approvedAt: daysAgo(45),
      trainees: [
        {
          trainee: traineeAlpha._id,
          assignedAt: activeMembershipAlpha.startDate,
          status: 'active',
          goals: ['Build strength', 'Improve squat depth'],
        },
      ],
    },
    {
      trainer: trainerBeta._id,
      gym: gymTwo._id,
      status: 'active',
      requestedAt: daysAgo(38),
      approvedAt: daysAgo(30),
      trainees: [
        {
          trainee: traineeBeta._id,
          assignedAt: activeMembershipBeta.startDate,
          status: 'active',
          goals: ['Increase stamina', 'Reduce lower-back stiffness'],
        },
      ],
    },
  ]);

  const trainerAlphaSlots = [
    { dayOfWeek: 1, startTime: '07:00', endTime: '08:00', capacity: 2, sessionType: 'strength-coaching', locationLabel: 'Main floor' },
    { dayOfWeek: 3, startTime: '18:00', endTime: '19:00', capacity: 2, sessionType: 'mobility-lift', locationLabel: 'Recovery corner' },
  ];
  const trainerBetaSlots = [
    { dayOfWeek: 2, startTime: '08:00', endTime: '09:00', capacity: 1, sessionType: 'yoga-flow', locationLabel: 'Studio room' },
    { dayOfWeek: 4, startTime: '19:00', endTime: '20:00', capacity: 1, sessionType: 'mobility-reset', locationLabel: 'Studio room' },
  ];

  await TrainerAvailability.create([
    {
      trainer: trainerAlpha._id,
      gym: gymOne._id,
      timezone: 'Asia/Calcutta',
      notes: 'Morning strength slots and one midweek recovery block.',
      slots: trainerAlphaSlots,
    },
    {
      trainer: trainerBeta._id,
      gym: gymTwo._id,
      timezone: 'Asia/Calcutta',
      notes: 'Mobility-first coaching blocks for calmer evenings.',
      slots: trainerBetaSlots,
    },
  ]);

  await TrainerProgress.create([
    {
      trainer: trainerAlpha._id,
      trainee: traineeAlpha._id,
      gym: gymOne._id,
      attendance: [
        { date: daysAgo(12), status: 'present', notes: 'Strong lower-body day' },
        { date: daysAgo(10), status: 'present', notes: 'Maintained full routine' },
        { date: daysAgo(8), status: 'late', notes: 'Late by 10 minutes' },
        { date: daysAgo(5), status: 'present', notes: 'Added progressive overload' },
        { date: daysAgo(2), status: 'present', notes: 'Personal best on trap bar deadlift' },
      ],
      progressMetrics: [
        { metric: 'deadlift', value: 95, unit: 'kg', recordedAt: daysAgo(9) },
        { metric: 'deadlift', value: 102.5, unit: 'kg', recordedAt: daysAgo(2) },
      ],
      bodyMetrics: [
        { weightKg: 58.6, heightCm: 164, bmi: 21.8, recordedAt: daysAgo(14) },
        { weightKg: 58.0, heightCm: 164, bmi: 21.6, recordedAt: daysAgo(1) },
      ],
      dietPlans: [
        {
          weekOf: daysAgo(4),
          notes: 'Push protein intake slightly higher on training days.',
          meals: [
            { mealType: 'breakfast', item: 'Greek yogurt bowl', calories: 380, protein: 28, fat: 9 },
            { mealType: 'lunch', item: 'Chicken rice bowl', calories: 620, protein: 42, fat: 14 },
            { mealType: 'snack', item: 'Protein smoothie', calories: 240, protein: 24, fat: 5 },
            { mealType: 'dinner', item: 'Paneer stir fry', calories: 510, protein: 33, fat: 18 },
          ],
        },
      ],
      feedback: [
        { message: 'Excellent adherence this week. Keep your bracing tight on heavy pulls.', category: 'progress', createdAt: daysAgo(2) },
      ],
      traineeFeedback: [
        { message: 'The deadlift cues helped a lot. Feeling stronger already.', createdAt: daysAgo(1) },
      ],
      summary: 'Steady strength gains with excellent consistency.',
    },
    {
      trainer: trainerBeta._id,
      trainee: traineeBeta._id,
      gym: gymTwo._id,
      attendance: [
        { date: daysAgo(7), status: 'present', notes: 'Completed full flow' },
        { date: daysAgo(5), status: 'present', notes: 'Improved control through transitions' },
        { date: daysAgo(3), status: 'present', notes: 'Core endurance improved' },
      ],
      progressMetrics: [
        { metric: 'plank', value: 90, unit: 'seconds', recordedAt: daysAgo(6) },
        { metric: 'plank', value: 120, unit: 'seconds', recordedAt: daysAgo(1) },
      ],
      bodyMetrics: [
        { weightKg: 79, heightCm: 176, bmi: 25.5, recordedAt: daysAgo(5) },
      ],
      dietPlans: [
        {
          weekOf: daysAgo(3),
          notes: 'Prioritize hydration and reduce late-night snacking.',
          meals: [
            { mealType: 'breakfast', item: 'Overnight oats', calories: 360, protein: 18, fat: 10 },
            { mealType: 'lunch', item: 'Dal and millet', calories: 540, protein: 24, fat: 11 },
            { mealType: 'snack', item: 'Fruit and nuts', calories: 220, protein: 6, fat: 12 },
            { mealType: 'dinner', item: 'Grilled fish and greens', calories: 480, protein: 38, fat: 14 },
          ],
        },
      ],
      feedback: [
        { message: 'Posture looked much better. Keep owning the exhale during mobility drills.', category: 'progress', createdAt: daysAgo(1) },
      ],
      traineeFeedback: [
        { message: 'The evening sessions are helping my back pain a lot.', createdAt: daysAgo(1) },
      ],
      summary: 'Great early momentum and noticeably better mobility control.',
    },
  ]);

  await Review.create([
    {
      user: traineeAlpha._id,
      gym: gymOne._id,
      rating: 5,
      comment: 'Excellent coaching quality and a serious training atmosphere.',
      createdAt: daysAgo(4),
      updatedAt: daysAgo(4),
    },
    {
      user: traineeBeta._id,
      gym: gymTwo._id,
      rating: 4,
      comment: 'Supportive instructors and a calm studio setup.',
      createdAt: daysAgo(2),
      updatedAt: daysAgo(2),
    },
  ]);

  const nextMonday = nextWeekdayAtNoonUtc(1);
  const nextTuesday = nextWeekdayAtNoonUtc(2);
  const nextWednesday = nextWeekdayAtNoonUtc(3);
  const previousMonday = new Date(nextMonday);
  previousMonday.setUTCDate(previousMonday.getUTCDate() - 7);

  await Booking.create([
    {
      user: traineeAlpha._id,
      trainer: trainerAlpha._id,
      gym: gymOne._id,
      gymName: gymOne.name,
      availabilitySlotKey: buildAvailabilitySlotKey(trainerAlphaSlots[0]),
      day: 'monday',
      startTime: '07:00',
      endTime: '08:00',
      bookingDate: nextMonday,
      timezone: 'Asia/Calcutta',
      sessionType: 'strength-coaching',
      locationLabel: 'Main floor',
      status: 'pending',
      type: 'in-person',
      paymentStatus: 'free',
      notes: 'Would like to focus on upper-body pressing mechanics.',
    },
    {
      user: traineeAlpha._id,
      trainer: trainerAlpha._id,
      gym: gymOne._id,
      gymName: gymOne.name,
      availabilitySlotKey: buildAvailabilitySlotKey(trainerAlphaSlots[1]),
      day: 'wednesday',
      startTime: '18:00',
      endTime: '19:00',
      bookingDate: nextWednesday,
      timezone: 'Asia/Calcutta',
      sessionType: 'mobility-lift',
      locationLabel: 'Recovery corner',
      status: 'confirmed',
      type: 'in-person',
      paymentStatus: 'free',
      notes: 'Need a mobility reset before the next heavy week.',
    },
    {
      user: traineeAlpha._id,
      trainer: trainerAlpha._id,
      gym: gymOne._id,
      gymName: gymOne.name,
      availabilitySlotKey: buildAvailabilitySlotKey(trainerAlphaSlots[0]),
      day: 'monday',
      startTime: '07:00',
      endTime: '08:00',
      bookingDate: previousMonday,
      timezone: 'Asia/Calcutta',
      sessionType: 'strength-coaching',
      locationLabel: 'Main floor',
      status: 'completed',
      type: 'in-person',
      paymentStatus: 'free',
      notes: 'Completed demo calibration session.',
    },
    {
      user: traineeBeta._id,
      trainer: trainerBeta._id,
      gym: gymTwo._id,
      gymName: gymTwo.name,
      availabilitySlotKey: buildAvailabilitySlotKey(trainerBetaSlots[0]),
      day: 'tuesday',
      startTime: '08:00',
      endTime: '09:00',
      bookingDate: nextTuesday,
      timezone: 'Asia/Calcutta',
      sessionType: 'yoga-flow',
      locationLabel: 'Studio room',
      status: 'pending',
      type: 'in-person',
      paymentStatus: 'free',
      notes: 'Need extra work on hip opening and breath pacing.',
    },
  ]);

  const products = await Product.create([
    {
      seller: seller._id,
      name: 'Demo Whey Protein',
      description: 'High-protein whey blend for post-workout recovery.',
      price: 2200,
      mrp: 2500,
      image: '/images/products/protein-powder.jpg',
      category: 'supplements',
      stock: 40,
      status: 'available',
      metrics: {
        sales: { totalSold: 6, lastSoldAt: daysAgo(2) },
        reviews: { count: 2, averageRating: 4.5, lastReviewedAt: daysAgo(1) },
      },
    },
    {
      seller: seller._id,
      name: 'Demo Yoga Mat',
      description: 'High-grip yoga mat for studio and home mobility work.',
      price: 1200,
      mrp: 1500,
      image: '/images/products/yoga-mat.jpg',
      category: 'equipment',
      stock: 28,
      status: 'available',
      metrics: {
        sales: { totalSold: 4, lastSoldAt: daysAgo(5) },
        reviews: { count: 1, averageRating: 5, lastReviewedAt: daysAgo(3) },
      },
    },
  ]);

  const [proteinProduct, yogaMatProduct] = products;

  await Order.create([
    {
      user: traineeAlpha._id,
      seller: seller._id,
      orderNumber: 'DEMO-ORDER-001',
      shippingAddress: buildShippingAddress({ email: traineeAlpha.email }),
      paymentMethod: 'UPI',
      subtotal: 2200,
      tax: 0,
      shippingCost: 0,
      total: 2200,
      status: 'delivered',
      orderItems: [
        {
          seller: seller._id,
          product: proteinProduct._id,
          name: proteinProduct.name,
          quantity: 1,
          price: 2200,
          image: proteinProduct.image,
          status: 'delivered',
          lastStatusAt: daysAgo(2),
          statusHistory: [
            { status: 'processing', updatedBy: seller._id, updatedAt: daysAgo(4) },
            { status: 'in-transit', updatedBy: seller._id, updatedAt: daysAgo(3) },
            { status: 'delivered', updatedBy: seller._id, updatedAt: daysAgo(2) },
          ],
          payoutRecorded: true,
        },
      ],
    },
    {
      user: traineeBeta._id,
      seller: seller._id,
      orderNumber: 'DEMO-ORDER-002',
      shippingAddress: buildShippingAddress({ email: traineeBeta.email, city: 'Bengaluru', state: 'Karnataka' }),
      paymentMethod: 'Card',
      subtotal: 1200,
      tax: 0,
      shippingCost: 0,
      total: 1200,
      status: 'in-transit',
      orderItems: [
        {
          seller: seller._id,
          product: yogaMatProduct._id,
          name: yogaMatProduct.name,
          quantity: 1,
          price: 1200,
          image: yogaMatProduct.image,
          status: 'in-transit',
          lastStatusAt: daysAgo(1),
          statusHistory: [
            { status: 'processing', updatedBy: seller._id, updatedAt: daysAgo(2) },
            { status: 'in-transit', updatedBy: seller._id, updatedAt: daysAgo(1) },
          ],
        },
      ],
    },
  ]);

  await Revenue.create([
    {
      amount: 18999,
      user: owner._id,
      type: 'listing',
      description: 'Growth listing plan for FitSync Demo Iron Temple',
      metadata: new Map([['gymId', String(gymOne._id)], ['paymentReference', 'DEMO-LIST-IRON-001']]),
      createdAt: daysAgo(20),
    },
    {
      amount: 6999,
      user: owner._id,
      type: 'listing',
      description: 'Starter listing plan for FitSync Demo Flow Studio',
      metadata: new Map([['gymId', String(gymTwo._id)], ['paymentReference', 'DEMO-LIST-FLOW-001']]),
      createdAt: daysAgo(12),
    },
    {
      amount: 24000,
      user: owner._id,
      type: 'sponsorship',
      description: 'Gold sponsorship for FitSync Demo Iron Temple',
      metadata: new Map([['gymId', String(gymOne._id)], ['tier', 'gold'], ['paymentReference', 'DEMO-SPONSOR-IRON-001']]),
      createdAt: daysAgo(8),
    },
    {
      amount: 9000,
      user: owner._id,
      type: 'sponsorship',
      description: 'Silver sponsorship for FitSync Demo Flow Studio',
      metadata: new Map([['gymId', String(gymTwo._id)], ['tier', 'silver'], ['paymentReference', 'DEMO-SPONSOR-FLOW-001']]),
      createdAt: daysAgo(3),
    },
    {
      amount: 1600,
      user: owner._id,
      type: 'renewal',
      description: 'Owner share for trainee alpha renewal',
      metadata: new Map([['gymId', String(gymOne._id)], ['membershipId', String(activeMembershipAlpha._id)], ['paymentReference', 'DEMO-MEM-ALPHA-002']]),
      createdAt: daysAgo(10),
    },
    {
      amount: 1600,
      user: trainerAlpha._id,
      type: 'renewal',
      description: 'Trainer share for trainee alpha renewal',
      metadata: new Map([['gymId', String(gymOne._id)], ['membershipId', String(activeMembershipAlpha._id)], ['paymentReference', 'DEMO-MEM-ALPHA-002']]),
      createdAt: daysAgo(10),
    },
    {
      amount: 3900,
      user: owner._id,
      type: 'membership',
      description: 'Owner share for trainee beta membership',
      metadata: new Map([['gymId', String(gymTwo._id)], ['membershipId', String(activeMembershipBeta._id)], ['paymentReference', 'DEMO-MEM-BETA-001']]),
      createdAt: daysAgo(5),
    },
    {
      amount: 3900,
      user: trainerBeta._id,
      type: 'membership',
      description: 'Trainer share for trainee beta membership',
      metadata: new Map([['gymId', String(gymTwo._id)], ['membershipId', String(activeMembershipBeta._id)], ['paymentReference', 'DEMO-MEM-BETA-001']]),
      createdAt: daysAgo(5),
    },
    {
      amount: 330,
      user: admin._id,
      type: 'marketplace',
      description: 'Platform commission for delivered demo order',
      metadata: new Map([['orderNumber', 'DEMO-ORDER-001']]),
      createdAt: daysAgo(2),
    },
    {
      amount: 1870,
      user: seller._id,
      type: 'seller',
      description: 'Seller payout for delivered demo order',
      metadata: new Map([['orderNumber', 'DEMO-ORDER-001']]),
      createdAt: daysAgo(2),
    },
  ]);

  const impressionRows = [];
  for (let offset = 0; offset < 30; offset += 1) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - offset);
    impressionRows.push({
      gym: gymOne._id,
      date: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())),
      count: 95 + offset * 2,
      openCount: 24 + (offset % 5),
      lastImpressionAt: date,
      lastOpenAt: date,
    });
    impressionRows.push({
      gym: gymTwo._id,
      date: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())),
      count: 62 + offset,
      openCount: 15 + (offset % 4),
      lastImpressionAt: date,
      lastOpenAt: date,
    });
  }

  await GymImpressionDaily.insertMany(impressionRows);

  const gymOneImpressions = impressionRows
    .filter((row) => String(row.gym) === String(gymOne._id))
    .reduce((sum, row) => sum + row.count, 0);
  const gymOneOpens = impressionRows
    .filter((row) => String(row.gym) === String(gymOne._id))
    .reduce((sum, row) => sum + row.openCount, 0);
  const gymTwoImpressions = impressionRows
    .filter((row) => String(row.gym) === String(gymTwo._id))
    .reduce((sum, row) => sum + row.count, 0);
  const gymTwoOpens = impressionRows
    .filter((row) => String(row.gym) === String(gymTwo._id))
    .reduce((sum, row) => sum + row.openCount, 0);

  await Promise.all([
    Gym.updateOne(
      { _id: gymOne._id },
      {
        $set: {
          'analytics.impressions': gymOneImpressions,
          'analytics.opens': gymOneOpens,
          'analytics.memberships': 1,
          'analytics.trainers': 1,
          'analytics.lastImpressionAt': daysAgo(0),
          'analytics.lastOpenAt': daysAgo(0),
          'analytics.lastReviewAt': daysAgo(4),
        },
      },
    ),
    Gym.updateOne(
      { _id: gymTwo._id },
      {
        $set: {
          'analytics.impressions': gymTwoImpressions,
          'analytics.opens': gymTwoOpens,
          'analytics.memberships': 1,
          'analytics.trainers': 1,
          'analytics.lastImpressionAt': daysAgo(0),
          'analytics.lastOpenAt': daysAgo(0),
          'analytics.lastReviewAt': daysAgo(2),
        },
      },
    ),
  ]);

  await Promise.all([
    recordAuditLog({
      actor: admin._id,
      actorRole: admin.role,
      action: 'admin.settings.updated',
      entityType: 'systemSettings',
      entityId: 'demo-seed',
      summary: 'Demo environment configured for evaluation',
      metadata: { mode: analyticsOnly ? 'analytics-only' : 'demo' },
    }),
    recordAuditLog({
      actor: owner._id,
      actorRole: owner.role,
      action: 'owner.trainer.approved',
      entityType: 'trainerAssignment',
      entityId: `${trainerAlpha._id}-${gymOne._id}`,
      summary: 'Demo trainer approved for flagship gym',
      metadata: { gymId: String(gymOne._id), trainerId: String(trainerAlpha._id) },
    }),
    recordAuditLog({
      actor: traineeAlpha._id,
      actorRole: traineeAlpha.role,
      action: 'booking.created',
      entityType: 'booking',
      entityId: 'demo-booking-seed',
      summary: 'Demo booking request created',
      metadata: { gymId: String(gymOne._id), trainerId: String(trainerAlpha._id) },
    }),
  ]);

  console.log(`Demo seed complete${analyticsOnly ? ' (analytics mode)' : ''}.`);
  console.log('Accounts:');
  console.log(`  Admin: ${admin.email} / Demo@123`);
  console.log(`  Manager: ${manager.email} / Demo@123`);
  console.log(`  Owner: ${owner.email} / Demo@123`);
  console.log(`  Trainer Alpha: ${trainerAlpha.email} / Demo@123`);
  console.log(`  Trainer Beta: ${trainerBeta.email} / Demo@123`);
  console.log(`  Trainee Alpha: ${traineeAlpha.email} / Demo@123`);
  console.log(`  Trainee Beta: ${traineeBeta.email} / Demo@123`);
  console.log(`  Seller: ${seller.email} / Demo@123`);
  console.log(`Gyms: ${gymOne.name}, ${gymTwo.name}`);
  console.log(`Historical membership id seeded: ${expiredMembership._id}`);
};

connectDB()
  .then(() => seed())
  .then(async () => {
    await mongoose.connection.close();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('Demo seed failed', error);
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  });
