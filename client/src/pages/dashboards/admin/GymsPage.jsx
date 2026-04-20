import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import { useGetAdminGymsQuery } from '../../../services/dashboardApi.js';
import { useDeleteGymMutation } from '../../../services/adminApi.js';
import { formatDate, formatNumber, formatStatus } from '../../../utils/format.js';
import PaginationBar from '../../../ui/PaginationBar.jsx';
import '../Dashboard.css';

const AdminGymsPage = () => {
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data, isLoading, isError, refetch } = useGetAdminGymsQuery({ page, search: searchTerm, status: statusFilter });
  const [deleteGym, { isLoading: isDeleting }] = useDeleteGymMutation();
  const gyms = data?.data?.gyms ?? [];
  const pagination = data?.data?.pagination ?? {};
  const [notice, setNotice] = useState(null);
  const [errorNotice, setErrorNotice] = useState(null);

  useEffect(() => { setPage(1); }, [searchTerm, statusFilter]);

  // Provide hardcoded or broader status options since the local strictly paginated gym list might miss options
  const statusOptions = ['all', 'active', 'pending', 'inactive'];

  const filteredGyms = gyms; // The backend now performs the filtering

  const filtersActive = searchTerm.trim() || statusFilter !== 'all';
  const resetFilters = () => { setSearchTerm(''); setStatusFilter('all'); };

  const totalPages = pagination.totalPages ?? 1;
  const totalItems = pagination.total ?? 0;
  const startIndex = (page - 1) * (pagination.limit ?? 10) + 1;
  const endIndex = Math.min(page * (pagination.limit ?? 10), Math.max(totalItems, 1));

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
                  <th style={{ width: '25%' }}>Name</th>
                  <th>Owner</th>
                  <th style={{ width: '150px' }}>Status</th>
                  <th>Members</th>
                  <th>Trainers</th>
                  <th>Sponsorship</th>
                  <th>Impressions</th>
                  <th style={{ width: '130px' }}>Created</th>
                  <th style={{ width: '120px' }}>Action</th>
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
            <PaginationBar page={page} totalPages={totalPages} totalItems={totalItems} startIndex={startIndex} endIndex={endIndex} onPage={setPage} />
          </div>
        ) : (
          <EmptyState message={filtersActive ? 'No gyms match filters.' : 'No gyms to review right now.'} />
        )}
      </DashboardSection>
    </div>
  );
};

export default AdminGymsPage;
