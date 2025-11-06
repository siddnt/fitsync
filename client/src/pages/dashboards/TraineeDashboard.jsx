import DashboardSection from './components/DashboardSection.jsx';
import EmptyState from './components/EmptyState.jsx';
import SkeletonPanel from '../../ui/SkeletonPanel.jsx';
import {
  useGetTraineeOverviewQuery,
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
  const { data, isLoading, isError, refetch } = useGetTraineeOverviewQuery();
  const overview = data?.data;

  const membership = overview?.membership ?? null;
  const progress = overview?.progress ?? null;
  const diet = overview?.diet ?? null;
  const orders = overview?.recentOrders ?? [];

  if (isLoading) {
    return (
      <div className="dashboard-grid">
        {['Active membership', 'Progress overview', 'Diet plan', 'Recent orders'].map((title) => (
          <DashboardSection key={title} title={title}>
            <SkeletonPanel lines={6} />
          </DashboardSection>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="dashboard-grid">
        <DashboardSection
          title="Dashboard unavailable"
          action={(
            <button type="button" onClick={() => refetch()}>
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
    <div className="dashboard-grid">
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
            {membership.trainer ? (
              <div className="stat-card">
                <small>Your trainer</small>
                <strong>{membership.trainer.name}</strong>
                <small>{membership.gym?.name ?? ''}</small>
              </div>
            ) : null}
          </div>
        ) : (
          <EmptyState message="You do not have an active membership yet." />
        )}
      </DashboardSection>

      <DashboardSection title="Progress overview">
        {progress ? (
          <div className="stat-grid">
            <div className="stat-card">
              <small>Attendance streak</small>
              <strong>{progress.streak ?? 0} days</strong>
              <small>Last check-in {formatDate(progress.lastCheckIn)}</small>
            </div>
            <div className="stat-card">
              <small>Presence (30 days)</small>
              <strong>{formatPercentage(progress.attendance?.presentPercentage ?? 0)}</strong>
              <small>{formatPercentage(progress.attendance?.latePercentage ?? 0)} late</small>
            </div>
            <div className="stat-card">
              <small>Feedback received</small>
              <strong>{progress.feedback?.length ?? 0}</strong>
              <small>Latest {formatDate(progress.feedback?.[0]?.createdAt)}</small>
            </div>
          </div>
        ) : (
          <EmptyState message="Your trainer has not submitted progress updates yet." />
        )}
      </DashboardSection>

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
            {diet.notes ? <p>{diet.notes}</p> : null}
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
  );
};

export default TraineeDashboard;
