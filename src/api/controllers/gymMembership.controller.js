import mongoose from 'mongoose';
import Gym from '../../models/gym.model.js';
import GymMembership from '../../models/gymMembership.model.js';
import PaymentSession from '../../models/paymentSession.model.js';
import TrainerAssignment from '../../models/trainerAssignment.model.js';
import Booking from '../../models/booking.model.js';
import Revenue from '../../models/revenue.model.js';
import User from '../../models/user.model.js';
import stripe from '../../services/stripe.service.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { invalidateCacheByTags } from '../../services/cache.service.js';
import { recordAuditLog } from '../../services/audit.service.js';
import { createNotifications } from '../../services/notification.service.js';
import { syncGymAnalyticsSnapshot } from '../../services/gymMetrics.service.js';
import {
  getMembershipPlanDurationMonths,
  resolveGymMembershipPlan,
} from '../../utils/membershipPlans.js';

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const invalidateGymReadCaches = async (gymId) =>
  invalidateCacheByTags(['gyms:list', gymId ? `gym:${gymId}` : null]);

const getFrontendUrl = () => process.env.FRONTEND_URL || 'http://localhost:5173';

const toCheckoutCurrency = (value) =>
  String(value || 'INR').trim().toLowerCase() || 'inr';

const toDisplayCurrency = (value) =>
  String(value || 'INR').trim().toUpperCase() || 'INR';

const buildStripePaymentReference = ({ paymentIntentId, stripeSessionId, fallback }) =>
  String(paymentIntentId || stripeSessionId || fallback || '').trim();

const buildMembershipSuccessUrl = (gymId) => {
  const params = new URLSearchParams({
    session_id: '{CHECKOUT_SESSION_ID}',
    flow: 'gym-membership',
  });

  if (gymId) {
    params.set('gymId', String(gymId));
  }

  return `${getFrontendUrl()}/payments/success?${params.toString()}`;
};

const buildMembershipCancelUrl = (gymId) => {
  const params = new URLSearchParams({ flow: 'gym-membership' });

  if (gymId) {
    params.set('gymId', String(gymId));
  }

  return `${getFrontendUrl()}/payments/cancelled?${params.toString()}`;
};

const mapMembership = (membership) => {
  if (!membership) {
    return null;
  }

  return {
    id: membership._id,
    status: membership.status,
    plan: membership.plan,
    startDate: membership.startDate,
    endDate: membership.endDate,
    autoRenew: membership.autoRenew,
    benefits: membership.benefits ?? [],
    createdAt: membership.createdAt,
    updatedAt: membership.updatedAt,
    notes: membership.notes,
    billing: membership.billing
      ? {
        amount: membership.billing.amount,
        currency: membership.billing.currency,
        paymentGateway: membership.billing.paymentGateway,
        paymentReference: membership.billing.paymentReference,
        status: membership.billing.status,
      }
      : null,
    gym: membership.gym
      ? {
        id: membership.gym._id,
        name: membership.gym.name,
        city: membership.gym.location?.city,
      }
      : null,
    trainer: membership.trainer
      ? {
        id: membership.trainer._id,
        name: membership.trainer.name,
        profilePicture: membership.trainer.profilePicture,
      }
      : null,
  };
};

const ensureGymForMembership = async (gymId) => {
  if (!isObjectId(gymId)) {
    throw new ApiError(400, 'Invalid gym id.');
  }

  const gym = await Gym.findOne({ _id: gymId, status: 'active', isPublished: true })
    .select('owner name analytics pricing')
    .lean();

  if (!gym) {
    throw new ApiError(404, 'Gym is not available for memberships.');
  }

  return gym;
};

