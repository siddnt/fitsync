import Gym from '../models/gym.model.js';
import GymMembership from '../models/gymMembership.model.js';
import GymListingSubscription from '../models/gymListingSubscription.model.js';
import TrainerAssignment from '../models/trainerAssignment.model.js';
import TrainerProgress from '../models/trainerProgress.model.js';
import Order from '../models/order.model.js';
import Revenue from '../models/revenue.model.js';
import Product from '../models/product.model.js';
import Cart from '../models/cart.model.js';
import ProductReview from '../models/productReview.model.js';
import {
  indexGymDocument,
  indexProductDocument,
  removeGymDocument,
  removeProductDocument,
} from './solr.service.js';

/**
 * Cancel all active/paused memberships for a user.
 */
export const cancelMembershipsForUser = async (userId) => {
  await GymMembership.updateMany(
    { trainee: userId, status: { $in: ['active', 'paused'] } },
    { $set: { status: 'cancelled' } },
  );
};

/**
 * Force-deliver all non-delivered orders for a user.
 */
export const cleanOrdersForUser = async (userId) => {
  await Order.updateMany(
    { user: userId, status: { $ne: 'delivered' } },
    { $set: { status: 'delivered', 'orderItems.$[].status': 'delivered' } },
  );
};

/**
 * Suspend all gyms owned by the specified owner and
 * cascade to subscriptions, assignments, progress, memberships.
 * Returns the list of affected gym IDs.
 */
export const deactivateGymsForOwner = async (ownerId) => {
  const gyms = await Gym.find({ owner: ownerId }).select('_id').lean();
  if (!gyms.length) return [];

  const gymIds = gyms.map((g) => g._id);

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

  const updatedGyms = await Gym.find({ _id: { $in: gymIds } }).lean();
  await Promise.all(updatedGyms.map((gym) => indexGymDocument(gym)));

  return gymIds;
};

/**
 * Unpublish all products belonging to a seller.
 */
export const deactivateSellerProducts = async (sellerId) => {
  await Product.updateMany(
    { seller: sellerId, isPublished: true },
    { $set: { isPublished: false } },
  );

  const updatedProducts = await Product.find({ seller: sellerId }).lean();
  await Promise.all(updatedProducts.map((product) => indexProductDocument(product)));
};

/**
 * Delete a gym with full cascade cleanup:
 * assignments, progress, memberships, subscriptions, revenue.
 */
export const cascadeDeleteGym = async (gymId) => {
  await Promise.all([
    TrainerAssignment.deleteMany({ gym: gymId }),
    TrainerProgress.deleteMany({ gym: gymId }),
    GymMembership.updateMany({ gym: gymId }, { $set: { status: 'cancelled' } }),
    GymListingSubscription.deleteMany({ gym: gymId }),
    Revenue.deleteMany({ 'metadata.gym': gymId.toString() }),
  ]);
  await Gym.findByIdAndDelete(gymId);
  await removeGymDocument(gymId);
};

/**
 * Delete a product with cascade cleanup:
 * remove from carts, delete reviews.
 */
export const cascadeDeleteProduct = async (productId) => {
  await Promise.all([
    Cart.updateMany(
      { 'items.product': productId },
      { $pull: { items: { product: productId } } },
    ),
    ProductReview.deleteMany({ product: productId }),
  ]);
  await Product.findByIdAndDelete(productId);
  await removeProductDocument(productId);
};
