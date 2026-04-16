const MEMBERSHIP_PLAN_DEFINITIONS = [
  { code: 'monthly', label: 'Monthly', durationMonths: 1, sortOrder: 1 },
  { code: 'quarterly', label: 'Quarterly', durationMonths: 3, sortOrder: 2 },
  { code: 'half-yearly', label: 'Half Yearly', durationMonths: 6, sortOrder: 3 },
  { code: 'yearly', label: 'Yearly', durationMonths: 12, sortOrder: 4 },
];

const PLAN_DEFINITION_MAP = new Map(
  MEMBERSHIP_PLAN_DEFINITIONS.map((definition) => [definition.code, definition]),
);

const PLAN_CODE_ALIASES = new Map([
  ['monthly', 'monthly'],
  ['month', 'monthly'],
  ['quarterly', 'quarterly'],
  ['quarter', 'quarterly'],
  ['half-yearly', 'half-yearly'],
  ['half yearly', 'half-yearly'],
  ['half_yearly', 'half-yearly'],
  ['halfyearly', 'half-yearly'],
  ['semi-annual', 'half-yearly'],
  ['semi annual', 'half-yearly'],
  ['semiannual', 'half-yearly'],
  ['biannual', 'half-yearly'],
  ['yearly', 'yearly'],
  ['annual', 'yearly'],
  ['annually', 'yearly'],
]);

const toFiniteAmount = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

export const normalizeMembershipPlanCode = (value) => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, ' ')
    .replace(/\s*-\s*/g, '-');

  if (!normalized) {
    return '';
  }

  return PLAN_CODE_ALIASES.get(normalized) || PLAN_CODE_ALIASES.get(normalized.replace(/-/g, ' ')) || '';
};

export const getMembershipPlanDefinition = (value) =>
  PLAN_DEFINITION_MAP.get(normalizeMembershipPlanCode(value)) || null;

export const getMembershipPlanDurationMonths = (value, fallback = 1) =>
  getMembershipPlanDefinition(value)?.durationMonths ?? fallback;

export const getMembershipPlanLabel = (value) =>
  getMembershipPlanDefinition(value)?.label || String(value || '').trim();

export const sortMembershipPlans = (plans = []) => [...plans].sort((left, right) => {
  const leftDefinition = getMembershipPlanDefinition(left?.code || left?.planCode);
  const rightDefinition = getMembershipPlanDefinition(right?.code || right?.planCode);
  const leftOrder = leftDefinition?.sortOrder ?? Number(left?.durationMonths) ?? Number.MAX_SAFE_INTEGER;
  const rightOrder = rightDefinition?.sortOrder ?? Number(right?.durationMonths) ?? Number.MAX_SAFE_INTEGER;

  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  return (Number(left?.price) || 0) - (Number(right?.price) || 0);
});

const normalizeMembershipPlanEntry = (plan = {}, fallbackCurrency = 'INR') => {
  const definition = getMembershipPlanDefinition(plan?.code || plan?.planCode || plan?.id);
  if (!definition) {
    return null;
  }

  const mrpCandidate = toFiniteAmount(plan?.mrp ?? plan?.monthlyMrp ?? plan?.listPrice);
  const priceCandidate = toFiniteAmount(
    plan?.price
    ?? plan?.discounted
    ?? plan?.monthlyPrice
    ?? plan?.amount
    ?? plan?.salePrice,
  );

  const mrp = mrpCandidate && mrpCandidate > 0
    ? mrpCandidate
    : priceCandidate && priceCandidate > 0
      ? priceCandidate
      : null;

  if (!mrp || mrp <= 0) {
    return null;
  }

  const rawPrice = priceCandidate && priceCandidate > 0 ? priceCandidate : mrp;
  const price = rawPrice > mrp ? mrp : rawPrice;

  return {
    code: definition.code,
    label: definition.label,
    durationMonths: definition.durationMonths,
    mrp,
    price,
    currency: String(plan?.currency || fallbackCurrency || 'INR').trim().toUpperCase() || 'INR',
    isActive: plan?.isActive !== false,
  };
};

const derivePlanFromMonthly = (monthlyPlan, definition) => {
  const monthlyMrp = Number(monthlyPlan?.mrp);
  const monthlyPrice = Number(monthlyPlan?.price);

  if (!Number.isFinite(monthlyMrp) || monthlyMrp <= 0) {
    return null;
  }

  const durationMonths = Number(definition?.durationMonths) || 0;
  if (durationMonths <= 0) {
    return null;
  }

  const price = Number.isFinite(monthlyPrice) && monthlyPrice > 0 ? monthlyPrice : monthlyMrp;

  return {
    code: definition.code,
    label: definition.label,
    durationMonths,
    mrp: Math.round(monthlyMrp * durationMonths),
    price: Math.round(price * durationMonths),
    currency: monthlyPlan?.currency || 'INR',
    isActive: true,
  };
};

