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

const TraineeAttendancePage = () => {
  const { data, isLoading, isError, refetch } = useGetTraineeProgressQuery();
  const progress = data?.data;
  const attendance = progress?.attendance;

  if (isLoading) {
    return (
      <div className="dashboard-grid">
        {['Monthly attendance', 'Trainer notes'].map((title) => (
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
          title="Attendance unavailable"
          action={(
            <button type="button" onClick={() => refetch()}>
              Retry
            </button>
          )}
        >
          <EmptyState message="We could not load attendance records." />
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="dashboard-grid">
      <DashboardSection title="Monthly attendance">
        {attendance ? (
          <>
            <div className="stat-grid">
              <div className="stat-card">
                <small>Present</small>
                <strong>{formatPercentage(attendance.presentPercentage ?? 0)}</strong>
                <small>Across the last 30 days</small>
              </div>
              <div className="stat-card">
                <small>Late</small>
                <strong>{formatPercentage(attendance.latePercentage ?? 0)}</strong>
                <small>Across the last 30 days</small>
              </div>
              <div className="stat-card">
                <small>Absent</small>
                <strong>{formatPercentage(attendance.absentPercentage ?? 0)}</strong>
                <small>Across the last 30 days</small>
              </div>
            </div>
            <table className="dashboard-table" style={{ marginTop: '1rem' }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {(attendance.records ?? []).map((record, index) => (
                  <tr key={`${record.date}-${index}`}>
                    <td>{formatDate(record.date)}</td>
                    <td>{formatStatus(record.status)}</td>
                    <td>{record.notes ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <EmptyState message="Attendance tracking will appear here once your trainer logs sessions." />
        )}
      </DashboardSection>

      <DashboardSection title="Trainer notes">
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
          <EmptyState message="Your trainer has not left attendance notes yet." />
        )}
      </DashboardSection>
    </div>
  );
};

export default TraineeAttendancePage;
