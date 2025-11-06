import { useState, useMemo } from 'react';
import { SubmissionError, reset as resetForm } from 'redux-form';
import { useDispatch } from 'react-redux';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import { useGetGymOwnerGymsQuery } from '../../../services/dashboardApi.js';
import { useGetGymByIdQuery, useUpdateGymMutation, useCreateGymMutation } from '../../../services/gymsApi.js';
import {
  useGetMonetisationOptionsQuery,
  useGetTrainerRequestsQuery,
  useApproveTrainerRequestMutation,
  useDeclineTrainerRequestMutation,
} from '../../../services/ownerApi.js';
import GymEditForm from '../../../features/gyms/GymEditForm.jsx';
import GymCreateForm from '../../../features/gyms/GymCreateForm.jsx';
import { transformGymPayload } from '../../../features/gyms/helpers.js';
import { formatDate, formatStatus } from '../../../utils/format.js';
import '../Dashboard.css';

const GymOwnerGymsPage = () => {
  const dispatch = useDispatch();
  const [activeGymId, setActiveGymId] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [processingRequestId, setProcessingRequestId] = useState(null);
  const [processingAction, setProcessingAction] = useState(null);
  const [trainerActionMessage, setTrainerActionMessage] = useState(null);
  const [trainerActionError, setTrainerActionError] = useState(null);

  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useGetGymOwnerGymsQuery();

  const rawGyms = data?.data?.gyms;

  const gyms = useMemo(
    () => (Array.isArray(rawGyms) ? rawGyms : []),
    [rawGyms],
  );

  const pendingGyms = useMemo(
    () => gyms.filter((gym) => gym.status !== 'active' || !gym.isPublished),
    [gyms],
  );

  const activeGym = useMemo(() => gyms.find((gym) => gym.id === activeGymId), [gyms, activeGymId]);

  const {
    data: monetisationResponse,
    isFetching: isPlansFetching,
  } = useGetMonetisationOptionsQuery();

  const {
    data: trainerRequestsResponse,
    isFetching: isTrainerRequestsFetching,
    isError: isTrainerRequestsError,
    refetch: refetchTrainerRequests,
  } = useGetTrainerRequestsQuery();

  const [approveTrainerRequest, { isLoading: isApprovingTrainer }] = useApproveTrainerRequestMutation();
  const [declineTrainerRequest, { isLoading: isDecliningTrainer }] = useDeclineTrainerRequestMutation();

  const plans = monetisationResponse?.data?.listingPlans ?? [];

  const pendingTrainerRequests = useMemo(
    () => (Array.isArray(trainerRequestsResponse?.data?.requests)
      ? trainerRequestsResponse.data.requests
      : []),
    [trainerRequestsResponse?.data?.requests],
  );

  const clearTrainerMessages = () => {
    setTrainerActionMessage(null);
    setTrainerActionError(null);
  };

  const {
    data: gymDetailsResponse,
    isFetching: isGymDetailsFetching,
  } = useGetGymByIdQuery(activeGymId, { skip: !activeGymId });

  const [updateGym] = useUpdateGymMutation();
  const [createGym] = useCreateGymMutation();

  const formInitialValues = useMemo(() => {
    const details = gymDetailsResponse?.data?.gym;
    if (!details) {
      return undefined;
    }

    return {
      name: details.name,
      description: details.description,
      location: {
        city: details.city ?? details.location?.city ?? '',
        state: details.location?.state ?? '',
      },
      pricing: {
        mrp: details.pricing?.mrp ?? '',
        discounted: details.pricing?.discounted ?? '',
      },
      contact: {
        phone: details.contact?.phone ?? '',
      },
      schedule: {
        open: details.schedule?.open ?? '',
        close: details.schedule?.close ?? '',
      },
      keyFeatures: (details.keyFeatures ?? []).join(', '),
      tags: (details.tags ?? []).join(', '),
    };
  }, [gymDetailsResponse]);

  const handleEditGym = (gymId) => {
    setIsCreateOpen(false);
    dispatch(resetForm('gymCreate'));
    setActiveGymId(gymId);
  };

  const handleCancelEdit = () => {
    setActiveGymId(null);
    dispatch(resetForm('gymEdit'));
  };

  const handleStartCreate = () => {
    setActiveGymId(null);
    dispatch(resetForm('gymEdit'));
    dispatch(resetForm('gymCreate'));
    setIsCreateOpen(true);
  };

  const handleRefreshTrainerRequests = () => {
    clearTrainerMessages();
    refetchTrainerRequests();
  };

  const handleApproveTrainer = async (assignmentId) => {
    if (!assignmentId) {
      return;
    }

    clearTrainerMessages();
    setProcessingRequestId(assignmentId);
    setProcessingAction('approve');

    try {
      await approveTrainerRequest({ assignmentId }).unwrap();
      setTrainerActionMessage('Trainer approved successfully.');
      await Promise.all([refetch(), refetchTrainerRequests()]);
    } catch (error) {
      setTrainerActionError(error?.data?.message ?? 'Could not approve trainer request.');
    } finally {
      setProcessingRequestId(null);
      setProcessingAction(null);
    }
  };

  const handleDeclineTrainer = async (assignmentId) => {
    if (!assignmentId) {
      return;
    }

    clearTrainerMessages();
    setProcessingRequestId(assignmentId);
    setProcessingAction('decline');

    try {
      await declineTrainerRequest({ assignmentId }).unwrap();
      setTrainerActionMessage('Trainer request declined.');
      await Promise.all([refetch(), refetchTrainerRequests()]);
    } catch (error) {
      setTrainerActionError(error?.data?.message ?? 'Could not decline trainer request.');
    } finally {
      setProcessingRequestId(null);
      setProcessingAction(null);
    }
  };

  const handleCancelCreate = () => {
    setIsCreateOpen(false);
    dispatch(resetForm('gymCreate'));
  };

  const handleUpdateGym = async (values) => {
    if (!activeGymId) {
      return;
    }

    try {
      const payload = transformGymPayload(values);
      await updateGym({ id: activeGymId, ...payload }).unwrap();
      await refetch();
      setActiveGymId(null);
      dispatch(resetForm('gymEdit'));
    } catch (error) {
      const message = error?.data?.message ?? 'Could not update gym details.';
      throw new SubmissionError({ _error: message });
    }
  };

  const handleCreateGym = async (values) => {
    try {
      const payload = transformGymPayload(values);
      const planCode = values.planCode;
      const paymentReference = values.paymentReference;
      const autoRenew = Boolean(values.autoRenew);

      const response = await createGym({
        ...payload,
        subscription: {
          planCode,
          paymentReference,
          autoRenew,
        },
      }).unwrap();

      const createdGym = response?.data?.gym;

      await refetch();
      dispatch(resetForm('gymCreate'));
      setIsCreateOpen(false);

      if (createdGym?.id) {
        setActiveGymId(createdGym.id);
      }
    } catch (error) {
      const message = error?.data?.message ?? 'Could not create gym.';
      throw new SubmissionError({ _error: message });
    }
  };

  if (isLoading) {
    return (
      <div className="dashboard-grid">
        {['Registered gyms', 'Pending approvals'].map((title) => (
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
          title="Gyms unavailable"
          action={(
            <button type="button" onClick={() => refetch()}>
              Retry
            </button>
          )}
        >
          <EmptyState message="We ran into a problem fetching your gym list." />
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="dashboard-grid">
      <DashboardSection
        title="Registered gyms"
        action={(
          <button type="button" className="cta-button" onClick={handleStartCreate}>
            Add gym
          </button>
        )}
      >
        {gyms.length ? (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Members</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {gyms.map((gym) => (
                <tr key={gym.id}>
                  <td>{gym.name}</td>
                  <td>{formatStatus(gym.status)}</td>
                  <td>
                    Active {gym.members?.active ?? 0} · Paused {gym.members?.paused ?? 0}
                  </td>
                  <td>{formatDate(gym.updatedAt)}</td>
                  <td>
                    <button type="button" onClick={() => handleEditGym(gym.id)} className="ghost-button">
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="Add your first gym to start attracting members." />
        )}
      </DashboardSection>

      <DashboardSection
        title="Trainer approvals"
        action={(
          <button type="button" className="ghost-button" onClick={handleRefreshTrainerRequests}>
            Refresh
          </button>
        )}
      >
        {trainerActionError ? (
          <p className="dashboard-message dashboard-message--error">{trainerActionError}</p>
        ) : null}
        {trainerActionMessage ? (
          <p className="dashboard-message dashboard-message--success">{trainerActionMessage}</p>
        ) : null}

        {isTrainerRequestsFetching && !pendingTrainerRequests.length ? (
          <SkeletonPanel lines={4} />
        ) : isTrainerRequestsError ? (
          <EmptyState message="We could not load trainer requests." />
        ) : pendingTrainerRequests.length ? (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Trainer</th>
                <th>Gym</th>
                <th>Requested</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingTrainerRequests.map((request) => {
                const isProcessing = processingRequestId === request.id;
                const approving = isProcessing && processingAction === 'approve' && isApprovingTrainer;
                const declining = isProcessing && processingAction === 'decline' && isDecliningTrainer;
                const disabled = isProcessing && (isApprovingTrainer || isDecliningTrainer);
                const trainer = request.trainer ?? {};
                const metaParts = [];

                if (typeof trainer.experienceYears === 'number') {
                  metaParts.push(`${trainer.experienceYears} yrs experience`);
                }

                if (typeof trainer.mentoredCount === 'number' && trainer.mentoredCount > 0) {
                  metaParts.push(`${trainer.mentoredCount} trainees mentored`);
                }

                if (typeof trainer.age === 'number' && trainer.age > 0) {
                  metaParts.push(`${trainer.age} yrs`);
                }

                if (typeof trainer.height === 'number' && trainer.height > 0) {
                  metaParts.push(`${trainer.height} cm`);
                }

                if (trainer.gender) {
                  const genderLabel = trainer.gender
                    .replace(/-/g, ' ')
                    .split(' ')
                    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
                    .join(' ');
                  metaParts.push(genderLabel);
                }

                const specialisations = Array.isArray(trainer.specializations) && trainer.specializations.length
                  ? trainer.specializations.join(', ')
                  : null;

                const certifications = Array.isArray(trainer.certifications) && trainer.certifications.length
                  ? trainer.certifications.join(', ')
                  : null;
                const bio = trainer.bio ? `${trainer.bio.slice(0, 220)}${trainer.bio.length > 220 ? '…' : ''}` : null;

                return (
                  <tr key={request.id}>
                    <td>
                      <strong>{trainer.name ?? 'Unknown trainer'}</strong>
                      {metaParts.length ? (
                        <div className="dashboard-table__meta">{metaParts.join(' • ')}</div>
                      ) : null}
                      {trainer.headline ? (
                        <div className="dashboard-table__meta">{trainer.headline}</div>
                      ) : null}
                      {specialisations ? (
                        <div className="dashboard-table__meta">Specialisations: {specialisations}</div>
                      ) : null}
                      {certifications ? (
                        <div className="dashboard-table__meta">Certifications: {certifications}</div>
                      ) : null}
                      {bio ? (
                        <div className="dashboard-table__note">{bio}</div>
                      ) : null}
                    </td>
                    <td>{request.gym?.name ?? '—'}</td>
                    <td>{formatDate(request.requestedAt)}</td>
                    <td>
                      <div className="button-row">
                        <button
                          type="button"
                          className="cta-button"
                          onClick={() => handleApproveTrainer(request.id)}
                          disabled={disabled}
                        >
                          {approving ? 'Approving…' : 'Approve'}
                        </button>
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => handleDeclineTrainer(request.id)}
                          disabled={disabled}
                        >
                          {declining ? 'Declining…' : 'Decline'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <EmptyState message="No trainer requests awaiting approval." />
        )}
      </DashboardSection>

      <DashboardSection title="Pending approvals">
        {pendingGyms.length ? (
          <ul>
            {pendingGyms.map((gym) => (
              <li key={`${gym.id}-pending`}>
                <strong>{gym.name}</strong> · {formatStatus(gym.status)} · Last updated {formatDate(gym.updatedAt)}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState message="All gyms are active and visible." />
        )}
      </DashboardSection>

      {isCreateOpen ? (
        <DashboardSection title="Add a new gym">
          {isPlansFetching && !plans.length ? (
            <SkeletonPanel lines={8} />
          ) : (
            <GymCreateForm
              onSubmit={handleCreateGym}
              onCancel={handleCancelCreate}
              plans={plans}
              isPlansLoading={isPlansFetching}
            />
          )}
        </DashboardSection>
      ) : null}

      {activeGym ? (
        <DashboardSection title={`Edit ${activeGym.name}`}>
          {isGymDetailsFetching && !formInitialValues ? (
            <SkeletonPanel lines={6} />
          ) : (
            <GymEditForm
              onSubmit={handleUpdateGym}
              onCancel={handleCancelEdit}
              initialValues={formInitialValues}
            />
          )}
        </DashboardSection>
      ) : null}
    </div>
  );
};

export default GymOwnerGymsPage;
