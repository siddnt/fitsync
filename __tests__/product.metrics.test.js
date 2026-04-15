import {
  buildNextProductSalesMetrics,
  getProductReviewSnapshot,
  getProductSalesSnapshot,
  pruneRecentSalesBuckets,
  toSalesBucketDate,
} from '../src/services/productMetrics.service.js';

describe('product metrics service', () => {
  it('builds and prunes recent sales buckets within the rolling window', () => {
    const referenceDate = new Date('2026-04-14T12:00:00.000Z');
    const keptDate = new Date('2026-04-01T09:00:00.000Z');
    const expiredDate = new Date('2026-03-01T09:00:00.000Z');

    const buckets = pruneRecentSalesBuckets([
      { date: toSalesBucketDate(expiredDate), quantity: 8 },
      { date: toSalesBucketDate(keptDate), quantity: 3 },
    ], referenceDate);

    expect(buckets).toEqual([{ date: '2026-04-01', quantity: 3 }]);
  });

  it('accumulates delivered quantities into denormalized sales metrics', () => {
    const baseDate = new Date('2026-04-14T12:00:00.000Z');
    const currentMetrics = {
      totalSold: 5,
      lastSoldAt: new Date('2026-04-10T08:00:00.000Z'),
      recentDaily: [
        { date: '2026-04-10', quantity: 2 },
        { date: '2026-04-14', quantity: 1 },
      ],
    };

    const next = buildNextProductSalesMetrics(currentMetrics, 4, baseDate);

    expect(next.totalSold).toBe(9);
    expect(next.soldLast30Days).toBe(7);
    expect(next.recentDaily).toEqual([
      { date: '2026-04-10', quantity: 2 },
      { date: '2026-04-14', quantity: 5 },
    ]);
  });

  it('extracts marketplace-facing review and sales snapshots from product metrics', () => {
    const product = {
      metrics: {
        sales: {
          totalSold: 11,
          recentDaily: [
            { date: '2026-04-12', quantity: 2 },
            { date: '2026-04-13', quantity: 3 },
          ],
          lastSoldAt: new Date('2026-04-13T08:00:00.000Z'),
        },
        reviews: {
          count: 6,
          averageRating: 4.26,
          lastReviewedAt: new Date('2026-04-13T09:00:00.000Z'),
        },
      },
    };

    expect(getProductSalesSnapshot(product, new Date('2026-04-14T12:00:00.000Z'))).toEqual({
      totalSold: 11,
      soldLast30Days: 5,
      recentDaily: [
        { date: '2026-04-12', quantity: 2 },
        { date: '2026-04-13', quantity: 3 },
      ],
      lastSoldAt: new Date('2026-04-13T08:00:00.000Z'),
    });

    expect(getProductReviewSnapshot(product)).toEqual({
      count: 6,
      averageRating: 4.3,
      lastReviewedAt: new Date('2026-04-13T09:00:00.000Z'),
    });
  });
});
