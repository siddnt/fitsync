import mongoose from 'mongoose';
import Gym from '../../models/gym.model.js';
import GymMembership from '../../models/gymMembership.model.js';
import TrainerAssignment from '../../models/trainerAssignment.model.js';
import Revenue from '../../models/revenue.model.js';
import User from '../../models/user.model.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { invalidatePrefix } from '../../services/redis.service.js';
import {
  buildFrontendUrl,
  createStripeCheckoutSession,
} from '../../services/stripe.service.js';

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

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
        receiptUrl: membership.billing.receiptUrl,
        status: membership.billing.status,
      }
      : null,
    invoices: Array.isArray(membership.invoices)
      ? membership.invoices.map((invoice) => ({
        amount: invoice.amount,
        currency: invoice.currency,
        paidOn: invoice.paidOn,
        paymentReference: invoice.paymentReference,
        receiptUrl: invoice.receiptUrl,
        status: invoice.status,
      }))
      : [],
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

const resolveGymPrice = (gym) => {
  const price = Number(gym?.pricing?.monthlyPrice ?? gym?.pricing?.monthlyMrp);
  return Number.isFinite(price) && price > 0 ? price : null;
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

  const monthlyFee = resolveGymPrice(gym);

  if (!monthlyFee) {
    throw new ApiError(400, 'This gym does not have a valid monthly price configured.');
  }

  const autoRenew = req.body?.autoRenew ?? true;
  const benefits = Array.isArray(req.body?.benefits) ? req.body.benefits : undefined;
  const notes = req.body?.notes;

  const startDate = new Date();
  const endDate = (() => {
    const result = new Date(startDate);
    result.setMonth(result.getMonth() + 1);
    return result;
  })();

  if (Number.isNaN(endDate.getTime())) {
    throw new ApiError(400, 'Invalid membership end date.');
  }

  // Generate Stripe Checkout session
  const stripeSession = await createStripeCheckoutSession({
    payment_method_types: ['card'],
    mode: 'payment',
    line_items: [{
      price_data: {
        currency: 'inr',
        product_data: {
          name: `Gym Membership: ${gym.name}`,
          description: `1 Month Membership with Trainer ${assignment.trainer.name}`,
        },
        unit_amount: Math.round(monthlyFee * 100),
      },
      quantity: 1,
    }],
    success_url: buildFrontendUrl('/payment/success?session_id={CHECKOUT_SESSION_ID}'),
    cancel_url: buildFrontendUrl(`/gyms/${gym._id}`),
    metadata: { type: 'gym_membership', gymId: String(gym._id) }
  });

  const membershipPayload = {
    trainee: user._id,
    gym: gym._id,
    plan: 'monthly',
    startDate,
    endDate,
    status: 'pending', // Pending until verified
    autoRenew,
    benefits,
    notes,
    trainer: assignment.trainer._id,
  };

  const billingSource = req.body?.billing ?? {};
  
  membershipPayload.billing = {
    amount: monthlyFee,
    currency: billingSource.currency ?? 'INR',
    paymentGateway: 'stripe',
    paymentReference: stripeSession.id,
    receiptUrl: null,
    status: 'pending', // Pending until verified
  };

  membershipPayload.invoices = [
    {
      amount: monthlyFee,
      currency: billingSource.currency ?? 'INR',
      paidOn: startDate,
      paymentReference: stripeSession.id,
      receiptUrl: null,
      status: 'pending',
      metadata: new Map([
        ['gymId', String(gym._id)],
        ['trainerId', String(assignment.trainer._id)],
      ]),
    },
  ];

  const membership = await GymMembership.create(membershipPayload);

  return res
    .status(201)
    .json(new ApiResponse(201, { checkoutUrl: stripeSession.url }, 'Redirecting to secure checkout'));
});

/**
 * Fulfills a gym membership post-payment. Called by payment.controller.js.
 */
