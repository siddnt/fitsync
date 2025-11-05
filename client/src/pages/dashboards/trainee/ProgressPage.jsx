import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import { useGetTraineeProgressQuery } from '../../../services/dashboardApi.js';
import {
  formatDate,
  formatPercentage,
  formatStatus,
} from '../../../utils/format.js';
import '../Dashboard.css';

const TraineeProgressPage = () => {
  const { data, isLoading, isError, refetch } = useGetTraineeProgressQuery();
  const progress = data?.data;
  const attendance = progress?.attendance;

  if (isLoading) {
    return (
      <div className="dashboard-grid">
        {['Attendance insights', 'Performance metrics', 'Trainer feedback', 'Attendance log'].map((title) => (
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
          title="Unable to load progress"
          action={(
            <button type="button" onClick={() => refetch()}>
              Retry
            </button>
          )}
        >
          <EmptyState message="We ran into a problem fetching your progress data." />
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="dashboard-grid">
      <DashboardSection title="Attendance insights">
        {attendance ? (
          <div className="stat-grid">
            <div className="stat-card">
              <small>Current streak</small>
              <strong>{attendance.streak ?? 0} days</strong>
              <small>Consecutive presents logged</small>
            </div>
            <div className="stat-card">
              <small>Present</small>
              <strong>{formatPercentage(attendance.presentPercentage ?? 0)}</strong>
              <small>Past 30 days</small>
            </div>
            <div className="stat-card">
              <small>Late</small>
              <strong>{formatPercentage(attendance.latePercentage ?? 0)}</strong>
              <small>Past 30 days</small>
            </div>
            <div className="stat-card">
              <small>Absent</small>
              <strong>{formatPercentage(attendance.absentPercentage ?? 0)}</strong>
              <small>Past 30 days</small>
            </div>
          </div>
        ) : (
          <EmptyState message="We do not have attendance data for you yet." />
        )}
      </DashboardSection>

      <DashboardSection title="Performance metrics">
        {progress?.metrics?.length ? (
          <div className="stat-grid">
            {progress.metrics.map((metric) => (
              <div key={metric.metric} className="stat-card">
                <small>{formatStatus(metric.metric)}</small>
                <strong>
                  {metric.latestValue}
                  {metric.unit ? ` ${metric.unit}` : ''}
                </strong>
                <small>Updated {formatDate(metric.recordedAt)}</small>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message="Once your trainer logs measurements they will appear here." />
        )}
      </DashboardSection>

      <DashboardSection title="Trainer feedback">
        {progress?.feedback?.length ? (
          <ul>
            {progress.feedback.map((feedback, index) => (
              <li key={`${feedback.category}-${index}`}>
                <strong>{formatStatus(feedback.category)}:</strong> {feedback.message}{' '}
                <small>({formatDate(feedback.createdAt)})</small>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState message="Your trainer has not left fresh feedback yet." />
        )}
      </DashboardSection>

      <DashboardSection title="Attendance log">
        {progress?.rawAttendance?.length ? (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Status</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {progress.rawAttendance.map((entry, index) => (
                <tr key={`${entry.date}-${index}`}>
                  <td>{formatDate(entry.date)}</td>
                  <td>{formatStatus(entry.status)}</td>
                  <td>{entry.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="We will show your attendance history here." />
        )}
      </DashboardSection>
    </div>
  );
};

export default TraineeProgressPage;
