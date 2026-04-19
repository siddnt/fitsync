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

const BOOLEAN_SETTING_DEFINITIONS = [
  {
    key: 'marketplaceEnabled',
    label: 'Marketplace enabled',
    description: 'Controls whether the public marketplace is visible to end users.',
    type: 'boolean',
  },
  {
    key: 'autoApproveTrainers',
    label: 'Auto-approve trainers',
    description: 'Automatically activate trainer accounts after registration instead of manual review.',
    type: 'boolean',
  },
  {
    key: 'showBetaDashboards',
    label: 'Show beta dashboards',
    description: 'Expose experimental analytics views to internal roles for validation.',
    type: 'boolean',
  },
  {
    key: 'maintenanceMode',
    label: 'Maintenance mode',
    description: 'Temporarily pause member-facing activity while administrators perform platform maintenance.',
    type: 'boolean',
  },
  {
    key: 'supportInboxEnabled',
    label: 'Support inbox enabled',
    description: 'Keep the public support and contact intake available for new tickets.',
    type: 'boolean',
  },
  {
    key: 'paymentCheckoutEnabled',
    label: 'Payments enabled',
    description: 'Allow marketplace checkout and paid flows to proceed for end users.',
    type: 'boolean',
  },
  {
    key: 'searchIndexingEnabled',
    label: 'Search indexing enabled',
    description: 'Keep marketplace and gym-search indexing jobs active for fresh discovery results.',
    type: 'boolean',
  },
  {
    key: 'cacheWarmupEnabled',
    label: 'Cache warmup enabled',
    description: 'Prime cache-heavy public experiences so traffic spikes do not hit cold reads first.',
    type: 'boolean',
  },
  {
    key: 'orderReturnsEnabled',
    label: 'Order returns enabled',
    description: 'Allow buyers to request returns and refunds from delivered marketplace orders.',
    type: 'boolean',
  },
  {
    key: 'gymModerationAlerts',
    label: 'Gym moderation alerts',
    description: 'Highlight suspicious listing activity for admin and manager review.',
    type: 'boolean',
  },
];

const CONFIG_SETTING_DEFINITIONS = [
  {
    key: 'maintenanceBannerMessage',
    label: 'Maintenance banner message',
    description: 'Optional message shown when maintenance mode is enabled.',
    type: 'text',
    placeholder: 'Scheduled maintenance from 2:00 AM to 3:00 AM IST.',
  },
  {
    key: 'supportQueueWarningDepth',
    label: 'Support queue warning depth',
    description: 'Open-ticket count that should begin surfacing queue pressure alerts.',
    type: 'number',
    min: 1,
    step: 1,
  },
  {
    key: 'staleSupportTicketHours',
    label: 'Stale support ticket hours',
    description: 'Idle ticket age before ops highlights the support backlog.',
    type: 'number',
    min: 1,
    step: 1,
  },
  {
    key: 'shipmentBacklogHours',
    label: 'Shipment backlog hours',
    description: 'Processing-order age before seller fulfillment backlog is considered risky.',
    type: 'number',
    min: 1,
    step: 1,
  },
  {
    key: 'searchQueueWarningDepth',
    label: 'Search queue warning depth',
    description: 'Queued search-sync jobs allowed before a queue-depth alert is raised.',
    type: 'number',
    min: 1,
    step: 1,
  },
  {
    key: 'auditSpikeThreshold',
    label: 'Audit spike threshold',
    description: 'Audit events in the last 24 hours needed before the control center flags a spike.',
    type: 'number',
    min: 1,
    step: 1,
  },
  {
    key: 'returnWindowDays',
    label: 'Return window days',
    description: 'Default buyer return window surfaced across order and receipt flows.',
    type: 'number',
    min: 1,
    step: 1,
  },
  {
    key: 'listingHealthMinimumScore',
    label: 'Listing health minimum score',
    description: 'Recommended minimum listing-health target before merchandising pushes begin.',
    type: 'number',
    min: 1,
    max: 100,
    step: 1,
  },
];

const ALL_SETTING_DEFINITIONS = [...BOOLEAN_SETTING_DEFINITIONS, ...CONFIG_SETTING_DEFINITIONS];

const normalizeSettingValue = (definition, value) => {
  if (definition.type === 'boolean') {
    return Boolean(value);
  }

  if (definition.type === 'number') {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return definition.min ?? 0;
    }
    return parsed;
  }

  return String(value ?? '');
};

