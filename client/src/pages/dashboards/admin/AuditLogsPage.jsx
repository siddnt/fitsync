import { useMemo, useState } from 'react';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import { useGetAuditLogsQuery } from '../../../services/adminApi.js';
import { formatDateTime, formatStatus } from '../../../utils/format.js';
import SearchSuggestInput from '../../../components/dashboard/SearchSuggestInput.jsx';
import { matchesPrefix, matchesAcrossFields } from '../../../utils/search.js';
import '../Dashboard.css';

const DEFAULT_LIMIT = 50;

const AuditLogsPage = () => {
  const [actionFilter, setActionFilter] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [limit, setLimit] = useState(DEFAULT_LIMIT);

  const queryParams = useMemo(() => ({
    action: actionFilter || undefined,
    entityType: entityTypeFilter || undefined,
    limit,
  }), [actionFilter, entityTypeFilter, limit]);

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
          </div>
        )}
      >
        {filteredLogs.length ? (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Actor</th>
                <th>Summary</th>
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
                  </td>
                  <td>
                    <strong>{log.summary ?? 'Audit event recorded'}</strong>
                    {log.metadata ? (
                      <div className="dashboard-table__meta">
                        {Object.entries(log.metadata)
                          .slice(0, 3)
                          .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`)
                          .join(' • ')}
                      </div>
                    ) : null}
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
    </div>
  );
};

export default AuditLogsPage;
