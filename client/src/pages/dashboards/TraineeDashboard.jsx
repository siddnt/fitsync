import DashboardSection from './components/DashboardSection.jsx';
import EmptyState from './components/EmptyState.jsx';
import SkeletonPanel from '../../ui/SkeletonPanel.jsx';
import StreakGraph from '../../components/dashboard/StreakGraph.jsx';
import {
  useGetTraineeOverviewQuery,
  useGetTraineeProgressQuery,
} from '../../services/dashboardApi.js';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatDaysRemaining,
  formatPercentage,
  formatStatus,
} from '../../utils/format.js';
import './Dashboard.css';

const TraineeDashboard = () => {
  const {
    data: overviewData,
    isLoading: isOverviewLoading,
    isError: isOverviewError,
    refetch: refetchOverview
  } = useGetTraineeOverviewQuery();

  const {
    data: progressData,
    isLoading: isProgressLoading,
    isError: isProgressError,
    refetch: refetchProgress
  } = useGetTraineeProgressQuery();

  const overview = overviewData?.data;
  const progress = progressData?.data;

  const membership = overview?.membership ?? null;
  const diet = overview?.diet ?? null;
  const orders = overview?.recentOrders ?? [];
  const attendanceRecords = progress?.attendance?.records ?? [];

  const isLoading = isOverviewLoading || isProgressLoading;
  const isError = isOverviewError || isProgressError;

  const handleRetry = () => {
    refetchOverview();
    refetchProgress();
  };

  if (isLoading) {
    return (
      <div className="trainee-dashboard-layout">
        <div className="dashboard-row row-overview">
          <SkeletonPanel lines={6} />
          <SkeletonPanel lines={6} />
        </div>
        <div className="dashboard-row row-streak">
          <SkeletonPanel lines={8} />
        </div>
        <div className="dashboard-row row-split">
          <SkeletonPanel lines={6} />
          <SkeletonPanel lines={6} />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="dashboard-grid">
        <DashboardSection
          title="Dashboard unavailable"
          action={(
            <button type="button" onClick={handleRetry}>
              Retry
            </button>
          )}
        >
          <EmptyState message="We could not load your dashboard right now. Please try again." />
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="trainee-dashboard-layout">
      {/* Row 1: Key Metrics */}
      <div className="dashboard-row row-overview">
        <DashboardSection
          title="Active membership"
          action={
            membership ? (
              <span className="pill">{formatStatus(membership.status)}</span>
            ) : undefined
          }
        >
          {membership ? (
            <div className="stat-grid">
              <div className="stat-card">
                <small>Plan</small>
                <strong>{formatStatus(membership.plan)}</strong>
                <small>Auto renew: {membership.autoRenew ? 'On' : 'Off'}</small>
              </div>
              <div className="stat-card">
                <small>Ends on</small>
                <strong>{formatDate(membership.endDate)}</strong>
                <small>{formatDaysRemaining(membership.daysRemaining)} remaining</small>
              </div>
              <div className="stat-card">
                <small>Billing</small>
                <strong>{membership.billing ? formatCurrency(membership.billing) : '—'}</strong>
                <small>Started {formatDate(membership.startDate)}</small>
              </div>
            </div>
          ) : (
            <EmptyState message="You do not have an active membership yet." />
          )}
        </DashboardSection>

        <DashboardSection title="Progress overview">
          {overview?.progress ? (
            <div className="stat-grid">
              <div className="stat-card">
                <small>Attendance streak</small>
                <strong>{overview.progress.streak ?? 0} days</strong>
                <small>Last check-in {formatDate(overview.progress.lastCheckIn)}</small>
              </div>
              <div className="stat-card">
                <small>Presence (30 days)</small>
                <strong>{formatPercentage(overview.progress.attendance?.presentPercentage ?? 0)}</strong>
                <small>{formatPercentage(overview.progress.attendance?.latePercentage ?? 0)} late</small>
              </div>
              <div className="stat-card">
                <small>Feedback received</small>
                <strong>{overview.progress.feedback?.length ?? 0}</strong>
                <small>Latest {formatDate(overview.progress.feedback?.[0]?.createdAt)}</small>
              </div>
            </div>
          ) : (
            <EmptyState message="Your trainer has not submitted progress updates yet." />
          )}
        </DashboardSection>
      </div>

      {/* Row 2: Attendance Streak Graph */}
      <div className="dashboard-row row-streak">
        <StreakGraph data={attendanceRecords} />
      </div>

      {/* Row 3: Diet & Orders */}
      <div className="dashboard-row row-split">
        <DashboardSection title="Diet plan">
          {diet ? (
            <div>
              <div className="pill-row">
                <span className="pill">Week of {formatDate(diet.weekOf)}</span>
                {diet.nextPlanDueIn ? (
                  <span className="pill">Next update in {formatDaysRemaining(diet.nextPlanDueIn)}</span>
                ) : null}
              </div>
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Meal</th>
                    <th>Description</th>
                    <th>Calories</th>
                  </tr>
                </thead>
                <tbody>
                  {(diet.meals ?? []).map((meal, index) => (
                    <tr key={`${meal.name}-${index}`}>
                      <td>{meal.name}</td>
                      <td>{meal.description ?? '—'}</td>
                      <td>{meal.calories ? `${meal.calories} kcal` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {diet.notes ? <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>{diet.notes}</p> : null}
            </div>
          ) : (
            <EmptyState message="No diet plan has been assigned yet." />
          )}
        </DashboardSection>

        <DashboardSection title="Recent orders">
          {orders.length ? (
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Placed</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td>{order.orderNumber ?? '—'}</td>
                    <td>{formatCurrency(order.total)}</td>
                    <td>{formatStatus(order.status)}</td>
                    <td>{formatDateTime(order.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState message="You have not placed any marketplace orders yet." />
          )}
        </DashboardSection>
      </div>
    </div>
  );
};

export default TraineeDashboard;
