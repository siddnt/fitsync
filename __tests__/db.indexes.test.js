import Gym from '../src/models/gym.model.js';
import Product from '../src/models/product.model.js';
import Order from '../src/models/order.model.js';

const hasIndex = (indexes, predicate) => indexes.some(([fields, options]) => predicate(fields, options ?? {}));

describe('database indexes', () => {
  it('defines public gym catalogue indexes', () => {
    const indexes = Gym.schema.indexes();

    expect(
      hasIndex(indexes, (fields) => fields.status === 1 && fields.isPublished === 1 && fields['location.city'] === 1),
    ).toBe(true);
    expect(
      hasIndex(indexes, (fields) => fields.status === 1 && fields.isPublished === 1 && fields['analytics.rating'] === -1),
    ).toBe(true);
    expect(
      hasIndex(indexes, (fields) => fields.status === 1 && fields.isPublished === 1 && fields['analytics.memberships'] === -1),
    ).toBe(true);
    expect(
      hasIndex(indexes, (_fields, options) => options.name === 'gym_search_text_idx'),
    ).toBe(true);
  });

  it('defines marketplace catalogue indexes', () => {
    const indexes = Product.schema.indexes();

    expect(
      hasIndex(indexes, (fields) => fields.isPublished === 1 && fields.category === 1 && fields.updatedAt === -1),
    ).toBe(true);
    expect(
      hasIndex(indexes, (_fields, options) => options.name === 'product_search_text_idx'),
    ).toBe(true);
  });

  it('defines order lookup indexes for user and seller workflows', () => {
    const indexes = Order.schema.indexes();

    expect(hasIndex(indexes, (fields) => fields.user === 1 && fields.createdAt === -1)).toBe(true);
    expect(hasIndex(indexes, (fields) => fields['orderItems.seller'] === 1 && fields.createdAt === -1)).toBe(true);
    expect(hasIndex(indexes, (fields) => fields['orderItems.product'] === 1 && fields.createdAt === -1)).toBe(true);
  });
});
