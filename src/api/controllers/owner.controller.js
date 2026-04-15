import mongoose from 'mongoose';
import Gym from '../../models/gym.model.js';
import TrainerAssignment from '../../models/trainerAssignment.model.js';
import GymMembership from '../../models/gymMembership.model.js';
import User from '../../models/user.model.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { invalidateCacheByTags } from '../../services/cache.service.js';
import { recordAuditLog } from '../../services/audit.service.js';
import { createNotifications } from '../../services/notification.service.js';
import { syncGymAnalyticsSnapshot } from '../../services/gymMetrics.service.js';
import {
  buildCursorFilter,
  buildCursorSortStage,
  encodeCursorToken,
} from '../../utils/cursorPagination.js';

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const invalidateGymReadCaches = async (gymId) =>
  invalidateCacheByTags(['gyms:list', gymId ? `gym:${gymId}` : null]);

const OWNER_REQUEST_CURSOR_SORT_FIELDS = [
  { field: 'requestedAt', order: 1, type: 'date' },
  { field: '_id', order: 1, type: 'objectId' },
];

const normalizeTrainer = (assignment) => {
  if (!assignment?.trainer) {
    return null;
  }

  return {
    id: String(assignment.trainer._id),
    name:
      assignment.trainer.name ??
      `${assignment.trainer.firstName ?? ''} ${assignment.trainer.lastName ?? ''}`.trim(),
    email: assignment.trainer.email,
    status: assignment.trainer.status,
    profilePicture: assignment.trainer.profilePicture ?? null,
    experienceYears: assignment.trainer.experienceYears ?? null,
    mentoredCount: assignment.trainer.mentoredCount ?? assignment.trainer.trainerMetrics?.activeTrainees ?? 0,
    certifications: Array.isArray(assignment.trainer.certifications)
      ? assignment.trainer.certifications
      : [],
    specializations: Array.isArray(assignment.trainer.specializations)
      ? assignment.trainer.specializations
      : [],
    headline: assignment.trainer.profile?.headline ?? '',
    bio: assignment.trainer.bio ?? assignment.trainer.profile?.about ?? '',
    age: assignment.trainer.age ?? null,
    height: assignment.trainer.height ?? null,
    gender: assignment.trainer.gender ?? '',
  };
};

const normalizeGym = (assignment) => {
  if (!assignment?.gym) {
    return null;
  }

  return {
    id: String(assignment.gym._id ?? assignment.gym),
    name: assignment.gym.name,
    city: assignment.gym.location?.city,
  };
};

export const listTrainerRequests = asyncHandler(async (req, res) => {
  const ownerId = req.user?._id;
  const cursor = typeof req.query.cursor === 'string' ? req.query.cursor.trim() : '';
  const paginationMode = String(req.query.pagination ?? '').trim().toLowerCase();
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);

  const gyms = await Gym.find({ owner: ownerId })
    .select('name location')
    .lean();

  if (!gyms.length) {
    return res
      .status(200)
      .json(new ApiResponse(200, { requests: [] }, 'No pending trainer requests.'));
  }

  const gymIds = gyms.map((gym) => gym._id);

  const baseFilter = {
    gym: { $in: gymIds },
    status: 'pending',
  };
  const findFilters = paginationMode === 'cursor'
    ? buildCursorFilter({
      baseFilter,
      cursor,
      sortFields: OWNER_REQUEST_CURSOR_SORT_FIELDS,
    })
    : baseFilter;

  if (!findFilters) {
    throw new ApiError(400, 'Invalid cursor');
  }

  const assignments = await TrainerAssignment.find(findFilters)
    .populate({
      path: 'trainer',
      select:
        'name firstName lastName email profilePicture status age height gender bio experienceYears certifications mentoredCount profile specializations trainerMetrics',
    })
    .populate({ path: 'gym', select: 'name location owner' })
    .sort(paginationMode === 'cursor' ? buildCursorSortStage(OWNER_REQUEST_CURSOR_SORT_FIELDS) : { requestedAt: 1 })
    .limit(paginationMode === 'cursor' ? limit + 1 : 0)
    .lean();

  const hasMore = paginationMode === 'cursor' && assignments.length > limit;
  const assignmentPage = hasMore ? assignments.slice(0, limit) : assignments;
  const nextCursor = hasMore
    ? encodeCursorToken({ document: assignmentPage[assignmentPage.length - 1], sortFields: OWNER_REQUEST_CURSOR_SORT_FIELDS })
    : null;

  const requests = assignmentPage
    .filter((assignment) => String(assignment.gym?.owner) === String(ownerId))
    .map((assignment) => ({
      id: String(assignment._id),
      requestedAt: assignment.requestedAt,
      trainer: normalizeTrainer(assignment),
      gym: normalizeGym(assignment),
    }));

  return res
    .status(200)
    .json(new ApiResponse(200, {
      requests,
      ...(paginationMode === 'cursor'
        ? { pagination: { mode: 'cursor', limit, hasMore, nextCursor } }
        : {}),
    }, 'Trainer requests fetched successfully.'));
});

