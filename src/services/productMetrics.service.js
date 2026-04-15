const SALES_WINDOW_DAYS = 30;

const toUtcStartOfDay = (value = new Date()) => {
  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

const parseSalesBucketDate = (value) => new Date(`${value}T00:00:00.000Z`);

export const toSalesBucketDate = (value = new Date()) => toUtcStartOfDay(value).toISOString().slice(0, 10);

const normalizeBucket = (bucket) => {
  if (!bucket?.date) {
    return null;
  }

  const quantity = Number(bucket.quantity ?? 0);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return null;
  }

  const date = toSalesBucketDate(bucket.date);
  return { date, quantity };
};

export const pruneRecentSalesBuckets = (buckets = [], referenceDate = new Date(), windowDays = SALES_WINDOW_DAYS) => {
  const cutoff = toUtcStartOfDay(referenceDate);
  cutoff.setUTCDate(cutoff.getUTCDate() - Math.max(windowDays - 1, 0));

  return buckets
    .map(normalizeBucket)
    .filter(Boolean)
    .filter((bucket) => parseSalesBucketDate(bucket.date) >= cutoff)
    .sort((left, right) => left.date.localeCompare(right.date));
};

export const summarizeRecentSales = (buckets = [], referenceDate = new Date(), windowDays = SALES_WINDOW_DAYS) =>
  pruneRecentSalesBuckets(buckets, referenceDate, windowDays).reduce(
    (sum, bucket) => sum + bucket.quantity,
    0,
  );

export const getProductSalesSnapshot = (product, referenceDate = new Date()) => {
  const metrics = product?.metrics?.sales ?? product?.sales ?? {};
  const totalSold = Number(metrics.totalSold ?? 0);
  const recentDaily = pruneRecentSalesBuckets(metrics.recentDaily ?? [], referenceDate);

  return {
    totalSold: Number.isFinite(totalSold) ? totalSold : 0,
    soldLast30Days: recentDaily.reduce((sum, bucket) => sum + bucket.quantity, 0),
    recentDaily,
    lastSoldAt: metrics.lastSoldAt ?? null,
  };
};

export const getProductReviewSnapshot = (product) => {
  const metrics = product?.metrics?.reviews ?? product?.reviews ?? {};
  const count = Number(metrics.count ?? metrics.reviewCount ?? 0);
  const averageRating = Number(metrics.averageRating ?? 0);

  return {
    count: Number.isFinite(count) ? count : 0,
    averageRating: Number.isFinite(averageRating) ? Math.round(averageRating * 10) / 10 : 0,
    lastReviewedAt: metrics.lastReviewedAt ?? null,
  };
};

export const buildNextProductSalesMetrics = (currentMetrics = {}, quantity, deliveredAt = new Date()) => {
  const normalizedQuantity = Number(quantity ?? 0);
  if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) {
    return getProductSalesSnapshot({ metrics: { sales: currentMetrics } }, deliveredAt);
  }

  const snapshot = getProductSalesSnapshot({ metrics: { sales: currentMetrics } }, deliveredAt);
  const bucketDate = toSalesBucketDate(deliveredAt);
  const recentDaily = snapshot.recentDaily.map((bucket) => ({ ...bucket }));
  const existingBucket = recentDaily.find((bucket) => bucket.date === bucketDate);

  if (existingBucket) {
    existingBucket.quantity += normalizedQuantity;
  } else {
    recentDaily.push({ date: bucketDate, quantity: normalizedQuantity });
  }

  const prunedBuckets = pruneRecentSalesBuckets(recentDaily, deliveredAt);

  return {
    totalSold: snapshot.totalSold + normalizedQuantity,
    soldLast30Days: summarizeRecentSales(prunedBuckets, deliveredAt),
    recentDaily: prunedBuckets,
    lastSoldAt: deliveredAt,
  };
};

export { SALES_WINDOW_DAYS };
