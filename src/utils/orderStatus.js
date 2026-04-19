const ORDER_STATUS_KEYS = ['processing', 'in-transit', 'out-for-delivery', 'delivered'];

export const normaliseOrderItemStatus = (status) => {
  if (!status) {
    return 'processing';
  }

  const value = String(status).toLowerCase();

  if (ORDER_STATUS_KEYS.includes(value)) {
    return value;
  }

  if (value === 'shipped') {
    return 'in-transit';
  }

  if (value === 'placed' || value === 'cancelled') {
    return 'processing';
  }

  return 'processing';
};

export const summariseOrderStatus = (order) => {
  const items = Array.isArray(order?.orderItems) ? order.orderItems : [];

  if (!items.length) {
    return 'processing';
  }

  const statuses = items.map((item) => normaliseOrderItemStatus(item?.status));

  if (statuses.every((status) => status === 'delivered')) {
    return 'delivered';
  }

  if (statuses.some((status) => status === 'out-for-delivery')) {
    return 'out-for-delivery';
  }

  if (statuses.some((status) => status === 'in-transit')) {
    return 'in-transit';
  }

  return 'processing';
};
