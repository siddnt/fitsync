export const LISTING_PLANS = {
  basic: {
    planCode: 'basic',
    label: 'Basic Visibility',
    amount: 4999,
    currency: 'INR',
    durationMonths: 1,
    features: ['20 spotlight impressions', 'Marketplace listing', 'Email support'],
  },
  growth: {
    planCode: 'growth',
    label: 'Growth Booster',
    amount: 12999,
    currency: 'INR',
    durationMonths: 3,
    features: ['Sponsored placement', 'Priority search ranking', 'Dedicated account manager'],
  },
  scale: {
    planCode: 'scale',
    label: 'Scale Elite',
    amount: 44999,
    currency: 'INR',
    durationMonths: 12,
    features: ['Homepage hero', 'Quarterly creative workshop', 'Conversion analytics deep dive'],
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
  const plan = LISTING_PLANS[code];
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
