import DashboardSection from './components/DashboardSection.jsx';
import EmptyState from './components/EmptyState.jsx';
import SkeletonPanel from '../../ui/SkeletonPanel.jsx';
import { useGetTrainerOverviewQuery } from '../../services/dashboardApi.js';
import { formatCurrency, formatDate } from '../../utils/format.js';
import './Dashboard.css';
import './TrainerDashboard.css';

const TrainerDashboard = () => {
  const { data, isLoading, isError, refetch } = useGetTrainerOverviewQuery();
  const overview = data?.data;
  const assignments = overview?.activeAssignments ?? [];
  const upcoming = overview?.upcomingCheckIns ?? [];

  if (isLoading) {
    return (
      <div className="trainer-dashboard">
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
      <div className="trainer-dashboard">
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

  const renderGoals = (goals) => {
    if (!goals?.length) return <span className="trainer-table__gym">—</span>;
    return (
      <div className="trainer-table__goals">
        {goals.map((goal, i) => (
          <span key={i} className="trainer-goal-tag">{goal}</span>
        ))}
      </div>
    );
  };

  return (
    <div className="trainer-dashboard">
      <DashboardSection title="Team snapshot">
        {overview?.totals ? (
          <div className="trainer-stat-grid">
            <div className="trainer-stat-card trainer-stat-card--gyms">
              <span className="trainer-stat-card__label">Gyms</span>
              <span className="trainer-stat-card__value">{overview.totals.gyms}</span>
              <span className="trainer-stat-card__hint">Locations you cover</span>
            </div>
            <div className="trainer-stat-card trainer-stat-card--trainees">
              <span className="trainer-stat-card__label">Active trainees</span>
              <span className="trainer-stat-card__value">{overview.totals.activeTrainees}</span>
              <span className="trainer-stat-card__hint">Currently training</span>
            </div>
            <div className="trainer-stat-card trainer-stat-card--pending">
              <span className="trainer-stat-card__label">Pending updates</span>
              <span className="trainer-stat-card__value">{overview.totals.pendingUpdates}</span>
              <span className="trainer-stat-card__hint">Need new feedback</span>
            </div>
            <div className="trainer-stat-card trainer-stat-card--earnings">
              <span className="trainer-stat-card__label">30-day earnings</span>
              <span className="trainer-stat-card__value">{formatCurrency(overview.totals.earnings30d)}</span>
              <span className="trainer-stat-card__hint">Trainer share (50%)</span>
            </div>
          </div>
        ) : (
          <EmptyState message="No trainee assignments yet." />
        )}
      </DashboardSection>

      <DashboardSection title="Active trainees">
        {assignments.length ? (
          <table className="trainer-table">
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
                  <td className="trainer-table__name">{assignment.trainee?.name ?? '—'}</td>
                  <td className="trainer-table__gym">{assignment.gym?.name ?? '—'}</td>
                  <td className="trainer-table__date">{formatDate(assignment.assignedAt)}</td>
                  <td>{renderGoals(assignment.goals)}</td>
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
          <ul className="trainer-checkins">
            {upcoming.map((item, index) => (
              <li key={`${item.trainee?._id ?? index}-checkin`} className="trainer-checkin-item">
                <span className="trainer-checkin-item__name">{item.trainee?.name ?? 'Trainee'}</span>
                <div className="trainer-checkin-item__details">
                  <span>Last attendance: {formatDate(item.latestAttendance?.date)}</span>
                  <span className={`trainer-checkin-item__status ${item.nextFeedback ? 'trainer-checkin-item__status--done' : 'trainer-checkin-item__status--due'}`}>
                    {item.nextFeedback ? `Logged ${formatDate(item.nextFeedback.createdAt)}` : 'Feedback due'}
                  </span>
                </div>
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
