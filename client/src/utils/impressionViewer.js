const GYM_IMPRESSION_VIEWER_STORAGE_KEY = 'fitsync-gym-impression-viewer-id';

const generateViewerId = () => {
  if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `viewer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

export const getGymImpressionViewerId = () => {
  if (typeof window === 'undefined') {
    return '';
  }

  try {
    const existing = window.localStorage.getItem(GYM_IMPRESSION_VIEWER_STORAGE_KEY);
    if (existing) {
      return existing;
    }

    const nextValue = generateViewerId();
    window.localStorage.setItem(GYM_IMPRESSION_VIEWER_STORAGE_KEY, nextValue);
    return nextValue;
  } catch {
    return generateViewerId();
  }
};
