import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import { useAppSelector } from '../../../app/hooks.js';
import { useGetAuditLogsQuery } from '../../../services/adminApi.js';
import { downloadReport } from '../../../utils/reportDownload.js';
import { formatDateTime, formatStatus } from '../../../utils/format.js';
import SearchSuggestInput from '../../../components/dashboard/SearchSuggestInput.jsx';
import { matchesPrefix, matchesAcrossFields } from '../../../utils/search.js';
import '../Dashboard.css';

const DEFAULT_LIMIT = 50;

const stringifyMetadataValue = (value) => {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  return String(value);
};

const buildRelatedLinks = (log) => {
  const links = [];
  const metadata = log?.metadata ?? {};
  const entityType = String(log?.entityType ?? '').toLowerCase();
  const entityId = String(log?.entityId ?? '').trim();

  if (entityType === 'user' && entityId) {
    links.push({ id: `entity-user-${entityId}`, label: 'Open user', to: `/dashboard/admin/users/${entityId}` });
  }

  if (entityType === 'gym' && entityId) {
    links.push({ id: `entity-gym-${entityId}`, label: 'Open gym', to: `/dashboard/admin/gyms/${entityId}` });
  }

  if (entityType.includes('order') && entityId) {
    links.push({ id: `entity-order-${entityId}`, label: 'Find order', to: `/dashboard/admin/marketplace?search=${encodeURIComponent(entityId)}` });
  }

  const gymId = metadata.gymId ?? metadata.gym;
  if (gymId) {
    links.push({ id: `meta-gym-${gymId}`, label: 'Related gym', to: `/dashboard/admin/gyms/${gymId}` });
  }

  const orderId = metadata.orderId ?? metadata.paymentReference;
  if (orderId) {
    links.push({ id: `meta-order-${orderId}`, label: 'Related order', to: `/dashboard/admin/marketplace?search=${encodeURIComponent(orderId)}` });
  }

  const userId = metadata.userId ?? metadata.traineeId ?? metadata.trainerId ?? metadata.recipientId;
  if (userId) {
    links.push({ id: `meta-user-${userId}`, label: 'Related user', to: `/dashboard/admin/users/${userId}` });
  }

  return links;
};

const buildEntitySummary = (log) => {
  const metadata = log?.metadata ?? {};
  return [
    log?.entityType ? formatStatus(log.entityType) : null,
    log?.entityId || metadata.targetId || metadata.resourceId || null,
  ].filter(Boolean).join(' | ') || 'System entity';
};

const buildRequestMetadata = (log) => {
  const metadata = log?.metadata ?? {};
  return [
    metadata.paymentReference ? `Payment ref: ${metadata.paymentReference}` : null,
    metadata.targetId ? `Target: ${metadata.targetId}` : null,
    metadata.source || metadata.strategy ? `Source: ${metadata.source ?? metadata.strategy}` : null,
  ].filter(Boolean);
};

