import { useEffect, useMemo, useState } from 'react';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import {
  useGetAdminTogglesQuery,
  useUpdateAdminTogglesMutation,
} from '../../../services/adminApi.js';
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

  useEffect(() => {
    if (serverToggles) {
      setLocalToggles(serverToggles);
    }
  }, [serverToggles]);

  const handleToggleChange = (key) => {
    setLocalToggles((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
    setStatus(null);
  };

  const handleReset = () => {
    setLocalToggles(serverToggles ?? {});
    setStatus(null);
  };

  const isDirty = useMemo(() => {
    if (!serverToggles) {
      return false;
    }
    return TOGGLE_DEFINITIONS.some(({ key }) => Boolean(serverToggles[key]) !== Boolean(localToggles[key]));
  }, [localToggles, serverToggles]);

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
              {isSaving ? 'Saving…' : 'Save changes'}
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

      <DashboardSection title="Audit trail guidance">
        <p className="empty-state">
          Toggle changes are stored in the <code>systemsettings</code> collection with the acting admin&apos;s ID.
          Ensure production deployments include a backup of this collection before mass updates.
        </p>
      </DashboardSection>
    </div>
  );
};

export default AdminSettingsPage;
