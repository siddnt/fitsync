import { useState } from 'react';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import {
  useGetManagerGymsQuery,
  useDeleteGymByManagerMutation,
} from '../../../services/managerApi.js';
import { formatDate, formatNumber, formatStatus } from '../../../utils/format.js';
import '../Dashboard.css';

const GymsPage = () => {
  const { data, isLoading, isError, refetch } = useGetManagerGymsQuery();
  const [deleteGym, { isLoading: isDeleting }] = useDeleteGymByManagerMutation();

  const gyms = data?.data?.gyms ?? [];
  const [notice, setNotice] = useState(null);
  const [errorNotice, setErrorNotice] = useState(null);

  const handleDelete = async (gym) => {
    setNotice(null);
    setErrorNotice(null);
    const confirmed = window.confirm(
      `Remove ${gym.name}? This will cancel all memberships, trainer assignments, and listing subscriptions associated with this gym. This cannot be undone.`,
    );
    if (!confirmed) return;
    try {
      await deleteGym(gym.id).unwrap();
      setNotice('Gym removed successfully.');
      refetch();
    } catch (err) {
      setErrorNotice(err?.data?.message ?? 'Unable to remove the gym.');
    }
  };

  if (isLoading) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked">
        <DashboardSection title="Gyms"><SkeletonPanel lines={10} /></DashboardSection>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked">
        <DashboardSection title="Gyms" action={<button type="button" onClick={() => refetch()}>Retry</button>}>
          <EmptyState message="Could not load gyms." />
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="dashboard-grid dashboard-grid--stacked">
      <DashboardSection
        title="Gyms"
        action={<button type="button" onClick={() => refetch()}>Refresh</button>}
      >
        {(notice || errorNotice) && (
          <div className={`status-pill ${errorNotice ? 'status-pill--warning' : 'status-pill--success'}`}>
            {errorNotice || notice}
          </div>
        )}

        {gyms.length ? (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Owner</th>
                <th>Status</th>
                <th>Members</th>
                <th>Sponsorship</th>
                <th>Impressions</th>
                <th>Created</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {gyms.map((gym) => (
                <tr key={gym.id}>
                  <td>
                    <strong>{gym.name}</strong>
                    <div><small>{gym.city}</small></div>
                  </td>
                  <td>
                    {gym.owner?.name ?? '—'}
                    <div><small>{gym.owner?.email}</small></div>
                  </td>
                  <td>
                    <span className={`status-pill ${gym.status === 'active' ? 'status-pill--success' : 'status-pill--warning'}`}>
                      {formatStatus(gym.status)}
                    </span>
                  </td>
                  <td>{formatNumber(gym.activeMembers ?? 0)}</td>
                  <td>{formatStatus(gym.sponsorship?.tier ?? 'none')}</td>
                  <td>{formatNumber(gym.analytics?.impressions ?? 0)}</td>
                  <td>{formatDate(gym.createdAt)}</td>
                  <td>
                    <button
                      type="button"
                      className="manager-btn manager-btn--reject"
                      onClick={() => handleDelete(gym)}
                      disabled={isDeleting}
                    >
                      {isDeleting ? 'Removing…' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="No gyms to review right now." />
        )}
      </DashboardSection>
    </div>
  );
};

export default GymsPage;
