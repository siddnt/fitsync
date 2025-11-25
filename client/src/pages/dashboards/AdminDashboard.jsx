// ...existing code...
import { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
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
} from '../../services/dashboardApi.js';
import { formatCurrency, formatNumber, formatDate } from '../../utils/format.js';
import './Dashboard.css';

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

  const overview = overviewResponse?.data;
  const rawRevenueTrend = revenueResponse?.data?.trend;
  const recentOrders = marketplaceResponse?.data?.orders ?? [];
  const insights = insightsResponse?.data;

  const revenueSeries = useMemo(() => {
    if (!rawRevenueTrend) return [];
    return Array.isArray(rawRevenueTrend[timeframe]) ? rawRevenueTrend[timeframe] : [];
  }, [rawRevenueTrend, timeframe]);

  const demographics = insights?.demographics ?? { gender: [], ageBuckets: [] };
  const notifications = insights?.notifications ?? [];

  const isLoading = isOverviewLoading || isRevenueLoading || isMarketplaceLoading || isInsightsLoading;
  const hasError = isOverviewError || isRevenueError || isMarketplaceError || isInsightsError;

  const totalUsers = useMemo(() => {
    if (!overview?.users) return 0;
    return (overview.users.trainer || 0) + (overview.users.trainee || 0) + (overview.users['gym-owner'] || 0);
  }, [overview?.users]);

  if (isLoading) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked">
        {['Platform performance', 'Revenue trend', 'Recent marketplace activity', 'User demographics', 'Monetisation timeline'].map((section) => (
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
            <button type="button" onClick={() => {
              refetchOverview();
              refetchRevenue();
              refetchMarketplace();
              refetchInsights();
            }}>
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

      <DashboardSection title="Revenue Overview">
        {overview?.revenue ? (
          <div className="stat-grid">
            {overview.revenue.map((item) => (
              <div className="stat-card" key={item.type}>
                <small>{item.type === 'marketplace' ? 'Marketplace' : item.type === 'listing' ? 'Listing Plans' : item.type === 'sponsorship' ? 'Sponsorships' : item.type} Revenue</small>
                <strong>{formatCurrency(item.amount)}</strong>
              </div>
            ))}
             <div className="stat-card">
              <small>Total Revenue</small>
              <strong>{formatCurrency(overview.revenue.reduce((sum, item) => sum + (Number(item.amount?.amount) || 0), 0))}</strong>
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
                  <td>{order.user?.name ?? '—'}</td>
                  <td>{order.status}</td>
                  <td>{formatCurrency(order.total)}</td>
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