export const approveTrainerRequest = asyncHandler(async (req, res) => {
  const { assignmentId } = req.params;
  const ownerId = req.user?._id;

  if (!isObjectId(assignmentId)) {
    throw new ApiError(400, 'Invalid trainer request id.');
  }

  const assignment = await TrainerAssignment.findById(assignmentId)
    .populate({ path: 'gym', select: 'owner name location analytics' })
    .populate({ path: 'trainer', select: 'name firstName lastName email profilePicture status trainerMetrics' });

  if (!assignment) {
    throw new ApiError(404, 'Trainer request not found.');
  }

  if (String(assignment.gym?.owner) !== String(ownerId)) {
    throw new ApiError(403, 'You do not have permission to manage this trainer request.');
  }

  if (assignment.status === 'active') {
    return res
      .status(200)
      .json(new ApiResponse(200, { trainer: normalizeTrainer(assignment) }, 'Trainer already approved.'));
  }

  const approvalDate = new Date();

  assignment.status = 'active';
  assignment.approvedAt = approvalDate;
  assignment.requestedAt = assignment.requestedAt ?? approvalDate;
  await assignment.save();

  const membershipUpdate = {
    status: 'active',
    startDate: approvalDate,
    endDate: (() => {
      const end = new Date(approvalDate);
      end.setMonth(end.getMonth() + 6);
      return end;
    })(),
    autoRenew: false,
  };

  const membershipQuery = {
    gym: assignment.gym._id,
    trainee: assignment.trainer._id,
    plan: { $in: ['trainer-access', 'trainerAccess', 'trainer'] },
  };

  let membership = await GymMembership.findOneAndUpdate(
    membershipQuery,
    { $set: { ...membershipUpdate, plan: 'trainer-access' } },
    { new: true },
  );

  if (!membership) {
    membership = await GymMembership.create({
      trainee: assignment.trainer._id,
      gym: assignment.gym._id,
      plan: 'trainer-access',
      ...membershipUpdate,
      benefits: ['trainer-roster'],
    });
  }

  await Promise.all([
    User.updateOne(
      { _id: assignment.trainer._id },
      {
        $addToSet: { 'trainerMetrics.gyms': assignment.gym._id },
        ...(assignment.trainer.status === 'pending' ? { $set: { status: 'active' } } : {}),
      },
    ),
    Gym.updateOne(
      { _id: assignment.gym._id },
      { $set: { lastUpdatedBy: ownerId } },
    ),
  ]);
  await syncGymAnalyticsSnapshot(assignment.gym._id);

  const payload = {
    assignmentId: String(assignment._id),
    trainer: normalizeTrainer(assignment),
    gym: normalizeGym(assignment),
    approvedAt: approvalDate,
    membershipStatus: membership?.status ?? 'active',
  };
  await Promise.all([
    createNotifications([{
      user: assignment.trainer._id,
      type: 'trainer-request-approved',
      title: 'Trainer request approved',
      message: `Your trainer access request for ${assignment.gym?.name ?? 'the gym'} was approved.`,
      link: '/dashboard/trainer',
      metadata: { gymId: assignment.gym._id, assignmentId: assignment._id },
    }]),
    recordAuditLog({
      actor: ownerId,
      actorRole: req.user?.role,
      action: 'owner.trainer.approved',
      entityType: 'trainerAssignment',
      entityId: assignment._id,
      summary: 'Trainer request approved',
      metadata: { gymId: assignment.gym._id, trainerId: assignment.trainer._id },
    }),
  ]);
  await invalidateGymReadCaches(assignment.gym._id);

  return res
    .status(200)
    .json(new ApiResponse(200, payload, 'Trainer approved successfully.'));
});

export const declineTrainerRequest = asyncHandler(async (req, res) => {
  const { assignmentId } = req.params;
  const ownerId = req.user?._id;

  if (!isObjectId(assignmentId)) {
    throw new ApiError(400, 'Invalid trainer request id.');
  }

  const assignment = await TrainerAssignment.findById(assignmentId)
    .populate({ path: 'gym', select: 'owner' })
    .populate({ path: 'trainer', select: 'name' });

  if (!assignment) {
    throw new ApiError(404, 'Trainer request not found.');
  }

  if (String(assignment.gym?.owner) !== String(ownerId)) {
    throw new ApiError(403, 'You do not have permission to manage this trainer request.');
  }

  await TrainerAssignment.deleteOne({ _id: assignment._id });

  await GymMembership.updateOne(
    {
      gym: assignment.gym._id,
      trainee: assignment.trainer._id,
      plan: 'trainer-access',
    },
    {
      $set: {
        status: 'cancelled',
        autoRenew: false,
        endDate: new Date(),
      },
    },
  );
  await Promise.all([
    createNotifications([{
      user: assignment.trainer._id,
      type: 'trainer-request-declined',
      title: 'Trainer request declined',
      message: 'Your trainer access request was declined.',
      link: '/gyms',
      metadata: { gymId: assignment.gym._id },
    }]),
    recordAuditLog({
      actor: ownerId,
      actorRole: req.user?.role,
      action: 'owner.trainer.declined',
      entityType: 'trainerAssignment',
      entityId: assignment._id,
      summary: 'Trainer request declined',
      metadata: { gymId: assignment.gym._id, trainerId: assignment.trainer._id },
    }),
  ]);
  await syncGymAnalyticsSnapshot(assignment.gym._id);
  await invalidateGymReadCaches(assignment.gym._id);

  return res
    .status(200)
    .json(new ApiResponse(200, { assignmentId: String(assignment._id) }, 'Trainer request declined.'));
});

