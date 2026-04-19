import mongoose from 'mongoose';
import dotenv from 'dotenv';
import connectDB from '../db/index.js';
import Order from '../models/order.model.js';
import PaymentSession from '../models/paymentSession.model.js';
import Product from '../models/product.model.js';

dotenv.config();

const roundAmount = (value) => Math.round((Number(value) || 0) * 100) / 100;
const toAmount = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const hasValidMrp = (item = {}) => {
  const price = Math.max(0, toAmount(item?.price));
  const mrp = toAmount(item?.mrp, NaN);
  return Number.isFinite(mrp) && mrp >= price && mrp > 0;
};

const toIdString = (value) => {
  if (!value) {
    return null;
  }
  if (typeof value === 'string') {
    return value;
  }
  return value?._id ? String(value._id) : String(value);
};

const distributeAmount = (total, weights = []) => {
  if (!Number.isFinite(total) || total <= 0 || !weights.length) {
    return weights.map(() => 0);
  }

  const normalizedWeights = weights.map((weight) => (Number.isFinite(weight) && weight > 0 ? weight : 0));
  const weightTotal = normalizedWeights.reduce((sum, weight) => sum + weight, 0);

  if (weightTotal <= 0) {
    const evenShare = Math.floor(total / weights.length);
    const base = weights.map(() => evenShare);
    let remainder = total - (evenShare * weights.length);

    for (let index = 0; index < base.length && remainder > 0; index += 1) {
      base[index] += 1;
      remainder -= 1;
    }

    return base;
  }

  const rawShares = normalizedWeights.map((weight) => (total * weight) / weightTotal);
  const base = rawShares.map((share) => Math.floor(share));
  let remainder = total - base.reduce((sum, share) => sum + share, 0);

  const rankedFractions = rawShares
    .map((share, index) => ({
      index,
      fraction: share - base[index],
      weight: normalizedWeights[index],
    }))
    .sort((left, right) => (
      right.fraction - left.fraction
      || right.weight - left.weight
      || left.index - right.index
    ));

  for (let cursor = 0; remainder > 0 && rankedFractions.length; cursor = (cursor + 1) % rankedFractions.length) {
    base[rankedFractions[cursor].index] += 1;
    remainder -= 1;
  }

  return base;
};

const chooseAdjustmentCandidate = (items, deltaCents) => {
  const positiveDelta = deltaCents > 0;
  const limit = Math.abs(deltaCents);
  const eligible = items.filter((item) => {
    if (positiveDelta) {
      return item.quantity > 0;
    }
    return item.quantity > 0 && item.unitMrpCents > item.saleUnitCents;
  });

  if (!eligible.length) {
    return null;
  }

  const withinLimit = eligible
    .filter((item) => item.quantity <= limit)
    .sort((left, right) => right.quantity - left.quantity || left.index - right.index);

  if (withinLimit.length) {
    return withinLimit[0];
  }

  return [...eligible].sort((left, right) => left.quantity - right.quantity || left.index - right.index)[0];
};

const rebalanceAllocatedMrps = (items, targetOriginalCents) => {
  let achievedOriginalCents = items.reduce((sum, item) => sum + (item.unitMrpCents * item.quantity), 0);
  let deltaCents = targetOriginalCents - achievedOriginalCents;
  let guard = 0;

  while (deltaCents !== 0 && guard < 5000) {
    const candidate = chooseAdjustmentCandidate(items, deltaCents);
    if (!candidate) {
      break;
    }

    if (deltaCents > 0) {
      candidate.unitMrpCents += 1;
      deltaCents -= candidate.quantity;
    } else if (candidate.unitMrpCents > candidate.saleUnitCents) {
      candidate.unitMrpCents -= 1;
      deltaCents += candidate.quantity;
    } else {
      break;
    }

    guard += 1;
  }

  return items;
};

