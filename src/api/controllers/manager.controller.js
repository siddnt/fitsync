import User from '../../models/user.model.js';
import Gym from '../../models/gym.model.js';
import GymMembership from '../../models/gymMembership.model.js';
import Product from '../../models/product.model.js';
import Revenue from '../../models/revenue.model.js';
import Order from '../../models/order.model.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import toObjectId from '../../utils/toObjectId.js';
import { normaliseOrderItemStatus, summariseOrderStatus } from '../../utils/orderStatus.js';
import { getPaginationParams, paginationMeta } from '../../utils/paginate.js';
import {
  cancelMembershipsForUser,
  cleanOrdersForUser,
  deactivateGymsForOwner,
  deactivateSellerProducts,
  cascadeDeleteGym,
  cascadeDeleteProduct,
} from '../../services/cascade.service.js';

/* ──────── role guard ──────── */
const MANAGEABLE_ROLES = new Set(['seller', 'gym-owner']);

const ensureManager = (req) => {
  if (!req.user || req.user.role !== 'manager') {
    throw new ApiError(403, 'Only managers can access this resource.');
  }
  if (req.user.status !== 'active') {
    throw new ApiError(403, 'Your manager account is awaiting admin approval.');
  }
};

/* ──────── PENDING APPROVALS (sellers + gym-owners) ──────── */
export const getPendingApprovals = asyncHandler(async (req, res) => {
  ensureManager(req);

  const pending = await User.find({
    status: 'pending',
    role: { $in: ['seller', 'gym-owner'] },
  })
    .select('name email role createdAt profile.location profile.headline profilePicture contactNumber')
    .sort({ createdAt: -1 })
    .lean();

  return res
    .status(200)
    .json(new ApiResponse(200, { pending }, 'Pending approvals fetched.'));
});

export const approveUser = asyncHandler(async (req, res) => {
  ensureManager(req);

  const userId = toObjectId(req.params.userId, 'User id');
  const user = await User.findById(userId);

  if (!user) throw new ApiError(404, 'User not found.');
  if (!MANAGEABLE_ROLES.has(user.role)) {
    throw new ApiError(400, 'Managers can only approve sellers and gym-owners.');
  }
  if (user.status === 'active') {
    throw new ApiError(400, 'User is already active.');
  }

  user.status = 'active';
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, { userId: user._id, status: user.status }, `${user.role} approved successfully.`));
});

export const rejectUser = asyncHandler(async (req, res) => {
  ensureManager(req);

  const userId = toObjectId(req.params.userId, 'User id');
  const user = await User.findById(userId).lean();

  if (!user) throw new ApiError(404, 'User not found.');
  if (!MANAGEABLE_ROLES.has(user.role)) {
    throw new ApiError(400, 'Managers can only reject sellers and gym-owners.');
  }

  // Cascade cleanup before deletion
  const cleanupTasks = [
    cancelMembershipsForUser(userId),
    cleanOrdersForUser(userId),
  ];

  if (user.role === 'seller') {
    cleanupTasks.push(deactivateSellerProducts(userId));
  }

  if (user.role === 'gym-owner') {
    const affectedGymIds = await deactivateGymsForOwner(userId);
    if (affectedGymIds.length) {
      cleanupTasks.push(
        Revenue.deleteMany({ 'metadata.gym': { $in: affectedGymIds.map((id) => id.toString()) } }),
      );
    }
  }

  await Promise.all(cleanupTasks);
  await User.findByIdAndDelete(userId);

  return res
    .status(200)
    .json(new ApiResponse(200, { userId }, 'User rejected and removed.'));
});