export const getMyGymMembership = asyncHandler(async (req, res) => {
  const { gymId } = req.params;
  const userId = req.user?._id;
  const userRole = req.user?.role;

  if (!isObjectId(gymId)) {
    throw new ApiError(400, 'Invalid gym id.');
  }

  const membershipDoc = await GymMembership.findOne({
    gym: gymId,
    trainee: userId,
  })
    .sort({ createdAt: -1 })
    .populate({ path: 'gym', select: 'name location' })
    .populate({ path: 'trainer', select: 'name profilePicture' })
    .lean();

  let trainerAssignment = null;
  if (
    membershipDoc &&
    membershipDoc.plan === 'trainer-access' &&
    (userRole === 'trainer' || String(membershipDoc.trainee) === String(userId))
  ) {
    trainerAssignment = await TrainerAssignment.findOne({
      trainer: membershipDoc.trainee,
      gym: gymId,
    })
      .select('status requestedAt approvedAt')
      .lean();
  }

  let membership = mapMembership(membershipDoc);

  if (membership && membership.plan === 'trainer-access') {
    if (trainerAssignment) {
      membership.trainerAccess = {
        status: trainerAssignment.status,
        requestedAt: trainerAssignment.requestedAt,
        approvedAt: trainerAssignment.approvedAt,
      };
      if (trainerAssignment.status === 'active' && membership.status !== 'active') {
        membership.status = 'active';
      }
    } else {
      membership.trainerAccess = null;
    }
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { membership },
        membership ? 'Membership found.' : 'No membership for this gym.',
      ),
    );
});

const resolveGymPlanForPurchase = (gym, requestedPlanCode) =>
  resolveGymMembershipPlan(gym?.pricing, requestedPlanCode);

const buildAutoPaymentReference = ({ userId, gymId, planCode }) => {
  const normalizedPlan = String(planCode || 'membership')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '');

  const shortUserId = String(userId || '').slice(-4).toUpperCase();
  const shortGymId = String(gymId || '').slice(-4).toUpperCase();
  const timeToken = Date.now().toString().slice(-8);

  return ['AUTO', normalizedPlan || 'MEMBERSHIP', timeToken, shortUserId, shortGymId]
    .filter(Boolean)
    .join('-');
};

const loadMembershipSummary = async (membershipId) => {
  const membership = await GymMembership.findById(membershipId)
    .populate({ path: 'gym', select: 'name location pricing' })
    .populate({ path: 'trainer', select: 'name profilePicture' })
    .lean();

  return membership ? mapMembership(membership) : null;
};

