import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardSection from './components/DashboardSection.jsx';
import DemographicsSummary from './components/DemographicsSummary.jsx';
import NotificationsPanel from './components/NotificationsPanel.jsx';
import SkeletonPanel from '../../ui/SkeletonPanel.jsx';
import EmptyState from './components/EmptyState.jsx';
import {
  useGetAdminOverviewQuery,
  useGetAdminRevenueQuery,
  useGetAdminMarketplaceQuery,
  useGetAdminInsightsQuery,
  useGetAdminGymsQuery,
} from '../../services/dashboardApi.js';
import { useGetContactMessagesQuery } from '../../services/contactApi.js';
import { useGetAuditLogsQuery, useGetAdminTogglesQuery } from '../../services/adminApi.js';
import { formatCurrency, formatNumber, formatDate, formatStatus } from '../../utils/format.js';
import './Dashboard.css';

const OPEN_TICKET_STATUSES = new Set(['new', 'read', 'in-progress', 'responded']);

const formatQuickCount = (value, isLoading) => (isLoading ? '...' : formatNumber(value ?? 0));

const AdminDashboard = () => {
  const [timeframe, setTimeframe] = useState('weekly');
  const {
    data: overviewResponse,
    isLoading: isOverviewLoading,
    isError: isOverviewError,
    refetch: refetchOverview,
  } = useGetAdminOverviewQuery();
  const {
    data: revenueResponse,
    isLoading: isRevenueLoading,
    isError: isRevenueError,
    refetch: refetchRevenue,
  } = useGetAdminRevenueQuery();
  const {
    data: marketplaceResponse,
    isLoading: isMarketplaceLoading,
    isError: isMarketplaceError,
    refetch: refetchMarketplace,
  } = useGetAdminMarketplaceQuery();
  const {
    data: insightsResponse,
    isLoading: isInsightsLoading,
    isError: isInsightsError,
    refetch: refetchInsights,
  } = useGetAdminInsightsQuery();
  const {
    data: gymsResponse,
    isFetching: isGymsFetching,
  } = useGetAdminGymsQuery();
  const {
    data: contactsResponse,
    isFetching: isContactsFetching,
  } = useGetContactMessagesQuery();
  const {
    data: auditResponse,
    isFetching: isAuditFetching,
  } = useGetAuditLogsQuery({ limit: 100 });
  const {
    data: settingsState,
  } = useGetAdminTogglesQuery();

  const overview = overviewResponse?.data;
  const rawRevenueTrend = revenueResponse?.data?.trend;
  const recentOrders = marketplaceResponse?.data?.orders ?? [];
  const insights = insightsResponse?.data;
  const gyms = gymsResponse?.data?.gyms ?? [];
  const contactMessages = contactsResponse?.data ?? [];
  const auditLogs = auditResponse?.data?.logs ?? [];
  const adminSettings = settingsState?.toggles ?? {};

  const revenueSeries = useMemo(() => {
    if (!rawRevenueTrend) {
      return [];
    }
    return Array.isArray(rawRevenueTrend[timeframe]) ? rawRevenueTrend[timeframe] : [];
  }, [rawRevenueTrend, timeframe]);

  const demographics = insights?.demographics ?? { gender: [], ageBuckets: [] };
  const notifications = insights?.notifications ?? [];

  const isLoading = isOverviewLoading || isRevenueLoading || isMarketplaceLoading || isInsightsLoading;
  const hasError = isOverviewError || isRevenueError || isMarketplaceError || isInsightsError;

  const totalUsers = useMemo(() => {
    if (!overview?.users) {
      return 0;
    }
    return (overview.users.trainer || 0) + (overview.users.trainee || 0) + (overview.users['gym-owner'] || 0);
  }, [overview?.users]);

  const pendingTickets = useMemo(
    () => contactMessages.filter((message) => OPEN_TICKET_STATUSES.has(String(message?.status ?? 'new').toLowerCase())).length,
    [contactMessages],
  );

  const flaggedGyms = useMemo(
    () => gyms.filter((gym) => !gym?.isPublished || String(gym?.status ?? '').toLowerCase() !== 'active').length,
    [gyms],
  );

  const auditSpikeSummary = useMemo(() => {
    const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
    const recentLogs = auditLogs.filter((log) => {
      const timestamp = new Date(log?.createdAt ?? 0).getTime();
      return timestamp && timestamp >= twentyFourHoursAgo;
    });

    const actionCounts = recentLogs.reduce((accumulator, log) => {
      const action = log?.action || 'unknown';
      accumulator[action] = (accumulator[action] ?? 0) + 1;
      return accumulator;
    }, {});

    const dominantAction = Object.entries(actionCounts).reduce((best, entry) => {
      if (!best || entry[1] > best[1]) {
        return entry;
      }
      return best;
    }, null);

    return {
      count: recentLogs.length,
      dominantAction: dominantAction?.[0] ?? '',
      dominantCount: dominantAction?.[1] ?? 0,
    };
  }, [auditLogs]);

  const recentOrderSummary = useMemo(() => ({
    count: recentOrders.length,
    latestAt: recentOrders[0]?.createdAt ?? null,
  }), [recentOrders]);

  const controlAlerts = useMemo(() => {
    const alerts = [];
    const supportQueueWarningDepth = Math.max(1, Number(adminSettings?.supportQueueWarningDepth) || 5);
    const auditSpikeThreshold = Math.max(1, Number(adminSettings?.auditSpikeThreshold) || 10);

    if (adminSettings?.maintenanceMode) {
      alerts.push({
        id: 'maintenance',
        severity: 'critical',
        title: 'Maintenance mode enabled',
        message: adminSettings?.maintenanceBannerMessage
          ? `Banner: ${adminSettings.maintenanceBannerMessage}`
          : 'Public-facing activity is intentionally constrained while maintenance mode is on.',
        to: '/dashboard/admin/settings',
      });
    }

    if (adminSettings?.paymentCheckoutEnabled === false) {
      alerts.push({
        id: 'payments-disabled',
        severity: 'critical',
        title: 'Checkout disabled',
        message: 'Marketplace checkout is currently disabled for end users.',
        to: '/dashboard/admin/settings',
      });
    }

    if (adminSettings?.supportInboxEnabled === false) {
      alerts.push({
        id: 'support-disabled',
        severity: 'warning',
        title: 'Support intake paused',
        message: 'The public contact form is disabled. New tickets will not enter the queue.',
        to: '/dashboard/admin/settings',
      });
    }

    if (pendingTickets >= supportQueueWarningDepth) {
      alerts.push({
        id: 'ticket-backlog',
        severity: 'warning',
        title: 'Support queue above warning depth',
        message: `${formatNumber(pendingTickets)} active tickets are open against a warning depth of ${formatNumber(supportQueueWarningDepth)}.`,
        to: '/dashboard/admin/messages',
      });
    }

    if (flaggedGyms > 0 && adminSettings?.gymModerationAlerts !== false) {
      alerts.push({
        id: 'flagged-gyms',
        severity: 'warning',
        title: 'Flagged gyms need review',
        message: `${formatNumber(flaggedGyms)} gyms are draft, suspended, or unpublished.`,
        to: '/dashboard/admin/gyms',
      });
    }

    if (auditSpikeSummary.count >= auditSpikeThreshold) {
      alerts.push({
        id: 'audit-spike',
        severity: 'info',
        title: 'Audit activity spike',
        message: `${formatNumber(auditSpikeSummary.count)} logs were recorded in the last 24 hours. Dominant action: ${auditSpikeSummary.dominantAction ? formatStatus(auditSpikeSummary.dominantAction) : 'Unknown'}.`,
        to: '/dashboard/admin/audit-logs',
      });
    }

    if (!recentOrderSummary.count) {
      alerts.push({
        id: 'marketplace-quiet',
        severity: 'info',
        title: 'Marketplace activity is quiet',
        message: 'No recent marketplace orders were returned in the current dashboard snapshot.',
        to: '/dashboard/admin/marketplace',
      });
    }

    return alerts.slice(0, 4);
  }, [
    adminSettings?.auditSpikeThreshold,
    adminSettings?.gymModerationAlerts,
    adminSettings?.maintenanceBannerMessage,
    adminSettings?.maintenanceMode,
    adminSettings?.paymentCheckoutEnabled,
    adminSettings?.supportInboxEnabled,
    adminSettings?.supportQueueWarningDepth,
    auditSpikeSummary.count,
    auditSpikeSummary.dominantAction,
    flaggedGyms,
    pendingTickets,
    recentOrderSummary.count,
  ]);

  const quickLinks = useMemo(() => ([
    {
      id: 'tickets',
      label: 'Pending tickets',
      value: formatQuickCount(pendingTickets, isContactsFetching),
      meta: isContactsFetching
        ? 'Checking support inbox'
        : `${formatNumber(contactMessages.filter((message) => String(message?.status ?? '').toLowerCase() === 'new').length)} still new`,
      to: '/dashboard/admin/messages?status=new',
    },
    {
      id: 'gyms',
      label: 'Flagged gyms',
      value: formatQuickCount(flaggedGyms, isGymsFetching),
      meta: isGymsFetching
        ? 'Loading moderation queue'
        : 'Draft, suspended, or unpublished listings',
      to: '/dashboard/admin/gyms',
    },
    {
      id: 'orders',
      label: 'Recent orders',
      value: formatNumber(recentOrderSummary.count),
      meta: recentOrderSummary.latestAt
        ? `Latest order ${formatDate(recentOrderSummary.latestAt)}`
        : 'No recent marketplace orders',
      to: '/dashboard/admin/marketplace',
    },
    {
      id: 'audit',
      label: 'Audit spikes',
      value: formatQuickCount(auditSpikeSummary.count, isAuditFetching),
      meta: isAuditFetching
        ? 'Scanning last 24 hours'
        : auditSpikeSummary.dominantAction
          ? `${formatStatus(auditSpikeSummary.dominantAction)} x ${formatNumber(auditSpikeSummary.dominantCount)}`
          : 'No clustered action detected',
      to: '/dashboard/admin/audit-logs',
    },
    {
      id: 'ops',
      label: 'System ops',
      value: formatQuickCount(pendingTickets + flaggedGyms, isContactsFetching || isGymsFetching),
      meta: 'Backlog pressure and service health',
      to: '/dashboard/admin/ops',
    },
  ]), [
    auditSpikeSummary.count,
    auditSpikeSummary.dominantAction,
    auditSpikeSummary.dominantCount,
    contactMessages,
    flaggedGyms,
    isAuditFetching,
    isContactsFetching,
    isGymsFetching,
    pendingTickets,
    recentOrderSummary.count,
    recentOrderSummary.latestAt,
  ]);

  if (isLoading) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked">
        {[
          'Admin action center',
          'Platform performance',
          'Revenue trend',
          'Recent marketplace activity',
          'User demographics',
          'Monetisation timeline',
        ].map((section) => (
          <DashboardSection key={section} title={section}>
            <SkeletonPanel lines={8} />
          </DashboardSection>
        ))}
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked">
        <DashboardSection
          title="Admin dashboard"
          action={(
            <button
              type="button"
              onClick={() => {
                refetchOverview();
                refetchRevenue();
                refetchMarketplace();
                refetchInsights();
              }}
            >
              Retry
            </button>
          )}
        >
          <EmptyState message="We could not fetch the admin overview." />
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="dashboard-grid dashboard-grid--stacked">
      <DashboardSection title="Admin action center">
        <div className="dashboard-link-grid">
          {quickLinks.map((link) => (
            <Link key={link.id} className="dashboard-link-card" to={link.to}>
              <small>{link.label}</small>
              <strong>{link.value}</strong>
              <span>{link.meta}</span>
            </Link>
          ))}
        </div>
        <div className="dashboard-export-shortcuts">
          <Link to="/dashboard/admin/revenue">Revenue exports</Link>
          <Link to="/dashboard/admin/marketplace">Marketplace exports</Link>
          <Link to="/dashboard/admin/audit-logs">Audit exports</Link>
          <Link to="/dashboard/admin/ops">System ops</Link>
        </div>
      </DashboardSection>

      <DashboardSection title="Control center alerts">
        {controlAlerts.length ? (
          <div className="dashboard-alert-grid">
            {controlAlerts.map((alert) => (
              <Link
                key={alert.id}
                className={`dashboard-alert-card dashboard-alert-card--${alert.severity}`}
                to={alert.to}
              >
                <small>{formatStatus(alert.severity)}</small>
                <strong>{alert.title}</strong>
                <span>{alert.message}</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="status-pill status-pill--success">
            No active control-center anomalies were detected in the current snapshot.
          </div>
        )}
      </DashboardSection>

      <DashboardSection title="Platform performance">
        {overview ? (
          <div className="stat-grid">
            <div className="stat-card">
              <small>Total users</small>
              <strong>{formatNumber(totalUsers)}</strong>
              <small>
                Trainers {formatNumber(overview.users?.trainer ?? 0)} · Trainees {formatNumber(overview.users?.trainee ?? 0)} · Gym Owners {formatNumber(overview.users?.['gym-owner'] ?? 0)}
              </small>
            </div>
            <div className="stat-card">
              <small>Gyms live</small>
              <strong>{formatNumber(overview.gyms?.published ?? 0)}</strong>
              <small>
                {formatNumber(overview.gyms?.sponsored ?? 0)} sponsored · {formatNumber(overview.gyms?.totalImpressions ?? 0)} impressions
              </small>
            </div>
            <div className="stat-card">
              <small>Total listed items</small>
              <strong>{formatNumber(overview.marketplace?.totalItems ?? 0)}</strong>
              <small>{formatNumber(overview.marketplace?.totalOrders ?? 0)} total orders</small>
            </div>
          </div>
        ) : (
          <EmptyState message="No overview data yet." />
        )}
      </DashboardSection>

      <DashboardSection
        title="Revenue overview"
        action={(
          <div className="owner-revenue-chart__toggle" role="group" aria-label="Select revenue timeframe">
            {['weekly', 'monthly'].map((option) => {
              const isActive = option === timeframe;
              return (
                <button
                  key={option}
                  type="button"
                  className={`owner-revenue-chart__toggle-button${isActive ? ' owner-revenue-chart__toggle-button--active' : ''}`}
                  onClick={() => setTimeframe(option)}
                >
                  {formatStatus(option)}
                </button>
              );
            })}
          </div>
        )}
      >
        {overview?.revenue ? (
          <div className="stat-grid">
            {overview.revenue.map((item) => (
              <div className="stat-card" key={item.type}>
                <small>
                  {item.type === 'marketplace'
                    ? 'Marketplace'
                    : item.type === 'listing'
                      ? 'Listing plans'
                      : item.type === 'sponsorship'
                        ? 'Sponsorships'
                        : item.type}
                  {' '}
                  revenue
                </small>
                <strong>{formatCurrency({ amount: item.amount, currency: item.currency })}</strong>
              </div>
            ))}
            <div className="stat-card">
              <small>Tracked periods</small>
              <strong>{formatNumber(revenueSeries.length)}</strong>
              <small>{timeframe === 'weekly' ? 'Weekly buckets loaded' : 'Monthly buckets loaded'}</small>
            </div>
          </div>
        ) : (
          <EmptyState message="Revenue data will appear once transactions start flowing." />
        )}
      </DashboardSection>

      <DashboardSection
        title="Recent marketplace activity"
        action={(
          <button type="button" onClick={() => refetchMarketplace()}>
            Refresh
          </button>
        )}
      >
        {recentOrders.length ? (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Buyer</th>
                <th>Status</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <strong>{order.orderNumber ?? order.id}</strong>
                    <div>
                      <small>{formatDate(order.createdAt)}</small>
                    </div>
                  </td>
                  <td>{order.user?.name ?? '-'}</td>
                  <td>{order.status}</td>
                  <td>{formatCurrency({ amount: order.total, currency: order.currency })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="Marketplace orders will appear here once they are placed." />
        )}
      </DashboardSection>

      <DashboardSection title="User demographics">
        {demographics.gender?.length || demographics.ageBuckets?.length ? (
          <DemographicsSummary gender={demographics.gender} ageBuckets={demographics.ageBuckets} />
        ) : (
          <EmptyState message="Demographic distributions will appear once more users share profile details." />
        )}
      </DashboardSection>

      <DashboardSection title="Monetisation timeline">
        <NotificationsPanel notifications={notifications} />
      </DashboardSection>
    </div>
  );
};

export default AdminDashboard;