export const normalizeGymMembershipPlans = (pricing = {}) => {
  const fallbackCurrency = String(pricing?.currency || 'INR').trim().toUpperCase() || 'INR';
  const rawPlans = Array.isArray(pricing?.membershipPlans) ? pricing.membershipPlans : [];
  const normalizedPlans = rawPlans
    .map((plan) => normalizeMembershipPlanEntry(plan, fallbackCurrency))
    .filter(Boolean);

  if (!normalizedPlans.length) {
    const legacyMonthlyPlan = normalizeMembershipPlanEntry(
      {
        code: 'monthly',
        mrp: pricing?.monthlyMrp,
        price: pricing?.monthlyPrice,
        currency: pricing?.currency || fallbackCurrency,
      },
      fallbackCurrency,
    );

    if (legacyMonthlyPlan) {
      normalizedPlans.push(legacyMonthlyPlan);
    }
  }

  const uniquePlans = normalizedPlans.reduce((acc, plan) => {
    acc.set(plan.code, plan);
    return acc;
  }, new Map());

  const monthlyPlan = uniquePlans.get('monthly');
  const shouldExpandLegacyMonthlyPlans = monthlyPlan && uniquePlans.size === 1;

  if (shouldExpandLegacyMonthlyPlans) {
    MEMBERSHIP_PLAN_DEFINITIONS.forEach((definition) => {
      if (uniquePlans.has(definition.code)) {
        return;
      }

      const derivedPlan = derivePlanFromMonthly(monthlyPlan, definition);
      if (derivedPlan) {
        uniquePlans.set(definition.code, derivedPlan);
      }
    });
  }

  return sortMembershipPlans(Array.from(uniquePlans.values()));
};

export const deriveLegacyPricingFromMembershipPlans = (plans = [], fallbackCurrency = 'INR') => {
  const orderedPlans = sortMembershipPlans(plans);
  const monthlyPlan = orderedPlans.find((plan) => plan.code === 'monthly') || orderedPlans[0] || null;

  return {
    monthlyMrp: Number(monthlyPlan?.mrp) || 0,
    monthlyPrice: Number(monthlyPlan?.price) || 0,
    currency: monthlyPlan?.currency || String(fallbackCurrency || 'INR').trim().toUpperCase() || 'INR',
  };
};

export const buildGymPricingSnapshot = (pricing = {}) => {
  const membershipPlans = normalizeGymMembershipPlans(pricing);
  const legacyPricing = deriveLegacyPricingFromMembershipPlans(
    membershipPlans,
    pricing?.currency || 'INR',
  );

  return {
    monthlyMrp: legacyPricing.monthlyMrp,
    monthlyPrice: legacyPricing.monthlyPrice,
    currency: legacyPricing.currency,
    membershipPlans,
  };
};

export const getDefaultDisplayMembershipPlan = (plans = []) =>
  sortMembershipPlans(plans).find((plan) => plan.code === 'monthly') || sortMembershipPlans(plans)[0] || null;

export const getLowestPricedMembershipPlan = (plans = []) =>
  [...plans].sort((left, right) => {
    const leftPrice = Number(left?.price) || Number(left?.mrp) || Number.MAX_SAFE_INTEGER;
    const rightPrice = Number(right?.price) || Number(right?.mrp) || Number.MAX_SAFE_INTEGER;

    if (leftPrice !== rightPrice) {
      return leftPrice - rightPrice;
    }

    return (Number(left?.durationMonths) || Number.MAX_SAFE_INTEGER)
      - (Number(right?.durationMonths) || Number.MAX_SAFE_INTEGER);
  })[0] || null;

export const resolveGymMembershipPlan = (pricing = {}, requestedPlanCode = null) => {
  const availablePlans = normalizeGymMembershipPlans(pricing).filter((plan) => plan.isActive !== false);
  if (!availablePlans.length) {
    return null;
  }

  if (requestedPlanCode) {
    const normalizedCode = normalizeMembershipPlanCode(requestedPlanCode);
    return availablePlans.find((plan) => plan.code === normalizedCode) || null;
  }

  return getDefaultDisplayMembershipPlan(availablePlans) || availablePlans[0];
};

export const getSupportedMembershipPlans = () => MEMBERSHIP_PLAN_DEFINITIONS.map((definition) => ({ ...definition }));
