import SystemSetting from '../models/systemSetting.model.js';

export const DEFAULT_ADMIN_TOGGLES = {
  marketplaceEnabled: true,
  autoApproveTrainers: false,
  showBetaDashboards: false,
  maintenanceMode: false,
  supportInboxEnabled: true,
  paymentCheckoutEnabled: true,
  searchIndexingEnabled: true,
  cacheWarmupEnabled: true,
  orderReturnsEnabled: true,
  gymModerationAlerts: true,
};

export const loadAdminToggles = async () => {
  const stored = await SystemSetting.find({
    key: { $in: Object.keys(DEFAULT_ADMIN_TOGGLES) },
  })
    .select('key value')
    .lean();

  if (!stored.length) {
    return { ...DEFAULT_ADMIN_TOGGLES };
  }

  const merged = { ...DEFAULT_ADMIN_TOGGLES };
  stored.forEach((setting) => {
    merged[setting.key] = setting.value;
  });

  return merged;
};

export const loadAdminToggleState = async () => {
  const stored = await SystemSetting.find({
    key: { $in: Object.keys(DEFAULT_ADMIN_TOGGLES) },
  })
    .select('key value updatedAt updatedBy')
    .populate({ path: 'updatedBy', select: 'name email role' })
    .lean();

  const toggles = { ...DEFAULT_ADMIN_TOGGLES };
  let latestUpdateAt = null;
  let latestUpdatedBy = null;

  stored.forEach((setting) => {
    toggles[setting.key] = setting.value;

    if (!setting.updatedAt) {
      return;
    }

    if (!latestUpdateAt || new Date(setting.updatedAt) > new Date(latestUpdateAt)) {
      latestUpdateAt = setting.updatedAt;
      latestUpdatedBy = setting.updatedBy ?? null;
    }
  });

  return {
    toggles,
    updatedAt: latestUpdateAt,
    updatedBy: latestUpdatedBy
      ? {
          id: settingUserId(latestUpdatedBy),
          name: latestUpdatedBy.name ?? '',
          email: latestUpdatedBy.email ?? '',
          role: latestUpdatedBy.role ?? null,
        }
      : null,
  };
};

const settingUserId = (user) => {
  if (!user) {
    return null;
  }

  return user._id ? String(user._id) : String(user);
};

export const applyAdminToggleUpdates = async (updates = {}, actor) => {
  const entries = Object.entries(updates).filter(([key]) => key in DEFAULT_ADMIN_TOGGLES);

  if (!entries.length) {
    return loadAdminToggles();
  }

  await Promise.all(
    entries.map(([key, value]) =>
      SystemSetting.findOneAndUpdate(
        { key },
        {
          value,
          ...(actor?._id ? { updatedBy: actor._id } : {}),
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      ),
    ),
  );

  return loadAdminToggles();
};