const activatePaidMembership = async ({
  user,
  gym,
  assignment,
  selectedPlan,
  autoRenew,
  benefits,
  notes,
  paymentReference,
  paymentGateway = 'stripe',
}) => {
  const selectedPlanAmount = Number(selectedPlan?.price ?? selectedPlan?.mrp);

  if (!selectedPlan || !selectedPlanAmount) {
    throw new ApiError(400, 'Select a valid membership plan to continue.');
  }

  const startDate = new Date();
  const endDate = (() => {
    const result = new Date(startDate);
    result.setMonth(result.getMonth() + getMembershipPlanDurationMonths(selectedPlan.code, 1));
    return result;
  })();

  if (Number.isNaN(endDate.getTime())) {
    throw new ApiError(400, 'Invalid membership end date.');
  }

  const membershipPayload = {
    trainee: user._id,
    gym: gym._id,
    plan: selectedPlan.code,
    startDate,
    endDate,
    status: 'active',
    autoRenew,
    benefits,
    notes,
    trainer: assignment.trainer._id,
    billing: {
      amount: selectedPlanAmount,
      currency: toDisplayCurrency(selectedPlan.currency),
      paymentGateway,
      paymentReference,
      status: 'paid',
    },
  };

  const membership = await GymMembership.create(membershipPayload);

  const trainerShare = Math.round(selectedPlanAmount * 0.5);
  const ownerShare = Math.max(Math.round(selectedPlanAmount - trainerShare), 0);

  const updates = [
    Gym.updateOne(
      { _id: gym._id },
      {
        $inc: { 'analytics.memberships': 1 },
        $set: { lastUpdatedBy: user._id },
      },
    ),
  ];

  if (user.role === 'trainee') {
    updates.push(
      User.updateOne(
        { _id: user._id },
        {
          $inc: { 'traineeMetrics.activeMemberships': 1 },
          $set: { 'traineeMetrics.primaryGym': gym._id },
        },
      ),
    );
  }

  if (user.role === 'trainer') {
    updates.push(User.updateOne({ _id: user._id }, { $addToSet: { 'trainerMetrics.gyms': gym._id } }));
  }

  updates.push(
    User.updateOne(
      { _id: assignment.trainer._id },
      {
        $addToSet: { 'trainerMetrics.gyms': gym._id },
        $inc: { 'trainerMetrics.activeTrainees': 1 },
      },
    ),
  );

  updates.push(
    User.updateOne(
      { _id: gym.owner },
      {
        $inc: {
          'ownerMetrics.monthlyEarnings': ownerShare,
        },
      },
    ),
  );

  await Promise.all(updates);
  await Promise.all([
    createNotifications([
      {
        user: user._id,
        type: 'membership-active',
        title: 'Gym membership confirmed',
        message: `Your membership at ${gym.name} is active.`,
        link: `/gyms/${gym._id}`,
        metadata: { gymId: gym._id, membershipId: membership._id },
      },
      {
        user: assignment.trainer._id,
        type: 'new-trainee',
        title: 'New trainee assigned',
        message: `${user.name ?? 'A trainee'} joined ${gym.name} under your guidance.`,
        link: '/dashboard/trainer',
        metadata: { gymId: gym._id, traineeId: user._id },
      },
    ]),
    recordAuditLog({
      actor: user._id,
      actorRole: user.role,
      action: 'membership.joined',
      entityType: 'gymMembership',
      entityId: membership._id,
      summary: `Membership started for ${gym.name}`,
      metadata: { gymId: gym._id, trainerId: assignment.trainer._id },
    }),
  ]);
  await syncGymAnalyticsSnapshot(gym._id);

  const assignmentUpdate = await TrainerAssignment.findOneAndUpdate(
    { trainer: assignment.trainer._id, gym: gym._id, 'trainees.trainee': user._id },
    {
      $set: {
        status: 'active',
        'trainees.$.status': 'active',
        'trainees.$.assignedAt': new Date(),
      },
    },
    { new: true },
  );

  if (!assignmentUpdate) {
    await TrainerAssignment.findOneAndUpdate(
      { trainer: assignment.trainer._id, gym: gym._id },
      {
        $setOnInsert: {
          trainer: assignment.trainer._id,
          gym: gym._id,
        },
        $set: { status: 'active' },
        $push: {
          trainees: {
            trainee: user._id,
            status: 'active',
            assignedAt: new Date(),
          },
        },
      },
      { upsert: true },
    );
  }

  const metadataBase = [
    ['gymId', String(gym._id)],
    ['memberId', String(user._id)],
    ['membershipId', String(membership._id)],
    ['paymentReference', paymentReference],
    ['plan', selectedPlan.code],
    ['paymentGateway', paymentGateway],
  ];

  await Promise.all([
    Revenue.create({
      amount: trainerShare,
      user: assignment.trainer._id,
      type: 'membership',
      description: `Trainer share for ${gym.name} membership`,
      metadata: new Map(
        [...metadataBase, ['share', 'trainer'], ['trainerId', String(assignment.trainer._id)], ['amount', String(trainerShare)]],
      ),
    }),
    Revenue.create({
      amount: ownerShare,
      user: gym.owner,
      type: 'membership',
      description: `Gym share for ${gym.name} membership`,
      metadata: new Map(
        [...metadataBase, ['share', 'gym'], ['trainerId', String(assignment.trainer._id)], ['amount', String(ownerShare)]],
      ),
    }),
  ]);

  await invalidateGymReadCaches(gym._id);
  return loadMembershipSummary(membership._id);
};

const createMembershipCheckoutSession = async ({
  user,
  gym,
  selectedPlan,
  assignment,
  autoRenew,
  benefits,
  notes,
}) => {
  const selectedPlanAmount = Number(selectedPlan?.price ?? selectedPlan?.mrp);

  if (!selectedPlan || !selectedPlanAmount) {
    throw new ApiError(400, 'Select a valid membership plan to continue.');
  }

  const session = await mongoose.startSession();
  let paymentSessionId;
  let stripeSession;

  try {
    await session.withTransaction(async () => {
      const [paymentSession] = await PaymentSession.create([{
        user: user._id,
        owner: gym.owner,
        gym: gym._id,
        type: 'gym-membership',
        amount: selectedPlanAmount,
        currency: toCheckoutCurrency(selectedPlan.currency),
        metadata: {
          flow: 'gym-membership',
          gymId: String(gym._id),
          gymName: gym.name,
          planCode: selectedPlan.code,
          planLabel: selectedPlan.label || selectedPlan.code,
          amount: selectedPlanAmount,
          currency: toDisplayCurrency(selectedPlan.currency),
          durationMonths: Number(selectedPlan.durationMonths)
            || getMembershipPlanDurationMonths(selectedPlan.code, 1),
          trainerId: String(assignment.trainer._id),
          trainerName: assignment.trainer.name,
          autoRenew: Boolean(autoRenew),
          benefits: Array.isArray(benefits) ? [...benefits] : [],
          notes: notes || '',
        },
      }], { session });

      paymentSessionId = paymentSession._id;

      stripeSession = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: toCheckoutCurrency(selectedPlan.currency),
            product_data: {
              name: `${gym.name} membership - ${selectedPlan.label || selectedPlan.code}`,
              description: `Trainer: ${assignment.trainer.name} (Stripe test mode)`,
            },
            unit_amount: Math.round(selectedPlanAmount * 100),
          },
          quantity: 1,
        }],
        mode: 'payment',
        customer_email: user?.email || undefined,
        metadata: {
          paymentSessionId: String(paymentSessionId),
          userId: String(user._id),
          type: 'gym-membership',
        },
        success_url: buildMembershipSuccessUrl(gym._id),
        cancel_url: buildMembershipCancelUrl(gym._id),
      });

      await PaymentSession.findByIdAndUpdate(
        paymentSessionId,
        {
          'stripe.checkoutSessionId': stripeSession.id,
          'stripe.status': 'open',
        },
        { session },
      );
    });
  } finally {
    await session.endSession();
  }

  return {
    checkoutUrl: stripeSession.url,
    sessionId: stripeSession.id,
  };
};

