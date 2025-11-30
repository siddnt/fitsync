import { useState } from 'react';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import { useGetTrainerUpdatesQuery } from '../../../services/dashboardApi.js';
import { useReviewFeedbackMutation } from '../../../services/trainerApi.js';
import { formatDate, formatDateTime } from '../../../utils/format.js';
import '../Dashboard.css';
import '../TrainerDashboard.css';

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

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (isLoading) {
    return (
      <div className="trainer-updates-page">
        <DashboardSection title="Program updates">
          <SkeletonPanel lines={8} />
        </DashboardSection>
        <DashboardSection title="Feedback follow-ups">
          <SkeletonPanel lines={6} />
        </DashboardSection>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="trainer-updates-page">
        <DashboardSection
          title="Trainer alerts"
          action={(
            <button type="button" onClick={() => refetch()}>
              Retry
            </button>
          )}
        >
          <div className="trainer-empty-state">
            <div className="trainer-empty-state__icon">⚠️</div>
            <h3 className="trainer-empty-state__title">Unable to load updates</h3>
            <p className="trainer-empty-state__message">
              We could not load trainee updates. Please try again.
            </p>
          </div>
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="trainer-updates-page">
      <DashboardSection
        title="Program updates"
        action={(
          <button type="button" onClick={() => refetch()}>
            Refresh
          </button>
        )}
      >
        {updates.length ? (
          <div className="trainer-update-list">
            {updates.map((update) => (
              <div key={update.trainee?._id ?? update.trainee?.email} className="trainer-update-card">
                <div className="trainer-update-card__header">
                  <div className="trainer-update-card__avatar">
                    {getInitials(update.trainee?.name)}
                  </div>
                  <div className="trainer-update-card__info">
                    <p className="trainer-update-card__name">{update.trainee?.name ?? '—'}</p>
                    <p className="trainer-update-card__email">{update.trainee?.email}</p>
                  </div>
                </div>

                <div className="trainer-update-card__section">
                  <h4 className="trainer-update-card__section-title">Latest Metrics</h4>
                  {(update.metrics || []).length ? (
                    <ul className="trainer-metric-list">
                      {update.metrics.map((metric) => (
                        <li key={`${metric.metric}-${metric.recordedAt}`} className="trainer-metric-item">
                          <strong>{metric.metric}:</strong>{' '}
                          <span>{metric.latestValue}{metric.unit ? ` ${metric.unit}` : ''}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyState message="No progress metrics yet." />
                  )}
                </div>

                <div className="trainer-update-card__section">
                  <h4 className="trainer-update-card__section-title">Recent Attendance</h4>
                  {(update.attendance || []).length ? (
                    <ul className="trainer-attendance-list">
                      {update.attendance.map((entry, index) => (
                        <li key={`${entry.date}-${index}`} className="trainer-attendance-item">
                          <span className="trainer-attendance-item__date">{formatDate(entry.date)}</span>
                          <span className={`trainer-attendance-item__status trainer-attendance-item__status--${entry.status}`}>
                            {entry.status}
                          </span>
                          {entry.notes && <span className="trainer-attendance-item__notes">– {entry.notes}</span>}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyState message="No attendance captured." />
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="trainer-empty-state">
            <div className="trainer-empty-state__icon">📊</div>
            <h3 className="trainer-empty-state__title">No updates yet</h3>
            <p className="trainer-empty-state__message">
              Trainee progress and attendance will appear here once you start logging updates.
            </p>
          </div>
        )}
      </DashboardSection>

      <DashboardSection title="Feedback follow-ups">
        {(notice || errorNotice) && (
          <div className={`trainer-notice ${errorNotice ? 'trainer-notice--error' : 'trainer-notice--success'}`}>
            {errorNotice || notice}
          </div>
        )}

        {updates.some((update) => update.pendingFeedback?.length) ? (
          <div className="trainer-feedback-list">
            {updates.flatMap((update) =>
              (update.pendingFeedback || []).map((feedback) => (
                <div key={`${feedback._id ?? feedback.createdAt}-feedback`} className="trainer-feedback-item">
                  <div className="trainer-feedback-item__header">
                    <span className="trainer-feedback-item__trainee">{update.trainee?.name ?? '—'}</span>
                    <span className="trainer-feedback-item__category">{feedback.category}</span>
                  </div>
                  <p className="trainer-feedback-item__message">{feedback.message}</p>
                  <div className="trainer-feedback-item__footer">
                    <span className="trainer-feedback-item__time">{formatDateTime(feedback.createdAt)}</span>
                    <button
                      type="button"
                      className="trainer-feedback-item__btn"
                      onClick={() => handleReview(feedback)}
                      disabled={isReviewing}
                    >
                      {isReviewing ? 'Updating…' : 'Mark reviewed'}
                    </button>
                  </div>
                </div>
              )),
            )}
          </div>
        ) : (
          <div className="trainer-empty-state">
            <div className="trainer-empty-state__icon">✅</div>
            <h3 className="trainer-empty-state__title">All caught up!</h3>
            <p className="trainer-empty-state__message">
              No pending feedback to review. Keep the momentum going with your trainees!
            </p>
          </div>
        )}
      </DashboardSection>
    </div>
  );
};

export default TrainerUpdatesPage;
