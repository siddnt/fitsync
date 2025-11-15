export const SELLER_ORDER_STATUSES = [
  { value: 'processing', label: 'Processing' },
  { value: 'in-transit', label: 'In transit' },
  { value: 'out-for-delivery', label: 'Out for delivery' },
  { value: 'delivered', label: 'Delivered' },
];

export const ACTIVE_FULFILLMENT_STATUSES = new Set([
  'processing',
  'in-transit',
  'out-for-delivery',
]);