export const finalizeGymMembershipPaymentSession = async ({
  paymentSessionId,
  stripeSessionId,
  paymentIntentId,
}) => {
  const paymentSession = await PaymentSession.findById(paymentSessionId);

  if (!paymentSession) {
    throw new ApiError(404, 'Payment session not found.');
  }

  const metadata = paymentSession.metadata ?? {};

  if (metadata.membershipId) {
    return loadMembershipSummary(metadata.membershipId);
  }

  if (paymentSession.stripe?.status === 'expired') {
    throw new ApiError(400, 'This checkout session has expired.');
  }

  const user = await User.findById(paymentSession.user).select('name email role status');

  if (!user || !['trainee', 'trainer'].includes(user.role)) {
    throw new ApiError(403, 'Only trainees or trainers can activate this membership.');
  }

  const gym = await ensureGymForMembership(paymentSession.gym);

  if (String(gym.owner) === String(user._id)) {
    throw new ApiError(400, 'Gym owners cannot join their own gym as a member.');
  }

  const reusableMembership = await GymMembership.findOne({
    gym: gym._id,
    trainee: user._id,
    trainer: metadata.trainerId,
    plan: metadata.planCode,
    status: { $in: ['active', 'paused'] },
  }).lean();

  if (reusableMembership) {
    paymentSession.stripe = paymentSession.stripe || {};
    paymentSession.processed = true;
    paymentSession.stripe.checkoutSessionId = stripeSessionId || paymentSession.stripe?.checkoutSessionId;
    paymentSession.stripe.paymentIntentId = paymentIntentId || paymentSession.stripe?.paymentIntentId;
    paymentSession.stripe.status = 'completed';
    paymentSession.metadata = {
      ...metadata,
      membershipId: String(reusableMembership._id),
    };
    await paymentSession.save();
    return loadMembershipSummary(reusableMembership._id);
  }

  const conflictingMembership = await GymMembership.findOne({
    gym: gym._id,
    trainee: user._id,
    plan: { $ne: 'trainer-access' },
    status: { $in: ['pending', 'active', 'paused'] },
  }).lean();

  if (conflictingMembership) {
    throw new ApiError(409, 'You already have an active membership for this gym.');
  }

  if (user.role === 'trainee') {
    const otherGymMembership = await GymMembership.findOne({
      trainee: user._id,
      gym: { $ne: gym._id },
      plan: { $ne: 'trainer-access' },
      status: { $in: ['pending', 'active', 'paused'] },
    })
      .select('_id gym status plan')
      .lean();

    if (otherGymMembership) {
      throw new ApiError(409, 'You already have an active membership in another gym.');
    }
  }

  const assignment = await TrainerAssignment.findOne({
    gym: gym._id,
    trainer: metadata.trainerId,
    status: 'active',
  })
    .populate({ path: 'trainer', select: 'name email profilePicture role status' })
    .lean();

  if (!assignment || !assignment.trainer || assignment.trainer.role !== 'trainer') {
    throw new ApiError(400, 'Selected trainer is not available for this gym.');
  }

  if (assignment.trainer.status !== 'active') {
    throw new ApiError(400, 'Trainer is not active at the moment.');
  }

  const paymentReference = buildStripePaymentReference({
    paymentIntentId,
    stripeSessionId,
    fallback: buildAutoPaymentReference({
      userId: user._id,
      gymId: gym._id,
      planCode: metadata.planCode,
    }),
  });

  const membership = await activatePaidMembership({
    user,
    gym,
    assignment,
    selectedPlan: {
      code: metadata.planCode,
      label: metadata.planLabel,
      durationMonths: Number(metadata.durationMonths) || getMembershipPlanDurationMonths(metadata.planCode, 1),
      price: Number(metadata.amount) || Number(paymentSession.amount) || 0,
      mrp: Number(metadata.amount) || Number(paymentSession.amount) || 0,
      currency: toDisplayCurrency(metadata.currency || paymentSession.currency),
    },
    autoRenew: metadata.autoRenew !== false,
    benefits: Array.isArray(metadata.benefits) ? metadata.benefits : undefined,
    notes: metadata.notes,
    paymentReference,
    paymentGateway: 'stripe',
  });

  paymentSession.stripe = paymentSession.stripe || {};
  paymentSession.processed = true;
  paymentSession.stripe.checkoutSessionId = stripeSessionId || paymentSession.stripe?.checkoutSessionId;
  paymentSession.stripe.paymentIntentId = paymentIntentId || paymentSession.stripe?.paymentIntentId;
  paymentSession.stripe.status = 'completed';
  paymentSession.metadata = {
    ...metadata,
    membershipId: membership?.id ? String(membership.id) : undefined,
    paymentReference,
  };
  await paymentSession.save();

  return membership;
};

