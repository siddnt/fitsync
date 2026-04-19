import { jest } from '@jest/globals';

const buildQuery = (result) => {
  const query = {
    select: jest.fn(),
    lean: jest.fn(),
    session: jest.fn(),
  };

  query.select.mockReturnValue(query);
  query.lean.mockResolvedValue(result);
  query.session.mockReturnValue(query);

  return query;
};

const Booking = {
  deleteMany: jest.fn(),
};

const Cart = {
  updateMany: jest.fn(),
};

const Gym = {
  find: jest.fn(),
  updateMany: jest.fn(),
  findByIdAndDelete: jest.fn(),
};

const GymListingSubscription = {
  updateMany: jest.fn(),
  deleteMany: jest.fn(),
};

const GymMembership = {
  updateMany: jest.fn(),
};

const Order = {
  updateMany: jest.fn(),
};

const Product = {
  find: jest.fn(),
  updateMany: jest.fn(),
  findByIdAndDelete: jest.fn(),
};

const ProductReview = {
  deleteMany: jest.fn(),
};

const Revenue = {
  deleteMany: jest.fn(),
};

const TrainerAssignment = {
  deleteMany: jest.fn(),
};

const TrainerProgress = {
  deleteMany: jest.fn(),
};

const enqueueOutboxEvents = jest.fn();

jest.unstable_mockModule('../src/models/booking.model.js', () => ({ default: Booking }));
jest.unstable_mockModule('../src/models/cart.model.js', () => ({ default: Cart }));
jest.unstable_mockModule('../src/models/gym.model.js', () => ({ default: Gym }));
jest.unstable_mockModule('../src/models/gymListingSubscription.model.js', () => ({ default: GymListingSubscription }));
jest.unstable_mockModule('../src/models/gymMembership.model.js', () => ({ default: GymMembership }));
jest.unstable_mockModule('../src/models/order.model.js', () => ({ default: Order }));
jest.unstable_mockModule('../src/models/product.model.js', () => ({ default: Product }));
jest.unstable_mockModule('../src/models/productReview.model.js', () => ({ default: ProductReview }));
jest.unstable_mockModule('../src/models/revenue.model.js', () => ({ default: Revenue }));
jest.unstable_mockModule('../src/models/trainerAssignment.model.js', () => ({ default: TrainerAssignment }));
jest.unstable_mockModule('../src/models/trainerProgress.model.js', () => ({ default: TrainerProgress }));
jest.unstable_mockModule('../src/services/outbox.service.js', () => ({ enqueueOutboxEvents }));

let cascadeService;

beforeAll(async () => {
  cascadeService = await import('../src/services/cascade.service.js');
});

beforeEach(() => {
  jest.clearAllMocks();

  [
    Booking.deleteMany,
    Cart.updateMany,
    Gym.updateMany,
    Gym.findByIdAndDelete,
    GymListingSubscription.updateMany,
    GymListingSubscription.deleteMany,
    GymMembership.updateMany,
    Order.updateMany,
    Product.updateMany,
    Product.findByIdAndDelete,
    ProductReview.deleteMany,
    Revenue.deleteMany,
    TrainerAssignment.deleteMany,
    TrainerProgress.deleteMany,
    enqueueOutboxEvents,
  ].forEach((mockFn) => mockFn.mockResolvedValue(undefined));
});

describe('cascade service', () => {
  it('deactivates owner gyms and emits cache/search refresh events', async () => {
    Gym.find.mockReturnValue(buildQuery([
      { _id: 'gym-1' },
      { _id: 'gym-2' },
    ]));

    const result = await cascadeService.deactivateGymsForOwner('owner-1');

    expect(result).toEqual(['gym-1', 'gym-2']);
    expect(Gym.updateMany).toHaveBeenCalledWith(
      { _id: { $in: ['gym-1', 'gym-2'] } },
      { $set: { status: 'suspended', isPublished: false } },
      {},
    );

    expect(enqueueOutboxEvents).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          topic: 'gym.cache.invalidate',
          aggregateId: 'gym-1',
          payload: { tags: ['gyms:list', 'gym:gym-1', 'gym:gym-1:reviews'] },
        }),
        expect.objectContaining({
          topic: 'gym.search.upsert',
          aggregateId: 'gym-1',
        }),
        expect.objectContaining({
          topic: 'gym.cache.invalidate',
          aggregateId: 'gym-2',
          payload: { tags: ['gyms:list', 'gym:gym-2', 'gym:gym-2:reviews'] },
        }),
        expect.objectContaining({
          topic: 'gym.search.upsert',
          aggregateId: 'gym-2',
        }),
      ]),
      {},
    );
  });

  it('deactivates seller products and queues marketplace cleanup events', async () => {
    Product.find.mockReturnValue(buildQuery([
      { _id: 'product-1' },
      { _id: 'product-2' },
    ]));

    const result = await cascadeService.deactivateSellerProducts('seller-1');

    expect(result).toEqual(['product-1', 'product-2']);
    expect(Product.updateMany).toHaveBeenCalledWith(
      { seller: 'seller-1', isPublished: true },
      { $set: { isPublished: false } },
      {},
    );
    expect(enqueueOutboxEvents).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          topic: 'product.cache.invalidate',
          aggregateId: 'product-1',
          payload: {
            tags: [
              'marketplace:catalogue',
              'marketplace:product:product-1',
              'marketplace:product:product-2',
            ],
          },
        }),
        expect.objectContaining({
          topic: 'product.search.upsert',
          aggregateId: 'product-1',
        }),
        expect.objectContaining({
          topic: 'product.search.upsert',
          aggregateId: 'product-2',
        }),
      ]),
      {},
    );
  });

  it('cascades gym deletion and emits removal events', async () => {
    await cascadeService.cascadeDeleteGym('gym-9');

    expect(Gym.findByIdAndDelete).toHaveBeenCalledWith('gym-9', {});
    expect(enqueueOutboxEvents).toHaveBeenCalledWith(
      [
        {
          topic: 'gym.cache.invalidate',
          aggregateType: 'gym',
          aggregateId: 'gym-9',
          payload: {
            tags: ['gyms:list', 'gym:gym-9', 'gym:gym-9:reviews'],
          },
        },
        {
          topic: 'gym.search.delete',
          aggregateType: 'gym',
          aggregateId: 'gym-9',
          payload: {},
        },
      ],
      {},
    );
  });

  it('cascades product deletion and emits removal events', async () => {
    await cascadeService.cascadeDeleteProduct('product-9');

    expect(Product.findByIdAndDelete).toHaveBeenCalledWith('product-9', {});
    expect(enqueueOutboxEvents).toHaveBeenCalledWith(
      [
        {
          topic: 'product.cache.invalidate',
          aggregateType: 'product',
          aggregateId: 'product-9',
          payload: {
            tags: ['marketplace:catalogue', 'marketplace:product:product-9'],
          },
        },
        {
          topic: 'product.search.delete',
          aggregateType: 'product',
          aggregateId: 'product-9',
          payload: {},
        },
      ],
      {},
    );
  });
});