const computeBackfilledItemMrps = (items = [], originalSubtotal = 0, productMrpById = new Map()) => {
  const normalizedItems = items.map((item, index) => {
    const quantity = Math.max(1, Math.round(toAmount(item?.quantity, 1)));
    const saleUnitCents = Math.max(0, Math.round(toAmount(item?.price) * 100));
    const saleLineCents = saleUnitCents * quantity;
    const existingMrpCents = hasValidMrp(item) ? Math.round(toAmount(item.mrp) * 100) : null;
    const productId = toIdString(item?.product);
    const productDoc = productId ? productMrpById.get(productId) : null;
    const referenceMrpCents = Math.max(
      saleUnitCents,
      Math.round(Math.max(
        toAmount(productDoc?.mrp, 0),
        toAmount(productDoc?.price, 0),
        toAmount(item?.price, 0),
      ) * 100),
    );

    return {
      index,
      productId,
      quantity,
      saleUnitCents,
      saleLineCents,
      existingMrpCents,
      referenceMrpCents,
      referenceExtraLineCents: Math.max(0, (referenceMrpCents - saleUnitCents) * quantity),
    };
  });

  const saleSubtotalCents = normalizedItems.reduce((sum, item) => sum + item.saleLineCents, 0);
  const storedOriginalCents = Math.round(toAmount(originalSubtotal, 0) * 100);
  const referenceOriginalCents = normalizedItems.reduce(
    (sum, item) => sum + ((item.existingMrpCents ?? item.referenceMrpCents ?? item.saleUnitCents) * item.quantity),
    0,
  );
  const targetOriginalCents = storedOriginalCents > saleSubtotalCents
    ? storedOriginalCents
    : Math.max(saleSubtotalCents, referenceOriginalCents);
  const fixedOriginalCents = normalizedItems.reduce(
    (sum, item) => sum + ((item.existingMrpCents ?? item.saleUnitCents) * item.quantity),
    0,
  );
  const missingItems = normalizedItems.filter((item) => item.existingMrpCents === null);
  const missingSaleSubtotalCents = missingItems.reduce((sum, item) => sum + item.saleLineCents, 0);
  const remainingTargetOriginalCents = Math.max(targetOriginalCents - (fixedOriginalCents - missingSaleSubtotalCents), missingSaleSubtotalCents);
  const remainingExtraCents = Math.max(0, remainingTargetOriginalCents - missingSaleSubtotalCents);
  const totalReferenceExtraCents = missingItems.reduce((sum, item) => sum + item.referenceExtraLineCents, 0);

  let strategy = 'already-complete';

  if (missingItems.length) {
    if (remainingExtraCents <= 0) {
      strategy = 'sale-price-fallback';
    } else if (totalReferenceExtraCents > 0 && remainingExtraCents === totalReferenceExtraCents) {
      strategy = 'current-product-mrp-exact';
    } else if (totalReferenceExtraCents > 0 && remainingExtraCents < totalReferenceExtraCents) {
      strategy = 'current-product-mrp-scaled';
    } else if (totalReferenceExtraCents > 0) {
      strategy = 'current-product-mrp-plus-order-distribution';
    } else {
      strategy = 'order-level-distribution';
    }
  }

  const initialExtraCents = missingItems.length
    ? (
      totalReferenceExtraCents > 0
        ? distributeAmount(Math.min(remainingExtraCents, totalReferenceExtraCents), missingItems.map((item) => item.referenceExtraLineCents))
        : missingItems.map(() => 0)
    )
    : [];

  let allocatedExtraCents = initialExtraCents;
  const allocatedReferenceTotal = allocatedExtraCents.reduce((sum, amount) => sum + amount, 0);
  const residualExtraCents = Math.max(0, remainingExtraCents - allocatedReferenceTotal);

  if (residualExtraCents > 0 && missingItems.length) {
    const residualWeights = missingItems.map((item) => item.saleLineCents || item.quantity || 1);
    const residualDistribution = distributeAmount(residualExtraCents, residualWeights);
    allocatedExtraCents = allocatedExtraCents.map((amount, index) => amount + residualDistribution[index]);
  }

  missingItems.forEach((item, index) => {
    const allocatedLineCents = item.saleLineCents + (allocatedExtraCents[index] || 0);
    const unitMrpCents = Math.max(item.saleUnitCents, Math.round(allocatedLineCents / item.quantity));
    item.unitMrpCents = unitMrpCents;
  });

  normalizedItems.forEach((item) => {
    if (item.existingMrpCents !== null) {
      item.unitMrpCents = Math.max(item.saleUnitCents, item.existingMrpCents);
    }
  });

  rebalanceAllocatedMrps(normalizedItems, targetOriginalCents);

  const mrps = normalizedItems.map((item) => roundAmount(item.unitMrpCents / 100));
  const achievedOriginalSubtotal = roundAmount(
    normalizedItems.reduce((sum, item) => sum + ((item.unitMrpCents / 100) * item.quantity), 0),
  );

  return {
    mrps,
    strategy,
    achievedOriginalSubtotal,
    targetOriginalSubtotal: roundAmount(targetOriginalCents / 100),
  };
};

const buildMissingMrpQuery = (path) => ({
  [path]: {
    $elemMatch: {
      $or: [
        { mrp: { $exists: false } },
        { mrp: null },
        { mrp: { $lte: 0 } },
      ],
    },
  },
});

const collectProductIds = (items = []) => (
  [...new Set(
    items
      .map((item) => toIdString(item?.product))
      .filter(Boolean),
  )]
);

const productCache = new Map();

const hydrateProductCache = async (productIds = []) => {
  const missingIds = productIds.filter((id) => id && !productCache.has(id));
  if (!missingIds.length) {
    return;
  }

  const products = await Product.find({ _id: { $in: missingIds } })
    .select('_id mrp price')
    .lean();

  products.forEach((product) => {
    productCache.set(String(product._id), {
      mrp: toAmount(product.mrp),
      price: toAmount(product.price),
    });
  });

  missingIds.forEach((id) => {
    if (!productCache.has(id)) {
      productCache.set(id, null);
    }
  });
};

