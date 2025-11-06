import { useMemo } from 'react';
import DashboardSection from './components/DashboardSection.jsx';
import GrowthLineChart from './components/GrowthLineChart.jsx';
import DistributionPieChart from './components/DistributionPieChart.jsx';
import GeoDensityMap from './components/GeoDensityMap.jsx';
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
import { formatCurrency, formatNumber, formatStatus, formatDate } from '../../utils/format.js';
import './Dashboard.css';

const AdminDashboard = () => {
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

  const revenueTrend = useMemo(
    () => (Array.isArray(rawRevenueTrend) ? rawRevenueTrend : []),
    [rawRevenueTrend],
  );

  const revenueSeries = useMemo(() => {
    const trend = Array.isArray(revenueTrend) ? revenueTrend : [];
    return trend.map((entry) => ({
      ...entry,
      total: ['listing', 'sponsorship', 'marketplace'].reduce(
        (sum, key) => sum + (Number(entry?.[key]) || 0),
        0,
      ),
    }));
  }, [revenueTrend]);

  const revenueBreakdown = useMemo(() => {
    const revenue = Array.isArray(overview?.revenue) ? overview.revenue : [];
    return revenue.map((item) => ({
      name: formatStatus(item?.type),
      value: Number(item?.amount?.amount ?? item?.amount ?? 0),
    }));
  }, [overview?.revenue]);

  const geoDensity = insights?.geoDensity ?? { totalGyms: 0, totalImpressions: 0, points: [], topLocations: [] };
  const demographics = insights?.demographics ?? { gender: [], ageBuckets: [] };
  const notifications = insights?.notifications ?? [];
  const capturedAt = insights?.capturedAt ? new Date(insights.capturedAt) : null;

  const isLoading = isOverviewLoading || isRevenueLoading || isMarketplaceLoading || isInsightsLoading;
  const hasError = isOverviewError || isRevenueError || isMarketplaceError || isInsightsError;

  if (isLoading) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked">
        {['Platform performance', 'Revenue trend', 'Income mix', 'Recent marketplace activity', 'Geographic reach', 'User demographics', 'Monetisation timeline'].map((section) => (
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
              <strong>{formatNumber(Object.values(overview.users || {}).reduce((sum, count) => sum + count, 0))}</strong>
              <small>
                Trainers {formatNumber(overview.users?.trainer ?? 0)} · Trainees {formatNumber(overview.users?.trainee ?? 0)}
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
              <small>Marketplace revenue</small>
              <strong>{formatCurrency(overview.marketplace?.totalRevenue)}</strong>
              <small>{formatNumber(overview.marketplace?.totalOrders ?? 0)} total orders</small>
            </div>
          </div>
        ) : (
          <EmptyState message="No overview data yet." />
        )}
      </DashboardSection>

      <DashboardSection title="Revenue trend">
        {revenueSeries.length ? (
          <GrowthLineChart
            role="admin"
            data={revenueSeries}
            series={[
              { dataKey: 'listing', stroke: '#ff6b6b', label: 'Listing' },
              { dataKey: 'sponsorship', stroke: '#845ef7', label: 'Sponsorship' },
              { dataKey: 'marketplace', stroke: '#51cf66', label: 'Marketplace' },
            ]}
          />
        ) : (
          <EmptyState message="Revenue data will appear once transactions start flowing." />
        )}
      </DashboardSection>

      <DashboardSection title="Income mix">
        {revenueBreakdown.length ? (
          <DistributionPieChart role="admin" data={revenueBreakdown} valueKey="value" nameKey="name" />
        ) : (
          <EmptyState message="Income sources will populate here." />
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

      <DashboardSection
        title="Geographic reach"
        action={(
          <button type="button" onClick={() => refetchInsights()}>
            Refresh
          </button>
        )}
      >
        {geoDensity.points?.length ? (
          <>
            {capturedAt ? (
              <p className="geo-map__timestamp">Snapshot {capturedAt.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
            ) : null}
            <GeoDensityMap points={geoDensity.points} totals={geoDensity} topLocations={geoDensity.topLocations} />
          </>
        ) : (
          <EmptyState message="We will map gym coverage once listings go live across India." />
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
