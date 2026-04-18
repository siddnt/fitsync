import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import { useGetAdminGymsQuery } from '../../../services/dashboardApi.js';
import { useDeleteGymMutation } from '../../../services/adminApi.js';
import useConfirmationModal from '../../../hooks/useConfirmationModal.js';
import { formatDate, formatNumber, formatStatus } from '../../../utils/format.js';
import '../Dashboard.css';

const AdminGymsPage = () => {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useGetAdminGymsQuery();
  const [deleteGym, { isLoading: isDeleting }] = useDeleteGymMutation();
  const gyms = data?.data?.gyms ?? [];
  const [notice, setNotice] = useState(null);
  const [errorNotice, setErrorNotice] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { confirm, confirmationModal } = useConfirmationModal();

  const filteredGyms = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return gyms;
    return gyms.filter(
      (gym) =>
        (gym.name || '').toLowerCase().includes(query) ||
        (gym.city || '').toLowerCase().includes(query) ||
        (gym.owner?.name || '').toLowerCase().includes(query),
    );
  }, [gyms, searchQuery]);

  const stats = useMemo(() => {
    const active = gyms.filter((g) => g.status === 'active').length;
    const sponsored = gyms.filter((g) => g.sponsorship?.tier && g.sponsorship.tier !== 'none').length;
    const totalImpressions = gyms.reduce((sum, g) => sum + (g.analytics?.impressions ?? 0), 0);
    return { total: gyms.length, active, sponsored, totalImpressions };
  }, [gyms]);

  const handleDelete = async (e, gym) => {
    e.stopPropagation();
    if (!gym) return;
    setNotice(null);
    setErrorNotice(null);

    const confirmed = await confirm({
      title: 'Remove gym listing',
      message: `Remove ${gym.name}? This will cancel memberships and listing billing tied to this gym.`,
      confirmLabel: 'Remove gym',
      cancelLabel: 'Keep gym',
      tone: 'danger',
    });
    if (!confirmed) return;

    try {
      await deleteGym(gym.id).unwrap();
      setNotice('Gym removed successfully.');
      refetch();
    } catch (mutationError) {
      setErrorNotice(mutationError?.data?.message ?? 'Unable to delete the gym.');
    }
  };

  if (isLoading) {
    return (
      <div className="dashboard-grid dashboard-grid--admin">
        <DashboardSection title="Gyms" className="dashboard-section--span-12">
          <SkeletonPanel lines={10} />
        </DashboardSection>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="dashboard-grid dashboard-grid--admin">
        <DashboardSection
          title="Gym administration"
          className="dashboard-section--span-12"
          action={(
            <button type="button" className="admin-gyms__refresh-btn" onClick={() => refetch()}>
              Retry
            </button>
          )}
        >
          <EmptyState message="We could not load the gyms list." />
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="dashboard-grid dashboard-grid--admin">
      <DashboardSection
        title="Gyms"
        className="dashboard-section--span-12"
        action={(
          <button type="button" className="admin-gyms__refresh-btn" onClick={() => refetch()}>
            ↻ Refresh
          </button>
        )}
      >
        {/* Notices */}
        {(notice || errorNotice) && (
          <div className={`status-pill ${errorNotice ? 'status-pill--warning' : 'status-pill--success'}`}>
            {errorNotice || notice}
          </div>
        )}

        {/* Summary Stat Cards */}
        <div className="stat-grid admin-gyms__stats">
          <div className="stat-card">
            <small>Total Gyms</small>
            <strong>{formatNumber(stats.total)}</strong>
          </div>
          <div className="stat-card">
            <small>Active</small>
            <strong>{formatNumber(stats.active)}</strong>
          </div>
          <div className="stat-card">
            <small>Sponsored</small>
            <strong>{formatNumber(stats.sponsored)}</strong>
          </div>
          <div className="stat-card">
            <small>Total Impressions</small>
            <strong>{formatNumber(stats.totalImpressions)}</strong>
          </div>
        </div>

        {/* Search Bar */}
        <div className="admin-gyms__toolbar">
          <input
            type="text"
            className="admin-gyms__search"
            placeholder="Search gyms by name, city, or owner…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <span className="admin-gyms__count">
            {filteredGyms.length === gyms.length
              ? `${gyms.length} gym${gyms.length !== 1 ? 's' : ''}`
              : `${filteredGyms.length} of ${gyms.length} gym${gyms.length !== 1 ? 's' : ''}`}
          </span>
        </div>

        {/* Gym Table */}
        {filteredGyms.length ? (
          <div className="admin-gyms__table-wrap">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Gym</th>
                  <th>Owner</th>
                  <th>Status</th>
                  <th>Sponsorship</th>
                  <th>Impressions</th>
                  <th>Created</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredGyms.map((gym) => (
                  <tr
                    key={gym.id}
                    className="admin-gyms__row"
                    onClick={() => navigate(`/dashboard/admin/gyms/${gym.id}`)}
                    title="Click to view details"
                  >
                    <td>
                      <div className="admin-gyms__gym-cell">
                        <div className="admin-gyms__avatar">
                          {(gym.name || 'G').charAt(0).toUpperCase()}
                        </div>
                        <div className="admin-gyms__gym-info">
                          <strong>{gym.name}</strong>
                          <small>{gym.city || '—'}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="admin-gyms__owner-name">{gym.owner?.name ?? '—'}</span>
                    </td>
                    <td>
                      <span className={`status-pill ${gym.status === 'active' ? 'status-pill--success' : 'status-pill--warning'}`}>
                        {formatStatus(gym.status)}
                      </span>
                    </td>
                    <td>
                      {gym.sponsorship?.tier && gym.sponsorship.tier !== 'none' ? (
                        <span className="status-pill status-pill--info">
                          {formatStatus(gym.sponsorship.tier)}
                        </span>
                      ) : (
                        <span className="admin-gyms__muted">None</span>
                      )}
                    </td>
                    <td>
                      <span className="admin-gyms__impressions">{formatNumber(gym.analytics?.impressions ?? 0)}</span>
                    </td>
                    <td>
                      <span className="admin-gyms__date">{formatDate(gym.createdAt)}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="admin-gyms__delete-btn"
                        onClick={(e) => handleDelete(e, gym)}
                        disabled={isDeleting}
                      >
                        {isDeleting ? 'Removing…' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : searchQuery ? (
          <EmptyState message={`No gyms matching "${searchQuery}".`} />
        ) : (
          <EmptyState message="No gyms to review right now." />
        )}
      </DashboardSection>
      {confirmationModal}
    </div>
  );
};

export default AdminGymsPage;
