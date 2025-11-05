export const normalizeTags = (value) =>
  value
    ?.split(',')
    .map((item) => item.trim())
    .filter(Boolean) ?? [];

export const transformGymPayload = (values) => ({
  name: values.name,
  description: values.description,
  location: {
    city: values?.location?.city,
    state: values?.location?.state,
  },
  pricing: {
    mrp: Number(values?.pricing?.mrp) || 0,
    discounted: values?.pricing?.discounted ? Number(values.pricing.discounted) : undefined,
  },
  contact: {
    phone: values?.contact?.phone,
  },
  schedule: {
    open: values?.schedule?.open,
    close: values?.schedule?.close,
  },
  keyFeatures: normalizeTags(values.keyFeatures),
  tags: normalizeTags(values.tags),
});
