export const SELLER_ORDER_STATUSES = [
  { value: 'placed', label: 'Just placed' },
  { value: 'processing', label: 'Processing' },
  { value: 'in-transit', label: 'In transit' },
  { value: 'out-for-delivery', label: 'Out for delivery' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const ACTIVE_FULFILLMENT_STATUSES = new Set([
  'placed',
  'processing',
  'in-transit',
  'out-for-delivery',
]);
