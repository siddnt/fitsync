import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import { useGetAdminOpsQuery } from '../../../services/dashboardApi.js';
import { formatDateTime, formatNumber, formatStatus } from '../../../utils/format.js';
import '../Dashboard.css';

const getSeverityTone = (severity) => {
  const normalized = String(severity || '').toLowerCase();
  if (normalized === 'critical') {
    return 'warning';
  }
  if (normalized === 'warning') {
    return 'info';
  }
  return 'success';
};

const OpsPage = () => {
  const { data, isLoading, isError, refetch } = useGetAdminOpsQuery();

  const ops = data?.data ?? null;
  const alerts = Array.isArray(ops?.alerts) ? ops.alerts : [];
  const recentAudit = Array.isArray(ops?.audit?.recent) ? ops.audit.recent : [];
  const topRoutes = Array.isArray(ops?.services?.requests?.topRoutes) ? ops.services.requests.topRoutes : [];
  const topOperations = Array.isArray(ops?.services?.queries?.topOperations) ? ops.services.queries.topOperations : [];
  const slowSamples = Array.isArray(ops?.services?.queries?.slowSamples) ? ops.services.queries.slowSamples : [];
  const backlog = ops?.backlog ?? {};
  const services = ops?.services ?? {};

  if (isLoading) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked">
        {['Ops status', 'Alerts', 'Traffic and query health', 'Audit pulse'].map((section) => (
          <DashboardSection key={section} title={section}>
            <SkeletonPanel lines={7} />
          </DashboardSection>
        ))}
      </div>
    );
  }

  if (isError || !ops) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked">
        <DashboardSection
          title="System ops"
          action={(
            <button type="button" onClick={() => refetch()}>
              Retry
            </button>
          )}
        >
          <EmptyState message="We could not load platform ops status right now." />
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="dashboard-grid dashboard-grid--stacked">
      <DashboardSection
        title="System ops"
        action={(
          <button type="button" onClick={() => refetch()}>
            Refresh
          </button>
        )}
      >
        <div className="stat-grid">
          <div className="stat-card">
            <small>Uptime</small>
            <strong>{formatNumber(services.uptimeHours ?? 0)} hrs</strong>
            <small>Snapshot {formatDateTime(ops.generatedAt)}</small>
          </div>
          <div className="stat-card">
            <small>Cache provider</small>
            <strong>{formatStatus(services.cache?.provider ?? 'unknown')}</strong>
            <small>{services.cache?.redisConfigured ? 'Redis configured' : 'Memory only'}</small>
          </div>
          <div className="stat-card">
            <small>Search</small>
            <strong>{services.search?.ready ? 'Ready' : 'Degraded'}</strong>
            <small>Queue depth {formatNumber(services.search?.queue?.depth ?? 0)}</small>
          </div>
          <div className="stat-card">
            <small>Open support tickets</small>
            <strong>{formatNumber(backlog.openSupportTickets ?? 0)}</strong>
            <small>{formatNumber(backlog.staleSupportTickets ?? 0)} stale over 24h</small>
          </div>
          <div className="stat-card">
            <small>Pending bookings</small>
            <strong>{formatNumber(backlog.pendingBookings ?? 0)}</strong>
            <small>{formatNumber(backlog.todaysBookings ?? 0)} sessions scheduled today</small>
          </div>
          <div className="stat-card">
            <small>Shipment backlog</small>
            <strong>{formatNumber(backlog.sellerShipmentBacklog ?? 0)}</strong>
            <small>{formatNumber(backlog.pendingReturnRequests ?? 0)} return requests pending</small>
          </div>
        </div>
      </DashboardSection>

      <DashboardSection title="Ops alerts">
        {alerts.length ? (
          <div className="dashboard-list">
            {alerts.map((alert) => (
              <div key={alert.id} className="dashboard-list__item">
                <div>
                  <small>{formatStatus(alert.severity)}</small>
                  <strong>{alert.title}</strong>
                  <div className="dashboard-table__meta">{alert.message}</div>
                </div>
                <div className="dashboard-list__meta">
                  <span className={`status-pill status-pill--${getSeverityTone(alert.severity)}`}>
                    {formatStatus(alert.severity)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="status-pill status-pill--success">
            No active ops alerts. Cache, search, and backlog signals are healthy.
          </div>
        )}
      </DashboardSection>

      <DashboardSection title="Traffic and query health">
        <div className="details-grid">
          <div className="detail-card">
            <h4>HTTP traffic</h4>
            <div className="detail-row">
              <span className="detail-label">Requests tracked</span>
              <div className="detail-value">{formatNumber(services.requests?.total ?? 0)}</div>
            </div>
            <div className="detail-row">
              <span className="detail-label">Average duration</span>
              <div className="detail-value">{formatNumber(services.requests?.averageDurationMs ?? 0)} ms</div>
            </div>
            <div className="detail-row">
              <span className="detail-label">Max duration</span>
              <div className="detail-value">{formatNumber(services.requests?.maxDurationMs ?? 0)} ms</div>
            </div>
            {topRoutes.length ? (
              <div className="dashboard-list">
                {topRoutes.map((route) => (
                  <div key={route.route} className="dashboard-list__item">
                    <div>
                      <small>Top route</small>
                      <strong>{route.route}</strong>
                    </div>
                    <div className="dashboard-list__meta">
                      <strong>{formatNumber(route.count)}</strong>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="dashboard-table__meta">No request metrics captured yet.</p>
            )}
          </div>

          <div className="detail-card">
            <h4>Query performance</h4>
            <div className="detail-row">
              <span className="detail-label">Queries tracked</span>
              <div className="detail-value">{formatNumber(services.queries?.total ?? 0)}</div>
            </div>
            <div className="detail-row">
              <span className="detail-label">Average duration</span>
              <div className="detail-value">{formatNumber(services.queries?.averageDurationMs ?? 0)} ms</div>
            </div>
            <div className="detail-row">
              <span className="detail-label">Max duration</span>
              <div className="detail-value">{formatNumber(services.queries?.maxDurationMs ?? 0)} ms</div>
            </div>
            {topOperations.length ? (
              <div className="dashboard-list">
                {topOperations.map((operation) => (
                  <div key={operation.operation} className="dashboard-list__item">
                    <div>
                      <small>Top query op</small>
                      <strong>{operation.operation}</strong>
                    </div>
                    <div className="dashboard-list__meta">
                      <strong>{formatNumber(operation.count)}</strong>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="dashboard-table__meta">No query metrics captured yet.</p>
            )}
          </div>
        </div>

        <div className="dashboard-section__body" style={{ paddingLeft: 0, paddingRight: 0, paddingBottom: 0 }}>
          <h4 style={{ marginBottom: '0.75rem' }}>Slow query samples</h4>
          {slowSamples.length ? (
            <div className="dashboard-table-wrap">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Recorded</th>
                    <th>Collection</th>
                    <th>Operation</th>
                    <th>Duration</th>
                    <th>Payload</th>
                  </tr>
                </thead>
                <tbody>
                  {slowSamples.slice(0, 6).map((sample, index) => (
                    <tr key={`${sample.recordedAt}-${index}`}>
                      <td>{formatDateTime(sample.recordedAt)}</td>
                      <td>{sample.collection || sample.model || '-'}</td>
                      <td>{formatStatus(sample.operation || 'query')}</td>
                      <td>{formatNumber(sample.durationMs ?? 0)} ms</td>
                      <td>{sample.payload || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="dashboard-table__meta">No slow query samples are currently recorded.</p>
          )}
        </div>
      </DashboardSection>

      <DashboardSection title="Audit pulse">
        <div className="stat-grid">
          <div className="stat-card">
            <small>Last 24 hours</small>
            <strong>{formatNumber(ops.audit?.last24Hours ?? 0)}</strong>
            <small>Audit events captured</small>
          </div>
          <div className="stat-card">
            <small>Previous 24 hours</small>
            <strong>{formatNumber(ops.audit?.previous24Hours ?? 0)}</strong>
            <small>Previous comparison window</small>
          </div>
          <div className="stat-card">
            <small>Audit delta</small>
            <strong>{formatNumber(ops.audit?.delta ?? 0)}</strong>
            <small>Positive means activity increased</small>
          </div>
          <div className="stat-card">
            <small>HTTP cache hits</small>
            <strong>{formatNumber(services.httpCache?.freshResponses ?? 0)}</strong>
            <small>{formatNumber(services.httpCache?.notModifiedResponses ?? 0)} not modified</small>
          </div>
        </div>

        {recentAudit.length ? (
          <div className="dashboard-table-wrap">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Actor</th>
                  <th>Summary</th>
                </tr>
              </thead>
              <tbody>
                {recentAudit.map((log) => (
                  <tr key={log.id}>
                    <td>{formatDateTime(log.createdAt)}</td>
                    <td>{formatStatus(log.action)}</td>
                    <td>{`${formatStatus(log.entityType)} ${log.entityId}`}</td>
                    <td>{log.actor?.name || log.actor?.email || '-'}</td>
                    <td>{log.summary || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState message="No recent audit activity was returned." />
        )}
      </DashboardSection>
    </div>
  );
};

export default OpsPage;
