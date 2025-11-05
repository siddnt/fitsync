import { useState } from 'react';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import { useGetTrainerUpdatesQuery } from '../../../services/dashboardApi.js';
import { useReviewFeedbackMutation } from '../../../services/trainerApi.js';
import { formatDate, formatDateTime } from '../../../utils/format.js';
import '../Dashboard.css';

const TrainerUpdatesPage = () => {
  const { data, isLoading, isError, refetch } = useGetTrainerUpdatesQuery();
  const updates = data?.data?.updates ?? [];
  const [reviewFeedback, { isLoading: isReviewing }] = useReviewFeedbackMutation();
  const [notice, setNotice] = useState(null);
  const [errorNotice, setErrorNotice] = useState(null);

  const handleReview = async (feedback) => {
    setNotice(null);
    setErrorNotice(null);

    if (!feedback) {
      return;
    }

    try {
      await reviewFeedback({ feedbackId: feedback._id ?? feedback.createdAt }).unwrap();
      setNotice('Feedback marked as reviewed.');
      await refetch();
    } catch (mutationError) {
      setErrorNotice(mutationError?.data?.message ?? 'Unable to update feedback status.');
    }
  };

  if (isLoading) {
    return (
      <div className="dashboard-grid">
        <DashboardSection title="Program updates">
          <SkeletonPanel lines={8} />
        </DashboardSection>
        <DashboardSection title="Check-in alerts">
          <SkeletonPanel lines={6} />
        </DashboardSection>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="dashboard-grid">
        <DashboardSection
          title="Trainer alerts"
          action={(
            <button type="button" onClick={() => refetch()}>
              Retry
            </button>
          )}
        >
          <EmptyState message="We could not load trainee updates." />
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="dashboard-grid">
      <DashboardSection
        title="Program updates"
        action={(
          <button type="button" onClick={() => refetch()}>
            Refresh
          </button>
        )}
      >
        {updates.length ? (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Trainee</th>
                <th>Latest metrics</th>
                <th>Recent attendance</th>
              </tr>
            </thead>
            <tbody>
              {updates.map((update) => (
                <tr key={update.trainee?._id ?? update.trainee?.email}>
                  <td>
                    <div>{update.trainee?.name ?? '—'}</div>
                    <small>{update.trainee?.email}</small>
                  </td>
                  <td>
                    {(update.metrics || []).length ? (
                      <ul>
                        {update.metrics.map((metric) => (
                          <li key={`${metric.metric}-${metric.recordedAt}`}>
                            <strong>{metric.metric}</strong> · {metric.latestValue}
                            {metric.unit ? ` ${metric.unit}` : ''} ({formatDate(metric.recordedAt)})
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <EmptyState message="No progress metrics yet." />
                    )}
                  </td>
                  <td>
                    {(update.attendance || []).length ? (
                      <ul>
                        {update.attendance.map((entry, index) => (
                          <li key={`${entry.date}-${index}`}>
                            {formatDate(entry.date)} · {entry.status}
                            {entry.notes ? ` – ${entry.notes}` : ''}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <EmptyState message="No attendance captured." />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="Trainee progress and attendance will appear once updates are logged." />
        )}
      </DashboardSection>

      <DashboardSection title="Feedback follow-ups">
        {(notice || errorNotice) && (
          <div className={`status-pill ${errorNotice ? 'status-pill--warning' : 'status-pill--success'}`}>
            {errorNotice || notice}
          </div>
        )}

        {updates.some((update) => update.pendingFeedback?.length) ? (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Trainee</th>
                <th>Feedback</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {updates.flatMap((update) =>
                (update.pendingFeedback || []).map((feedback) => (
                  <tr key={`${feedback._id ?? feedback.createdAt}-feedback`}>
                    <td>{update.trainee?.name ?? '—'}</td>
                    <td>
                      <strong>{feedback.category}</strong> · {feedback.message}
                      <div>
                        <small>{formatDateTime(feedback.createdAt)}</small>
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => handleReview(feedback)}
                        disabled={isReviewing}
                      >
                        {isReviewing ? 'Updating…' : 'Mark reviewed'}
                      </button>
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        ) : (
          <EmptyState message="No pending feedback. Keep the momentum going!" />
        )}
      </DashboardSection>
    </div>
  );
};

export default TrainerUpdatesPage;
