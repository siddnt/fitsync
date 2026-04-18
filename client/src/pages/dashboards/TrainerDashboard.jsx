import DashboardSection from './components/DashboardSection.jsx';
import EmptyState from './components/EmptyState.jsx';
import NotificationsPanel from './components/NotificationsPanel.jsx';
import SkeletonPanel from '../../ui/SkeletonPanel.jsx';
import { useGetTrainerFeedbackQuery, useGetTrainerOverviewQuery } from '../../services/dashboardApi.js';
import { useGetMyNotificationsQuery } from '../../services/userApi.js';
import { formatCurrency, formatDate, formatStatus } from '../../utils/format.js';
import './Dashboard.css';

const TrainerDashboard = () => {
  const { data, isLoading, isError, refetch } = useGetTrainerOverviewQuery();
  const {
    data: feedbackData,
    isLoading: isFeedbackLoading,
    isError: isFeedbackError,
    refetch: refetchFeedback,
  } = useGetTrainerFeedbackQuery();

  const overview = data?.data;
  const assignments = overview?.activeAssignments ?? [];
  const todaySessions = overview?.todaySessions ?? [];
  const overdueUpdates = overview?.overdueProgressUpdates ?? [];
  const upcoming = overview?.upcomingCheckIns ?? [];
  const feedbackEntries = Array.isArray(feedbackData?.data?.feedback) ? feedbackData.data.feedback : [];
  const { data: notificationsResponse } = useGetMyNotificationsQuery({ limit: 6 });
  const notifications = notificationsResponse?.data?.notifications ?? [];

  if (isLoading) {
    return (
      <div className="dashboard-grid">
        {['Team snapshot', "Today's sessions", 'Overdue progress updates'].map((title) => (
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
    <div className="dashboard-grid dashboard-grid--trainer">
      <DashboardSection title="Team snapshot" className="dashboard-section--span-12">
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
              <small>Overdue coach feedback or progress notes</small>
            </div>
            <div className="stat-card">
              <small>Today's sessions</small>
              <strong>{overview.totals.todaysSessions ?? todaySessions.length}</strong>
              <small>Pending or confirmed bookings on your calendar today</small>
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

      <DashboardSection title="Today's sessions" className="dashboard-section--span-8">
        {todaySessions.length ? (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Trainee</th>
                <th>Gym</th>
                <th>Status</th>
                <th>Session</th>
              </tr>
            </thead>
            <tbody>
              {todaySessions.map((session) => (
                <tr key={session.id}>
                  <td>{session.startTime} - {session.endTime}</td>
                  <td>{session.trainee?.name ?? 'Trainee'}</td>
                  <td>{session.gym?.name ?? 'Gym'}</td>
                  <td>{formatStatus(session.status)}</td>
                  <td>{formatStatus(session.sessionType ?? 'personal-training')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="No trainer bookings scheduled for today." />
        )}
      </DashboardSection>

      <DashboardSection title="Overdue progress updates" className="dashboard-section--span-4">
        {overdueUpdates.length ? (
          <ul>
            {overdueUpdates.slice(0, 5).map((item, index) => (
              <li key={`${item.trainee?.id ?? index}-overdue`}>
                <strong>{item.trainee?.name ?? 'Trainee'}</strong>
                {' | '}
                {item.gym?.name ?? 'Gym'}
                {' | '}
                {item.daysSinceUpdate === null ? 'No coach note yet' : `${item.daysSinceUpdate} day(s) since last coach note`}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState message="All assigned trainees have recent coach updates." />
        )}
      </DashboardSection>

      <DashboardSection title="Active trainees" className="dashboard-section--span-8">
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
                  <td>{assignment.trainee?.name ?? '--'}</td>
                  <td>{assignment.gym?.name ?? '--'}</td>
                  <td>{formatDate(assignment.assignedAt)}</td>
                  <td>{assignment.goals?.join(', ') || '--'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="We will list assignments once trainees are allocated to you." />
        )}
      </DashboardSection>

      <DashboardSection title="Upcoming check-ins" className="dashboard-section--span-4">
        {upcoming.length ? (
          <ul>
            {upcoming.map((item, index) => (
              <li key={`${item.trainee?._id ?? index}-checkin`}>
                <strong>{item.trainee?.name ?? 'Trainee'}</strong>
                {' | '}
                Last attendance {formatDate(item.latestAttendance?.date)}
                {' | '}
                {item.nextFeedback ? `Feedback logged ${formatDate(item.nextFeedback.createdAt)}` : 'Feedback due'}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState message="Schedule follow-ups with your assigned trainees to see them here." />
        )}
      </DashboardSection>

      <DashboardSection title="Feedback" className="dashboard-section--span-12">
        {isFeedbackLoading ? (
          <SkeletonPanel lines={6} />
        ) : isFeedbackError ? (
          <div className="dashboard-feedback-error">
            <EmptyState message="We could not load trainee feedback." />
            <button type="button" onClick={() => refetchFeedback()}>
              Retry
            </button>
          </div>
        ) : feedbackEntries.length ? (
          <ul className="trainer-feedback-list">
            {feedbackEntries.map((entry) => (
              <li key={entry.id}>
                <header>
                  <div>
                    <strong>{entry.trainee?.name ?? 'Trainee'}</strong>
                    <small>{entry.gym?.name ?? '--'}</small>
                  </div>
                  <small>{formatDate(entry.createdAt)}</small>
                </header>
                <p>{entry.message}</p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState message="No trainee feedback yet. Encourage members to share their thoughts." />
        )}
      </DashboardSection>

      <DashboardSection title="Notifications" className="dashboard-section--span-12">
        <NotificationsPanel
          notifications={notifications}
          emptyMessage="Assignment approvals and trainee activity updates will appear here."
        />
      </DashboardSection>
    </div>
  );
};

export default TrainerDashboard;