export const joinGym = asyncHandler(async (req, res) => {
  const { gymId } = req.params;
  const user = req.user;

  if (!['trainee', 'trainer'].includes(user.role)) {
    throw new ApiError(403, 'Only trainees or trainers can join a gym.');
  }

  const gym = await ensureGymForMembership(gymId);

  if (String(gym.owner) === String(user._id)) {
    throw new ApiError(400, 'Gym owners cannot join their own gym as a member.');
  }

  const joinAsTrainer = user.role === 'trainer' && Boolean(req.body?.joinAsTrainer);

  const existingMembership = await GymMembership.findOne({
    gym: gym._id,
    trainee: user._id,
    status: { $in: ['pending', 'active', 'paused'] },
  }).lean();

  if (!joinAsTrainer && user.role === 'trainee') {
    const otherGymMembership = await GymMembership.findOne({
      trainee: user._id,
      gym: { $ne: gym._id },
      plan: { $ne: 'trainer-access' },
      status: { $in: ['pending', 'active', 'paused'] },
    })
      .select('_id gym status plan')
      .lean();

    if (otherGymMembership) {
      throw new ApiError(409, 'You already have an active membership in another gym.');
    }
  }

  const existingTrainerMembership = existingMembership?.plan === 'trainer-access'
    ? existingMembership
    : await GymMembership.findOne({
      gym: gym._id,
      trainee: user._id,
      plan: 'trainer-access',
      status: { $in: ['pending', 'active'] },
    }).lean();

  if (joinAsTrainer) {
    if (existingTrainerMembership) {
      if (existingTrainerMembership.status === 'pending') {
        throw new ApiError(409, 'Trainer approval already requested for this gym.');
      }

      throw new ApiError(409, 'You are already registered as a trainer at this gym.');
    }

    if (existingMembership && existingMembership.plan !== 'trainer-access') {
      throw new ApiError(
        409,
        'You already have an active membership for this gym. End it before joining as a trainer.',
      );
    }

    const requestedAt = new Date();
    const endDate = new Date(requestedAt);
    endDate.setMonth(endDate.getMonth() + 6);

    const trainerMembership = await GymMembership.create({
      trainee: user._id,
      gym: gym._id,
      plan: 'trainer-access',
      startDate: requestedAt,
      endDate,
      status: 'pending',
      autoRenew: false,
      benefits: ['trainer-roster'],
      notes: req.body?.notes,
    });

    await TrainerAssignment.updateOne(
      { trainer: user._id, gym: gym._id },
      {
        $setOnInsert: {
          trainer: user._id,
          gym: gym._id,
          trainees: [],
        },
        $set: {
          status: 'pending',
          requestedAt,
        },
        $unset: { approvedAt: '' },
      },
      { upsert: true },
    );

    const populatedTrainerMembership = await GymMembership.findById(trainerMembership._id)
      .populate({ path: 'gym', select: 'name location pricing' })
      .populate({ path: 'trainer', select: 'name profilePicture' })
      .lean();

    return res
      .status(202)
      .json(
        new ApiResponse(
          202,
          { membership: mapMembership(populatedTrainerMembership) },
          'Trainer request submitted. Await gym owner approval.',
        ),
      );
  }

  if (existingMembership && existingMembership.plan !== 'trainer-access') {
    throw new ApiError(409, 'You already have an active membership for this gym.');
  }

  const trainerId = req.body?.trainerId;
  if (!trainerId || !isObjectId(trainerId)) {
    throw new ApiError(400, 'Select a trainer to continue.');
  }

  const assignment = await TrainerAssignment.findOne({
    gym: gym._id,
    trainer: trainerId,
    status: 'active',
  })
    .populate({ path: 'trainer', select: 'name email profilePicture role status' })
    .lean();

  if (!assignment || !assignment.trainer || assignment.trainer.role !== 'trainer') {
    throw new ApiError(400, 'Selected trainer is not available for this gym.');
  }

  if (assignment.trainer.status !== 'active') {
    throw new ApiError(400, 'Trainer is not active at the moment.');
  }

  const selectedPlan = resolveGymPlanForPurchase(gym, req.body?.planCode);
  const selectedPlanAmount = Number(selectedPlan?.price ?? selectedPlan?.mrp);

  if (!selectedPlan || !selectedPlanAmount) {
    throw new ApiError(400, 'Select a valid membership plan to continue.');
  }

  const autoRenew = req.body?.autoRenew ?? true;
  const benefits = Array.isArray(req.body?.benefits) ? req.body.benefits : undefined;
  const notes = req.body?.notes;

  const checkoutSession = await createMembershipCheckoutSession({
    user,
    gym,
    selectedPlan,
    assignment,
    autoRenew,
    benefits,
    notes,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, checkoutSession, 'Membership checkout session created.'));
});

