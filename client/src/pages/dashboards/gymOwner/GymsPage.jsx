import { useState, useMemo } from 'react';
import { SubmissionError, reset as resetForm } from 'redux-form';
import { useDispatch } from 'react-redux';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import { useGetGymOwnerGymsQuery } from '../../../services/dashboardApi.js';
import { useGetGymByIdQuery, useUpdateGymMutation } from '../../../services/gymsApi.js';
import GymEditForm from '../../../features/gyms/GymEditForm.jsx';
import { transformGymPayload } from '../../../features/gyms/helpers.js';
import { formatDate, formatStatus } from '../../../utils/format.js';
import '../Dashboard.css';

const GymOwnerGymsPage = () => {
  const dispatch = useDispatch();
  const [activeGymId, setActiveGymId] = useState(null);

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
    data: gymDetailsResponse,
    isFetching: isGymDetailsFetching,
  } = useGetGymByIdQuery(activeGymId, { skip: !activeGymId });

  const [updateGym] = useUpdateGymMutation();

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
    setActiveGymId(gymId);
  };

  const handleCancelEdit = () => {
    setActiveGymId(null);
    dispatch(resetForm('gymEdit'));
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
      <DashboardSection title="Registered gyms">
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
