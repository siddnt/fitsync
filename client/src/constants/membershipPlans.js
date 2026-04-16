export const MEMBERSHIP_PLAN_OPTIONS = [
  { code: 'monthly', label: 'Monthly', durationMonths: 1 },
  { code: 'quarterly', label: 'Quarterly', durationMonths: 3 },
  { code: 'half-yearly', label: 'Half Yearly', durationMonths: 6 },
  { code: 'yearly', label: 'Yearly', durationMonths: 12 },
];

const MEMBERSHIP_PLAN_MAP = new Map(
  MEMBERSHIP_PLAN_OPTIONS.map((plan) => [plan.code, plan]),
);

export const getMembershipPlanDefinition = (code) => MEMBERSHIP_PLAN_MAP.get(String(code || '').trim().toLowerCase()) || null;

export const formatMembershipPlanDuration = (durationMonths) => {
  const months = Number(durationMonths) || 0;
  if (months <= 0) {
    return '';
  }
  return `${months} month${months > 1 ? 's' : ''}`;
};
