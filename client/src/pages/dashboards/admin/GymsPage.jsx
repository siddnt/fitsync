import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import { useGetAdminGymsQuery } from '../../../services/dashboardApi.js';
import { useDeleteGymMutation } from '../../../services/adminApi.js';
import { formatDate, formatNumber, formatStatus } from '../../../utils/format.js';
import '../Dashboard.css';

const AdminGymsPage = () => {
  const { data, isLoading, isError, refetch } = useGetAdminGymsQuery();
  const [deleteGym, { isLoading: isDeleting }] = useDeleteGymMutation();
  const gyms = data?.data?.gyms ?? [];
  const [notice, setNotice] = useState(null);
  const [errorNotice, setErrorNotice] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const statusOptions = useMemo(() => {
    const values = new Set(gyms.map((g) => g.status).filter(Boolean));
    return ['all', ...values];
  }, [gyms]);

  const filteredGyms = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return gyms.filter((gym) => {
      if (statusFilter !== 'all' && gym.status !== statusFilter) return false;
      if (!query) return true;
      const haystacks = [gym.name, gym.city, gym.state, gym.owner?.name, gym.owner?.email].filter(Boolean).map((v) => v.toLowerCase());
      return haystacks.some((v) => v.includes(query));
    });
  }, [gyms, searchTerm, statusFilter]);

  const filtersActive = searchTerm.trim() || statusFilter !== 'all';
  const resetFilters = () => { setSearchTerm(''); setStatusFilter('all'); };

  const handleDelete = async (gym) => {
    if (!gym) return;
    setNotice(null);
    setErrorNotice(null);
    const confirmed = window.confirm(`Remove ${gym.name}? This will cancel memberships and listings.`);
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
      <div className="dashboard-grid dashboard-grid--stacked">
        <DashboardSection title="Gyms"><SkeletonPanel lines={10} /></DashboardSection>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked">
        <DashboardSection title="Gym administration" action={<button type="button" onClick={() => refetch()}>Retry</button>}>
          <EmptyState message="We could not load the gyms list." />
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="dashboard-grid dashboard-grid--stacked">
      <DashboardSection title="Gym Overview">
        <div className="stat-grid">
          <div className="stat-card"><small>Total Gyms</small><strong>{gyms.length}</strong></div>
          <div className="stat-card"><small>Published</small><strong>{gyms.filter((g) => g.isPublished).length}</strong></div>
          <div className="stat-card"><small>Active Members</small><strong>{gyms.reduce((s, g) => s + (g.activeMembers ?? 0), 0)}</strong></div>
          <div className="stat-card"><small>Active Trainers</small><strong>{gyms.reduce((s, g) => s + (g.activeTrainers ?? 0), 0)}</strong></div>
        </div>
      </DashboardSection>

      <DashboardSection
        title="All Gyms"
        action={
          <div className="users-toolbar">
            <input type="search" className="inventory-toolbar__input" placeholder="Search gym, city, owner" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} aria-label="Search gyms" />
            <select className="inventory-toolbar__input inventory-toolbar__input--select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status">
              {statusOptions.map((o) => <option key={o} value={o}>{o === 'all' ? 'All statuses' : formatStatus(o)}</option>)}
            </select>
            {filtersActive ? <button type="button" className="users-toolbar__reset" onClick={resetFilters}>Reset</button> : null}
            <button type="button" className="users-toolbar__refresh" onClick={() => refetch()}>Refresh</button>
          </div>
        }
      >
        {(notice || errorNotice) && (
          <div className={`status-pill ${errorNotice ? 'status-pill--warning' : 'status-pill--success'}`}>
            {errorNotice || notice}
          </div>
        )}

        {filteredGyms.length ? (
          <div className="admin-table-wrapper">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Owner</th>
                  <th>Status</th>
                  <th>Members</th>
                  <th>Trainers</th>
                  <th>Sponsorship</th>
                  <th>Impressions</th>
                  <th>Created</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredGyms.map((gym) => (
                  <tr key={gym.id}>
                    <td>
                      <Link to={`/dashboard/admin/gyms/${gym.id}`} className="dashboard-table__user--link">
                        {gym.name}
                      </Link>
                      <div><small>{gym.city}{gym.state ? `, ${gym.state}` : ''}</small></div>
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
                    <td>{gym.activeMembers}</td>
                    <td>{gym.activeTrainers}</td>
                    <td>{formatStatus(gym.sponsorship?.tier)}</td>
                    <td>{formatNumber(gym.analytics?.impressions ?? 0)}</td>
                    <td>{formatDate(gym.createdAt)}</td>
                    <td>
                      <button type="button" onClick={() => handleDelete(gym)} disabled={isDeleting}>
                        {isDeleting ? 'Removing…' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState message={filtersActive ? 'No gyms match filters.' : 'No gyms to review right now.'} />
        )}
      </DashboardSection>
    </div>
  );
};

export default AdminGymsPage;
