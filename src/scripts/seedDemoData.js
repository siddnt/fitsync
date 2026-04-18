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
import ProductReview from '../models/productReview.model.js';
import Order from '../models/order.model.js';
import AuditLog from '../models/auditLog.model.js';
import Notification from '../models/notification.model.js';
import GymImpressionDaily from '../models/gymImpressionDaily.model.js';
import Contact from '../models/contact.model.js';
import InternalConversation from '../models/internalConversation.model.js';
import SystemSetting from '../models/systemSetting.model.js';
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
  'trainee.gamma@fitsync.local',
  'trainee.delta@fitsync.local',
  'seller.demo@fitsync.local',
];

const DEMO_GYM_NAMES = [
  'FitSync Demo Iron Temple',
  'FitSync Demo Flow Studio',
];

const DEMO_SETTING_KEYS = [
  'marketplaceEnabled',
  'autoApproveTrainers',
  'showBetaDashboards',
  'maintenanceMode',
  'supportInboxEnabled',
  'paymentCheckoutEnabled',
  'searchIndexingEnabled',
  'cacheWarmupEnabled',
  'orderReturnsEnabled',
  'gymModerationAlerts',
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
  const existingProducts = await Product.find({ seller: { $in: userIds } }).select('_id').lean();
  const productIds = existingProducts.map((product) => product._id);

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
    ProductReview.deleteMany({
      $or: [
        { user: { $in: userIds } },
        { product: { $in: productIds } },
      ],
    }),
    Review.deleteMany({
      $or: [
        { user: { $in: userIds } },
        { gym: { $in: gymIds } },
      ],
    }),
    Contact.deleteMany({
      $or: [
        { assignedTo: { $in: userIds } },
        { gym: { $in: gymIds } },
        { email: { $in: DEMO_EMAILS } },
      ],
    }),
    InternalConversation.deleteMany({
      $or: [
        { createdBy: { $in: userIds } },
        { gym: { $in: gymIds } },
        { 'participants.user': { $in: userIds } },
      ],
    }),
    AuditLog.deleteMany({
      $or: [
        { actor: { $in: userIds } },
        { entityId: { $in: [...userIds, ...gymIds].map((id) => String(id)) } },
      ],
    }),
    Notification.deleteMany({ user: { $in: userIds } }),
    SystemSetting.deleteMany({
      $or: [
        { key: { $in: DEMO_SETTING_KEYS } },
        { updatedBy: { $in: userIds } },
      ],
    }),
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
      profilePicture: '/images/about/trainer3.jpg',
      profile: {
        headline: 'Platform administrator',
        about: 'Oversees safety, moderation, and platform readiness across every workflow.',
        location: 'Pune, India',
        company: 'FitSync Ops',
      },
    },
    {
      firstName: 'Manager',
      lastName: 'Demo',
      email: 'manager.demo@fitsync.local',
      password: 'Demo@123',
      role: 'manager',
      status: 'active',
      profilePicture: '/images/about/trainer2.jpg',
      profile: {
        headline: 'Ops manager',
        about: 'Handles support escalations, gym onboarding, and operational response.',
        location: 'Bengaluru, India',
        company: 'FitSync Ops',
      },
    },
    {
      firstName: 'Olivia',
      lastName: 'Owner',
      email: 'owner.demo@fitsync.local',
      password: 'Demo@123',
      role: 'gym-owner',
      status: 'active',
      profilePicture: '/images/about/trainer1.jpg',
      profile: {
        headline: 'Multi-location gym owner',
        about: 'Building premium coaching-led gym experiences with clear retention metrics.',
        location: 'Pune & Bengaluru',
        company: 'FitSync Demo Clubs',
        socialLinks: {
          website: 'https://owner-demo.fitsync.local',
          instagram: 'https://instagram.com/fitsyncdemoowner',
        },
      },
      bio: 'Owns the demo flagship gyms and actively invests in sponsorship and retention programmes.',
      contactNumber: '9876500001',
      address: 'Demo Owner Office, Pune',
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
      mentoredCount: 28,
      specializations: ['Strength', 'Mobility'],
      certifications: ['ACE CPT', 'Nutrition Basics'],
      profilePicture: '/images/about/trainer1.jpg',
      profile: {
        headline: 'Strength and conditioning coach',
        about: 'Helps members progress from foundational strength to confident barbell work.',
        location: 'Pune',
        socialLinks: {
          website: 'https://coach-arjun.fitsync.local',
        },
      },
      bio: 'Performance-focused coach known for precise cues and measurable programming.',
      contactNumber: '9876501001',
      address: 'FitSync Demo Iron Temple',
      trainerMetrics: { activeTrainees: 2, gyms: [] },
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
      mentoredCount: 19,
      specializations: ['Yoga', 'Functional'],
      certifications: ['RYT 200', 'Functional Mobility'],
      profilePicture: '/images/about/trainer2.jpg',
      profile: {
        headline: 'Mobility and recovery specialist',
        about: 'Blends breathwork, mobility, and postural strength into calm but demanding sessions.',
        location: 'Bengaluru',
        socialLinks: {
          website: 'https://coach-mira.fitsync.local',
        },
      },
      bio: 'Leads the recovery-led programmes and helps desk-bound members regain range of motion.',
      contactNumber: '9876501002',
      address: 'FitSync Demo Flow Studio',
      trainerMetrics: { activeTrainees: 2, gyms: [] },
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
      profilePicture: '/images/gallery/gallery3.jpg',
      profile: {
        headline: 'Progress-focused trainee',
        location: 'Pune',
      },
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
      profilePicture: '/images/gallery/gallery4.jpg',
      profile: {
        headline: 'Mobility-first trainee',
        location: 'Bengaluru',
      },
      gender: 'male',
      age: 31,
      height: 176,
      weight: 79,
    },
    {
      firstName: 'Naina',
      lastName: 'Trainee',
      email: 'trainee.gamma@fitsync.local',
      password: 'Demo@123',
      role: 'trainee',
      status: 'active',
      traineeMetrics: { activeMemberships: 1 },
      fitnessGoals: ['Increase confidence with free weights', 'Stay consistent'],
      profilePicture: '/images/gallery/gallery6.jpg',
      profile: {
        headline: 'Evening strength member',
        location: 'Pune',
      },
      gender: 'female',
      age: 27,
      height: 168,
      weight: 63,
    },
    {
      firstName: 'Dev',
      lastName: 'Trainee',
      email: 'trainee.delta@fitsync.local',
      password: 'Demo@123',
      role: 'trainee',
      status: 'active',
      traineeMetrics: { activeMemberships: 1 },
      fitnessGoals: ['Recover mobility', 'Build routine'],
      profilePicture: '/images/gallery/gallery7.jpg',
      profile: {
        headline: 'Hybrid wellness member',
        location: 'Bengaluru',
      },
      gender: 'male',
      age: 34,
      height: 181,
      weight: 82,
    },
    {
      firstName: 'Sonal',
      lastName: 'Seller',
      email: 'seller.demo@fitsync.local',
      password: 'Demo@123',
      role: 'seller',
      status: 'active',
      profilePicture: '/images/about/trainer3.jpg',
      profile: {
        headline: 'Supplements and gear merchant',
        about: 'Ships recovery supplements, home-training accessories, and apparel across demo cities.',
        location: 'Mumbai, India',
        company: 'FitSync Supply Co.',
        socialLinks: {
          website: 'https://seller-demo.fitsync.local',
          instagram: 'https://instagram.com/fitsyncsupply',
        },
      },
      bio: 'Runs the demo seller storefront with fast dispatch and structured return handling.',
      contactNumber: '9876509001',
      address: 'Warehouse 7, Mumbai',
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
    traineeGamma,
    traineeDelta,
    seller,
  ] = users;

  const gyms = await Gym.create([
    {
      owner: owner._id,
      trainers: [trainerAlpha._id],
      name: DEMO_GYM_NAMES[0],
      description: 'Strength-first flagship facility with premium coaching, coached lifting blocks, recovery access, and clear progression for both beginners and intermediate lifters.',
      location: {
        address: '101 Atlas Road',
        city: 'Pune',
        state: 'Maharashtra',
        postalCode: '411001',
        coordinates: {
          lat: 18.5204,
          lng: 73.8567,
        },
      },
      pricing: {
        monthlyMrp: 3600,
        monthlyPrice: 3200,
        currency: 'INR',
        membershipPlans: [
          { code: 'monthly', label: 'Monthly', durationMonths: 1, mrp: 3600, price: 3200, currency: 'INR' },
          { code: 'quarterly', label: 'Quarterly', durationMonths: 3, mrp: 10200, price: 9000, currency: 'INR' },
          { code: 'half-yearly', label: 'Half yearly', durationMonths: 6, mrp: 19200, price: 16800, currency: 'INR' },
        ],
      },
      features: ['Barbell coaching', 'Progress tracking', 'Nutrition guidance', 'Small-group classes'],
      amenities: ['Strength floor', 'Recovery zone', 'Showers', 'Locker rooms', 'Mobility tools', 'Parking'],
      keyFeatures: ['Small-batch coaching', 'Olympic platforms', 'Technique clinics'],
      tags: ['Strength', 'Beginner friendly', 'Recovery'],
      images: ['/images/gyms/Strength_training.jpg'],
      gallery: [
        '/images/gyms/Strength_training.jpg',
        '/images/gallery/gallery2.jpg',
        '/images/gallery/gallery5.jpg',
      ],
      contact: {
        phone: '9876543210',
        email: 'iron-temple@fitsync.local',
        website: 'https://iron-temple-demo.fitsync.local',
        whatsapp: '919876543210',
      },
      schedule: { openTime: '05:30', closeTime: '22:30', workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
      analytics: { impressions: 0, opens: 0, memberships: 2, trainers: 1, rating: 4.8, ratingCount: 2 },
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
      trainers: [trainerBeta._id],
      name: DEMO_GYM_NAMES[1],
      description: 'Community-first studio focused on flexibility, mobility, guided yoga, and sustainable routines for busy professionals and recovery-minded members.',
      location: {
        address: '22 Harmony Lane',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560001',
        coordinates: {
          lat: 12.9716,
          lng: 77.5946,
        },
      },
      pricing: {
        monthlyMrp: 3000,
        monthlyPrice: 2600,
        currency: 'INR',
        membershipPlans: [
          { code: 'monthly', label: 'Monthly', durationMonths: 1, mrp: 3000, price: 2600, currency: 'INR' },
          { code: 'quarterly', label: 'Quarterly', durationMonths: 3, mrp: 8400, price: 7800, currency: 'INR' },
          { code: 'yearly', label: 'Yearly', durationMonths: 12, mrp: 30000, price: 27600, currency: 'INR' },
        ],
      },
      features: ['Mobility classes', 'Breathwork', 'Guided recovery', 'Community events'],
      amenities: ['Yoga hall', 'Breathwork room', 'Smoothie bar', 'Showers', 'Meditation corner'],
      keyFeatures: ['Low-impact training', 'Guided mobility classes', 'Recovery workshops'],
      tags: ['Yoga', 'Mobility', 'Recovery'],
      images: ['/images/gyms/yoga.jpg'],
      gallery: [
        '/images/gyms/yoga.jpg',
        '/images/gyms/zumba.jpg',
        '/images/gallery/gallery8.jpg',
      ],
      contact: {
        phone: '9876501234',
        email: 'flow-studio@fitsync.local',
        website: 'https://flow-studio-demo.fitsync.local',
        whatsapp: '919876501234',
      },
      schedule: { openTime: '06:00', closeTime: '21:30', workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
      analytics: { impressions: 0, opens: 0, memberships: 2, trainers: 1, rating: 4.7, ratingCount: 2 },
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
      autoRenew: true,
      invoices: [
        {
          amount: 17999,
          currency: 'INR',
          paidOn: daysAgo(110),
          paymentReference: 'DEMO-LIST-IRON-ROLL-000',
          status: 'paid',
        },
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
          amount: 6499,
          currency: 'INR',
          paidOn: daysAgo(42),
          paymentReference: 'DEMO-LIST-FLOW-ROLL-000',
          status: 'paid',
        },
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
    endDate: daysFromNow(18),
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

  const activeMembershipGamma = await GymMembership.create({
    trainee: traineeGamma._id,
    gym: gymOne._id,
    trainer: trainerAlpha._id,
    plan: 'quarterly',
    startDate: daysAgo(22),
    endDate: daysFromNow(6),
    status: 'active',
    autoRenew: true,
    billing: {
      amount: 9000,
      currency: 'INR',
      paymentGateway: 'internal',
      paymentReference: 'DEMO-MEM-GAMMA-001',
      status: 'paid',
    },
  });

  const activeMembershipDelta = await GymMembership.create({
    trainee: traineeDelta._id,
    gym: gymTwo._id,
    trainer: trainerBeta._id,
    plan: 'monthly',
    startDate: daysAgo(16),
    endDate: daysFromNow(12),
    status: 'active',
    autoRenew: false,
    billing: {
      amount: 2600,
      currency: 'INR',
      paymentGateway: 'internal',
      paymentReference: 'DEMO-MEM-DELTA-001',
      status: 'paid',
    },
  });

  await Promise.all([
    User.findByIdAndUpdate(traineeAlpha._id, {
      $set: {
        'traineeMetrics.primaryGym': gymOne._id,
        'traineeMetrics.lastCheckInAt': daysAgo(1),
      },
    }),
    User.findByIdAndUpdate(traineeBeta._id, {
      $set: {
        'traineeMetrics.primaryGym': gymTwo._id,
        'traineeMetrics.lastCheckInAt': daysAgo(2),
      },
    }),
    User.findByIdAndUpdate(traineeGamma._id, {
      $set: {
        'traineeMetrics.primaryGym': gymOne._id,
        'traineeMetrics.lastCheckInAt': daysAgo(3),
      },
    }),
    User.findByIdAndUpdate(traineeDelta._id, {
      $set: {
        'traineeMetrics.primaryGym': gymTwo._id,
        'traineeMetrics.lastCheckInAt': daysAgo(4),
      },
    }),
  ]);

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
        {
          trainee: traineeGamma._id,
          assignedAt: activeMembershipGamma.startDate,
          status: 'active',
          goals: ['Build confidence with barbells', 'Improve weekly consistency'],
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
        {
          trainee: traineeDelta._id,
          assignedAt: activeMembershipDelta.startDate,
          status: 'active',
          goals: ['Restore mobility', 'Reduce stress through movement'],
        },
      ],
    },
    {
      trainer: trainerBeta._id,
      gym: gymOne._id,
      status: 'pending',
      requestedAt: daysAgo(2),
      trainees: [],
    },
  ]);

  const trainerAlphaSlots = [
    { dayOfWeek: 1, startTime: '07:00', endTime: '08:00', capacity: 2, sessionType: 'strength-coaching', locationLabel: 'Main floor' },
    { dayOfWeek: 3, startTime: '18:00', endTime: '19:00', capacity: 2, sessionType: 'mobility-lift', locationLabel: 'Recovery corner' },
    { dayOfWeek: 4, startTime: '17:30', endTime: '18:30', capacity: 1, sessionType: 'mobility-reset', locationLabel: 'Recovery corner' },
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
        { date: daysAgo(24), status: 'present', notes: 'Locked in technique work across the full session.' },
        { date: daysAgo(21), status: 'present', notes: 'Hit every accessory target without missing tempo.' },
        { date: daysAgo(18), status: 'late', notes: 'Traffic delay, but still finished the main lifts.' },
        { date: daysAgo(15), status: 'present', notes: 'Strong squat focus and clean bracing.' },
        { date: daysAgo(11), status: 'absent', notes: 'Skipped because of a work trip and logged a home mobility session instead.' },
        { date: daysAgo(10), status: 'present', notes: 'Returned with a controlled bench session.' },
        { date: daysAgo(8), status: 'present', notes: 'Maintained form through the full deadlift ladder.' },
        { date: daysAgo(5), status: 'present', notes: 'Added progressive overload to accessory pulls.' },
        { date: daysAgo(2), status: 'present', notes: 'Personal best on trap bar deadlift with strong lockout.' },
      ],
      progressMetrics: [
        { metric: 'deadlift', value: 90, unit: 'kg', recordedAt: daysAgo(22) },
        { metric: 'deadlift', value: 95, unit: 'kg', recordedAt: daysAgo(15) },
        { metric: 'deadlift', value: 100, unit: 'kg', recordedAt: daysAgo(8) },
        { metric: 'deadlift', value: 102.5, unit: 'kg', recordedAt: daysAgo(2) },
        { metric: 'bench press', value: 42.5, unit: 'kg', recordedAt: daysAgo(12) },
        { metric: 'bench press', value: 45, unit: 'kg', recordedAt: daysAgo(3) },
      ],
      bodyMetrics: [
        { weightKg: 59.2, heightCm: 164, bmi: 22.0, recordedAt: daysAgo(28) },
        { weightKg: 58.9, heightCm: 164, bmi: 21.9, recordedAt: daysAgo(21) },
        { weightKg: 58.6, heightCm: 164, bmi: 21.8, recordedAt: daysAgo(14) },
        { weightKg: 58.0, heightCm: 164, bmi: 21.6, recordedAt: daysAgo(1) },
      ],
      dietPlans: [
        {
          weekOf: daysAgo(18),
          notes: 'Use the late-afternoon snack to keep energy stable before strength work.',
          meals: [
            { mealType: 'breakfast', item: 'Egg white wrap', calories: 340, protein: 26, fat: 9, notes: 'Add spinach on heavy days.' },
            { mealType: 'lunch', item: 'Chicken quinoa bowl', calories: 590, protein: 40, fat: 16 },
            { mealType: 'snack', item: 'Banana whey shake', calories: 250, protein: 25, fat: 4 },
            { mealType: 'dinner', item: 'Tofu stir fry with rice', calories: 520, protein: 31, fat: 17 },
          ],
        },
        {
          weekOf: daysAgo(11),
          notes: 'Recovery week: keep hydration high and cut back on takeaway meals.',
          meals: [
            { mealType: 'breakfast', item: 'Greek yogurt bowl', calories: 380, protein: 28, fat: 9 },
            { mealType: 'lunch', item: 'Turkey sandwich and fruit', calories: 470, protein: 34, fat: 13 },
            { mealType: 'snack', item: 'Protein smoothie', calories: 240, protein: 24, fat: 5 },
            { mealType: 'dinner', item: 'Paneer stir fry', calories: 510, protein: 33, fat: 18 },
          ],
        },
        {
          weekOf: daysAgo(4),
          notes: 'Push protein intake slightly higher on training days and keep dinner lighter on rest days.',
          meals: [
            { mealType: 'breakfast', item: 'Greek yogurt bowl', calories: 380, protein: 28, fat: 9 },
            { mealType: 'lunch', item: 'Chicken rice bowl', calories: 620, protein: 42, fat: 14 },
            { mealType: 'snack', item: 'Protein smoothie', calories: 240, protein: 24, fat: 5 },
            { mealType: 'dinner', item: 'Paneer stir fry', calories: 510, protein: 33, fat: 18, notes: 'Swap rice for greens on rest evenings.' },
          ],
        },
      ],
      feedback: [
        { message: 'Bar path looked cleaner on every deadlift set this fortnight.', category: 'progress', createdAt: daysAgo(9) },
        { message: 'Excellent adherence this week. Keep your bracing tight on heavy pulls.', category: 'progress', createdAt: daysAgo(2) },
        { message: 'Bench press setup is more stable now. Stay patient on the descent.', category: 'technique', createdAt: daysAgo(1) },
      ],
      traineeFeedback: [
        { message: 'The deadlift cues helped a lot. Feeling stronger already.', createdAt: daysAgo(4) },
        { message: 'The new meal timing stopped the mid-afternoon energy dip before training.', createdAt: daysAgo(1) },
      ],
      summary: 'Steady strength gains with excellent consistency, clearer meal adherence, and better recovery habits.',
    },
    {
      trainer: trainerBeta._id,
      trainee: traineeBeta._id,
      gym: gymTwo._id,
      attendance: [
        { date: daysAgo(18), status: 'present', notes: 'Completed the beginner flow without stopping.' },
        { date: daysAgo(14), status: 'present', notes: 'Better control through hip openers.' },
        { date: daysAgo(11), status: 'late', notes: 'Joined a little late after work but still finished the cooldown.' },
        { date: daysAgo(9), status: 'present', notes: 'Improved transition pacing.' },
        { date: daysAgo(7), status: 'present', notes: 'Completed full flow with stronger balance.' },
        { date: daysAgo(5), status: 'present', notes: 'Core stability held up through longer holds.' },
        { date: daysAgo(3), status: 'present', notes: 'Core endurance improved and breathing stayed calm.' },
      ],
      progressMetrics: [
        { metric: 'plank', value: 75, unit: 'seconds', recordedAt: daysAgo(18) },
        { metric: 'plank', value: 90, unit: 'seconds', recordedAt: daysAgo(12) },
        { metric: 'plank', value: 105, unit: 'seconds', recordedAt: daysAgo(6) },
        { metric: 'plank', value: 120, unit: 'seconds', recordedAt: daysAgo(1) },
      ],
      bodyMetrics: [
        { weightKg: 80.4, heightCm: 176, bmi: 26.0, recordedAt: daysAgo(21) },
        { weightKg: 79.7, heightCm: 176, bmi: 25.7, recordedAt: daysAgo(10) },
        { weightKg: 79.0, heightCm: 176, bmi: 25.5, recordedAt: daysAgo(5) },
      ],
      dietPlans: [
        {
          weekOf: daysAgo(12),
          notes: 'Start with consistent breakfast protein and reduce sugar-heavy evening snacks.',
          meals: [
            { mealType: 'breakfast', item: 'Overnight oats', calories: 360, protein: 18, fat: 10 },
            { mealType: 'lunch', item: 'Dal and millet', calories: 540, protein: 24, fat: 11 },
            { mealType: 'snack', item: 'Fruit and nuts', calories: 220, protein: 6, fat: 12 },
            { mealType: 'dinner', item: 'Grilled fish and greens', calories: 480, protein: 38, fat: 14 },
          ],
        },
        {
          weekOf: daysAgo(3),
          notes: 'Prioritize hydration, keep the late-night snack smaller, and hold the evening mobility routine.',
          meals: [
            { mealType: 'breakfast', item: 'Protein chia pudding', calories: 330, protein: 22, fat: 11 },
            { mealType: 'lunch', item: 'Dal and millet', calories: 540, protein: 24, fat: 11 },
            { mealType: 'snack', item: 'Fruit and nuts', calories: 220, protein: 6, fat: 12 },
            { mealType: 'dinner', item: 'Grilled fish and greens', calories: 480, protein: 38, fat: 14 },
          ],
        },
      ],
      feedback: [
        { message: 'Your posture looked much better through the full yoga flow this week.', category: 'progress', createdAt: daysAgo(6) },
        { message: 'Keep owning the exhale during mobility drills and the holds will feel easier.', category: 'mobility', createdAt: daysAgo(1) },
      ],
      traineeFeedback: [
        { message: 'The evening sessions are helping my back pain a lot.', createdAt: daysAgo(5) },
        { message: 'The meal plan is much easier to stick to than the first version.', createdAt: daysAgo(1) },
      ],
      summary: 'Great early momentum, noticeably better mobility control, and more consistent nutrition habits.',
    },
    {
      trainer: trainerAlpha._id,
      trainee: traineeGamma._id,
      gym: gymOne._id,
      attendance: [
        { date: daysAgo(16), status: 'present', notes: 'Finished the full beginner strength circuit.' },
        { date: daysAgo(13), status: 'present', notes: 'Handled dumbbell pressing volume well.' },
        { date: daysAgo(10), status: 'absent', notes: 'Missed due to travel, then completed recovery work at home.' },
        { date: daysAgo(6), status: 'present', notes: 'Returned with better setup confidence.' },
        { date: daysAgo(3), status: 'present', notes: 'Grip and pacing improved across every set.' },
      ],
      progressMetrics: [
        { metric: 'goblet squat', value: 16, unit: 'kg', recordedAt: daysAgo(18) },
        { metric: 'goblet squat', value: 18, unit: 'kg', recordedAt: daysAgo(10) },
        { metric: 'goblet squat', value: 22, unit: 'kg', recordedAt: daysAgo(2) },
      ],
      bodyMetrics: [
        { weightKg: 64.2, heightCm: 168, bmi: 22.7, recordedAt: daysAgo(20) },
        { weightKg: 63.5, heightCm: 168, bmi: 22.5, recordedAt: daysAgo(12) },
        { weightKg: 62.8, heightCm: 168, bmi: 22.3, recordedAt: daysAgo(2) },
      ],
      dietPlans: [
        {
          weekOf: daysAgo(5),
          notes: 'Keep meals simple and repeatable while your gym confidence keeps building.',
          meals: [
            { mealType: 'breakfast', item: 'Peanut butter toast and eggs', calories: 410, protein: 22, fat: 17 },
            { mealType: 'lunch', item: 'Rice, dal, and grilled chicken', calories: 610, protein: 39, fat: 15 },
            { mealType: 'snack', item: 'Yogurt with berries', calories: 190, protein: 13, fat: 4 },
            { mealType: 'dinner', item: 'Salmon, potatoes, and beans', calories: 560, protein: 37, fat: 18 },
          ],
        },
      ],
      feedback: [
        { message: 'Confidence is increasing quickly. Keep owning the setup before each set.', category: 'progress', createdAt: daysAgo(13) },
        { message: 'Your squat depth is more consistent now. Stay patient at the bottom.', category: 'technique', createdAt: daysAgo(10) },
      ],
      traineeFeedback: [
        { message: 'I finally feel comfortable on the gym floor and not lost around equipment.', createdAt: daysAgo(1) },
      ],
      summary: 'Confidence, adherence, and movement quality are all trending in the right direction.',
    },
    {
      trainer: trainerBeta._id,
      trainee: traineeDelta._id,
      gym: gymTwo._id,
      attendance: [
        { date: daysAgo(15), status: 'present', notes: 'Completed the intro mobility flow with good control.' },
        { date: daysAgo(12), status: 'late', notes: 'Joined 12 minutes late but completed the cooldown.' },
        { date: daysAgo(9), status: 'present', notes: 'Shoulders stayed relaxed through longer holds.' },
        { date: daysAgo(4), status: 'present', notes: 'Desk-break mobility drill carried over well.' },
        { date: daysAgo(1), status: 'present', notes: 'Thoracic rotation improved noticeably.' },
      ],
      progressMetrics: [
        { metric: 'shoulder flexion', value: 132, unit: 'degrees', recordedAt: daysAgo(15) },
        { metric: 'shoulder flexion', value: 138, unit: 'degrees', recordedAt: daysAgo(7) },
        { metric: 'shoulder flexion', value: 144, unit: 'degrees', recordedAt: daysAgo(1) },
      ],
      bodyMetrics: [
        { weightKg: 83.1, heightCm: 181, bmi: 25.4, recordedAt: daysAgo(18) },
        { weightKg: 82.3, heightCm: 181, bmi: 25.1, recordedAt: daysAgo(8) },
        { weightKg: 81.9, heightCm: 181, bmi: 25.0, recordedAt: daysAgo(1) },
      ],
      dietPlans: [
        {
          weekOf: daysAgo(6),
          notes: 'Hold a lighter dinner on weekdays and keep the post-work snack ready before commuting home.',
          meals: [
            { mealType: 'breakfast', item: 'Veg omelette and toast', calories: 390, protein: 25, fat: 16 },
            { mealType: 'lunch', item: 'Paneer wrap with salad', calories: 520, protein: 30, fat: 18 },
            { mealType: 'snack', item: 'Trail mix and kefir', calories: 260, protein: 11, fat: 14 },
            { mealType: 'dinner', item: 'Grilled tofu with stir-fried vegetables', calories: 470, protein: 28, fat: 15 },
          ],
        },
      ],
      feedback: [
        { message: 'Range is opening up well. Stay consistent with the desk-break drill between sessions.', category: 'mobility', createdAt: daysAgo(5) },
        { message: 'Breathing looked calmer in the last session. Keep the same rhythm through end range.', category: 'recovery', createdAt: daysAgo(1) },
      ],
      traineeFeedback: [
        { message: 'The evening mobility work is making long workdays much easier to recover from.', createdAt: daysAgo(1) },
      ],
      summary: 'Mobility markers are improving quickly, soreness after work is down, and evening recovery routines are sticking.',
    },
  ]);

  await Review.create([
    {
      user: traineeAlpha._id,
      gym: gymOne._id,
      rating: 5,
      comment: 'Excellent coaching quality, a serious training atmosphere, and clear progression week to week.',
      createdAt: daysAgo(4),
      updatedAt: daysAgo(4),
    },
    {
      user: traineeGamma._id,
      gym: gymOne._id,
      rating: 4,
      comment: 'Very supportive for newer lifters. The staff explain why every drill matters.',
      createdAt: daysAgo(6),
      updatedAt: daysAgo(6),
    },
    {
      user: traineeBeta._id,
      gym: gymTwo._id,
      rating: 4,
      comment: 'Supportive instructors, calm studio energy, and classes that genuinely help mobility.',
      createdAt: daysAgo(2),
      updatedAt: daysAgo(2),
    },
    {
      user: traineeDelta._id,
      gym: gymTwo._id,
      rating: 5,
      comment: 'The recovery classes are structured really well and the coaching feels personal.',
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
    },
  ]);

  const nextMonday = nextWeekdayAtNoonUtc(1);
  const nextTuesday = nextWeekdayAtNoonUtc(2);
  const nextWednesday = nextWeekdayAtNoonUtc(3);
  const nextThursday = nextWeekdayAtNoonUtc(4);
  const previousMonday = new Date(nextMonday);
  const previousTuesday = new Date(nextTuesday);
  const previousThursday = new Date(nextThursday);
  const todaySession = new Date();
  todaySession.setHours(18, 0, 0, 0);
  const weekdayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  previousMonday.setUTCDate(previousMonday.getUTCDate() - 7);
  previousTuesday.setUTCDate(previousTuesday.getUTCDate() - 7);
  previousThursday.setUTCDate(previousThursday.getUTCDate() - 7);

  await Booking.create([
    {
      user: traineeAlpha._id,
      trainer: trainerAlpha._id,
      gym: gymOne._id,
      gymName: gymOne.name,
      availabilitySlotKey: buildAvailabilitySlotKey(trainerAlphaSlots[1]),
      day: weekdayNames[todaySession.getDay()],
      startTime: '18:00',
      endTime: '19:00',
      bookingDate: todaySession,
      timezone: 'Asia/Calcutta',
      sessionType: 'mobility-lift',
      locationLabel: 'Recovery corner',
      status: 'confirmed',
      type: 'in-person',
      paymentStatus: 'free',
      notes: 'Today session focused on recovery prep before the next heavy strength block.',
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
      bookingDate: nextMonday,
      timezone: 'Asia/Calcutta',
      sessionType: 'strength-coaching',
      locationLabel: 'Main floor',
      status: 'pending',
      type: 'in-person',
      paymentStatus: 'free',
      notes: 'Would like to focus on upper-body pressing mechanics. Trainer note: bring last week\'s bench video.',
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
      notes: 'Need a mobility reset before the next heavy week. Trainer note: plan includes ankle and T-spine prep.',
    },
    {
      user: traineeAlpha._id,
      trainer: trainerAlpha._id,
      gym: gymOne._id,
      gymName: gymOne.name,
      availabilitySlotKey: buildAvailabilitySlotKey(trainerAlphaSlots[2]),
      day: 'thursday',
      startTime: '17:30',
      endTime: '18:30',
      bookingDate: nextThursday,
      timezone: 'Asia/Calcutta',
      sessionType: 'mobility-reset',
      locationLabel: 'Recovery corner',
      status: 'cancelled',
      type: 'in-person',
      paymentStatus: 'free',
      notes: 'Cancelled due to work travel. Trainer note: reschedule into next week\'s reset block.',
      cancellationReason: 'Travelling for work this week.',
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
      notes: 'Completed demo calibration session. Trainer note: deadlift setup improved after cueing.',
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
      notes: 'Need extra work on hip opening and breath pacing. Trainer note: bring mobility strap for home drill review.',
    },
    {
      user: traineeBeta._id,
      trainer: trainerBeta._id,
      gym: gymTwo._id,
      gymName: gymTwo.name,
      availabilitySlotKey: buildAvailabilitySlotKey(trainerBetaSlots[1]),
      day: 'thursday',
      startTime: '19:00',
      endTime: '20:00',
      bookingDate: nextThursday,
      timezone: 'Asia/Calcutta',
      sessionType: 'mobility-reset',
      locationLabel: 'Studio room',
      status: 'confirmed',
      type: 'in-person',
      paymentStatus: 'free',
      notes: 'Confirmed mobility reset before a long work stretch. Trainer note: add thoracic opener sequence.',
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
      bookingDate: previousTuesday,
      timezone: 'Asia/Calcutta',
      sessionType: 'yoga-flow',
      locationLabel: 'Studio room',
      status: 'completed',
      type: 'in-person',
      paymentStatus: 'free',
      notes: 'Completed focus session. Trainer note: balance transitions looked much steadier.',
    },
    {
      user: traineeBeta._id,
      trainer: trainerBeta._id,
      gym: gymTwo._id,
      gymName: gymTwo.name,
      availabilitySlotKey: buildAvailabilitySlotKey(trainerBetaSlots[1]),
      day: 'thursday',
      startTime: '19:00',
      endTime: '20:00',
      bookingDate: previousThursday,
      timezone: 'Asia/Calcutta',
      sessionType: 'mobility-reset',
      locationLabel: 'Studio room',
      status: 'cancelled',
      type: 'in-person',
      paymentStatus: 'free',
      notes: 'Cancelled after a schedule clash. Trainer note: home stretch routine was shared instead.',
      cancellationReason: 'Late client call ran into the session slot.',
    },
    {
      user: traineeGamma._id,
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
      notes: 'Building confidence with recovery work between beginner strength blocks.',
    },
    {
      user: traineeDelta._id,
      trainer: trainerBeta._id,
      gym: gymTwo._id,
      gymName: gymTwo.name,
      availabilitySlotKey: buildAvailabilitySlotKey(trainerBetaSlots[1]),
      day: 'thursday',
      startTime: '19:00',
      endTime: '20:00',
      bookingDate: previousThursday,
      timezone: 'Asia/Calcutta',
      sessionType: 'mobility-reset',
      locationLabel: 'Studio room',
      status: 'completed',
      type: 'in-person',
      paymentStatus: 'free',
      notes: 'Completed desk-recovery reset. Trainer note: shoulder range held through the cooldown.',
    },
  ]);

  const products = await Product.create([
    {
      seller: seller._id,
      name: 'Demo Whey Protein',
      description: 'High-protein whey blend for post-workout recovery with chocolate flavour and easy-mix texture.',
      price: 2200,
      mrp: 2500,
      image: '/images/products/protein-powder.jpg',
      category: 'supplements',
      stock: 32,
      status: 'available',
      metrics: {
        sales: {
          totalSold: 24,
          lastSoldAt: daysAgo(2),
          recentDaily: [
            { date: daysAgo(3).toISOString().slice(0, 10), quantity: 3 },
            { date: daysAgo(2).toISOString().slice(0, 10), quantity: 2 },
            { date: daysAgo(1).toISOString().slice(0, 10), quantity: 4 },
          ],
        },
        reviews: { count: 2, averageRating: 4.5, lastReviewedAt: daysAgo(1) },
      },
      metadata: new Map([['flavour', 'Chocolate'], ['size', '2kg']]),
    },
    {
      seller: seller._id,
      name: 'Demo Yoga Mat',
      description: 'High-grip yoga mat for studio and home mobility work with extra knee support.',
      price: 1200,
      mrp: 1500,
      image: '/images/products/yoga-mat.jpg',
      category: 'equipment',
      stock: 11,
      status: 'available',
      metrics: {
        sales: {
          totalSold: 17,
          lastSoldAt: daysAgo(4),
          recentDaily: [
            { date: daysAgo(5).toISOString().slice(0, 10), quantity: 1 },
            { date: daysAgo(4).toISOString().slice(0, 10), quantity: 2 },
          ],
        },
        reviews: { count: 2, averageRating: 4.5, lastReviewedAt: daysAgo(2) },
      },
      metadata: new Map([['material', 'Natural rubber'], ['thickness', '6mm']]),
    },
    {
      seller: seller._id,
      name: 'Demo Resistance Bands Set',
      description: 'Five-band resistance kit for warmups, rehab work, and hotel-room training.',
      price: 900,
      mrp: 1100,
      image: '/images/products/resistance-bands.jpg',
      category: 'equipment',
      stock: 4,
      status: 'available',
      metrics: {
        sales: { totalSold: 14, lastSoldAt: daysAgo(1) },
        reviews: { count: 1, averageRating: 4, lastReviewedAt: daysAgo(2) },
      },
      metadata: new Map([['levels', '5 resistance bands'], ['useCase', 'Warmup and rehab']]),
    },
    {
      seller: seller._id,
      name: 'Demo Fitness Tracker',
      description: 'Lightweight tracker with step count, sleep snapshots, and workout timers.',
      price: 3200,
      mrp: 3899,
      image: '/images/products/fitness-tracker.jpg',
      category: 'accessories',
      stock: 9,
      status: 'available',
      metrics: {
        sales: { totalSold: 8, lastSoldAt: daysAgo(6) },
        reviews: { count: 0, averageRating: 0, lastReviewedAt: null },
      },
      metadata: new Map([['battery', '7 days'], ['connectivity', 'Bluetooth sync']]),
    },
    {
      seller: seller._id,
      name: 'Demo Steel Water Bottle',
      description: 'Insulated steel bottle sized for long gym sessions and commute carry.',
      price: 800,
      mrp: 950,
      image: '/images/products/water-bottle.jpg',
      category: 'accessories',
      stock: 18,
      status: 'available',
      metrics: {
        sales: { totalSold: 22, lastSoldAt: daysAgo(2) },
        reviews: { count: 1, averageRating: 4, lastReviewedAt: daysAgo(3) },
      },
      metadata: new Map([['capacity', '1 litre'], ['finish', 'Insulated steel']]),
    },
    {
      seller: seller._id,
      name: 'Demo BCAA Recovery Mix',
      description: 'Recovery mix with electrolyte support for high-volume training days.',
      price: 950,
      mrp: 1200,
      image: '/images/products/bcaa.jpg',
      category: 'supplements',
      stock: 0,
      status: 'out-of-stock',
      isPublished: true,
      metrics: {
        sales: { totalSold: 11, lastSoldAt: daysAgo(9) },
        reviews: { count: 1, averageRating: 5, lastReviewedAt: daysAgo(8) },
      },
      metadata: new Map([['flavour', 'Citrus'], ['servings', '30']]),
    },
    {
      seller: seller._id,
      name: 'Demo Gym Shorts',
      description: 'Quick-dry training shorts kept hidden while the seller refreshes inventory photography.',
      price: 1350,
      mrp: 1600,
      image: '/images/products/gym-shorts.jpg',
      category: 'clothing',
      stock: 14,
      status: 'available',
      isPublished: false,
      metrics: {
        sales: { totalSold: 5, lastSoldAt: daysAgo(13) },
        reviews: { count: 0, averageRating: 0, lastReviewedAt: null },
      },
    },
  ]);

  const [
    proteinProduct,
    yogaMatProduct,
    bandsProduct,
    trackerProduct,
    bottleProduct,
    bcaaProduct,
  ] = products;

  const orders = await Order.create([
    {
      user: traineeAlpha._id,
      seller: seller._id,
      orderNumber: 'DEMO-ORDER-001',
      shippingAddress: buildShippingAddress({ email: traineeAlpha.email }),
      paymentMethod: 'UPI',
      subtotal: 3000,
      tax: 0,
      shippingCost: 0,
      total: 3000,
      status: 'delivered',
      createdAt: daysAgo(4),
      updatedAt: daysAgo(2),
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
            { status: 'processing', note: 'Packed within four hours of checkout.', updatedBy: seller._id, updatedAt: daysAgo(4) },
            { status: 'in-transit', note: 'Picked up by BlueDart from the Mumbai warehouse.', updatedBy: seller._id, updatedAt: daysAgo(3) },
            { status: 'delivered', note: 'Delivered and signed for at reception.', updatedBy: seller._id, updatedAt: daysAgo(2) },
          ],
          payoutRecorded: true,
          tracking: {
            carrier: 'BlueDart',
            trackingNumber: 'BLUEDART-DEMO-001',
            trackingUrl: 'https://tracking.fitsync.local/BLUEDART-DEMO-001',
            updatedAt: daysAgo(2),
          },
        },
        {
          seller: seller._id,
          product: bottleProduct._id,
          name: bottleProduct.name,
          quantity: 1,
          price: 800,
          image: bottleProduct.image,
          status: 'delivered',
          lastStatusAt: daysAgo(2),
          statusHistory: [
            { status: 'processing', note: 'Bottle batch quality check passed.', updatedBy: seller._id, updatedAt: daysAgo(4) },
            { status: 'in-transit', note: 'Packed in the same parcel as the whey protein.', updatedBy: seller._id, updatedAt: daysAgo(3) },
            { status: 'delivered', note: 'Delivered with the primary parcel.', updatedBy: seller._id, updatedAt: daysAgo(2) },
          ],
          payoutRecorded: true,
          tracking: {
            carrier: 'BlueDart',
            trackingNumber: 'BLUEDART-DEMO-001',
            trackingUrl: 'https://tracking.fitsync.local/BLUEDART-DEMO-001',
            updatedAt: daysAgo(2),
          },
        },
      ],
    },
    {
      user: traineeBeta._id,
      seller: seller._id,
      orderNumber: 'DEMO-ORDER-002',
      shippingAddress: buildShippingAddress({ email: traineeBeta.email, city: 'Bengaluru', state: 'Karnataka' }),
      paymentMethod: 'Card',
      subtotal: 2100,
      tax: 0,
      shippingCost: 0,
      total: 2100,
      status: 'out-for-delivery',
      createdAt: daysAgo(3),
      updatedAt: daysAgo(0),
      orderItems: [
        {
          seller: seller._id,
          product: yogaMatProduct._id,
          name: yogaMatProduct.name,
          quantity: 1,
          price: 1200,
          image: yogaMatProduct.image,
          status: 'out-for-delivery',
          lastStatusAt: daysAgo(0),
          statusHistory: [
            { status: 'processing', note: 'Rolled and tagged for same-day dispatch.', updatedBy: seller._id, updatedAt: daysAgo(3) },
            { status: 'in-transit', note: 'Reached the Bengaluru sorting hub overnight.', updatedBy: seller._id, updatedAt: daysAgo(1) },
            { status: 'out-for-delivery', note: 'Courier is on the final local route today.', updatedBy: seller._id, updatedAt: daysAgo(0) },
          ],
          tracking: {
            carrier: 'Delhivery',
            trackingNumber: 'DLV-DEMO-002A',
            trackingUrl: 'https://tracking.fitsync.local/DLV-DEMO-002A',
            updatedAt: daysAgo(0),
          },
        },
        {
          seller: seller._id,
          product: bandsProduct._id,
          name: bandsProduct.name,
          quantity: 1,
          price: 900,
          image: bandsProduct.image,
          status: 'in-transit',
          lastStatusAt: daysAgo(1),
          statusHistory: [
            { status: 'processing', note: 'Bands set packed into the secondary shipment carton.', updatedBy: seller._id, updatedAt: daysAgo(3) },
            { status: 'in-transit', note: 'Secondary parcel is one hop behind the yoga mat shipment.', updatedBy: seller._id, updatedAt: daysAgo(1) },
          ],
          tracking: {
            carrier: 'Delhivery',
            trackingNumber: 'DLV-DEMO-002B',
            trackingUrl: 'https://tracking.fitsync.local/DLV-DEMO-002B',
            updatedAt: daysAgo(1),
          },
        },
      ],
    },
    {
      user: traineeAlpha._id,
      seller: seller._id,
      orderNumber: 'DEMO-ORDER-003',
      shippingAddress: buildShippingAddress({ email: traineeAlpha.email }),
      paymentMethod: 'Card',
      subtotal: 3200,
      tax: 0,
      shippingCost: 0,
      total: 3200,
      status: 'processing',
      createdAt: daysAgo(4),
      updatedAt: daysAgo(1),
      orderItems: [
        {
          seller: seller._id,
          product: trackerProduct._id,
          name: trackerProduct.name,
          quantity: 1,
          price: 3200,
          image: trackerProduct.image,
          status: 'processing',
          lastStatusAt: daysAgo(1),
          statusHistory: [
            { status: 'processing', note: 'Awaiting the next hardware QA batch before dispatch.', updatedBy: seller._id, updatedAt: daysAgo(1) },
          ],
        },
      ],
    },
    {
      user: traineeBeta._id,
      seller: seller._id,
      orderNumber: 'DEMO-ORDER-004',
      shippingAddress: buildShippingAddress({ email: traineeBeta.email, city: 'Bengaluru', state: 'Karnataka' }),
      paymentMethod: 'UPI',
      subtotal: 900,
      tax: 0,
      shippingCost: 0,
      total: 900,
      status: 'delivered',
      createdAt: daysAgo(10),
      updatedAt: daysAgo(3),
      orderItems: [
        {
          seller: seller._id,
          product: bandsProduct._id,
          name: bandsProduct.name,
          quantity: 1,
          price: 900,
          image: bandsProduct.image,
          status: 'delivered',
          lastStatusAt: daysAgo(3),
          statusHistory: [
            { status: 'processing', note: 'Packed for the weekend dispatch run.', updatedBy: seller._id, updatedAt: daysAgo(10) },
            { status: 'in-transit', note: 'Reached the city hub on schedule.', updatedBy: seller._id, updatedAt: daysAgo(5) },
            { status: 'delivered', note: 'Delivered successfully. Buyer later reported a tear on one loop.', updatedBy: seller._id, updatedAt: daysAgo(3) },
          ],
          tracking: {
            carrier: 'XpressBees',
            trackingNumber: 'XPB-DEMO-004',
            trackingUrl: 'https://tracking.fitsync.local/XPB-DEMO-004',
            updatedAt: daysAgo(3),
          },
          returnRequest: {
            status: 'requested',
            reason: 'One resistance loop had visible wear near the grip seam.',
            requestedAt: daysAgo(1),
            requestedBy: traineeBeta._id,
            note: 'Seller review pending. Replacement or partial refund expected.',
          },
        },
      ],
    },
    {
      user: traineeGamma._id,
      seller: seller._id,
      orderNumber: 'DEMO-ORDER-005',
      shippingAddress: buildShippingAddress({ email: traineeGamma.email }),
      paymentMethod: 'Card',
      subtotal: 950,
      tax: 0,
      shippingCost: 0,
      total: 950,
      status: 'delivered',
      createdAt: daysAgo(14),
      updatedAt: daysAgo(7),
      orderItems: [
        {
          seller: seller._id,
          product: bcaaProduct._id,
          name: bcaaProduct.name,
          quantity: 1,
          price: 950,
          image: bcaaProduct.image,
          status: 'delivered',
          lastStatusAt: daysAgo(9),
          statusHistory: [
            { status: 'processing', note: 'Packed from the fast-moving supplement rack.', updatedBy: seller._id, updatedAt: daysAgo(14) },
            { status: 'in-transit', note: 'Line-haul departed Mumbai overnight.', updatedBy: seller._id, updatedAt: daysAgo(11) },
            { status: 'delivered', note: 'Delivered before noon. Buyer later raised a flavour mismatch issue.', updatedBy: seller._id, updatedAt: daysAgo(9) },
          ],
          tracking: {
            carrier: 'BlueDart',
            trackingNumber: 'BLUEDART-DEMO-005',
            trackingUrl: 'https://tracking.fitsync.local/BLUEDART-DEMO-005',
            updatedAt: daysAgo(9),
          },
          returnRequest: {
            status: 'refunded',
            reason: 'Received the wrong flavour variant.',
            requestedAt: daysAgo(8),
            requestedBy: traineeGamma._id,
            reviewedAt: daysAgo(7),
            reviewedBy: seller._id,
            refundAmount: 950,
            note: 'Refund approved in full after seller verification.',
          },
        },
      ],
    },
    {
      user: traineeAlpha._id,
      seller: seller._id,
      orderNumber: 'DEMO-ORDER-006',
      shippingAddress: buildShippingAddress({ email: traineeAlpha.email }),
      paymentMethod: 'UPI',
      subtotal: 1200,
      tax: 0,
      shippingCost: 0,
      total: 1200,
      status: 'delivered',
      createdAt: daysAgo(12),
      updatedAt: daysAgo(5),
      orderItems: [
        {
          seller: seller._id,
          product: yogaMatProduct._id,
          name: yogaMatProduct.name,
          quantity: 1,
          price: 1200,
          image: yogaMatProduct.image,
          status: 'delivered',
          lastStatusAt: daysAgo(8),
          statusHistory: [
            { status: 'processing', note: 'Rolled and tagged for the standard dispatch batch.', updatedBy: seller._id, updatedAt: daysAgo(12) },
            { status: 'in-transit', note: 'Reached the local hub in one day.', updatedBy: seller._id, updatedAt: daysAgo(10) },
            { status: 'delivered', note: 'Delivered successfully. Buyer later requested a pickup because the grip felt too soft for hardwood floors.', updatedBy: seller._id, updatedAt: daysAgo(8) },
          ],
          tracking: {
            carrier: 'Delhivery',
            trackingNumber: 'DLV-DEMO-006',
            trackingUrl: 'https://tracking.fitsync.local/DLV-DEMO-006',
            updatedAt: daysAgo(8),
          },
          returnRequest: {
            status: 'approved',
            reason: 'Surface grip felt softer than expected for home floor use.',
            requestedAt: daysAgo(6),
            requestedBy: traineeAlpha._id,
            reviewedAt: daysAgo(5),
            reviewedBy: seller._id,
            refundAmount: 1200,
            note: 'Return pickup approved and refund queued after warehouse scan.',
          },
        },
      ],
    },
  ]);

  const [
    deliveredBundleOrder,
    transitOrder,
    backlogOrder,
    returnRequestedOrder,
    refundedOrder,
    alphaApprovedReturnOrder,
  ] = orders;

  await ProductReview.create([
    {
      product: proteinProduct._id,
      user: traineeAlpha._id,
      order: deliveredBundleOrder._id,
      rating: 5,
      title: 'Easy recovery staple',
      comment: 'Mixes cleanly and the chocolate flavour is much better than most budget blends.',
      isVerifiedPurchase: true,
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
    },
    {
      product: proteinProduct._id,
      user: traineeGamma._id,
      rating: 4,
      title: 'Solid daily protein',
      comment: 'Good taste and no bloating. Would like a slightly richer flavour profile.',
      isVerifiedPurchase: true,
      createdAt: daysAgo(5),
      updatedAt: daysAgo(5),
    },
    {
      product: yogaMatProduct._id,
      user: traineeDelta._id,
      rating: 5,
      title: 'Strong grip for mobility days',
      comment: 'Does not slide on tile and feels thick enough for longer recovery sessions.',
      isVerifiedPurchase: true,
      createdAt: daysAgo(2),
      updatedAt: daysAgo(2),
    },
    {
      product: yogaMatProduct._id,
      user: traineeBeta._id,
      rating: 4,
      title: 'Comfortable but slightly bulky',
      comment: 'Excellent grip in class. Carrying it around is the only minor tradeoff.',
      isVerifiedPurchase: true,
      createdAt: daysAgo(6),
      updatedAt: daysAgo(6),
    },
    {
      product: yogaMatProduct._id,
      user: traineeAlpha._id,
      order: alphaApprovedReturnOrder._id,
      rating: 3,
      title: 'Good mat, but softer than expected',
      comment: 'Comfortable for mobility days, but I needed a firmer surface for my home floor setup. Return approval was quick.',
      isVerifiedPurchase: true,
      createdAt: daysAgo(5),
      updatedAt: daysAgo(5),
    },
    {
      product: bandsProduct._id,
      user: traineeBeta._id,
      order: returnRequestedOrder._id,
      rating: 4,
      title: 'Good tension progression',
      comment: 'Loved the resistance levels even though one loop had a defect. Support was responsive.',
      isVerifiedPurchase: true,
      createdAt: daysAgo(2),
      updatedAt: daysAgo(2),
    },
    {
      product: bottleProduct._id,
      user: traineeAlpha._id,
      order: deliveredBundleOrder._id,
      rating: 4,
      title: 'Useful everyday bottle',
      comment: 'Keeps water cool for long sessions and fits standard gym bag sleeves.',
      isVerifiedPurchase: true,
      createdAt: daysAgo(3),
      updatedAt: daysAgo(3),
    },
    {
      product: bcaaProduct._id,
      user: traineeGamma._id,
      order: refundedOrder._id,
      rating: 5,
      title: 'Fast refund handling',
      comment: 'The wrong flavour arrived, but the seller processed the refund quickly and clearly.',
      isVerifiedPurchase: true,
      createdAt: daysAgo(7),
      updatedAt: daysAgo(7),
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
      amount: 4500,
      user: owner._id,
      type: 'membership',
      description: 'Owner share for trainee gamma membership',
      metadata: new Map([['gymId', String(gymOne._id)], ['membershipId', String(activeMembershipGamma._id)], ['paymentReference', 'DEMO-MEM-GAMMA-001']]),
      createdAt: daysAgo(22),
    },
    {
      amount: 4500,
      user: trainerAlpha._id,
      type: 'membership',
      description: 'Trainer share for trainee gamma membership',
      metadata: new Map([['gymId', String(gymOne._id)], ['membershipId', String(activeMembershipGamma._id)], ['paymentReference', 'DEMO-MEM-GAMMA-001']]),
      createdAt: daysAgo(22),
    },
    {
      amount: 1300,
      user: owner._id,
      type: 'renewal',
      description: 'Owner share for trainee delta monthly plan',
      metadata: new Map([['gymId', String(gymTwo._id)], ['membershipId', String(activeMembershipDelta._id)], ['paymentReference', 'DEMO-MEM-DELTA-001']]),
      createdAt: daysAgo(16),
    },
    {
      amount: 1300,
      user: trainerBeta._id,
      type: 'renewal',
      description: 'Trainer share for trainee delta monthly plan',
      metadata: new Map([['gymId', String(gymTwo._id)], ['membershipId', String(activeMembershipDelta._id)], ['paymentReference', 'DEMO-MEM-DELTA-001']]),
      createdAt: daysAgo(16),
    },
    {
      amount: 450,
      user: admin._id,
      type: 'marketplace',
      description: 'Platform commission for delivered demo order',
      metadata: new Map([['orderNumber', 'DEMO-ORDER-001']]),
      createdAt: daysAgo(2),
    },
    {
      amount: 2550,
      user: seller._id,
      type: 'seller',
      description: 'Seller payout for delivered demo order',
      metadata: new Map([['orderNumber', 'DEMO-ORDER-001']]),
      createdAt: daysAgo(2),
    },
    {
      amount: 135,
      user: admin._id,
      type: 'marketplace',
      description: 'Platform commission for delivered return-reviewed order',
      metadata: new Map([['orderNumber', 'DEMO-ORDER-004']]),
      createdAt: daysAgo(3),
    },
    {
      amount: 765,
      user: seller._id,
      type: 'seller',
      description: 'Seller payout for delivered return-reviewed order',
      metadata: new Map([['orderNumber', 'DEMO-ORDER-004']]),
      createdAt: daysAgo(3),
    },
    {
      amount: 142.5,
      user: admin._id,
      type: 'marketplace',
      description: 'Platform commission for refunded demo order before adjustment',
      metadata: new Map([['orderNumber', 'DEMO-ORDER-005'], ['refundStatus', 'refunded']]),
      createdAt: daysAgo(9),
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
          'analytics.memberships': 2,
          'analytics.trainers': 1,
          'analytics.rating': 4.5,
          'analytics.ratingCount': 2,
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
          'analytics.memberships': 2,
          'analytics.trainers': 1,
          'analytics.rating': 4.5,
          'analytics.ratingCount': 2,
          'analytics.lastImpressionAt': daysAgo(0),
          'analytics.lastOpenAt': daysAgo(0),
          'analytics.lastReviewAt': daysAgo(1),
        },
      },
    ),
    User.findByIdAndUpdate(owner._id, {
      $set: {
        'ownerMetrics.totalImpressions': gymOneImpressions + gymTwoImpressions,
        'ownerMetrics.monthlySpend': 58998,
        'ownerMetrics.monthlyEarnings': 11300,
      },
    }),
  ]);

  await SystemSetting.create([
    { key: 'marketplaceEnabled', value: true, updatedBy: admin._id, description: 'Expose the public marketplace.', createdAt: daysAgo(2), updatedAt: daysAgo(2) },
    { key: 'autoApproveTrainers', value: false, updatedBy: admin._id, description: 'Require trainer review before activation.', createdAt: daysAgo(2), updatedAt: daysAgo(2) },
    { key: 'showBetaDashboards', value: true, updatedBy: admin._id, description: 'Enable beta dashboards for internal staff.', createdAt: daysAgo(1), updatedAt: daysAgo(1) },
    { key: 'maintenanceMode', value: false, updatedBy: admin._id, description: 'Keep the platform available during evaluation.', createdAt: daysAgo(1), updatedAt: daysAgo(1) },
    { key: 'supportInboxEnabled', value: true, updatedBy: manager._id, description: 'Public contact intake remains enabled.', createdAt: daysAgo(1), updatedAt: daysAgo(1) },
    { key: 'paymentCheckoutEnabled', value: true, updatedBy: admin._id, description: 'Allow marketplace checkout flows.', createdAt: daysAgo(1), updatedAt: daysAgo(1) },
    { key: 'searchIndexingEnabled', value: true, updatedBy: manager._id, description: 'Keep product and gym indexing warm.', createdAt: daysAgo(1), updatedAt: daysAgo(1) },
    { key: 'cacheWarmupEnabled', value: true, updatedBy: manager._id, description: 'Prime public cache entries after updates.', createdAt: daysAgo(0), updatedAt: daysAgo(0) },
    { key: 'orderReturnsEnabled', value: true, updatedBy: admin._id, description: 'Support delivered-order returns.', createdAt: daysAgo(0), updatedAt: daysAgo(0) },
    { key: 'gymModerationAlerts', value: true, updatedBy: admin._id, description: 'Raise visibility for risky listing changes.', createdAt: daysAgo(0), updatedAt: daysAgo(0) },
  ]);

  await Contact.create([
    {
      name: traineeAlpha.name,
      email: traineeAlpha.email,
      subject: 'Membership freeze while travelling',
      category: 'membership',
      priority: 'normal',
      message: 'Can I pause the monthly plan for one week while I am travelling for work?',
      status: 'responded',
      assignedTo: manager._id,
      gym: gymOne._id,
      internalNotes: 'Offer freeze credit if travel extends beyond one week.',
      replies: [
        {
          author: manager._id,
          authorRole: manager.role,
          message: 'Yes. We can place a short pause and push the renewal date forward once travel dates are confirmed.',
          createdAt: daysAgo(1),
        },
      ],
      createdAt: daysAgo(2),
      updatedAt: daysAgo(1),
    },
    {
      name: traineeBeta.name,
      email: traineeBeta.email,
      subject: 'Return status for resistance bands order',
      category: 'marketplace',
      priority: 'high',
      message: 'One loop on the resistance bands had wear near the grip seam. Please confirm the return review timeline.',
      status: 'in-progress',
      assignedTo: manager._id,
      internalNotes: 'Seller acknowledged the defect. Monitor until refund or replacement lands.',
      replies: [
        {
          author: manager._id,
          authorRole: manager.role,
          message: 'We have flagged this with the seller and will update you once the inspection note is attached.',
          createdAt: daysAgo(0),
        },
      ],
      createdAt: daysAgo(1),
      updatedAt: daysAgo(0),
    },
    {
      name: traineeDelta.name,
      email: traineeDelta.email,
      subject: 'Need help understanding class credits',
      category: 'billing',
      priority: 'low',
      message: 'Could someone explain how carry-over class credits work for the recovery workshops?',
      status: 'closed',
      assignedTo: manager._id,
      gym: gymTwo._id,
      internalNotes: 'Resolved with a billing FAQ link and credit balance summary.',
      replies: [
        {
          author: manager._id,
          authorRole: manager.role,
          message: 'Shared the credit rules and your current balance by email. Closing this ticket unless anything else comes up.',
          createdAt: daysAgo(4),
        },
      ],
      createdAt: daysAgo(5),
      updatedAt: daysAgo(4),
    },
    {
      name: 'Prospective Member',
      email: 'lead.demo@fitsync.local',
      subject: 'Tour request for Iron Temple',
      category: 'general',
      priority: 'normal',
      message: 'I would like to schedule an evening walkthrough before signing up for the quarterly plan.',
      status: 'new',
      assignedTo: manager._id,
      gym: gymOne._id,
      createdAt: daysAgo(0),
      updatedAt: daysAgo(0),
    },
  ]);

  await InternalConversation.create([
    {
      subject: 'Flow Studio retention push for expiring members',
      category: 'owner-manager',
      gym: gymTwo._id,
      createdBy: owner._id,
      lastMessageAt: daysAgo(1),
      participants: [
        { user: owner._id, role: owner.role, lastReadAt: daysAgo(1) },
        { user: manager._id, role: manager.role, lastReadAt: daysAgo(3) },
      ],
      messages: [
        {
          sender: owner._id,
          senderRole: owner.role,
          body: 'Can we trigger a retention offer for members expiring within the next 14 days at Flow Studio?',
          createdAt: daysAgo(2),
        },
        {
          sender: manager._id,
          senderRole: manager.role,
          body: 'Yes. I have a shortlist ready and will pair it with mobility workshop credits.',
          createdAt: daysAgo(1),
        },
      ],
      createdAt: daysAgo(2),
      updatedAt: daysAgo(1),
    },
    {
      subject: 'Refund audit spike needs review',
      category: 'admin-manager',
      createdBy: admin._id,
      lastMessageAt: daysAgo(0),
      participants: [
        { user: admin._id, role: admin.role, lastReadAt: daysAgo(0) },
        { user: manager._id, role: manager.role, lastReadAt: daysAgo(2), archivedAt: daysAgo(30) },
      ],
      messages: [
        {
          sender: admin._id,
          senderRole: admin.role,
          body: 'The ops panel flagged a refund spike. Please verify whether it is limited to the demo supplement batch.',
          createdAt: daysAgo(1),
        },
        {
          sender: manager._id,
          senderRole: manager.role,
          body: 'Confirmed. The spike is isolated to one flavour mismatch and one damaged bands shipment.',
          createdAt: daysAgo(0),
        },
      ],
      createdAt: daysAgo(1),
      updatedAt: daysAgo(0),
    },
    {
      subject: 'Approve Iron Temple technique workshop banner',
      category: 'owner-admin',
      gym: gymOne._id,
      createdBy: owner._id,
      lastMessageAt: daysAgo(2),
      participants: [
        { user: owner._id, role: owner.role, lastReadAt: daysAgo(2) },
        { user: admin._id, role: admin.role, lastReadAt: daysAgo(2) },
      ],
      messages: [
        {
          sender: owner._id,
          senderRole: owner.role,
          body: 'Uploaded the updated technique workshop banner. Please confirm it meets promo guidelines.',
          createdAt: daysAgo(3),
        },
        {
          sender: admin._id,
          senderRole: admin.role,
          body: 'Approved. The banner can go live with the current sponsorship creative.',
          createdAt: daysAgo(2),
        },
      ],
      createdAt: daysAgo(3),
      updatedAt: daysAgo(2),
    },
    {
      subject: 'Pending trainer request for Iron Temple evenings',
      category: 'owner-manager',
      gym: gymOne._id,
      createdBy: manager._id,
      lastMessageAt: daysAgo(0),
      participants: [
        { user: owner._id, role: owner.role, lastReadAt: daysAgo(3) },
        { user: manager._id, role: manager.role, lastReadAt: daysAgo(0) },
      ],
      messages: [
        {
          sender: manager._id,
          senderRole: manager.role,
          body: 'Mira requested a secondary evening block at Iron Temple. Can you review the pending trainer request today?',
          createdAt: daysAgo(1),
        },
        {
          sender: manager._id,
          senderRole: manager.role,
          body: 'If approved, I can route mobility-focused leads there and reduce the waitlist pressure.',
          createdAt: daysAgo(0),
        },
      ],
      createdAt: daysAgo(1),
      updatedAt: daysAgo(0),
    },
    {
      subject: 'Flow Studio listing health follow-up',
      category: 'owner-admin',
      gym: gymTwo._id,
      createdBy: admin._id,
      lastMessageAt: daysAgo(1),
      participants: [
        { user: owner._id, role: owner.role, lastReadAt: daysAgo(4) },
        { user: admin._id, role: admin.role, lastReadAt: daysAgo(1) },
      ],
      messages: [
        {
          sender: admin._id,
          senderRole: admin.role,
          body: 'The listing health score improved, but the Flow Studio contact block still needs a direct WhatsApp line and one more gallery image.',
          createdAt: daysAgo(2),
        },
        {
          sender: admin._id,
          senderRole: admin.role,
          body: 'Once that is added, the listing should be fully ready for the next sponsorship push.',
          createdAt: daysAgo(1),
        },
      ],
      createdAt: daysAgo(2),
      updatedAt: daysAgo(1),
    },
    {
      subject: 'Quarterly sponsorship recap archived',
      category: 'owner-manager',
      gym: gymOne._id,
      createdBy: owner._id,
      lastMessageAt: daysAgo(6),
      participants: [
        { user: owner._id, role: owner.role, lastReadAt: daysAgo(5), archivedAt: daysAgo(5) },
        { user: manager._id, role: manager.role, lastReadAt: daysAgo(5) },
      ],
      messages: [
        {
          sender: owner._id,
          senderRole: owner.role,
          body: 'Closing the loop on the quarterly sponsorship recap. Iron Temple outperformed the planned reach target after the gallery refresh.',
          createdAt: daysAgo(7),
        },
        {
          sender: manager._id,
          senderRole: manager.role,
          body: 'Agreed. I have archived the campaign note on my side and will reference it in the next budget review.',
          createdAt: daysAgo(6),
        },
      ],
      createdAt: daysAgo(7),
      updatedAt: daysAgo(6),
    },
    {
      subject: 'Retention goal threshold for next month',
      category: 'owner-admin',
      createdBy: owner._id,
      lastMessageAt: daysAgo(3),
      participants: [
        { user: owner._id, role: owner.role, lastReadAt: daysAgo(3) },
        { user: admin._id, role: admin.role, lastReadAt: daysAgo(6) },
      ],
      messages: [
        {
          sender: owner._id,
          senderRole: owner.role,
          body: 'I want to keep join-to-renewal above 35% next month. Do the current ops benchmarks support that target?',
          createdAt: daysAgo(4),
        },
        {
          sender: admin._id,
          senderRole: admin.role,
          body: 'Yes. Ops is comfortable with that threshold as long as expiring members receive the workshop-credit retention offer on time.',
          createdAt: daysAgo(3),
        },
      ],
      createdAt: daysAgo(4),
      updatedAt: daysAgo(3),
    },
  ]);

  await Notification.create([
    {
      user: traineeAlpha._id,
      type: 'session-reminder',
      title: 'Upcoming coaching session',
      message: 'Your confirmed mobility-lift session with Arjun starts Wednesday at 6:00 PM.',
      link: '/dashboard/trainee/sessions',
      metadata: { gymId: String(gymOne._id) },
      createdAt: daysAgo(0),
      updatedAt: daysAgo(0),
    },
    {
      user: traineeBeta._id,
      type: 'order-tracking',
      title: 'Order is out for delivery',
      message: 'Your yoga mat order is on the final courier route today.',
      link: '/dashboard/trainee/orders',
      metadata: { orderNumber: 'DEMO-ORDER-002' },
      createdAt: daysAgo(0),
      updatedAt: daysAgo(0),
    },
    {
      user: seller._id,
      type: 'return-request',
      title: 'Return request pending review',
      message: 'A buyer requested a return on DEMO-ORDER-004. Review the reason and respond.',
      link: '/dashboard/seller/orders',
      metadata: { orderNumber: 'DEMO-ORDER-004' },
      createdAt: daysAgo(0),
      updatedAt: daysAgo(0),
    },
    {
      user: seller._id,
      type: 'inventory-alert',
      title: 'Shipment backlog to review',
      message: 'DEMO-ORDER-003 is still in processing and the resistance bands stock is down to four units.',
      link: '/dashboard/seller/orders',
      metadata: { orderNumber: 'DEMO-ORDER-003', sku: 'resistance-bands' },
      createdAt: daysAgo(0),
      updatedAt: daysAgo(0),
    },
    {
      user: manager._id,
      type: 'support-ticket',
      title: 'New support ticket assigned',
      message: 'Marketplace return ticket from Kabir Trainee was assigned to you.',
      link: '/dashboard/admin/messages',
      metadata: { category: 'marketplace' },
      createdAt: daysAgo(0),
      updatedAt: daysAgo(0),
    },
    {
      user: owner._id,
      type: 'gym-performance',
      title: 'Gym conversion trend improving',
      message: 'Iron Temple conversion rate improved after the latest listing refresh.',
      link: '/dashboard/gym-owner/analytics',
      metadata: { gymId: String(gymOne._id) },
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
    },
    {
      user: owner._id,
      type: 'internal-message',
      title: 'Pending trainer request needs review',
      message: 'Manager Demo asked you to review the pending evening mobility trainer request for Iron Temple.',
      link: '/dashboard/gym-owner/communications',
      metadata: { gymId: String(gymOne._id), category: 'owner-manager' },
      createdAt: daysAgo(0),
      updatedAt: daysAgo(0),
    },
    {
      user: admin._id,
      type: 'ops-alert',
      title: 'Ops dashboard alert',
      message: 'Refund volume crossed the monitoring threshold for the last 7 days.',
      link: '/dashboard/admin/ops',
      metadata: { severity: 'medium' },
      createdAt: daysAgo(0),
      updatedAt: daysAgo(0),
    },
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
      actor: admin._id,
      actorRole: admin.role,
      action: 'admin.ops.alert.generated',
      entityType: 'systemStatus',
      entityId: 'ops-refund-spike',
      summary: 'Ops dashboard flagged a refund spike for marketplace orders',
      metadata: { threshold: 'medium', orderNumber: 'DEMO-ORDER-005' },
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
      actor: owner._id,
      actorRole: owner.role,
      action: 'owner.gym.updated',
      entityType: 'gym',
      entityId: gymOne._id,
      summary: 'Flagship gym listing refreshed with new gallery and pricing',
      metadata: { galleryCount: 3, contactUpdated: true },
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
    recordAuditLog({
      actor: seller._id,
      actorRole: seller.role,
      action: 'seller.order.tracking.updated',
      entityType: 'order',
      entityId: transitOrder._id,
      summary: 'Seller advanced demo order to out-for-delivery',
      metadata: { orderNumber: transitOrder.orderNumber, trackingNumber: 'DLV-DEMO-002A' },
    }),
    recordAuditLog({
      actor: seller._id,
      actorRole: seller.role,
      action: 'seller.order.backlog.flagged',
      entityType: 'order',
      entityId: backlogOrder._id,
      summary: 'Seller backlog alert raised for a processing tracker order',
      metadata: { orderNumber: backlogOrder.orderNumber, ageDays: 4 },
    }),
    recordAuditLog({
      actor: traineeBeta._id,
      actorRole: traineeBeta.role,
      action: 'marketplace.return.requested',
      entityType: 'order',
      entityId: returnRequestedOrder._id,
      summary: 'Buyer requested a return for damaged resistance bands',
      metadata: { orderNumber: returnRequestedOrder.orderNumber, reason: 'Damaged item' },
    }),
    recordAuditLog({
      actor: seller._id,
      actorRole: seller.role,
      action: 'marketplace.return.refunded',
      entityType: 'order',
      entityId: refundedOrder._id,
      summary: 'Seller refunded the BCAA flavour mismatch order',
      metadata: { orderNumber: refundedOrder.orderNumber, refundAmount: 950 },
    }),
    recordAuditLog({
      actor: manager._id,
      actorRole: manager.role,
      action: 'support.ticket.assigned',
      entityType: 'contact',
      entityId: 'marketplace-return-ticket',
      summary: 'Manager picked up the marketplace return support ticket',
      metadata: { priority: 'high', assignee: manager.email },
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
  console.log(`  Trainee Gamma: ${traineeGamma.email} / Demo@123`);
  console.log(`  Trainee Delta: ${traineeDelta.email} / Demo@123`);
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
