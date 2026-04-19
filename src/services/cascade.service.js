import Booking from '../models/booking.model.js';
import Cart from '../models/cart.model.js';
import Gym from '../models/gym.model.js';
import GymListingSubscription from '../models/gymListingSubscription.model.js';
import GymMembership from '../models/gymMembership.model.js';
import Order from '../models/order.model.js';
import Product from '../models/product.model.js';
import ProductReview from '../models/productReview.model.js';
import Revenue from '../models/revenue.model.js';
import TrainerAssignment from '../models/trainerAssignment.model.js';
import TrainerProgress from '../models/trainerProgress.model.js';

export const cancelMembershipsForUser = async (userId) => {
  await GymMembership.updateMany(
    { trainee: userId, status: { $in: ['active', 'paused'] } },
    { $set: { status: 'cancelled' } },
  );
};

export const cleanOrdersForUser = async (userId) => {
  await Order.updateMany(
    { user: userId, status: { $ne: 'delivered' } },
    { $set: { status: 'delivered', 'orderItems.$[].status': 'delivered' } },
  );
};

export const deactivateGymsForOwner = async (ownerId) => {
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
    Booking.deleteMany({ gym: { $in: gymIds } }),
    TrainerAssignment.deleteMany({ gym: { $in: gymIds } }),
    TrainerProgress.deleteMany({ gym: { $in: gymIds } }),
    GymMembership.updateMany({ gym: { $in: gymIds } }, { $set: { status: 'cancelled' } }),
  ]);

  return gymIds;
};

export const deactivateSellerProducts = async (sellerId) => {
  await Product.updateMany(
    { seller: sellerId, isPublished: true },
    { $set: { isPublished: false } },
  );
};

export const cascadeDeleteGym = async (gymId) => {
  await Promise.all([
    TrainerAssignment.deleteMany({ gym: gymId }),
    TrainerProgress.deleteMany({ gym: gymId }),
    GymMembership.updateMany({ gym: gymId }, { $set: { status: 'cancelled' } }),
    Booking.deleteMany({ gym: gymId }),
    GymListingSubscription.deleteMany({ gym: gymId }),
    Revenue.deleteMany({
      $or: [
        { 'metadata.gym': gymId.toString() },
        { 'metadata.gymId': gymId.toString() },
      ],
    }),
  ]);

  await Gym.findByIdAndDelete(gymId);
};

export const cascadeDeleteProduct = async (productId) => {
  await Promise.all([
    Cart.updateMany(
      { 'items.product': productId },
      { $pull: { items: { product: productId } } },
    ),
    ProductReview.deleteMany({ product: productId }),
  ]);

  await Product.findByIdAndDelete(productId);
};
