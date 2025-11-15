export const normalizeTags = (value) =>
  value
    ?.split(',')
    .map((item) => item.trim())
    .filter(Boolean) ?? [];

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

export const transformGymPayload = (values) => {
  const mrp = normaliseAmount(values?.pricing?.mrp) ?? 0;
  const discountedRaw = normaliseAmount(values?.pricing?.discounted);
  const discounted = discountedRaw && mrp && discountedRaw < mrp ? discountedRaw : undefined;

  const location = {};
  const city = trimToUndefined(values?.location?.city);
  const state = trimToUndefined(values?.location?.state);
  if (city !== undefined) location.city = city;
  if (state !== undefined) location.state = state;

  const contact = {};
  const phone = trimToUndefined(values?.contact?.phone);
  if (phone !== undefined) contact.phone = phone;

  const schedule = {};
  const opens = trimToUndefined(values?.schedule?.open);
  const closes = trimToUndefined(values?.schedule?.close);
  if (opens !== undefined) schedule.open = opens;
  if (closes !== undefined) schedule.close = closes;

  const payload = {
    name: trimToUndefined(values.name),
    description: trimToUndefined(values.description),
    pricing: {
      mrp,
      ...(discounted ? { discounted } : {}),
    },
    keyFeatures: normalizeTags(values.keyFeatures),
    tags: normalizeTags(values.tags),
  };

  if (Object.keys(location).length) {
    payload.location = location;
  }

  if (Object.keys(contact).length) {
    payload.contact = contact;
  }

  if (Object.keys(schedule).length) {
    payload.schedule = schedule;
  }

  return payload;
};
