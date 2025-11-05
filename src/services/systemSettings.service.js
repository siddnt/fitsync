import SystemSetting from '../models/systemSetting.model.js';

export const DEFAULT_ADMIN_TOGGLES = {
  marketplaceEnabled: true,
  autoApproveTrainers: false,
  showBetaDashboards: false,
};

export const loadAdminToggles = async () => {
  const stored = await SystemSetting.find()
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
