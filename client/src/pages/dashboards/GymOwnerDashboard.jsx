import DashboardSection from './components/DashboardSection.jsx';
import EmptyState from './components/EmptyState.jsx';
import SkeletonPanel from '../../ui/SkeletonPanel.jsx';
import {
  useGetGymOwnerOverviewQuery,
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
    data: subscriptionsResponse,
    isLoading: isSubscriptionsLoading,
    isError: isSubscriptionsError,
    refetch: refetchSubscriptions,
  } = useGetGymOwnerSubscriptionsQuery();

  const isLoading = isOverviewLoading || isSubscriptionsLoading;
  const isError = isOverviewError || isSubscriptionsError;

  const overview = overviewResponse?.data;
  const subscriptions = subscriptionsResponse?.data?.subscriptions ?? [];

  const refetchAll = () => {
    refetchOverview();
    refetchSubscriptions();
  };

  if (isLoading) {
    return (
      <div className="dashboard-grid dashboard-grid--owner">
  {['Business snapshot', 'Expiring subscriptions', 'Active subscriptions', 'Recent joiners'].map((title) => (
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
              <small>30-day owner earnings</small>
              <strong>{formatCurrency(overview.stats.revenue30d)}</strong>
              <small>Owner share (50%) · {formatNumber(overview.stats.impressions30d)} impressions</small>
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


      <DashboardSection title="Expiring subscriptions" className="dashboard-section--span-6">
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

      <DashboardSection title="Active subscriptions" className="dashboard-section--span-6">
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