const AuditLogsPage = () => {
  const [actionFilter, setActionFilter] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [reportFormat, setReportFormat] = useState('csv');
  const [isExporting, setIsExporting] = useState(false);
  const [reportNotice, setReportNotice] = useState(null);
  const [reportError, setReportError] = useState(null);
  const [activeLogId, setActiveLogId] = useState('');
  const accessToken = useAppSelector((state) => state.auth.accessToken);

  const queryParams = useMemo(() => ({
    action: actionFilter || undefined,
    entityType: entityTypeFilter || undefined,
    search: searchTerm.trim() || undefined,
    limit,
  }), [actionFilter, entityTypeFilter, searchTerm, limit]);

  const { data, isLoading, isError, refetch } = useGetAuditLogsQuery(queryParams);
  const logs = data?.data?.logs ?? [];

  const actionOptions = useMemo(() => {
    const values = [...new Set(logs.map((log) => log.action).filter(Boolean))];
    return ['all', ...values];
  }, [logs]);

  const entityTypeOptions = useMemo(() => {
    const values = [...new Set(logs.map((log) => log.entityType).filter(Boolean))];
    return ['all', ...values];
  }, [logs]);

  const filteredLogs = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return logs;
    }

    return logs.filter((log) => {
      const haystacks = [
        log.summary,
        log.action,
        log.entityType,
        log.entityId,
        log.actor?.name,
        log.actor?.email,
      ]
        .filter(Boolean)
        .map((value) => value.toString().toLowerCase());

      return matchesAcrossFields(haystacks, query);
    });
  }, [logs, searchTerm]);

  const activeLog = useMemo(
    () => filteredLogs.find((log) => String(log._id) === String(activeLogId)) ?? null,
    [activeLogId, filteredLogs],
  );

  const searchSuggestions = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return [];
    }

    const suggestions = [];
    const seen = new Set();

    logs.forEach((log) => {
      [
        {
          value: log.actor?.name,
          meta: `Actor • ${log.actor?.email ?? log.actorRole ?? 'System'}`,
        },
        {
          value: log.action,
          meta: `Action • ${formatStatus(log.entityType)}`,
        },
      ].forEach((entry, index) => {
        const normalized = entry.value?.toString().trim();
        if (!normalized) {
          return;
        }
        const lower = normalized.toLowerCase();
        if (!matchesPrefix(lower, query)) {
          return;
        }
        const key = `${index}:${lower}`;
        if (seen.has(key)) {
          return;
        }
        seen.add(key);
        suggestions.push({
          id: key,
          label: normalized,
          meta: entry.meta,
        });
      });
    });

    return suggestions;
  }, [logs, searchTerm]);

  const filtersActive = Boolean(searchTerm.trim() || actionFilter || entityTypeFilter || limit !== DEFAULT_LIMIT);

  const resetFilters = () => {
    setActionFilter('');
    setEntityTypeFilter('');
    setSearchTerm('');
    setLimit(DEFAULT_LIMIT);
  };

  const handleExportAuditLogs = async () => {
    setReportNotice(null);
    setReportError(null);
    setIsExporting(true);

    try {
      await downloadReport({
        path: '/admin/audit-logs/export',
        token: accessToken,
        format: reportFormat,
        params: {
          action: actionFilter || undefined,
          entityType: entityTypeFilter || undefined,
          search: searchTerm.trim() || undefined,
          limit,
        },
        fallbackFilename: `audit-log-report.${reportFormat}`,
      });
      setReportNotice(`Audit log report exported as ${reportFormat.toUpperCase()}.`);
    } catch (error) {
      setReportError(error.message || 'Unable to export audit log report.');
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="dashboard-grid dashboard-grid--admin">
        <DashboardSection title="Audit log history" className="dashboard-section--span-12">
          <SkeletonPanel lines={10} />
        </DashboardSection>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="dashboard-grid dashboard-grid--admin">
        <DashboardSection
          title="Audit log history"
          className="dashboard-section--span-12"
          action={(
            <button type="button" onClick={() => refetch()}>
              Retry
            </button>
          )}
        >
          <EmptyState message="We could not load the audit trail." />
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="dashboard-grid dashboard-grid--admin">
      <DashboardSection
        title="Audit log history"
        className="dashboard-section--span-12"
        action={(
          <div className="users-toolbar">
            <SearchSuggestInput
              id="audit-log-search"
              value={searchTerm}
              onChange={setSearchTerm}
              onSelect={(suggestion) => setSearchTerm(suggestion.label)}
              suggestions={searchSuggestions}
              placeholder="Search by actor name or action"
              ariaLabel="Search audit logs"
              noResultsText="No audit logs match those search attributes."
            />
            <select
              className="inventory-toolbar__input inventory-toolbar__input--select"
              value={actionFilter || 'all'}
              onChange={(event) => setActionFilter(event.target.value === 'all' ? '' : event.target.value)}
              aria-label="Filter by action"
            >
              {actionOptions.map((option) => (
                <option key={option} value={option}>
                  {option === 'all' ? 'All actions' : formatStatus(option)}
                </option>
              ))}
            </select>
            <select
              className="inventory-toolbar__input inventory-toolbar__input--select"
              value={entityTypeFilter || 'all'}
              onChange={(event) => setEntityTypeFilter(event.target.value === 'all' ? '' : event.target.value)}
              aria-label="Filter by entity type"
            >
              {entityTypeOptions.map((option) => (
                <option key={option} value={option}>
                  {option === 'all' ? 'All entities' : formatStatus(option)}
                </option>
              ))}
            </select>
            <select
              className="inventory-toolbar__input inventory-toolbar__input--select"
              value={limit}
              onChange={(event) => setLimit(Number(event.target.value))}
              aria-label="Audit log limit"
            >
              <option value={25}>25 rows</option>
              <option value={50}>50 rows</option>
              <option value={100}>100 rows</option>
              <option value={200}>200 rows</option>
            </select>
            {filtersActive ? (
              <button type="button" className="users-toolbar__reset" onClick={resetFilters}>
                Reset
              </button>
            ) : null}
            <button type="button" className="users-toolbar__refresh" onClick={() => refetch()}>
              Refresh
            </button>
            <select
              className="inventory-toolbar__input inventory-toolbar__input--select"
              value={reportFormat}
              onChange={(event) => setReportFormat(event.target.value)}
              aria-label="Audit export format"
            >
              <option value="csv">CSV</option>
              <option value="pdf">PDF</option>
            </select>
            <button
              type="button"
              className="users-toolbar__refresh"
              disabled={isExporting}
              onClick={handleExportAuditLogs}
            >
              {isExporting ? 'Exporting...' : 'Export'}
            </button>
          </div>
        )}
      >
        {reportNotice ? <p className="dashboard-message dashboard-message--success">{reportNotice}</p> : null}
        {reportError ? <p className="dashboard-message dashboard-message--error">{reportError}</p> : null}
        {filteredLogs.length ? (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Actor</th>
                <th>Summary</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr key={log._id}>
                  <td>
                    <strong>{formatDateTime(log.createdAt)}</strong>
                  </td>
                  <td>{formatStatus(log.action)}</td>
                  <td>
                    <strong>{formatStatus(log.entityType)}</strong>
                    <div>
                      <small>{log.entityId}</small>
                    </div>
                  </td>
                  <td>
                    {log.actor?.name ?? 'System'}
                    <div>
                      <small>{log.actor?.email ?? log.actorRole ?? '-'}</small>
                    </div>
                    <div className="dashboard-table__meta">
                      <span className="status-pill status-pill--info">{log.actorRole ?? 'system'}</span>
                    </div>
                  </td>
                  <td>
                    <strong>{log.summary ?? 'Audit event recorded'}</strong>
                    <div className="dashboard-table__meta">{buildEntitySummary(log)}</div>
                    {log.metadata ? (
                      <div className="dashboard-table__meta">
                        {Object.entries(log.metadata)
                          .slice(0, 3)
                          .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`)
                          .join(' | ')}
                      </div>
                    ) : null}
                  </td>
                  <td>
                    <button type="button" className="order-item-card__action" onClick={() => setActiveLogId(log._id)}>
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState
            message={
              filtersActive
                ? 'No audit logs match the current filters.'
                : 'Audit events will appear here as admins and background workflows make changes.'
            }
          />
        )}
      </DashboardSection>

      {activeLog ? (
        <div className="dashboard-overlay" role="dialog" aria-modal="true" onClick={(event) => {
          if (event.target === event.currentTarget) {
            setActiveLogId('');
          }
        }}>
          <div className="dashboard-overlay__panel">
            <DashboardSection
              title="Audit event details"
              className="dashboard-section--overlay"
              action={<button type="button" className="ghost-button" onClick={() => setActiveLogId('')}>Close</button>}
            >
              <div className="owner-roster-detail">
                <div className="owner-roster-detail__grid">
                  <div className="owner-roster-detail__card">
                    <small>Action</small>
                    <strong>{formatStatus(activeLog.action)}</strong>
                    <p>{activeLog.summary ?? 'Audit event recorded'}</p>
                  </div>
                  <div className="owner-roster-detail__card">
                    <small>Recorded at</small>
                    <strong>{formatDateTime(activeLog.createdAt)}</strong>
                    <p>{activeLog.actor?.name ?? activeLog.actorRole ?? 'System'}</p>
                    <span className="status-pill status-pill--info">{activeLog.actorRole ?? 'system'}</span>
                  </div>
                  <div className="owner-roster-detail__card">
                    <small>Entity</small>
                    <strong>{formatStatus(activeLog.entityType)}</strong>
                    <p>{buildEntitySummary(activeLog)}</p>
                  </div>
                </div>

                <div className="owner-roster-detail__panel">
                  <h4>Request metadata</h4>
                  {buildRequestMetadata(activeLog).length ? (
                    <div className="admin-audit-log__links">
                      {buildRequestMetadata(activeLog).map((entry) => (
                        <span key={entry} className="status-pill status-pill--info">{entry}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">No request metadata was captured for this event.</p>
                  )}
                </div>

                <div className="owner-roster-detail__panel">
                  <h4>Related links</h4>
                  {buildRelatedLinks(activeLog).length ? (
                    <div className="admin-audit-log__links">
                      {buildRelatedLinks(activeLog).map((link) => (
                        <Link key={link.id} to={link.to}>{link.label}</Link>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">No related entity links were derived for this event.</p>
                  )}
                </div>

                <div className="owner-roster-detail__panel">
                  <h4>Metadata</h4>
                  {activeLog.metadata && Object.keys(activeLog.metadata).length ? (
                    <div className="admin-audit-log__metadata">
                      {Object.entries(activeLog.metadata).map(([key, value]) => (
                        <div key={key} className="admin-audit-log__metadata-row">
                          <span>{key}</span>
                          <pre>{stringifyMetadataValue(value)}</pre>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">No metadata was recorded for this event.</p>
                  )}
                </div>
              </div>
            </DashboardSection>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AuditLogsPage;