const applyOrderBackfill = async ({ dryRun = false } = {}) => {
  const stats = {
    inspected: 0,
    updated: 0,
    exact: 0,
    scaled: 0,
    distributed: 0,
  };

  const query = buildMissingMrpQuery('orderItems');
  const orders = await Order.find(query)
    .select('_id orderNumber originalSubtotal subtotal orderItems.product orderItems.quantity orderItems.price orderItems.mrp')
    .lean();

  for (const order of orders) {
    stats.inspected += 1;

    const orderItems = Array.isArray(order?.orderItems) ? order.orderItems : [];
    await hydrateProductCache(collectProductIds(orderItems));

    const { mrps, strategy } = computeBackfilledItemMrps(
      orderItems,
      order.originalSubtotal ?? order.subtotal,
      productCache,
    );

    const nextItems = orderItems.map((item, index) => ({
      ...item,
      mrp: roundAmount(Math.max(toAmount(item?.price), mrps[index] ?? toAmount(item?.price))),
    }));

    const changed = nextItems.some((item, index) => !hasValidMrp(orderItems[index]) || roundAmount(toAmount(orderItems[index]?.mrp)) !== item.mrp);
    if (!changed) {
      continue;
    }

    if (strategy === 'current-product-mrp-exact') {
      stats.exact += 1;
    } else if (strategy === 'current-product-mrp-scaled') {
      stats.scaled += 1;
    } else {
      stats.distributed += 1;
    }

    if (!dryRun) {
      await Order.updateOne(
        { _id: order._id },
        { $set: { orderItems: nextItems } },
      );
    }

    stats.updated += 1;
  }

  return stats;
};

const applyPaymentSessionBackfill = async ({ dryRun = false } = {}) => {
  const stats = {
    inspected: 0,
    updated: 0,
    exact: 0,
    scaled: 0,
    distributed: 0,
  };

  const query = {
    type: 'shop',
    ...buildMissingMrpQuery('orderSnapshot.items'),
  };

  const sessions = await PaymentSession.find(query)
    .select('_id orderSnapshot.items orderSnapshot.originalSubtotal orderSnapshot.subtotal')
    .lean();

  for (const paymentSession of sessions) {
    stats.inspected += 1;

    const snapshotItems = Array.isArray(paymentSession?.orderSnapshot?.items)
      ? paymentSession.orderSnapshot.items
      : [];
    await hydrateProductCache(collectProductIds(snapshotItems));

    const { mrps, strategy } = computeBackfilledItemMrps(
      snapshotItems,
      paymentSession?.orderSnapshot?.originalSubtotal ?? paymentSession?.orderSnapshot?.subtotal,
      productCache,
    );

    const nextItems = snapshotItems.map((item, index) => ({
      ...item,
      mrp: roundAmount(Math.max(toAmount(item?.price), mrps[index] ?? toAmount(item?.price))),
    }));

    const changed = nextItems.some((item, index) => !hasValidMrp(snapshotItems[index]) || roundAmount(toAmount(snapshotItems[index]?.mrp)) !== item.mrp);
    if (!changed) {
      continue;
    }

    if (strategy === 'current-product-mrp-exact') {
      stats.exact += 1;
    } else if (strategy === 'current-product-mrp-scaled') {
      stats.scaled += 1;
    } else {
      stats.distributed += 1;
    }

    if (!dryRun) {
      await PaymentSession.updateOne(
        { _id: paymentSession._id },
        { $set: { 'orderSnapshot.items': nextItems } },
      );
    }

    stats.updated += 1;
  }

  return stats;
};

const logStats = (label, stats) => {
  console.log(`${label}:`);
  console.log(`- inspected: ${stats.inspected}`);
  console.log(`- updated: ${stats.updated}`);
  console.log(`- current-product-mrp exact: ${stats.exact}`);
  console.log(`- current-product-mrp scaled: ${stats.scaled}`);
  console.log(`- order-level distributed: ${stats.distributed}`);
};

const backfillMarketplaceOrderMrp = async () => {
  const dryRun = process.argv.includes('--dry-run');

  try {
    await connectDB();

    const [orderStats, paymentSessionStats] = await Promise.all([
      applyOrderBackfill({ dryRun }),
      applyPaymentSessionBackfill({ dryRun }),
    ]);

    console.log(dryRun
      ? 'Marketplace MRP backfill dry run completed.'
      : 'Marketplace MRP backfill completed.');
    logStats('Orders', orderStats);
    logStats('Payment sessions', paymentSessionStats);
  } catch (error) {
    console.error('Failed to backfill marketplace order MRP:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close().catch(() => {});
    process.exit(process.exitCode ?? 0);
  }
};

backfillMarketplaceOrderMrp();
