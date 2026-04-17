import { AMENITY_OPTIONS } from '../../constants/amenities.js';
import { MEMBERSHIP_PLAN_OPTIONS } from '../../constants/membershipPlans.js';

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

const normalizeUrlList = (value) => {
  const tokens = coerceToList(
    Array.isArray(value)
      ? value
      : String(value ?? '')
          .split(/\r?\n/)
          .flatMap((entry) => entry.split(',')),
  )
    .map((token) => String(token ?? '').trim())
    .filter(Boolean);

  return tokens.length ? [...new Set(tokens)] : undefined;
};

const AMENITY_SET = new Set(AMENITY_OPTIONS);

export const normalizeTags = (value) => {
  const tokens = coerceToList(value)
    .map((token) => (typeof token === 'string' ? token.trim() : String(token ?? '').trim()))
    .filter(Boolean);

  return tokens.length ? tokens : undefined;
};

export const buildMembershipPlanFormValues = (pricing = {}) => {
  const rawPlans = Array.isArray(pricing?.plans)
    ? pricing.plans
    : Array.isArray(pricing?.membershipPlans)
      ? pricing.membershipPlans
      : [];

  const mappedPlans = MEMBERSHIP_PLAN_OPTIONS.reduce((acc, plan) => {
    const currentPlan = rawPlans.find((entry) => entry?.code === plan.code || entry?.planCode === plan.code);
    if (!currentPlan) {
      return acc;
    }

    acc[plan.code] = {
      mrp: currentPlan?.mrp ?? currentPlan?.monthlyMrp ?? '',
      discounted: currentPlan?.price ?? currentPlan?.discounted ?? currentPlan?.monthlyPrice ?? '',
    };

    return acc;
  }, {});

  if (Object.keys(mappedPlans).length) {
    return mappedPlans;
  }

  const legacyMrp = normaliseAmount(pricing?.monthlyMrp ?? pricing?.mrp);
  const legacyPrice = normaliseAmount(pricing?.monthlyPrice ?? pricing?.discounted);

  if (legacyMrp === undefined && legacyPrice === undefined) {
    return {};
  }

  return {
    monthly: {
      mrp: legacyMrp ?? legacyPrice ?? '',
      discounted: legacyPrice ?? legacyMrp ?? '',
    },
  };
};

export const validateMembershipPricingValues = (
  pricingValues = {},
  { requireAtLeastOne = true } = {},
) => {
  const planErrors = {};
  let configuredPlanCount = 0;

  MEMBERSHIP_PLAN_OPTIONS.forEach((plan) => {
    const currentPlan = pricingValues?.plans?.[plan.code] ?? {};
    const mrpInput = currentPlan?.mrp;
    const discountedInput = currentPlan?.discounted;
    const hasMrp = mrpInput !== undefined && mrpInput !== null && mrpInput !== '';
    const hasDiscounted = discountedInput !== undefined && discountedInput !== null && discountedInput !== '';

    if (!hasMrp && !hasDiscounted) {
      return;
    }

    configuredPlanCount += 1;

    const currentErrors = {};
    const mrpValue = Number(mrpInput);

    if (!hasMrp) {
      currentErrors.mrp = 'Enter the plan MRP';
    } else if (!Number.isFinite(mrpValue) || mrpValue <= 0) {
      currentErrors.mrp = 'Enter a valid plan MRP';
    }

    if (hasDiscounted) {
      const discountedValue = Number(discountedInput);
      if (!Number.isFinite(discountedValue) || discountedValue <= 0) {
        currentErrors.discounted = 'Enter a valid offer price';
      } else if (hasMrp && Number.isFinite(mrpValue) && mrpValue > 0 && discountedValue > mrpValue) {
        currentErrors.discounted = 'Offer price cannot exceed the MRP';
      }
    }

    if (Object.keys(currentErrors).length) {
      planErrors[plan.code] = currentErrors;
    }
  });

  const pricingErrors = {};

  if (Object.keys(planErrors).length) {
    pricingErrors.plans = planErrors;
  }

  if (requireAtLeastOne && configuredPlanCount === 0) {
    pricingErrors.membershipPlansNotice = 'Add at least one membership plan.';
  }

  return Object.keys(pricingErrors).length ? pricingErrors : undefined;
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
  const address = trimToUndefined(values?.location?.address)
    ?? ([city, state].filter(Boolean).join(', ') || undefined);
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
    ['email', trimToUndefined(values?.contact?.email)],
    ['website', trimToUndefined(values?.contact?.website)],
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

  const membershipPlans = MEMBERSHIP_PLAN_OPTIONS.map((plan) => {
    const planValues = values?.pricing?.plans?.[plan.code] ?? {};
    const fallbackPlanValues = plan.code === 'monthly' ? values?.pricing ?? {} : {};
    const mrp = normaliseAmount(planValues?.mrp ?? fallbackPlanValues?.mrp);
    const discounted = normaliseAmount(planValues?.discounted ?? fallbackPlanValues?.discounted);
    const resolvedMrp = mrp ?? discounted;
    const resolvedPrice = discounted !== undefined && (resolvedMrp === undefined || discounted < resolvedMrp)
      ? discounted
      : resolvedMrp;

    if (resolvedMrp === undefined || resolvedPrice === undefined) {
      return null;
    }

    return {
      code: plan.code,
      mrp: resolvedMrp,
      price: resolvedPrice,
    };
  }).filter(Boolean);

  const pricing = buildSection([
    ['membershipPlans', membershipPlans.length ? membershipPlans : undefined],
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

  const gallery = normalizeUrlList(values?.gallery);
  if (gallery) {
    payload.gallery = gallery;
    payload.images = gallery.slice(0, 1);
  }

  return payload;
};
