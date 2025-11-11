export const LISTING_PLANS = {
  'listing-1m': {
    planCode: 'listing-1m',
    label: 'Starter · 1 month',
    amount: 6999,
    currency: 'INR',
    durationMonths: 1,
    features: ['Single gym activation', 'Verified listing badge', 'Weekly performance snapshot'],
  },
  'listing-3m': {
    planCode: 'listing-3m',
    label: 'Growth · 3 months',
    amount: 18999,
    currency: 'INR',
    durationMonths: 3,
    features: ['Priority placement', 'Monthly insights review', 'Onboarding success manager'],
  },
  'listing-6m': {
    planCode: 'listing-6m',
    label: 'Scale · 6 months',
    amount: 32999,
    currency: 'INR',
    durationMonths: 6,
    features: ['Homepage highlights', 'Campaign boost credits', 'Quarterly growth workshop'],
  },
  'listing-12m': {
    planCode: 'listing-12m',
    label: 'Dominance · 12 months',
    amount: 59999,
    currency: 'INR',
    durationMonths: 12,
    features: ['Always-on spotlight', 'Dedicated concierge team', 'Annual strategy audit'],
  },
};

export const SPONSORSHIP_PACKAGES = {
  silver: {
    tier: 'silver',
    label: 'Silver Spotlights',
    amount: 9000,
    currency: 'INR',
    durationMonths: 1,
    monthlyBudget: 9000,
    reach: 15000,
  },
  gold: {
    tier: 'gold',
    label: 'Gold Launchpad',
    amount: 24000,
    currency: 'INR',
    durationMonths: 3,
    monthlyBudget: 8000,
    reach: 60000,
  },
  platinum: {
    tier: 'platinum',
    label: 'Platinum Domination',
    amount: 84000,
    currency: 'INR',
    durationMonths: 12,
    monthlyBudget: 7000,
    reach: 240000,
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
