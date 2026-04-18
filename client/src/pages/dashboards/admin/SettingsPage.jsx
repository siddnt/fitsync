import { useEffect, useMemo, useState } from 'react';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import {
  useGetAdminTogglesQuery,
  useUpdateAdminTogglesMutation,
} from '../../../services/adminApi.js';
import { formatDateTime } from '../../../utils/format.js';
import '../Dashboard.css';

const TOGGLE_DEFINITIONS = [
  {
    key: 'marketplaceEnabled',
    label: 'Marketplace enabled',
    description: 'Controls whether the public marketplace is visible to end users.',
  },
  {
    key: 'autoApproveTrainers',
    label: 'Auto-approve trainers',
    description: 'Automatically activate trainer accounts after registration instead of manual review.',
  },
  {
    key: 'showBetaDashboards',
    label: 'Show beta dashboards',
    description: 'Expose experimental analytics views to internal roles for validation.',
  },
  {
    key: 'maintenanceMode',
    label: 'Maintenance mode',
    description: 'Temporarily pause member-facing activity while administrators perform platform maintenance.',
  },
  {
    key: 'supportInboxEnabled',
    label: 'Support inbox enabled',
    description: 'Keep the public support and contact intake available for new tickets.',
  },
  {
    key: 'paymentCheckoutEnabled',
    label: 'Payments enabled',
    description: 'Allow marketplace checkout and paid flows to proceed for end users.',
  },
  {
    key: 'searchIndexingEnabled',
    label: 'Search indexing enabled',
    description: 'Keep marketplace and gym-search indexing jobs active for fresh discovery results.',
  },
  {
    key: 'cacheWarmupEnabled',
    label: 'Cache warmup enabled',
    description: 'Prime cache-heavy public experiences so traffic spikes do not hit cold reads first.',
  },
  {
    key: 'orderReturnsEnabled',
    label: 'Order returns enabled',
    description: 'Allow buyers to request returns and refunds from delivered marketplace orders.',
  },
  {
    key: 'gymModerationAlerts',
    label: 'Gym moderation alerts',
    description: 'Highlight suspicious listing activity for admin and manager review.',
  },
];

const AdminSettingsPage = () => {
  const {
    data: serverToggles,
    isLoading,
    isError,
    refetch,
  } = useGetAdminTogglesQuery();
  const [updateToggles, { isLoading: isSaving }] = useUpdateAdminTogglesMutation();

  const [localToggles, setLocalToggles] = useState({});
  const [status, setStatus] = useState(null);
  const persistedToggles = serverToggles?.toggles ?? {};

  useEffect(() => {
    setLocalToggles(persistedToggles);
  }, [persistedToggles]);

  const enabledCount = useMemo(
    () => TOGGLE_DEFINITIONS.filter(({ key }) => Boolean(localToggles?.[key])).length,
    [localToggles],
  );

  const handleToggleChange = (key) => {
    setLocalToggles((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
    setStatus(null);
  };

  const handleReset = () => {
    setLocalToggles(persistedToggles);
    setStatus(null);
  };

  const isDirty = useMemo(() => {
    if (!serverToggles?.toggles) {
      return false;
    }
    return TOGGLE_DEFINITIONS.some(({ key }) => Boolean(persistedToggles[key]) !== Boolean(localToggles[key]));
  }, [localToggles, persistedToggles, serverToggles?.toggles]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus(null);

    try {
      await updateToggles(localToggles).unwrap();
      setStatus({ type: 'success', message: 'Platform toggles updated successfully.' });
    } catch (error) {
      setStatus({
        type: 'error',
        message: error?.data?.message ?? 'Unable to update toggles right now.',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="dashboard-grid">
        <DashboardSection title="Platform toggles">
          <SkeletonPanel lines={8} />
        </DashboardSection>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="dashboard-grid">
        <DashboardSection
          title="Admin settings"
          action={(<button type="button" onClick={() => refetch()}>Retry</button>)}
        >
          <EmptyState message="We could not load the platform toggle settings." />
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="dashboard-grid">
      <DashboardSection
        title="Platform toggles"
        action={(
          <div className="button-row">
            <button type="button" onClick={handleReset} disabled={!isDirty || isSaving}>
              Reset
            </button>
            <button type="submit" form="admin-toggle-form" disabled={!isDirty || isSaving}>
              {isSaving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        )}
      >
        {status ? (
          <div className={`status-pill ${status.type === 'error' ? 'status-pill--warning' : 'status-pill--success'}`}>
            {status.message}
          </div>
        ) : null}

        <form id="admin-toggle-form" className="settings-toggle-list" onSubmit={handleSubmit}>
          {TOGGLE_DEFINITIONS.map(({ key, label, description }) => (
            <label key={key} className="settings-toggle">
              <div className="settings-toggle__meta">
                <span className="settings-toggle__label">{label}</span>
                <span className="settings-toggle__description">{description}</span>
              </div>
              <div className="settings-toggle__control">
                <input
                  type="checkbox"
                  checked={Boolean(localToggles?.[key])}
                  onChange={() => handleToggleChange(key)}
                />
                <span className="settings-toggle__switch" aria-hidden="true" />
              </div>
            </label>
          ))}
        </form>
      </DashboardSection>

      <DashboardSection title="Configuration history">
        <div className="stat-grid">
          <div className="stat-card">
            <small>Last updated</small>
            <strong>{serverToggles?.updatedAt ? formatDateTime(serverToggles.updatedAt) : 'Not updated yet'}</strong>
            <small>
              {serverToggles?.updatedBy?.name
                ? `${serverToggles.updatedBy.name}${serverToggles.updatedBy.email ? ` (${serverToggles.updatedBy.email})` : ''}`
                : 'No admin recorded'}
            </small>
          </div>
          <div className="stat-card">
            <small>Enabled toggles</small>
            <strong>{enabledCount} / {TOGGLE_DEFINITIONS.length}</strong>
            <small>Live configuration currently applied across the platform.</small>
          </div>
          <div className="stat-card">
            <small>Persistence</small>
            <strong>systemsettings</strong>
            <small>Changes are persisted with the acting admin for audit review.</small>
          </div>
        </div>
      </DashboardSection>
    </div>
  );
};

export default AdminSettingsPage;
