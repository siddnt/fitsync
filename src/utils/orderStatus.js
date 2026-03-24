/**
 * Shared order-status normalisation helpers.
 *
 * Used by dashboard, marketplace, and manager controllers to
 * map legacy / inconsistent item statuses to a canonical set.
 */

export const MODERN_ITEM_STATUSES = ['processing', 'in-transit', 'out-for-delivery', 'delivered'];

const LEGACY_STATUS_FALLBACKS = new Map([
  ['placed', 'processing'],
  ['cancelled', 'processing'],
  ['shipped', 'in-transit'],
]);

/**
 * Normalise a single order-item status string to a canonical value.
 */
export const normaliseOrderItemStatus = (status) => {
  if (!status) return 'processing';

  const lower = String(status).trim().toLowerCase();
  if (MODERN_ITEM_STATUSES.includes(lower)) return lower;
  if (LEGACY_STATUS_FALLBACKS.has(lower)) return LEGACY_STATUS_FALLBACKS.get(lower);
  return 'processing';
};

/**
 * Derive an overall order status from its items.
 */
export const summariseOrderStatus = (order) => {
  const items = order?.orderItems || [];
  if (!items.length) return 'processing';

  const statuses = items.map((item) => normaliseOrderItemStatus(item.status));

  if (statuses.every((s) => s === 'delivered')) return 'delivered';
  if (statuses.some((s) => s === 'out-for-delivery')) return 'out-for-delivery';
  if (statuses.some((s) => s === 'in-transit')) return 'in-transit';
  return 'processing';
};
