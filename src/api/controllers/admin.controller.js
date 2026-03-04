import User from '../../models/user.model.js';
import Gym from '../../models/gym.model.js';
import Product from '../../models/product.model.js';
import TrainerAssignment from '../../models/trainerAssignment.model.js';
import TrainerProgress from '../../models/trainerProgress.model.js';
import Revenue from '../../models/revenue.model.js';
import {
  applyAdminToggleUpdates,
  loadAdminToggles,
} from '../../services/systemSettings.service.js';
import {
  cancelMembershipsForUser,
  cleanOrdersForUser,
  deactivateGymsForOwner,
  cascadeDeleteGym,
  cascadeDeleteProduct,
} from '../../services/cascade.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import toObjectId from '../../utils/toObjectId.js';

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

  // Manager deletion has no special cascade since they don't own content

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

  const allowedStatuses = new Set(['active', 'inactive', 'pending', 'suspended']);
  if (!status || !allowedStatuses.has(status)) {
    throw new ApiError(400, 'Provide a valid status (active, inactive, pending, or suspended).');
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

  await cascadeDeleteGym(gymId);

  return res
    .status(200)
    .json(new ApiResponse(200, { gymId }, 'Gym listing removed successfully.'));
});

export const deleteProduct = asyncHandler(async (req, res) => {
  if (!req.user || req.user.role !== 'admin') {
    throw new ApiError(403, 'Only administrators can delete products.');
  }

  const productId = toObjectId(req.params.productId, 'Product id');

  const product = await Product.findById(productId).lean();
  if (!product) {
    throw new ApiError(404, 'Product not found.');
  }

  await cascadeDeleteProduct(productId);

  return res
    .status(200)
    .json(new ApiResponse(200, { productId }, 'Product deleted successfully.'));
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