/* ──────── SELLERS MANAGEMENT ──────── */
export const getSellers = asyncHandler(async (req, res) => {
  ensureManager(req);
  const { page, limit, skip } = getPaginationParams(req.query);

  const [total, sellers] = await Promise.all([
    User.countDocuments({ role: 'seller' }),
    User.find({ role: 'seller' })
      .select('name email status createdAt profilePicture profile.headline profile.location contactNumber')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  // Enrich with product counts (only for current page)
  const sellerIds = sellers.map((s) => s._id);
  const productCounts = await Product.aggregate([
    { $match: { seller: { $in: sellerIds } } },
    { $group: { _id: '$seller', total: { $sum: 1 }, published: { $sum: { $cond: ['$isPublished', 1, 0] } } } },
  ]);

  const productMap = productCounts.reduce((acc, item) => {
    acc[item._id.toString()] = { total: item.total, published: item.published };
    return acc;
  }, {});

  const enrichedSellers = sellers.map((seller) => ({
    ...seller,
    products: productMap[seller._id.toString()] ?? { total: 0, published: 0 },
  }));

  return res
    .status(200)
    .json(new ApiResponse(200, { sellers: enrichedSellers, pagination: paginationMeta(total, page, limit) }, 'Sellers fetched.'));
});

export const updateSellerStatus = asyncHandler(async (req, res) => {
  ensureManager(req);

  const userId = toObjectId(req.params.userId, 'User id');
  const { status } = req.body ?? {};

  if (!status || !['active', 'inactive'].includes(status)) {
    throw new ApiError(400, 'Provide a valid status (active or inactive).');
  }

  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'User not found.');
  if (user.role !== 'seller') throw new ApiError(400, 'User is not a seller.');

  user.status = status;
  await user.save({ validateBeforeSave: false });

  // If deactivating, unpublish their products
  if (status === 'inactive') {
    await deactivateSellerProducts(userId);
    await cleanOrdersForUser(userId);
  }

  return res
    .status(200)
    .json(new ApiResponse(200, { userId: user._id, status: user.status }, `Seller ${status === 'active' ? 'activated' : 'deactivated'}.`));
});

export const deleteSeller = asyncHandler(async (req, res) => {
  ensureManager(req);

  const userId = toObjectId(req.params.userId, 'User id');
  const user = await User.findById(userId).lean();

  if (!user) throw new ApiError(404, 'User not found.');
  if (user.role !== 'seller') throw new ApiError(400, 'User is not a seller.');

  // Cascade: unpublish products, settle orders
  await Promise.all([
    deactivateSellerProducts(userId),
    cleanOrdersForUser(userId),
    Product.updateMany({ seller: userId }, { $set: { isPublished: false } }),
  ]);

  await User.findByIdAndDelete(userId);

  return res
    .status(200)
    .json(new ApiResponse(200, { userId }, 'Seller deleted successfully.'));
});

/* ──────── GYM-OWNERS MANAGEMENT ──────── */
export const getGymOwners = asyncHandler(async (req, res) => {
  ensureManager(req);
  const { page, limit, skip } = getPaginationParams(req.query);

  const [total, owners] = await Promise.all([
    User.countDocuments({ role: 'gym-owner' }),
    User.find({ role: 'gym-owner' })
      .select('name email status createdAt profilePicture profile.headline profile.location contactNumber')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  // Enrich with gym counts (only for current page)
  const ownerIds = owners.map((o) => o._id);
  const gymCounts = await Gym.aggregate([
    { $match: { owner: { $in: ownerIds } } },
    { $group: { _id: '$owner', total: { $sum: 1 }, published: { $sum: { $cond: ['$isPublished', 1, 0] } } } },
  ]);

  const gymMap = gymCounts.reduce((acc, item) => {
    acc[item._id.toString()] = { total: item.total, published: item.published };
    return acc;
  }, {});

  const enrichedOwners = owners.map((owner) => ({
    ...owner,
    gyms: gymMap[owner._id.toString()] ?? { total: 0, published: 0 },
  }));

  return res
    .status(200)
    .json(new ApiResponse(200, { gymOwners: enrichedOwners, pagination: paginationMeta(total, page, limit) }, 'Gym owners fetched.'));
});

export const updateGymOwnerStatus = asyncHandler(async (req, res) => {
  ensureManager(req);

  const userId = toObjectId(req.params.userId, 'User id');
  const { status } = req.body ?? {};

  if (!status || !['active', 'inactive'].includes(status)) {
    throw new ApiError(400, 'Provide a valid status (active or inactive).');
  }

  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'User not found.');
  if (user.role !== 'gym-owner') throw new ApiError(400, 'User is not a gym-owner.');

  user.status = status;
  await user.save({ validateBeforeSave: false });

  // If deactivating, suspend all their gyms and cascade
  if (status === 'inactive') {
    await deactivateGymsForOwner(userId);
  }

  return res
    .status(200)
    .json(new ApiResponse(200, { userId: user._id, status: user.status }, `Gym owner ${status === 'active' ? 'activated' : 'deactivated'}.`));
});

export const deleteGymOwner = asyncHandler(async (req, res) => {
  ensureManager(req);

  const userId = toObjectId(req.params.userId, 'User id');
  const user = await User.findById(userId).lean();

  if (!user) throw new ApiError(404, 'User not found.');
  if (user.role !== 'gym-owner') throw new ApiError(400, 'User is not a gym-owner.');

  // Cascade: deactivate gyms, clean memberships, assignments, revenue
  const affectedGymIds = await deactivateGymsForOwner(userId);
  const cleanupTasks = [
    cancelMembershipsForUser(userId),
    cleanOrdersForUser(userId),
  ];

  if (affectedGymIds.length) {
    cleanupTasks.push(
      Revenue.deleteMany({ 'metadata.gym': { $in: affectedGymIds.map((id) => id.toString()) } }),
      Gym.deleteMany({ _id: { $in: affectedGymIds } }),
    );
  }

  await Promise.all(cleanupTasks);
  await User.findByIdAndDelete(userId);

  return res
    .status(200)
    .json(new ApiResponse(200, { userId }, 'Gym owner and associated gyms deleted.'));
});

/* ──────── GYM LISTINGS MANAGEMENT ──────── */
export const getManagerGyms = asyncHandler(async (req, res) => {
  ensureManager(req);

  const gyms = await Gym.find()
    .sort({ createdAt: -1 })
    .limit(50)
    .populate({ path: 'owner', select: 'name email status' })
    .lean();

  const gymIds = gyms.map((g) => g._id);
  const membershipAggregates = await GymMembership.aggregate([
    { $match: { gym: { $in: gymIds }, status: 'active' } },
    { $group: { _id: '$gym', count: { $sum: 1 } } },
  ]);

  const memberMap = membershipAggregates.reduce((acc, item) => {
    acc[item._id.toString()] = item.count;
    return acc;
  }, {});

  const data = gyms.map((gym) => ({
    id: gym._id,
    name: gym.name,
    status: gym.status,
    isPublished: gym.isPublished,
    city: gym.location?.city,
    owner: gym.owner ? { id: gym.owner._id, name: gym.owner.name, email: gym.owner.email, status: gym.owner.status } : null,
    sponsorship: gym.sponsorship,
    analytics: gym.analytics,
    activeMembers: memberMap[gym._id.toString()] ?? 0,
    createdAt: gym.createdAt,
  }));

  return res
    .status(200)
    .json(new ApiResponse(200, { gyms: data }, 'Gyms fetched.'));
});

export const deleteManagerGym = asyncHandler(async (req, res) => {
  ensureManager(req);

  const gymId = toObjectId(req.params.gymId, 'Gym id');
  const gym = await Gym.findById(gymId).lean();
  if (!gym) throw new ApiError(404, 'Gym not found.');

  await cascadeDeleteGym(gymId);

  return res
    .status(200)
    .json(new ApiResponse(200, { gymId }, 'Gym removed successfully.'));
});

/* ──────── MARKETPLACE OVERSIGHT ──────── */
export const getManagerMarketplace = asyncHandler(async (req, res) => {
  ensureManager(req);

  const orders = await Order.find()
    .sort({ createdAt: -1 })
    .limit(30)
    .populate({ path: 'user', select: 'name email' })
    .populate({ path: 'seller', select: 'name email' })
    .populate({ path: 'orderItems.seller', select: 'name email' })
    .lean();

  const toContact = (entity) =>
    entity?._id ? { id: entity._id, name: entity.name, email: entity.email } : null;

  const data = orders.map((order) => {
    const fallbackSeller = order.orderItems?.find((i) => i.seller?._id)?.seller;
    const sellerEntity = order.seller?._id ? order.seller : fallbackSeller;
    return {
      id: order._id,
      orderNumber: order.orderNumber,
      total: { amount: order.total, currency: 'INR' },
      status: summariseOrderStatus(order),
      createdAt: order.createdAt,
      user: toContact(order.user),
      seller: toContact(sellerEntity),
      items: order.orderItems?.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        status: normaliseOrderItemStatus(item.status),
      })) ?? [],
    };
  });

  return res
    .status(200)
    .json(new ApiResponse(200, { orders: data }, 'Marketplace orders fetched.'));
});

/* ──────── PRODUCT DELETION ──────── */
export const deleteManagerProduct = asyncHandler(async (req, res) => {
  ensureManager(req);

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