const AdminSettingsPage = () => {
  const {
    data: serverToggles,
    isLoading,
    isError,
    refetch,
  } = useGetAdminTogglesQuery();
  const [updateToggles, { isLoading: isSaving }] = useUpdateAdminTogglesMutation();

  const [localSettings, setLocalSettings] = useState({});
  const [status, setStatus] = useState(null);
  const persistedSettings = serverToggles?.toggles ?? {};

  useEffect(() => {
    setLocalSettings(persistedSettings);
  }, [persistedSettings]);

  const enabledCount = useMemo(
    () => BOOLEAN_SETTING_DEFINITIONS.filter(({ key }) => Boolean(localSettings?.[key])).length,
    [localSettings],
  );

  const configuredThresholdCount = useMemo(
    () => CONFIG_SETTING_DEFINITIONS.filter(({ key }) => localSettings?.[key] !== undefined && localSettings?.[key] !== '').length,
    [localSettings],
  );

  const handleFieldChange = (key, value) => {
    setLocalSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
    setStatus(null);
  };

  const handleReset = () => {
    setLocalSettings(persistedSettings);
    setStatus(null);
  };

  const isDirty = useMemo(() => {
    if (!serverToggles?.toggles) {
      return false;
    }

    return ALL_SETTING_DEFINITIONS.some((definition) => (
      normalizeSettingValue(definition, persistedSettings?.[definition.key])
      !== normalizeSettingValue(definition, localSettings?.[definition.key])
    ));
  }, [localSettings, persistedSettings, serverToggles?.toggles]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus(null);

    const payload = ALL_SETTING_DEFINITIONS.reduce((accumulator, definition) => {
      accumulator[definition.key] = normalizeSettingValue(definition, localSettings?.[definition.key]);
      return accumulator;
    }, {});

    try {
      await updateToggles(payload).unwrap();
      setStatus({ type: 'success', message: 'Platform controls updated successfully.' });
    } catch (error) {
      setStatus({
        type: 'error',
        message: error?.data?.message ?? 'Unable to update controls right now.',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="dashboard-grid">
        <DashboardSection title="Platform controls">
          <SkeletonPanel lines={10} />
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
          <EmptyState message="We could not load the platform settings." />
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="dashboard-grid">
      <DashboardSection
        title="Platform controls"
        action={(
          <div className="button-row">
            <button type="button" onClick={handleReset} disabled={!isDirty || isSaving}>
              Reset
            </button>
            <button type="submit" form="admin-settings-form" disabled={!isDirty || isSaving}>
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

        <form id="admin-settings-form" className="settings-layout" onSubmit={handleSubmit}>
          <div className="settings-section">
            <div className="settings-section__header">
              <h4>Availability switches</h4>
              <p>Core on or off controls for the public product, intake, and platform workflows.</p>
            </div>
            <div className="settings-toggle-list">
              {BOOLEAN_SETTING_DEFINITIONS.map(({ key, label, description }) => (
                <label key={key} className="settings-toggle">
                  <div className="settings-toggle__meta">
                    <span className="settings-toggle__label">{label}</span>
                    <span className="settings-toggle__description">{description}</span>
                  </div>
                  <div className="settings-toggle__control">
                    <input
                      type="checkbox"
                      checked={Boolean(localSettings?.[key])}
                      onChange={() => handleFieldChange(key, !localSettings?.[key])}
                    />
                    <span className="settings-toggle__switch" aria-hidden="true" />
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="settings-section">
            <div className="settings-section__header">
              <h4>Operational thresholds</h4>
              <p>These values drive backlog warnings, audit spikes, listing-health expectations, and buyer policy cues.</p>
            </div>
            <div className="settings-field-list">
              {CONFIG_SETTING_DEFINITIONS.map((definition) => (
                <label key={definition.key} className="settings-field">
                  <span className="settings-field__label">{definition.label}</span>
                  <span className="settings-field__description">{definition.description}</span>
                  {definition.type === 'text' ? (
                    <textarea
                      className="settings-field__input settings-field__input--textarea"
                      value={String(localSettings?.[definition.key] ?? '')}
                      onChange={(event) => handleFieldChange(definition.key, event.target.value)}
                      placeholder={definition.placeholder}
                      rows={3}
                    />
                  ) : (
                    <input
                      className="settings-field__input"
                      type="number"
                      value={Number.isFinite(Number(localSettings?.[definition.key]))
                        ? Number(localSettings?.[definition.key])
                        : definition.min ?? 0}
                      min={definition.min}
                      max={definition.max}
                      step={definition.step}
                      onChange={(event) => handleFieldChange(definition.key, event.target.value)}
                    />
                  )}
                </label>
              ))}
            </div>
          </div>
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
            <small>Enabled switches</small>
            <strong>{enabledCount} / {BOOLEAN_SETTING_DEFINITIONS.length}</strong>
            <small>Availability controls currently active across the platform.</small>
          </div>
          <div className="stat-card">
            <small>Configured thresholds</small>
            <strong>{configuredThresholdCount} / {CONFIG_SETTING_DEFINITIONS.length}</strong>
            <small>Non-boolean operational controls persisted with audit attribution.</small>
          </div>
          <div className="stat-card">
            <small>Persistence</small>
            <strong>systemsettings</strong>
            <small>Thresholds, messages, and switches are stored for ops and audit review.</small>
          </div>
        </div>
      </DashboardSection>
    </div>
  );
};

export default AdminSettingsPage;
