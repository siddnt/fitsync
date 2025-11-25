import { useMemo, useState } from 'react';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import {
  useGetGymOwnerRosterQuery,
} from '../../../services/dashboardApi.js';
import {
  useRemoveTrainerFromGymMutation,
  useRemoveGymMemberMutation,
} from '../../../services/ownerApi.js';
import { formatDate, formatStatus } from '../../../utils/format.js';
import '../Dashboard.css';

const GymOwnerRosterPage = () => {
  const {
    data: rosterResponse,
    isLoading: isRosterLoading,
    isError: isRosterError,
    refetch: refetchRoster,
  } = useGetGymOwnerRosterQuery();

  const [removeTrainerFromGym, { isLoading: isRemovingTrainer }] = useRemoveTrainerFromGymMutation();
  const [removeGymMember, { isLoading: isRemovingMember }] = useRemoveGymMemberMutation();

  const [rosterMessage, setRosterMessage] = useState(null);
  const [rosterError, setRosterError] = useState(null);
  const [removalContext, setRemovalContext] = useState(null);

  const rosterGyms = useMemo(
    () => (Array.isArray(rosterResponse?.data?.gyms) ? rosterResponse.data.gyms : []),
    [rosterResponse?.data?.gyms],
  );

  const isProcessingRemoval = Boolean(
    removalContext
      && ((removalContext.type === 'trainer' && isRemovingTrainer)
        || (removalContext.type === 'member' && isRemovingMember)),
  );

  const resetRosterAlerts = () => {
    setRosterMessage(null);
    setRosterError(null);
  };

  const handleRemoveTrainer = async ({ assignmentId, name }, gymName) => {
    if (!assignmentId) {
      return;
    }

    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(`Remove ${name ?? 'this trainer'} from ${gymName}?`);
      if (!confirmed) {
        return;
      }
    }

    resetRosterAlerts();
    setRemovalContext({ type: 'trainer', id: assignmentId });

    try {
      await removeTrainerFromGym({ assignmentId }).unwrap();
      setRosterMessage('Trainer removed successfully.');
      await refetchRoster();
    } catch (error) {
      setRosterError(error?.data?.message ?? 'Unable to remove trainer right now.');
    } finally {
      setRemovalContext(null);
    }
  };

  const handleRemoveMember = async ({ membershipId, name }, gymName) => {
    if (!membershipId) {
      return;
    }

    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(`Remove ${name ?? 'this member'} from ${gymName}?`);
      if (!confirmed) {
        return;
      }
    }

    resetRosterAlerts();
    setRemovalContext({ type: 'member', id: membershipId });

    try {
      await removeGymMember({ membershipId }).unwrap();
      setRosterMessage('Member removed successfully.');
      await refetchRoster();
    } catch (error) {
      setRosterError(error?.data?.message ?? 'Unable to remove member right now.');
    } finally {
      setRemovalContext(null);
    }
  };

  return (
    <div className="dashboard-grid dashboard-grid--owner">
      <DashboardSection
        title="People roster"
        className="dashboard-section--span-12"
        action={(
          <button type="button" onClick={() => { resetRosterAlerts(); refetchRoster(); }}>
            Refresh
          </button>
        )}
      >
        {rosterMessage && (
          <p className="dashboard-message dashboard-message--success">{rosterMessage}</p>
        )}
        {(rosterError || isRosterError) && (
          <p className="dashboard-message dashboard-message--error">
            {rosterError ?? 'We could not load your roster right now.'}
          </p>
        )}

        {isRosterLoading && !rosterGyms.length ? (
          <SkeletonPanel lines={8} />
        ) : rosterGyms.length ? (
          <div className="owner-roster-grid">
            {rosterGyms.map((gym) => (
              <div key={gym.id} className="owner-roster-card">
                <div className="owner-roster-card__header">
                  <div>
                    <h4>{gym.name}</h4>
                    <p>{gym.city || 'Location pending'}</p>
                  </div>
                  <div className="owner-roster-card__meta">
                    <span className={`owner-roster-badge owner-roster-badge--${gym.status}`}>
                      {formatStatus(gym.status)}
                    </span>
                    {!gym.isPublished && <span className="owner-roster-tag owner-roster-tag--draft">Draft</span>}
                  </div>
                </div>

                <div className="owner-roster-columns">
                  <div className="owner-roster-list">
                    <div className="owner-roster-list__title">
                      <span>Members</span>
                      <small>{gym.trainees.length}</small>
                    </div>
                    {gym.trainees.length ? (
                      <ul className="owner-roster-list__items">
                        {gym.trainees.map((member) => (
                          <li key={member.membershipId} className="owner-roster-list__item">
                            <div className="owner-roster-avatar">
                              <span>{member.name?.charAt(0) ?? '?'}</span>
                            </div>
                            <div className="owner-roster-meta">
                              <strong>{member.name}</strong>
                              <small>{member.email || 'No email provided'}</small>
                              <small>
                                {member.plan ? formatStatus(member.plan) : 'Custom plan'} ·
                                {' '}
                                {member.startDate ? `Since ${formatDate(member.startDate)}` : 'Start pending'}
                              </small>
                              {member.trainer?.name && <small>Trainer: {member.trainer.name}</small>}
                            </div>
                            <div className="owner-roster-actions">
                              <button
                                type="button"
                                className="owner-roster-action"
                                disabled={
                                  (removalContext?.type === 'member'
                                    && removalContext?.id === member.membershipId
                                    && isProcessingRemoval)
                                }
                                onClick={() => handleRemoveMember(member, gym.name)}
                              >
                                {removalContext?.type === 'member'
                                  && removalContext?.id === member.membershipId
                                  && isProcessingRemoval
                                  ? 'Removing…'
                                  : 'Remove'}
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="owner-roster-empty">No active members yet.</p>
                    )}
                  </div>

                  <div className="owner-roster-list">
                    <div className="owner-roster-list__title">
                      <span>Trainers</span>
                      <small>{gym.trainers.length}</small>
                    </div>
                    {gym.trainers.length ? (
                      <ul className="owner-roster-list__items">
                        {gym.trainers.map((trainer) => (
                          <li key={trainer.assignmentId} className="owner-roster-list__item">
                            <div className="owner-roster-avatar">
                              {trainer.profilePicture ? (
                                <img src={trainer.profilePicture} alt={trainer.name} />
                              ) : (
                                <span>{trainer.name?.charAt(0) ?? '?'}</span>
                              )}
                            </div>
                            <div className="owner-roster-meta">
                              <strong>{trainer.name}</strong>
                              <small>{trainer.email || 'No email provided'}</small>
                              <small>
                                {trainer.status === 'pending'
                                  ? `Requested ${trainer.requestedAt ? formatDate(trainer.requestedAt) : 'recently'}`
                                  : `Approved ${trainer.approvedAt ? formatDate(trainer.approvedAt) : 'recently'}`}
                              </small>
                            </div>
                            <div className="owner-roster-actions">
                              <button
                                type="button"
                                className="owner-roster-action owner-roster-action--danger"
                                disabled={
                                  (removalContext?.type === 'trainer'
                                    && removalContext?.id === trainer.assignmentId
                                    && isProcessingRemoval)
                                }
                                onClick={() => handleRemoveTrainer(trainer, gym.name)}
                              >
                                {removalContext?.type === 'trainer'
                                  && removalContext?.id === trainer.assignmentId
                                  && isProcessingRemoval
                                  ? 'Removing…'
                                  : 'Remove'}
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="owner-roster-empty">No trainers assigned yet.</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message="Add a gym to start managing trainers and members." />
        )}
      </DashboardSection>
    </div>
  );
};

export default GymOwnerRosterPage;
