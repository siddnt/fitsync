const VIEWED_PRODUCTS_KEY = 'marketplaceViewedProducts';
const SAVED_ADDRESSES_KEY = 'marketplaceSavedAddresses';
const PROMO_CODE_KEY = 'marketplacePromoCode';
const MAX_VIEWED_PRODUCTS = 8;
const MAX_SAVED_ADDRESSES = 5;

export const MARKETPLACE_PROMO_CODES = [
  {
    code: 'WELCOMEKIT',
    label: 'Welcome kit',
    summary: 'Adds a welcome-pack note for first-time marketplace deliveries.',
  },
  {
    code: 'PRIORITYPACK',
    label: 'Priority packing',
    summary: 'Flags the order for faster seller handling in this demo flow.',
  },
  {
    code: 'RECOVERPLUS',
    label: 'Recovery support',
    summary: 'Adds a follow-up recovery and returns support note after delivery.',
  },
];

const canUseLocalStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const safeRead = (key, fallback) => {
  if (!canUseLocalStorage()) {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (_error) {
    return fallback;
  }
};

const safeWrite = (key, value) => {
  if (!canUseLocalStorage()) {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
};

const normalisePromoCode = (value) => String(value ?? '').trim().toUpperCase();

const buildAddressSignature = (address = {}) => [
  address.firstName,
  address.lastName,
  address.phone,
  address.address,
  address.city,
  address.state,
  address.zipCode,
]
  .map((segment) => String(segment ?? '').trim().toLowerCase())
  .join('|');

export const getMarketplacePromoDefinition = (code) => {
  const normalized = normalisePromoCode(code);
  return MARKETPLACE_PROMO_CODES.find((entry) => entry.code === normalized) ?? null;
};

export const readMarketplacePromoCode = () => {
  const raw = safeRead(PROMO_CODE_KEY, '');
  return typeof raw === 'string' ? normalisePromoCode(raw) : '';
};

export const writeMarketplacePromoCode = (code) => {
  const normalized = normalisePromoCode(code);
  safeWrite(PROMO_CODE_KEY, normalized);
  return normalized;
};

export const clearMarketplacePromoCode = () => {
  if (!canUseLocalStorage()) {
    return;
  }
  window.localStorage.removeItem(PROMO_CODE_KEY);
};

export const readViewedMarketplaceProducts = () => {
  const raw = safeRead(VIEWED_PRODUCTS_KEY, []);
  return Array.isArray(raw) ? raw : [];
};

export const trackViewedMarketplaceProduct = (product) => {
  if (!product?.id) {
    return [];
  }

  const nextEntry = {
    id: String(product.id),
    name: product.name ?? 'Marketplace product',
    image: product.image ?? null,
    price: Number(product.price) || 0,
    category: product.category ?? '',
    seller: product.seller ?? null,
    viewedAt: new Date().toISOString(),
  };

  const existing = readViewedMarketplaceProducts().filter((entry) => String(entry?.id) !== nextEntry.id);
  const next = [nextEntry, ...existing].slice(0, MAX_VIEWED_PRODUCTS);
  safeWrite(VIEWED_PRODUCTS_KEY, next);
  return next;
};

export const readSavedCheckoutAddresses = (userKey) => {
  if (!userKey) {
    return [];
  }

  const store = safeRead(SAVED_ADDRESSES_KEY, {});
  const bucket = store?.[String(userKey)] ?? [];
  return Array.isArray(bucket) ? bucket : [];
};

export const saveCheckoutAddress = (userKey, address) => {
  if (!userKey || !address) {
    return [];
  }

  const store = safeRead(SAVED_ADDRESSES_KEY, {});
  const current = readSavedCheckoutAddresses(userKey);
  const signature = buildAddressSignature(address);
  const entry = {
    id: signature || `${Date.now()}`,
    label: [address.address, address.city].filter(Boolean).join(', '),
    address,
    updatedAt: new Date().toISOString(),
  };

  const next = [entry, ...current.filter((saved) => saved?.id !== entry.id)].slice(0, MAX_SAVED_ADDRESSES);
  safeWrite(SAVED_ADDRESSES_KEY, {
    ...store,
    [String(userKey)]: next,
  });

  return next;
};

export const removeSavedCheckoutAddress = (userKey, addressId) => {
  if (!userKey || !addressId) {
    return [];
  }

  const store = safeRead(SAVED_ADDRESSES_KEY, {});
  const next = readSavedCheckoutAddresses(userKey).filter((entry) => entry?.id !== addressId);
  safeWrite(SAVED_ADDRESSES_KEY, {
    ...store,
    [String(userKey)]: next,
  });

  return next;
};