export const leaveGym = asyncHandler(async (req, res) => {
  const { gymId, membershipId } = req.params;
  const requester = req.user;

  if (!isObjectId(gymId) || !isObjectId(membershipId)) {
    throw new ApiError(400, 'Invalid membership request.');
  }

  const membership = await GymMembership.findById(membershipId);

  if (!membership || String(membership.gym) !== gymId) {
    throw new ApiError(404, 'Membership not found.');
  }

  const isTrainerMembership = membership.plan === 'trainer-access';

  const gym = await Gym.findById(gymId).select('owner');
  if (!gym) {
    throw new ApiError(404, 'Gym not found.');
  }

  const isSelf = String(membership.trainee) === String(requester._id);
  const isOwner = requester.role === 'gym-owner' && String(gym.owner) === String(requester._id);
  const isAdmin = requester.role === 'admin';

  if (!isSelf && !isOwner && !isAdmin) {
    throw new ApiError(403, 'You do not have permission to update this membership.');
  }

  const previousStatus = membership.status;
  const trainerId = membership.trainer;
  const trainerAccountId = isTrainerMembership ? membership.trainee : null;

  if (['cancelled', 'expired'].includes(previousStatus)) {
    const responsePayload = await GymMembership.findById(membership._id)
      .populate({ path: 'gym', select: 'name location' })
      .populate({ path: 'trainer', select: 'name profilePicture' })
      .lean();

    return res
      .status(200)
      .json(new ApiResponse(200, { membership: mapMembership(responsePayload) }, 'Membership already inactive.'));
  }

  membership.status = 'cancelled';
  membership.autoRenew = false;
  membership.endDate = new Date();

  if (membership.billing && membership.billing.status === 'paid') {
    membership.billing.status = 'refunded';
  }

  await membership.save();

  const updates = [];

  if (['active', 'paused'].includes(previousStatus)) {
    if (isTrainerMembership) {
      updates.push(
        Gym.updateOne(
          { _id: gymId },
          {
            $inc: { 'analytics.trainers': -1 },
            $set: { lastUpdatedBy: requester._id },
          },
        ),
      );
    } else {
      updates.push(
        Gym.updateOne(
          { _id: gymId },
          {
            $inc: { 'analytics.memberships': -1 },
            $set: { lastUpdatedBy: requester._id },
          },
        ),
      );
    }
  }

  if (isSelf && requester.role === 'trainee') {
    updates.push(
      User.updateOne(
        { _id: membership.trainee, 'traineeMetrics.activeMemberships': { $gt: 0 } },
        { $inc: { 'traineeMetrics.activeMemberships': -1 } },
      ),
    );
  }

  if (trainerId) {
    updates.push(
      User.updateOne(
        { _id: trainerId, 'trainerMetrics.activeTrainees': { $gt: 0 } },
        { $inc: { 'trainerMetrics.activeTrainees': -1 } },
      ),
    );
    updates.push(
      TrainerAssignment.updateOne(
        { trainer: trainerId, gym: gymId, 'trainees.trainee': membership.trainee },
        {
          $set: { 'trainees.$.status': 'completed' },
        },
      ),
    );
  }

  updates.push(
    Booking.updateMany(
      {
        user: membership.trainee,
        gym: gymId,
        status: { $in: ['pending', 'confirmed'] },
      },
      {
        $set: {
          status: 'cancelled',
          cancellationReason: isTrainerMembership
            ? 'Trainer access removed for this gym.'
            : 'Membership ended for this gym.',
        },
      },
    ),
  );

  if (isTrainerMembership && trainerAccountId) {
    updates.push(
      TrainerAssignment.updateOne(
        { trainer: trainerAccountId, gym: gymId },
        { $set: { status: 'inactive' } },
      ),
    );
    updates.push(
      User.updateOne(
        { _id: trainerAccountId },
        { $pull: { 'trainerMetrics.gyms': gymId } },
      ),
    );
  }

  await Promise.all(updates);
  await recordAuditLog({
    actor: requester._id,
    actorRole: requester.role,
    action: 'membership.cancelled',
    entityType: 'gymMembership',
    entityId: membership._id,
    summary: 'Membership cancelled',
    metadata: { gymId, trainerId },
  });
  await syncGymAnalyticsSnapshot(gymId);

  const populated = await GymMembership.findById(membership._id)
    .populate({ path: 'gym', select: 'name location' })
    .populate({ path: 'trainer', select: 'name profilePicture' })
    .lean();
  await invalidateGymReadCaches(gymId);

  return res
    .status(200)
    .json(new ApiResponse(200, { membership: mapMembership(populated) }, 'Membership cancelled successfully.'));
});

