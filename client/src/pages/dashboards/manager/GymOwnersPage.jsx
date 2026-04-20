import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import {
  useGetManagerGymOwnersQuery,
  useUpdateGymOwnerStatusMutation,
  useDeleteGymOwnerByManagerMutation,
} from '../../../services/managerApi.js';
import { formatDate, formatStatus, formatNumber } from '../../../utils/format.js';
import PaginationBar from '../../../ui/PaginationBar.jsx';
import '../Dashboard.css';

const GymOwnersPage = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useGetManagerGymOwnersQuery({ page });
  const [updateStatus, { isLoading: isUpdating }] = useUpdateGymOwnerStatusMutation();
  const [deleteOwner, { isLoading: isDeleting }] = useDeleteGymOwnerByManagerMutation();

  const owners = data?.data?.gymOwners ?? [];
  const pagination = data?.data?.pagination ?? {};
  const [notice, setNotice] = useState(null);
  const [errorNotice, setErrorNotice] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => { setPage(1); }, [searchTerm, statusFilter]);

  const filteredOwners = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return owners.filter((owner) => {
      if (statusFilter !== 'all' && owner.status !== statusFilter) return false;
      if (!query) return true;
      return [owner.name, owner.email].filter(Boolean).some((v) => v.toLowerCase().includes(query));
    });
  }, [owners, searchTerm, statusFilter]);

  const totalPages = pagination.totalPages ?? 1;
  const totalItems = pagination.total ?? filteredOwners.length;
  const startIndex = (page - 1) * (pagination.limit ?? 10) + 1;
  const endIndex = Math.min(page * (pagination.limit ?? 10), totalItems);

  const handleToggleStatus = async (owner) => {
    setNotice(null);
    setErrorNotice(null);
    const newStatus = owner.status === 'active' ? 'inactive' : 'active';
    const warning = newStatus === 'inactive'
      ? `Deactivating ${owner.name ?? 'this owner'} will suspend all their gyms, cancel memberships and trainer assignments. Continue?`
      : null;
    if (warning && !window.confirm(warning)) return;
    try {
      await updateStatus({ userId: owner._id, status: newStatus }).unwrap();
      setNotice(`${owner.name ?? 'Gym Owner'} ${newStatus === 'active' ? 'activated' : 'deactivated'}.`);
      refetch();
    } catch (err) {
      setErrorNotice(err?.data?.message ?? 'Unable to update gym owner status.');
    }
  };

  const handleDelete = async (owner) => {
    setNotice(null);
    setErrorNotice(null);
    const confirmed = window.confirm(
      `Permanently delete ${owner.name ?? 'this gym owner'}? All their gyms, memberships, subscriptions, and revenue will be removed. This cannot be undone.`,
    );
    if (!confirmed) return;
    try {
      await deleteOwner(owner._id).unwrap();
      setNotice(`${owner.name ?? 'Gym Owner'} deleted.`);
      refetch();
    } catch (err) {
      setErrorNotice(err?.data?.message ?? 'Unable to delete gym owner.');
    }
  };

  if (isLoading) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked">
        <DashboardSection title="Gym Owners"><SkeletonPanel lines={10} /></DashboardSection>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked">
        <DashboardSection title="Gym Owners" action={<button type="button" onClick={() => refetch()}>Retry</button>}>
          <EmptyState message="Could not load gym owners." />
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="dashboard-grid dashboard-grid--stacked">
      <DashboardSection
        title="Gym Owners"
        action={
          <div className="users-toolbar">
            <input
              type="search"
              className="inventory-toolbar__input"
              placeholder="Search name or email"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search gym owners"
            />
            <select
              className="inventory-toolbar__input inventory-toolbar__input--select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="pending">Pending</option>
            </select>
            <button type="button" className="users-toolbar__refresh" onClick={() => refetch()}>
              Refresh
            </button>
          </div>
        }
      >
        {(notice || errorNotice) && (
          <div className={`status-pill ${errorNotice ? 'status-pill--warning' : 'status-pill--success'}`}>
            {errorNotice || notice}
          </div>
        )}

        {filteredOwners.length ? (
          <div className="admin-table-wrapper">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th style={{ width: '20%' }}>Name</th>
                  <th style={{ width: '22%' }}>Email</th>
                  <th style={{ width: '120px' }}>Status</th>
                  <th>Gyms</th>
                  <th style={{ width: '100px' }}>Members</th>
                  <th style={{ width: '120px' }}>Joined</th>
                  <th style={{ width: '250px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOwners.map((owner) => (
                  <tr key={owner._id}>
                    <td>
                      <div
                        className="dashboard-table__user dashboard-table__user--link"
                        onClick={() => navigate(`/dashboard/manager/users/${owner._id}`)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && navigate(`/dashboard/manager/users/${owner._id}`)}
                      >
                        {owner.profilePicture ? (
                          <img src={owner.profilePicture} alt={owner.name} />
                        ) : (
                          <div className="dashboard-table__user-placeholder">
                            {owner.name?.charAt(0) ?? '?'}
                          </div>
                        )}
                        <div>
                          <strong>{owner.name}</strong>
                          {owner.profile?.headline && (
                            <div><small>{owner.profile.headline}</small></div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>{owner.email}</td>
                    <td>
                      <span className={`status-pill ${owner.status === 'active' ? 'status-pill--success' : owner.status === 'pending' ? 'status-pill--warning' : 'status-pill--danger'}`}>
                        {formatStatus(owner.status)}
                      </span>
                    </td>
                    <td>
                      {formatNumber(owner.gyms?.total ?? 0)} total
                      <div><small>{formatNumber(owner.gyms?.published ?? 0)} published</small></div>
                    </td>
                    <td>{formatNumber(owner.totalMembers ?? 0)}</td>
                    <td>{formatDate(owner.createdAt)}</td>
                    <td>
                      <div className="button-row" style={{ flexWrap: 'nowrap' }}>
                        {owner.status !== 'pending' && (
                          <button
                            type="button"
                            className={`manager-btn ${owner.status === 'active' ? 'manager-btn--deactivate' : 'manager-btn--approve'}`}
                            onClick={() => handleToggleStatus(owner)}
                            disabled={isUpdating}
                          >
                            {owner.status === 'active' ? 'Deactivate' : 'Activate'}
                          </button>
                        )}
                        <button
                          type="button"
                          className="manager-btn manager-btn--reject"
                          onClick={() => handleDelete(owner)}
                          disabled={isDeleting}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationBar page={page} totalPages={totalPages} totalItems={totalItems} startIndex={startIndex} endIndex={endIndex} onPage={setPage} />
          </div>
        ) : (
          <EmptyState message="No gym owners match your filters." />
        )}

      </DashboardSection>
    </div>
  );
};

export default GymOwnersPage;