export const fulfillGymMembership = async (membershipId, { sessionId, receiptUrl } = {}) => {
  const membership = await GymMembership.findById(membershipId)
    .populate('gym')
    .populate('trainer')
    .populate('trainee');
    
  if (!membership || membership.status !== 'pending') return null;

  membership.status = 'active';

  if (membership.billing) {
    membership.billing.status = 'paid';
    if (sessionId) {
      membership.billing.paymentReference = sessionId;
    }
    if (receiptUrl) {
      membership.billing.receiptUrl = receiptUrl;
    }
  }

  if (!Array.isArray(membership.invoices)) {
    membership.invoices = [];
  }

  let invoice = null;
  if (sessionId) {
    invoice = membership.invoices.find((entry) => entry?.paymentReference === sessionId) ?? null;
  }

  if (!invoice) {
    invoice = membership.invoices.find((entry) => entry?.status === 'pending') ?? null;
  }

  if (!invoice) {
    invoice = {
      amount: membership.billing?.amount || 0,
      currency: membership.billing?.currency || 'INR',
      paidOn: new Date(),
      paymentReference: sessionId ?? null,
      receiptUrl: receiptUrl ?? null,
      status: 'paid',
      metadata: new Map([
        ['gymId', String(membership.gym?._id || '')],
        ['trainerId', String(membership.trainer?._id || '')],
      ]),
    };
    membership.invoices.push(invoice);
  } else {
    invoice.status = 'paid';
    invoice.paidOn = invoice.paidOn ?? new Date();
    if (sessionId) {
      invoice.paymentReference = sessionId;
    }
    if (receiptUrl) {
      invoice.receiptUrl = receiptUrl;
    }
  }

  await membership.save();

  const monthlyFee = membership.billing?.amount || 0;
  const trainerShare = Math.round(monthlyFee * 0.5);
  const ownerShare = Math.max(Math.round(monthlyFee - trainerShare), 0);

  const updates = [
    Gym.updateOne(
      { _id: membership.gym._id },
      { $inc: { 'analytics.memberships': 1 }, $set: { lastUpdatedBy: membership.trainee._id } },
    ),
  ];

  if (membership.trainee.role === 'trainee') {
    updates.push(
      User.updateOne(
        { _id: membership.trainee._id },
        { $inc: { 'traineeMetrics.activeMemberships': 1 }, $set: { 'traineeMetrics.primaryGym': membership.gym._id } },
      ),
    );
  }

  updates.push(
    User.updateOne(
      { _id: membership.trainer._id },
      { $addToSet: { 'trainerMetrics.gyms': membership.gym._id }, $inc: { 'trainerMetrics.activeTrainees': 1 } },
    ),
  );

  updates.push(
    User.updateOne(
      { _id: membership.gym.owner },
      { $inc: { 'ownerMetrics.monthlyEarnings': ownerShare } },
    ),
  );

  await Promise.all(updates);

  const assignmentUpdate = await TrainerAssignment.findOneAndUpdate(
    { trainer: membership.trainer._id, gym: membership.gym._id, 'trainees.trainee': membership.trainee._id },
    { $set: { status: 'active', 'trainees.$.status': 'active', 'trainees.$.assignedAt': new Date() } },
    { new: true },
  );

  if (!assignmentUpdate) {
    await TrainerAssignment.findOneAndUpdate(
      { trainer: membership.trainer._id, gym: membership.gym._id },
      {
        $setOnInsert: { trainer: membership.trainer._id, gym: membership.gym._id, status: 'active' },
        $push: { trainees: { trainee: membership.trainee._id, status: 'active', assignedAt: new Date() } },
      },
      { upsert: true },
    );
  }

  const metadataBase = [
    ['gymId', String(membership.gym._id)],
    ['memberId', String(membership.trainee._id)],
    ['membershipId', String(membership._id)],
    ['paymentReference', membership.billing?.paymentReference || 'stripe'],
    ['plan', 'monthly'],
  ];

  await Promise.all([
    Revenue.create({
      amount: trainerShare,
      user: membership.trainer._id,
      type: 'membership',
      description: `Trainer share for ${membership.gym.name} membership`,
      metadata: new Map([...metadataBase, ['share', 'trainer'], ['trainerId', String(membership.trainer._id)], ['amount', String(trainerShare)]]),
    }),
    Revenue.create({
      amount: ownerShare,
      user: membership.gym.owner,
      type: 'membership',
      description: `Gym share for ${membership.gym.name} membership`,
      metadata: new Map([...metadataBase, ['share', 'gym'], ['trainerId', String(membership.trainer._id)], ['amount', String(ownerShare)]]),
    }),
  ]);

  await Promise.all([
    invalidatePrefix('cache:gymowner-overview'),
    invalidatePrefix('cache:gymowner-analytics'),
    invalidatePrefix('cache:gymowner-roster'),
    invalidatePrefix('cache:trainee-overview'),
    invalidatePrefix('cache:gym-detail:'),
    invalidatePrefix('cache:gyms:'),
  ]);

  return membership;
};

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

    if (Array.isArray(membership.invoices)) {
      membership.invoices.forEach((invoice) => {
        if (invoice?.status === 'paid') {
          invoice.status = 'refunded';
        }
      });
    }
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

  const populated = await GymMembership.findById(membership._id)
    .populate({ path: 'gym', select: 'name location' })
    .populate({ path: 'trainer', select: 'name profilePicture' })
    .lean();

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
