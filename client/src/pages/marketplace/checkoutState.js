export const BUY_NOW_CHECKOUT_ITEM_KEY = 'buyNowCheckoutItem';
export const PENDING_ORDER_SNAPSHOT_KEY = 'pendingOrderSnapshot';

const canUseSessionStorage = () => typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';

export const normalizeCheckoutItem = (item) => {
  const id = item?.id ?? item?.productId;
  if (!id) {
    return null;
  }

  const quantity = Number(item?.quantity ?? 1);

  return {
    id: String(id),
    name: item?.name ?? 'Unnamed product',
    price: Number(item?.price) || 0,
    image: item?.image ?? null,
    seller: item?.seller ?? null,
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
  };
};

export const readBuyNowCheckoutItem = () => {
  if (!canUseSessionStorage()) {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(BUY_NOW_CHECKOUT_ITEM_KEY);
    if (!raw) {
      return null;
    }
    return normalizeCheckoutItem(JSON.parse(raw));
  } catch (_error) {
    return null;
  }
};

export const saveBuyNowCheckoutItem = (item) => {
  const normalized = normalizeCheckoutItem(item);
  if (!normalized || !canUseSessionStorage()) {
    return normalized;
  }

  window.sessionStorage.setItem(BUY_NOW_CHECKOUT_ITEM_KEY, JSON.stringify(normalized));
  return normalized;
};

export const clearBuyNowCheckoutItem = () => {
  if (!canUseSessionStorage()) {
    return;
  }

  window.sessionStorage.removeItem(BUY_NOW_CHECKOUT_ITEM_KEY);
};

export const readPendingOrderSnapshot = () => {
  if (!canUseSessionStorage()) {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(PENDING_ORDER_SNAPSHOT_KEY);
    if (!raw) {
      return null;
    }

    return JSON.parse(raw);
  } catch (_error) {
    return null;
  }
};

export const writePendingOrderSnapshot = (snapshot) => {
  if (!canUseSessionStorage()) {
    return;
  }

  window.sessionStorage.setItem(PENDING_ORDER_SNAPSHOT_KEY, JSON.stringify(snapshot));
};

export const clearPendingOrderSnapshot = () => {
  if (!canUseSessionStorage()) {
    return;
  }

  window.sessionStorage.removeItem(PENDING_ORDER_SNAPSHOT_KEY);
};