export const removeTrainerFromGym = asyncHandler(async (req, res) => {
  const { assignmentId } = req.params;
  const ownerId = req.user?._id;

  if (!isObjectId(assignmentId)) {
    throw new ApiError(400, 'Invalid trainer assignment id.');
  }

  const assignment = await TrainerAssignment.findById(assignmentId)
    .populate({ path: 'gym', select: 'owner' })
    .populate({ path: 'trainer', select: 'name' });

  if (!assignment) {
    throw new ApiError(404, 'Trainer assignment not found.');
  }

  if (String(assignment.gym?.owner) !== String(ownerId)) {
    throw new ApiError(403, 'You do not have permission to manage this trainer.');
  }

  const traineesRemoved = assignment.trainees?.length ?? 0;
  assignment.status = 'inactive';
  assignment.trainees = [];
  await assignment.save();

  const updates = [
    Gym.updateOne(
      { _id: assignment.gym._id },
      { $set: { lastUpdatedBy: ownerId } },
    ),
    GymMembership.updateMany(
      {
        gym: assignment.gym._id,
        trainee: assignment.trainer._id,
        plan: { $in: ['trainer-access', 'trainerAccess', 'trainer'] },
      },
      {
        $set: {
          status: 'cancelled',
          autoRenew: false,
          endDate: new Date(),
        },
      },
    ),
    User.updateOne(
      { _id: assignment.trainer._id },
      {
        $pull: { 'trainerMetrics.gyms': assignment.gym._id },
        ...(traineesRemoved
          ? { $inc: { 'trainerMetrics.activeTrainees': -traineesRemoved } }
          : {}),
      },
    ),
  ];

  await Promise.all(updates);
  await recordAuditLog({
    actor: ownerId,
    actorRole: req.user?.role,
    action: 'owner.trainer.removed',
    entityType: 'trainerAssignment',
    entityId: assignment._id,
    summary: 'Trainer removed from gym',
    metadata: { gymId: assignment.gym._id, trainerId: assignment.trainer._id },
  });
  await syncGymAnalyticsSnapshot(assignment.gym._id);
  await invalidateGymReadCaches(assignment.gym._id);

  return res
    .status(200)
    .json(new ApiResponse(200, { assignmentId }, 'Trainer removed from gym.'));
});

export const removeGymMember = asyncHandler(async (req, res) => {
  const { membershipId } = req.params;
  const ownerId = req.user?._id;

  if (!isObjectId(membershipId)) {
    throw new ApiError(400, 'Invalid membership id.');
  }

  const membership = await GymMembership.findById(membershipId)
    .populate({ path: 'gym', select: 'owner' })
    .populate({ path: 'trainer', select: '_id' });

  if (!membership) {
    throw new ApiError(404, 'Membership not found.');
  }

  if (String(membership.gym?.owner) !== String(ownerId)) {
    throw new ApiError(403, 'You are not allowed to manage this membership.');
  }

  const previousStatus = membership.status;
  membership.status = 'cancelled';
  membership.autoRenew = false;
  membership.endDate = new Date();
  await membership.save();

  const updates = [];

  if (['active', 'paused'].includes(previousStatus)) {
    updates.push(
      Gym.updateOne(
        { _id: membership.gym._id },
        { $set: { lastUpdatedBy: ownerId } },
      ),
    );
  }

  if (membership.trainer) {
    updates.push(
      TrainerAssignment.updateOne(
        { trainer: membership.trainer._id, gym: membership.gym._id },
        { $pull: { trainees: { trainee: membership.trainee } } },
      ),
    );
  }

  await Promise.all(updates);
  await recordAuditLog({
    actor: ownerId,
    actorRole: req.user?.role,
    action: 'owner.member.removed',
    entityType: 'gymMembership',
    entityId: membership._id,
    summary: 'Gym member removed',
    metadata: { gymId: membership.gym._id, traineeId: membership.trainee },
  });
  await syncGymAnalyticsSnapshot(membership.gym._id);
  await invalidateGymReadCaches(membership.gym._id);

  return res
    .status(200)
    .json(new ApiResponse(200, { membershipId }, 'Member removed from gym.'));
});