export const listGymTrainers = asyncHandler(async (req, res) => {
  const { gymId } = req.params;

  if (!isObjectId(gymId)) {
    throw new ApiError(400, 'Invalid gym id.');
  }

  const gym = await Gym.findOne({ _id: gymId, status: 'active', isPublished: true })
    .select('_id name')
    .lean();

  if (!gym) {
    throw new ApiError(404, 'Gym not found.');
  }

  const assignments = await TrainerAssignment.find({ gym: gymId, status: 'active' })
    .populate({
      path: 'trainer',
      select:
        'name firstName lastName profilePicture trainerMetrics rating status bio experienceYears certifications mentoredCount profile specializations age height gender',
    })
    .lean();

  const trainers = assignments
    .map((assignment) => {
      if (!assignment.trainer || assignment.trainer.status !== 'active') {
        return null;
      }

      const activeTrainees = Array.isArray(assignment.trainees)
        ? assignment.trainees.filter((record) => record.status === 'active').length
        : 0;

      return {
        id: String(assignment.trainer._id),
        name: assignment.trainer.name ?? `${assignment.trainer.firstName ?? ''} ${assignment.trainer.lastName ?? ''}`.trim(),
        profilePicture: assignment.trainer.profilePicture ?? null,
        activeTrainees,
        gyms: assignment.trainer.trainerMetrics?.gyms?.map(String) ?? [],
        experienceYears: assignment.trainer.experienceYears ?? null,
        certifications: Array.isArray(assignment.trainer.certifications)
          ? assignment.trainer.certifications
          : [],
        mentoredCount: assignment.trainer.mentoredCount ?? activeTrainees,
        specializations: Array.isArray(assignment.trainer.specializations)
          ? assignment.trainer.specializations
          : [],
        headline: assignment.trainer.profile?.headline ?? '',
        bio: assignment.trainer.bio ?? assignment.trainer.profile?.about ?? '',
        age: assignment.trainer.age ?? null,
        height: assignment.trainer.height ?? null,
        gender: assignment.trainer.gender ?? '',
      };
    })
    .filter(Boolean);

  return res
    .status(200)
    .json(new ApiResponse(200, { trainers }, 'Gym trainers fetched successfully.'));
});
