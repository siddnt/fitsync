import DashboardSection from './components/DashboardSection.jsx';
import EmptyState from './components/EmptyState.jsx';
import SkeletonPanel from '../../ui/SkeletonPanel.jsx';
import { useGetTrainerOverviewQuery } from '../../services/dashboardApi.js';
import { formatCurrency, formatDate } from '../../utils/format.js';
import './Dashboard.css';

const TrainerDashboard = () => {
  const { data, isLoading, isError, refetch } = useGetTrainerOverviewQuery();
  const overview = data?.data;
  const assignments = overview?.activeAssignments ?? [];
  const upcoming = overview?.upcomingCheckIns ?? [];

  if (isLoading) {
    return (
      <div className="dashboard-grid">
        {['Team snapshot', 'Active trainees', 'Upcoming check-ins'].map((title) => (
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
          title="Trainer dashboard unavailable"
          action={(
            <button type="button" onClick={() => refetch()}>
              Retry
            </button>
          )}
        >
          <EmptyState message="We could not fetch your trainer dashboard." />
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="dashboard-grid">
      <DashboardSection title="Team snapshot">
        {overview?.totals ? (
          <div className="stat-grid">
            <div className="stat-card">
              <small>Gyms</small>
              <strong>{overview.totals.gyms}</strong>
              <small>Locations you cover</small>
            </div>
            <div className="stat-card">
              <small>Active trainees</small>
              <strong>{overview.totals.activeTrainees}</strong>
              <small>Currently training</small>
            </div>
            <div className="stat-card">
              <small>Pending updates</small>
              <strong>{overview.totals.pendingUpdates}</strong>
              <small>Need new feedback</small>
            </div>
            <div className="stat-card">
              <small>30-day earnings</small>
              <strong>{formatCurrency(overview.totals.earnings30d)}</strong>
              <small>Trainer share (50%)</small>
            </div>
          </div>
        ) : (
          <EmptyState message="No trainee assignments yet." />
        )}
      </DashboardSection>

      <DashboardSection title="Active trainees">
        {assignments.length ? (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Trainee</th>
                <th>Gym</th>
                <th>Assigned</th>
                <th>Goals</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((assignment, index) => (
                <tr key={`${assignment.trainee}-${index}`}>
                  <td>{assignment.trainee?.name ?? '—'}</td>
                  <td>{assignment.gym?.name ?? '—'}</td>
                  <td>{formatDate(assignment.assignedAt)}</td>
                  <td>{assignment.goals?.join(', ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="We will list assignments once trainees are allocated to you." />
        )}
      </DashboardSection>

      <DashboardSection title="Upcoming check-ins">
        {upcoming.length ? (
          <ul>
            {upcoming.map((item, index) => (
              <li key={`${item.trainee?._id ?? index}-checkin`}>
                <strong>{item.trainee?.name ?? 'Trainee'}</strong> · Last attendance {formatDate(item.latestAttendance?.date)} ·{' '}
                {item.nextFeedback ? `Feedback logged ${formatDate(item.nextFeedback.createdAt)}` : 'Feedback due'}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState message="Schedule follow-ups with your assigned trainees to see them here." />
        )}
      </DashboardSection>
    </div>
  );
};

export default TrainerDashboard;
