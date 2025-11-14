import DashboardSection from './components/DashboardSection.jsx';
import EmptyState from './components/EmptyState.jsx';
import RevenueSummaryChart from './components/RevenueSummaryChart.jsx';
import GrowthLineChart from './components/GrowthLineChart.jsx';
import DistributionPieChart from './components/DistributionPieChart.jsx';
import SkeletonPanel from '../../ui/SkeletonPanel.jsx';
import {
  useGetGymOwnerOverviewQuery,
  useGetGymOwnerAnalyticsQuery,
  useGetGymOwnerSubscriptionsQuery,
} from '../../services/dashboardApi.js';
import {
  formatCurrency,
  formatDate,
  formatNumber,
  formatStatus,
} from '../../utils/format.js';
import './Dashboard.css';

const GymOwnerDashboard = () => {
  const {
    data: overviewResponse,
    isLoading: isOverviewLoading,
    isError: isOverviewError,
    refetch: refetchOverview,
  } = useGetGymOwnerOverviewQuery();

  const {
    data: analyticsResponse,
    isLoading: isAnalyticsLoading,
    isError: isAnalyticsError,
    refetch: refetchAnalytics,
  } = useGetGymOwnerAnalyticsQuery();

  const {
    data: subscriptionsResponse,
    isLoading: isSubscriptionsLoading,
    isError: isSubscriptionsError,
    refetch: refetchSubscriptions,
  } = useGetGymOwnerSubscriptionsQuery();

  const isLoading = isOverviewLoading || isAnalyticsLoading || isSubscriptionsLoading;
  const isError = isOverviewError || isAnalyticsError || isSubscriptionsError;

  const overview = overviewResponse?.data;
  const analytics = analyticsResponse?.data;
  const subscriptions = subscriptionsResponse?.data?.subscriptions ?? [];

  const revenueTrend = (() => {
    const rawTrend = Array.isArray(analytics?.revenueTrend)
      ? analytics.revenueTrend
      : Array.isArray(analytics?.revenueTrend?.weekly)
        ? analytics.revenueTrend.weekly
        : [];
    return rawTrend.map((entry) => ({
      label: entry.label,
      earnings: entry.profit ?? entry.value ?? 0,
    }));
  })();

  const membershipTrend = (() => {
    const rawTrend = Array.isArray(analytics?.membershipTrend)
      ? analytics.membershipTrend
      : Array.isArray(analytics?.membershipTrend?.weekly)
        ? analytics.membershipTrend.weekly
        : [];
    return rawTrend.map((entry) => ({
      label: entry.label,
      memberships: entry.value,
    }));
  })();

  const sponsorshipSplit = overview?.gyms
    ?.filter((gym) => gym.sponsorship?.tier && gym.sponsorship.tier !== 'none')
    .map((gym) => ({
      name: gym.name,
      value: gym.impressions ?? 0,
    }));

  const refetchAll = () => {
    refetchOverview();
    refetchAnalytics();
    refetchSubscriptions();
  };

  if (isLoading) {
    return (
      <div className="dashboard-grid dashboard-grid--owner">
        {['Business snapshot', 'Revenue trend', 'Membership trend', 'Subscriptions'].map((title) => (
          <DashboardSection key={title} title={title}>
            <SkeletonPanel lines={6} />
          </DashboardSection>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="dashboard-grid dashboard-grid--owner">
        <DashboardSection
          title="Dashboard unavailable"
          action={(
            <button type="button" onClick={refetchAll}>
              Retry
            </button>
          )}
        >
          <EmptyState message="We could not fetch your gym analytics right now." />
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="dashboard-grid dashboard-grid--owner">
      <DashboardSection title="Business snapshot" className="dashboard-section--span-12">
        {overview?.stats ? (
          <div className="stat-grid">
            <div className="stat-card">
              <small>Total gyms</small>
              <strong>{overview.stats.totalGyms}</strong>
              <small>{overview.stats.publishedGyms} published</small>
            </div>
            <div className="stat-card">
              <small>Active memberships</small>
              <strong>{formatNumber(overview.stats.activeMemberships)}</strong>
              <small>Across all locations</small>
            </div>
            <div className="stat-card">
              <small>30-day revenue</small>
              <strong>{formatCurrency(overview.stats.revenue30d)}</strong>
              <small>{formatNumber(overview.stats.impressions30d)} impressions</small>
            </div>
            <div className="stat-card">
              <small>Pending gyms</small>
              <strong>{overview.stats.pendingGyms}</strong>
              <small>Awaiting verification</small>
            </div>
          </div>
        ) : (
          <EmptyState message="Add your first gym to start tracking performance." />
        )}
      </DashboardSection>

      <DashboardSection
        title="Revenue trend"
        action={(
          <button type="button" onClick={refetchAnalytics}>
            Refresh
          </button>
        )}
        className="dashboard-section--span-6"
      >
        {revenueTrend?.length ? (
          <RevenueSummaryChart role="gym-owner" data={revenueTrend} valueKey="earnings" />
        ) : (
          <EmptyState message="We need more transactions to show revenue insights." />
        )}
      </DashboardSection>

      <DashboardSection title="Membership trend" className="dashboard-section--span-6">
        {membershipTrend?.length ? (
          <GrowthLineChart
            role="gym-owner"
            data={membershipTrend}
            series={[
              { dataKey: 'memberships', stroke: '#51cf66', label: 'Active memberships' },
            ]}
          />
        ) : (
          <EmptyState message="Membership analytics will appear as new members join." />
        )}
      </DashboardSection>

      <DashboardSection title="Sponsorship exposure" className="dashboard-section--span-4">
        {sponsorshipSplit?.length ? (
          <DistributionPieChart
            role="gym-owner"
            data={sponsorshipSplit}
            valueKey="value"
            nameKey="name"
          />
        ) : (
          <EmptyState message="No sponsorship campaigns are active right now." />
        )}
      </DashboardSection>

      <DashboardSection title="Expiring subscriptions" className="dashboard-section--span-4">
        {overview?.expiringSubscriptions?.length ? (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Gym</th>
                <th>Plan</th>
                <th>Expires</th>
              </tr>
            </thead>
            <tbody>
              {overview.expiringSubscriptions.map((subscription) => (
                <tr key={subscription.id}>
                  <td>{subscription.gym?.name ?? '—'}</td>
                  <td>{formatStatus(subscription.planCode)}</td>
                  <td>{formatDate(subscription.periodEnd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="All sponsorships are in good standing." />
        )}
      </DashboardSection>

      <DashboardSection title="Active subscriptions" className="dashboard-section--span-4">
        {subscriptions.length ? (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Gym</th>
                <th>Status</th>
                <th>Billing</th>
                <th>Renewal</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((subscription) => (
                <tr key={subscription.id}>
                  <td>{subscription.gym?.name ?? '—'}</td>
                  <td>{formatStatus(subscription.status)}</td>
                  <td>{formatCurrency(subscription.amount)}</td>
                  <td>{formatDate(subscription.periodEnd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="Your gyms are not enrolled in any marketplace plans yet." />
        )}
      </DashboardSection>

      <DashboardSection title="Recent joiners" className="dashboard-section--span-12">
        {overview?.recentMembers?.length ? (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Gym</th>
                <th>Plan</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {overview.recentMembers.map((member) => (
                <tr key={member.id}>
                  <td>
                    <div className="dashboard-table__user">
                      {member.user?.profilePicture ? (
                        <img src={member.user.profilePicture} alt={member.user.name} />
                      ) : (
                        <div className="dashboard-table__user-placeholder">
                          {member.user?.name?.charAt(0) ?? '?'}
                        </div>
                      )}
                      <span>{member.user?.name ?? 'Unknown'}</span>
                    </div>
                  </td>
                  <td>{member.gym?.name ?? '—'}</td>
                  <td>{formatStatus(member.planType)}</td>
                  <td>{formatDate(member.joinedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="No new members have joined your gyms recently." />
        )}
      </DashboardSection>
    </div>
  );
};

export default GymOwnerDashboard;
