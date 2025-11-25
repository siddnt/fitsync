import { useState, useMemo, useEffect, useCallback } from 'react';
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
  const [gymActionMessage, setGymActionMessage] = useState(null);
  const [gymActionError, setGymActionError] = useState(null);
  const [processingGymId, setProcessingGymId] = useState(null);
  const [processingGymAction, setProcessingGymAction] = useState(null);

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

  const displayGyms = useMemo(
    () => gyms.filter((gym) => gym.status !== 'suspended'),
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

  const clearGymMessages = useCallback(() => {
    setGymActionMessage(null);
    setGymActionError(null);
  }, []);

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
    clearGymMessages();
    setActiveGymId(gymId);
  };

  const handleCancelEdit = () => {
    clearGymMessages();
    setActiveGymId(null);
    dispatch(resetForm('gymEdit'));
  };

  const handleStartCreate = () => {
    setActiveGymId(null);
    dispatch(resetForm('gymEdit'));
    dispatch(resetForm('gymCreate'));
    clearGymMessages();
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
    clearGymMessages();
    setIsCreateOpen(false);
    dispatch(resetForm('gymCreate'));
  };

  const isOverlayOpen = isCreateOpen || Boolean(activeGymId);
  const overlayTitle = isCreateOpen
    ? 'Add a new gym'
    : activeGym?.name
      ? `Edit ${activeGym.name}`
      : 'Edit gym';

  useEffect(() => {
    if (!isOverlayOpen) {
      return undefined;
    }

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [isOverlayOpen]);

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

  const handleTogglePublishGym = async (gym) => {
    if (!gym) {
      return;
    }

    clearGymMessages();
    setProcessingGymId(gym.id);
    setProcessingGymAction('toggle');

    const shouldPublish = !gym.isPublished;
    const nextStatus = shouldPublish ? 'active' : 'paused';

    try {
      await updateGym({ id: gym.id, status: nextStatus, isPublished: shouldPublish }).unwrap();
      setGymActionMessage(shouldPublish ? 'Gym published successfully.' : 'Gym hidden from marketplace.');
      await refetch();
    } catch (mutationError) {
      setGymActionError(mutationError?.data?.message ?? 'Could not update gym visibility.');
    } finally {
      setProcessingGymId(null);
      setProcessingGymAction(null);
    }
  };

  const handleDeleteGym = async (gym) => {
    if (!gym) {
      return;
    }

    const confirmed = window.confirm(`Remove ${gym.name}? This will hide the listing for members.`);
    if (!confirmed) {
      return;
    }

    clearGymMessages();
    setProcessingGymId(gym.id);
    setProcessingGymAction('delete');

    try {
      await updateGym({ id: gym.id, status: 'suspended', isPublished: false }).unwrap();
      setGymActionMessage('Gym removed from your listings.');
      if (activeGymId === gym.id) {
        setActiveGymId(null);
        dispatch(resetForm('gymEdit'));
      }
      await refetch();
    } catch (mutationError) {
      setGymActionError(mutationError?.data?.message ?? 'Could not remove this gym.');
    } finally {
      setProcessingGymId(null);
      setProcessingGymAction(null);
    }
  };

  const handleOverlayDismiss = () => {
    if (isCreateOpen) {
      handleCancelCreate();
    } else if (activeGymId) {
      handleCancelEdit();
    }
  };

  const handleOverlayBackdropClick = (event) => {
    if (event.target === event.currentTarget) {
      handleOverlayDismiss();
    }
  };

  if (isLoading) {
    return (
      <div className="dashboard-grid dashboard-grid--owner">
        <DashboardSection title="Registered gyms">
          <SkeletonPanel lines={6} />
        </DashboardSection>
        <DashboardSection title="Trainer approvals">
          <SkeletonPanel lines={6} />
        </DashboardSection>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="dashboard-grid dashboard-grid--owner">
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
    <>
      <div className="dashboard-grid dashboard-grid--owner">
        <DashboardSection
          title="Registered gyms"
          action={(
            <button type="button" className="cta-button" onClick={handleStartCreate}>
              Add gym
            </button>
          )}
          className="dashboard-section--span-12"
        >
          {gymActionError ? (
            <p className="dashboard-message dashboard-message--error">{gymActionError}</p>
          ) : null}
          {gymActionMessage ? (
            <p className="dashboard-message dashboard-message--success">{gymActionMessage}</p>
          ) : null}

          {displayGyms.length ? (
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
                {displayGyms.map((gym) => {
                  const isProcessing = processingGymId === gym.id;
                  const toggling = isProcessing && processingGymAction === 'toggle';
                  const deleting = isProcessing && processingGymAction === 'delete';
                  const disableLabel = gym.isPublished ? 'Disable' : 'Enable';
                  return (
                  <tr key={gym.id}>
                    <td>{gym.name}</td>
                    <td>{formatStatus(gym.status)}</td>
                    <td>
                      Active {gym.members?.active ?? 0} · Paused {gym.members?.paused ?? 0}
                    </td>
                    <td>{formatDate(gym.updatedAt)}</td>
                    <td>
                      <div className="button-row">
                        <button type="button" onClick={() => handleEditGym(gym.id)}>
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTogglePublishGym(gym)}
                          disabled={isProcessing}
                        >
                          {toggling ? 'Updating…' : disableLabel}
                        </button>
                        <button
                          type="button"
                          className="button--danger"
                          onClick={() => handleDeleteGym(gym)}
                          disabled={isProcessing}
                        >
                          {deleting ? 'Removing…' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
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
          className="dashboard-section--span-12"
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

      </div>

      {isOverlayOpen ? (
        <div
          className="dashboard-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={overlayTitle}
          onClick={handleOverlayBackdropClick}
        >
          <div className="dashboard-overlay__panel">
            <DashboardSection
              title={overlayTitle}
              className="dashboard-section--overlay"
              action={(
                <div className="dashboard-overlay__actions">
                  {activeGym ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleTogglePublishGym(activeGym)}
                        disabled={processingGymId === activeGym.id}
                      >
                        {processingGymId === activeGym.id && processingGymAction === 'toggle'
                          ? 'Updating…'
                          : activeGym.isPublished
                            ? 'Disable listing'
                            : 'Enable listing'}
                      </button>
                      <button
                        type="button"
                        className="button--danger"
                        onClick={() => handleDeleteGym(activeGym)}
                        disabled={processingGymId === activeGym.id}
                      >
                        {processingGymId === activeGym.id && processingGymAction === 'delete'
                          ? 'Removing…'
                          : 'Delete'}
                      </button>
                    </>
                  ) : null}
                  <button type="button" className="ghost-button" onClick={handleOverlayDismiss}>
                    Close
                  </button>
                </div>
              )}
            >
              {isCreateOpen ? (
                isPlansFetching && !plans.length ? (
                  <SkeletonPanel lines={8} />
                ) : plans.length ? (
                  <GymCreateForm
                    onSubmit={handleCreateGym}
                    onCancel={handleCancelCreate}
                    plans={plans}
                    isPlansLoading={isPlansFetching}
                  />
                ) : (
                  <EmptyState message="Activate a listing plan from the subscriptions tab before adding a gym." />
                )
              ) : activeGym ? (
                isGymDetailsFetching && !formInitialValues ? (
                  <SkeletonPanel lines={6} />
                ) : (
                  <GymEditForm
                    onSubmit={handleUpdateGym}
                    onCancel={handleCancelEdit}
                    initialValues={formInitialValues}
                  />
                )
              ) : null}
            </DashboardSection>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default GymOwnerGymsPage;
