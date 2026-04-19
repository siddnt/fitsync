const DEFAULT_CURRENCY = 'INR';

const resolveCurrencyValue = (value, fallbackCurrency = DEFAULT_CURRENCY) => {
  if (typeof value === 'object' && value !== null) {
    const nestedValue = value.amount ?? value.value ?? 0;

    if (typeof nestedValue === 'object' && nestedValue !== null) {
      return resolveCurrencyValue(nestedValue, value.currency || fallbackCurrency);
    }

    const amount = Number(nestedValue);
    return {
      amount: Number.isFinite(amount) ? amount : 0,
      currency: value.currency || fallbackCurrency,
    };
  }

  const amount = Number(value);
  return {
    amount: Number.isFinite(amount) ? amount : 0,
    currency: fallbackCurrency,
  };
};

export const formatCurrency = (value, fallbackCurrency = DEFAULT_CURRENCY) => {
  if (value === null || value === undefined) {
    return '—';
  }

  const { amount, currency } = resolveCurrencyValue(value, fallbackCurrency);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatNumber = (value, options = {}) => {
  if (value === null || value === undefined) {
    return '—';
  }
  return new Intl.NumberFormat('en-IN', options).format(Number(value) || 0);
};

export const formatPercentage = (value) => {
  if (value === null || value === undefined) {
    return '—';
  }
  return `${Math.round(value)}%`;
};

export const formatDate = (value) => {
  if (!value) {
    return '—';
  }
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const formatDateTime = (value) => {
  if (!value) {
    return '—';
  }
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatDaysRemaining = (daysRemaining) => {
  if (daysRemaining === null || daysRemaining === undefined) {
    return '—';
  }
  if (daysRemaining <= 0) {
    return 'Expired';
  }
  if (daysRemaining === 1) {
    return '1 day';
  }
  if (daysRemaining < 7) {
    return `${daysRemaining} days`;
  }
  const weeks = Math.floor(daysRemaining / 7);
  return `${weeks} week${weeks > 1 ? 's' : ''}`;
};

export const formatStatus = (status) => {
  if (!status) {
    return '—';
  }
  return status
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

export const sortByDateDesc = (collection, selector = (item) => item) => {
  if (!Array.isArray(collection)) {
    return [];
  }
  return [...collection].sort((a, b) => new Date(selector(b)) - new Date(selector(a)));
};
