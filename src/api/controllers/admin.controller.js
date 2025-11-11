import mongoose from 'mongoose';
import User from '../../models/user.model.js';
import Gym from '../../models/gym.model.js';
import TrainerAssignment from '../../models/trainerAssignment.model.js';
import TrainerProgress from '../../models/trainerProgress.model.js';
import GymMembership from '../../models/gymMembership.model.js';
import GymListingSubscription from '../../models/gymListingSubscription.model.js';
import Order from '../../models/order.model.js';
import Revenue from '../../models/revenue.model.js';
import {
  applyAdminToggleUpdates,
  loadAdminToggles,
} from '../../services/systemSettings.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';

const toObjectId = (value, label) => {
  if (!value) {
    throw new ApiError(400, `${label} is required.`);
  }
  try {
    return new mongoose.Types.ObjectId(value);
  } catch (_error) {
    throw new ApiError(400, `${label} is invalid.`);
  }
};

const cancelMembershipsForUser = async (userId) => {
  await GymMembership.updateMany(
    { trainee: userId, status: { $in: ['active', 'paused'] } },
    { $set: { status: 'cancelled' } },
  );
};

const cleanOrdersForUser = async (userId) => {
  await Order.updateMany(
    { user: userId, status: { $ne: 'delivered' } },
    { $set: { status: 'delivered', 'orderItems.$[].status': 'delivered' } },
  );
};

const deactivateGymsForOwner = async (ownerId) => {
  const gyms = await Gym.find({ owner: ownerId }).select('_id').lean();
  if (!gyms.length) {
    return [];
  }

  const gymIds = gyms.map((gym) => gym._id);

  await Promise.all([
    Gym.updateMany({ _id: { $in: gymIds } }, { $set: { status: 'suspended', isPublished: false } }),
    GymListingSubscription.updateMany(
      { gym: { $in: gymIds }, status: { $in: ['active', 'grace'] } },
      { $set: { status: 'cancelled', autoRenew: false } },
    ),
    TrainerAssignment.deleteMany({ gym: { $in: gymIds } }),
    TrainerProgress.deleteMany({ gym: { $in: gymIds } }),
    GymMembership.updateMany({ gym: { $in: gymIds } }, { $set: { status: 'cancelled' } }),
  ]);

  return gymIds;
};

export const deleteUserAccount = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    throw new ApiError(403, 'Only administrators can delete accounts.');
  }

  const targetUserId = toObjectId(req.params.userId, 'User id');

  if (targetUserId.equals(req.user._id)) {
    throw new ApiError(400, 'You cannot delete your own administrator account.');
  }

  const user = await User.findById(targetUserId).lean();
  if (!user) {
    throw new ApiError(404, 'User not found.');
  }

  if (user.role === 'admin') {
    throw new ApiError(400, 'Administrator accounts cannot be removed.');
  }

  const cleanupTasks = [
    cancelMembershipsForUser(targetUserId),
    cleanOrdersForUser(targetUserId),
    TrainerAssignment.updateMany({}, { $pull: { trainees: { trainee: targetUserId } } }),
    TrainerProgress.deleteMany({ trainee: targetUserId }),
  ];

  if (user.role === 'trainer') {
    cleanupTasks.push(
      TrainerAssignment.updateMany({ trainer: targetUserId }, { $set: { status: 'inactive' } }),
      TrainerProgress.deleteMany({ trainer: targetUserId }),
    );
  }

  if (user.role === 'gym-owner') {
    const affectedGymIds = await deactivateGymsForOwner(targetUserId);
    if (affectedGymIds.length) {
      cleanupTasks.push(
        Revenue.deleteMany({ 'metadata.gym': { $in: affectedGymIds.map((id) => id.toString()) } }),
      );
    }
  }

  await Promise.all(cleanupTasks);
  await User.findByIdAndDelete(targetUserId);

  return res
    .status(200)
    .json(new ApiResponse(200, { userId: targetUserId }, 'User account deleted successfully.'));
});

export const updateUserStatus = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    throw new ApiError(403, 'Only administrators can manage user status.');
  }

  const targetUserId = toObjectId(req.params.userId, 'User id');
  const { status } = req.body ?? {};

  const allowedStatuses = new Set(['active', 'inactive', 'pending']);
  if (!status || !allowedStatuses.has(status)) {
    throw new ApiError(400, 'Provide a valid status (active, inactive, or pending).');
  }

  const user = await User.findById(targetUserId);
  if (!user) {
    throw new ApiError(404, 'User not found.');
  }

  if (user.role === 'admin') {
    throw new ApiError(400, 'Administrator status cannot be changed.');
  }

  user.status = status;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, { userId: user._id, status: user.status }, 'User status updated successfully.'));
});

export const deleteGymListing = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    throw new ApiError(403, 'Only administrators can delete gyms.');
  }

  const gymId = toObjectId(req.params.gymId, 'Gym id');

  const gym = await Gym.findById(gymId).lean();
  if (!gym) {
    throw new ApiError(404, 'Gym not found.');
  }

  const cleanupTasks = [
    TrainerAssignment.deleteMany({ gym: gymId }),
    TrainerProgress.deleteMany({ gym: gymId }),
    GymMembership.updateMany({ gym: gymId }, { $set: { status: 'cancelled' } }),
    GymListingSubscription.deleteMany({ gym: gymId }),
    Revenue.deleteMany({ 'metadata.gym': gymId.toString() }),
  ];

  await Promise.all(cleanupTasks);
  await Gym.findByIdAndDelete(gymId);

  return res
    .status(200)
    .json(new ApiResponse(200, { gymId }, 'Gym listing removed successfully.'));
});

export const getAdminToggles = asyncHandler(async (_req, res) => {
  const adminToggles = await loadAdminToggles();

  return res
    .status(200)
    .json(new ApiResponse(200, { adminToggles }, 'Admin toggles fetched successfully.'));
});

export const updateAdminToggles = asyncHandler(async (req, res) => {
  const { toggles = {} } = req.body ?? {};

  const adminToggles = await applyAdminToggleUpdates(toggles, req.user);

  return res
    .status(200)
    .json(new ApiResponse(200, { adminToggles }, 'Admin toggles updated successfully.'));
});
