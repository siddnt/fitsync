import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import { useGetTraineeProgressQuery } from '../../../services/dashboardApi.js';
import {
  formatDate,
  formatStatus,
} from '../../../utils/format.js';
import '../Dashboard.css';

const TraineeProgressPage = () => {
  const { data, isLoading, isError, refetch } = useGetTraineeProgressQuery();
  const progress = data?.data;

  if (isLoading) {
    return (
      <div className="dashboard-grid">
        {['Attendance insights', 'Performance metrics', 'Trainer feedback'].map((title) => (
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


    </div>
  );
};

export default TraineeProgressPage;
