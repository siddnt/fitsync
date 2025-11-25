import mongoose from 'mongoose';
import Gym from '../../models/gym.model.js';
import TrainerAssignment from '../../models/trainerAssignment.model.js';
import GymMembership from '../../models/gymMembership.model.js';
import User from '../../models/user.model.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const isObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

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

  const gyms = await Gym.find({ owner: ownerId })
    .select('name location')
    .lean();

  if (!gyms.length) {
    return res
      .status(200)
      .json(new ApiResponse(200, { requests: [] }, 'No pending trainer requests.'));
  }

  const gymIds = gyms.map((gym) => gym._id);

  const assignments = await TrainerAssignment.find({
    gym: { $in: gymIds },
    status: 'pending',
  })
    .populate({
      path: 'trainer',
      select:
        'name firstName lastName email profilePicture status age height gender bio experienceYears certifications mentoredCount profile specializations trainerMetrics',
    })
    .populate({ path: 'gym', select: 'name location owner' })
    .sort({ requestedAt: 1 })
    .lean();

  const requests = assignments
    .filter((assignment) => String(assignment.gym?.owner) === String(ownerId))
    .map((assignment) => ({
      id: String(assignment._id),
      requestedAt: assignment.requestedAt,
      trainer: normalizeTrainer(assignment),
      gym: normalizeGym(assignment),
    }));

  return res
    .status(200)
    .json(new ApiResponse(200, { requests }, 'Trainer requests fetched successfully.'));
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
      {
        $inc: { 'analytics.trainers': 1 },
        $set: { lastUpdatedBy: ownerId },
      },
    ),
  ]);

  const payload = {
    assignmentId: String(assignment._id),
    trainer: normalizeTrainer(assignment),
    gym: normalizeGym(assignment),
    approvedAt: approvalDate,
    membershipStatus: membership?.status ?? 'active',
  };

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
      {
        $inc: { 'analytics.trainers': -1 },
        $set: { lastUpdatedBy: ownerId },
      },
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
        {
          $inc: { 'analytics.memberships': -1 },
          $set: { lastUpdatedBy: ownerId },
        },
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

  return res
    .status(200)
    .json(new ApiResponse(200, { membershipId }, 'Member removed from gym.'));
});
