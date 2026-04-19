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
import { enqueueOutboxEvents } from './outbox.service.js';

const buildWriteOptions = (session) => (session ? { session } : {});

const attachSessionToQuery = (query, session) => {
  if (session) {
    query.session(session);
  }

  return query;
};

const buildGymCacheTags = (gymId) => [
  'gyms:list',
  `gym:${gymId}`,
  `gym:${gymId}:reviews`,
];

const buildGymOutboxEvents = (gymIds = [], { deleted = false } = {}) =>
  [...new Set(gymIds.filter(Boolean).map((gymId) => String(gymId)))]
    .flatMap((gymId) => ([
      {
        topic: 'gym.cache.invalidate',
        aggregateType: 'gym',
        aggregateId: gymId,
        payload: {
          tags: buildGymCacheTags(gymId),
        },
      },
      {
        topic: deleted ? 'gym.search.delete' : 'gym.search.upsert',
        aggregateType: 'gym',
        aggregateId: gymId,
        payload: {},
      },
    ]));

const buildMarketplaceCacheTags = ({ productId, productIds = [] } = {}) => {
  const tags = new Set(['marketplace:catalogue']);

  [productId, ...productIds]
    .filter(Boolean)
    .map((value) => String(value))
    .forEach((value) => tags.add(`marketplace:product:${value}`));

  return Array.from(tags);
};

const buildMarketplaceOutboxEvents = ({ productId, productIds = [], deleted = false } = {}) => {
  const normalizedProductIds = [...new Set([productId, ...productIds].filter(Boolean).map((value) => String(value)))];

  if (!normalizedProductIds.length) {
    return [];
  }

  return [
    {
      topic: 'product.cache.invalidate',
      aggregateType: 'product',
      aggregateId: normalizedProductIds[0],
      payload: {
        tags: buildMarketplaceCacheTags({ productIds: normalizedProductIds }),
      },
    },
    ...normalizedProductIds.map((id) => ({
      topic: deleted ? 'product.search.delete' : 'product.search.upsert',
      aggregateType: 'product',
      aggregateId: id,
      payload: {},
    })),
  ];
};

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

export const deactivateGymsForOwner = async (ownerId, { session } = {}) => {
  const writeOptions = buildWriteOptions(session);
  const gyms = await attachSessionToQuery(
    Gym.find({ owner: ownerId }).select('_id').lean(),
    session,
  );

  if (!gyms.length) {
    return [];
  }

  const gymIds = gyms.map((gym) => gym._id);

  await Promise.all([
    Gym.updateMany(
      { _id: { $in: gymIds } },
      { $set: { status: 'suspended', isPublished: false } },
      writeOptions,
    ),
    GymListingSubscription.updateMany(
      { gym: { $in: gymIds }, status: { $in: ['active', 'grace'] } },
      { $set: { status: 'cancelled', autoRenew: false } },
      writeOptions,
    ),
    Booking.deleteMany({ gym: { $in: gymIds } }, writeOptions),
    TrainerAssignment.deleteMany({ gym: { $in: gymIds } }, writeOptions),
    TrainerProgress.deleteMany({ gym: { $in: gymIds } }, writeOptions),
    GymMembership.updateMany(
      { gym: { $in: gymIds } },
      { $set: { status: 'cancelled' } },
      writeOptions,
    ),
  ]);
  await enqueueOutboxEvents(buildGymOutboxEvents(gymIds), writeOptions);

  return gymIds;
};

export const deactivateSellerProducts = async (sellerId, { session } = {}) => {
  const writeOptions = buildWriteOptions(session);
  const products = await attachSessionToQuery(
    Product.find({ seller: sellerId, isPublished: true }).select('_id').lean(),
    session,
  );
  const productIds = products.map((product) => product._id);

  await Product.updateMany(
    { seller: sellerId, isPublished: true },
    { $set: { isPublished: false } },
    writeOptions,
  );

  await enqueueOutboxEvents(buildMarketplaceOutboxEvents({ productIds }), writeOptions);

  return productIds;
};

export const cascadeDeleteGym = async (gymId, { session } = {}) => {
  const writeOptions = buildWriteOptions(session);
  await Promise.all([
    TrainerAssignment.deleteMany({ gym: gymId }, writeOptions),
    TrainerProgress.deleteMany({ gym: gymId }, writeOptions),
    GymMembership.updateMany(
      { gym: gymId },
      { $set: { status: 'cancelled' } },
      writeOptions,
    ),
    Booking.deleteMany({ gym: gymId }, writeOptions),
    GymListingSubscription.deleteMany({ gym: gymId }, writeOptions),
    Revenue.deleteMany({
      $or: [
        { 'metadata.gym': gymId.toString() },
        { 'metadata.gymId': gymId.toString() },
      ],
    }, writeOptions),
  ]);

  await Gym.findByIdAndDelete(gymId, writeOptions);
  await enqueueOutboxEvents(buildGymOutboxEvents([gymId], { deleted: true }), writeOptions);
};

export const cascadeDeleteProduct = async (productId, { session } = {}) => {
  const writeOptions = buildWriteOptions(session);
  await Promise.all([
    Cart.updateMany(
      { 'items.product': productId },
      { $pull: { items: { product: productId } } },
      writeOptions,
    ),
    ProductReview.deleteMany({ product: productId }, writeOptions),
  ]);

  await Product.findByIdAndDelete(productId, writeOptions);
  await enqueueOutboxEvents(buildMarketplaceOutboxEvents({ productId, deleted: true }), writeOptions);
};
