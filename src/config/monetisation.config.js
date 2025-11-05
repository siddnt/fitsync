export const LISTING_PLANS = {
  'listing-1m': {
    planCode: 'listing-1m',
    label: 'Starter · 1 month',
    amount: 30000,
    currency: 'INR',
    durationMonths: 1,
    features: ['Single gym activation', 'Verified listing badge', 'Weekly performance snapshot'],
  },
  'listing-3m': {
    planCode: 'listing-3m',
    label: 'Growth · 3 months',
    amount: 80000,
    currency: 'INR',
    durationMonths: 3,
    features: ['Priority placement', 'Monthly insights review', 'Onboarding success manager'],
  },
  'listing-6m': {
    planCode: 'listing-6m',
    label: 'Scale · 6 months',
    amount: 150000,
    currency: 'INR',
    durationMonths: 6,
    features: ['Homepage highlights', 'Campaign boost credits', 'Quarterly growth workshop'],
  },
  'listing-12m': {
    planCode: 'listing-12m',
    label: 'Dominance · 12 months',
    amount: 250000,
    currency: 'INR',
    durationMonths: 12,
    features: ['Always-on spotlight', 'Dedicated concierge team', 'Annual strategy audit'],
  },
};

export const SPONSORSHIP_PACKAGES = {
  silver: {
    tier: 'silver',
    label: 'Silver Spotlights',
    amount: 15000,
    currency: 'INR',
    durationMonths: 1,
    monthlyBudget: 15000,
    reach: 25000,
  },
  gold: {
    tier: 'gold',
    label: 'Gold Launchpad',
    amount: 42000,
    currency: 'INR',
    durationMonths: 3,
    monthlyBudget: 18000,
    reach: 90000,
  },
  platinum: {
    tier: 'platinum',
    label: 'Platinum Domination',
    amount: 140000,
    currency: 'INR',
    durationMonths: 12,
    monthlyBudget: 20000,
    reach: 420000,
  },
};

export const resolveListingPlan = (code) => {
  if (!code) {
    return null;
  }

  const plan = LISTING_PLANS[code] || Object.values(LISTING_PLANS).find((entry) => entry.planCode === code);

  if (!plan) {
    return null;
  }

  return { ...plan };
};

export const resolveSponsorshipPackage = (tier) => {
  const pkg = SPONSORSHIP_PACKAGES[tier];
  if (!pkg) {
    return null;
  }
  return { ...pkg };
};
