import { AMENITY_OPTIONS } from '../../constants/amenities.js';

const trimToUndefined = (value) => {
  if (value === undefined || value === null) {
    return undefined;
  }

  const trimmed = String(value).trim();
  return trimmed ? trimmed : undefined;
};

const normaliseAmount = (value) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return undefined;
  }

  return numeric;
};

const coerceToList = (value) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (value === undefined || value === null) {
    return [];
  }

  return String(value).split(',');
};

const AMENITY_SET = new Set(AMENITY_OPTIONS);

export const normalizeTags = (value) => {
  const tokens = coerceToList(value)
    .map((token) => (typeof token === 'string' ? token.trim() : String(token ?? '').trim()))
    .filter(Boolean);

  return tokens.length ? tokens : undefined;
};

const buildSection = (entries) => {
  const section = entries.reduce((acc, [key, val]) => {
    if (val !== undefined) {
      acc[key] = val;
    }
    return acc;
  }, {});

  return Object.keys(section).length ? section : undefined;
};

export const transformGymPayload = (values) => {
  const payload = {};

  const name = trimToUndefined(values?.name);
  if (name !== undefined) {
    payload.name = name;
  }

  const description = trimToUndefined(values?.description);
  if (description !== undefined) {
    payload.description = description;
  }

  const city = trimToUndefined(values?.location?.city);
  const state = trimToUndefined(values?.location?.state);
  const address = [city, state].filter(Boolean).join(', ') || undefined;
  const location = buildSection([
    ['address', address],
    ['city', city],
    ['state', state],
  ]);
  if (location) {
    payload.location = location;
  }

  const contact = buildSection([
    ['phone', trimToUndefined(values?.contact?.phone)],
  ]);
  if (contact) {
    payload.contact = contact;
  }

  const schedule = buildSection([
    ['openTime', trimToUndefined(values?.schedule?.open)],
    ['closeTime', trimToUndefined(values?.schedule?.close)],
  ]);
  if (schedule) {
    payload.schedule = schedule;
  }

  const mrp = normaliseAmount(values?.pricing?.mrp);
  const discounted = normaliseAmount(values?.pricing?.discounted);
  const effectivePrice = discounted !== undefined && (mrp === undefined || discounted < mrp) ? discounted : mrp;
  const pricing = buildSection([
    ['monthlyMrp', mrp],
    ['monthlyPrice', effectivePrice],
  ]);
  if (pricing) {
    payload.pricing = pricing;
  }

  const keyFeatures = normalizeTags(values?.keyFeatures ?? values?.amenities);
  if (keyFeatures) {
    const curated = keyFeatures.filter((feature) => AMENITY_SET.has(feature));
    if (curated.length) {
      payload.keyFeatures = curated;
      payload.amenities = curated;
    }
  }

  const tags = normalizeTags(values?.tags);
  if (tags) {
    payload.tags = tags;
  }

  return payload;
};
