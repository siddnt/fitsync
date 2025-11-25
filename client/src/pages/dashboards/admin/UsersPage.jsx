import { useMemo, useState } from 'react';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import { useGetAdminUsersQuery } from '../../../services/dashboardApi.js';
import { useDeleteUserMutation, useUpdateUserStatusMutation } from '../../../services/adminApi.js';
import { formatDate, formatStatus } from '../../../utils/format.js';
import '../Dashboard.css';

const AdminUsersPage = () => {
  const { data, isLoading, isError, refetch } = useGetAdminUsersQuery();
  const [deleteUser, { isLoading: isDeleting }] = useDeleteUserMutation();
  const [updateUserStatus, { isLoading: isUpdatingStatus }] = useUpdateUserStatusMutation();
  const pending = (data?.data?.pending ?? []).filter((user) => user.role === 'seller');
  const recent = data?.data?.recent ?? [];
  const [notice, setNotice] = useState(null);
  const [errorNotice, setErrorNotice] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const roleOptions = useMemo(() => {
    const values = Array.from(new Set(recent.map((user) => user.role).filter(Boolean)));
    return ['all', ...values];
  }, [recent]);

  const statusOptions = useMemo(() => {
    const values = Array.from(new Set(recent.map((user) => user.status).filter(Boolean)));
    return ['all', ...values];
  }, [recent]);

  const filteredUsers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return recent.filter((user) => {
      if (roleFilter !== 'all' && user.role !== roleFilter) {
        return false;
      }
      if (statusFilter !== 'all' && user.status !== statusFilter) {
        return false;
      }
      if (!query) {
        return true;
      }
      const haystacks = [user.name, user.email].filter(Boolean).map((value) => value.toLowerCase());
      return haystacks.some((value) => value.includes(query));
    });
  }, [recent, roleFilter, statusFilter, searchTerm]);

  const filtersActive = useMemo(
    () => Boolean(searchTerm.trim() || roleFilter !== 'all' || statusFilter !== 'all'),
    [searchTerm, roleFilter, statusFilter],
  );

  const resetFilters = () => {
    setSearchTerm('');
    setRoleFilter('all');
    setStatusFilter('all');
  };

  const handleDelete = async (user) => {
    if (!user) {
      return;
    }
    setNotice(null);
    setErrorNotice(null);

    const confirmed = window.confirm(`Delete ${user.name ?? 'this user'} permanently?`);
    if (!confirmed) {
      return;
    }

    try {
      await deleteUser(user._id ?? user.id).unwrap();
      setNotice('User deleted successfully.');
      refetch();
    } catch (mutationError) {
      setErrorNotice(mutationError?.data?.message ?? 'Unable to delete this user.');
    }
  };

  const handleApprove = async (user) => {
    if (!user) {
      return;
    }

    setNotice(null);
    setErrorNotice(null);

    try {
      await updateUserStatus({ userId: user._id ?? user.id, status: 'active' }).unwrap();
      setNotice(`${user.name ?? 'User'} activated.`);
      refetch();
    } catch (mutationError) {
      setErrorNotice(mutationError?.data?.message ?? 'Unable to approve this user.');
    }
  };

  if (isLoading) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked">
        <DashboardSection title="Pending approvals">
          <SkeletonPanel lines={8} />
        </DashboardSection>
        <DashboardSection title="Users">
          <SkeletonPanel lines={8} />
        </DashboardSection>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked">
        <DashboardSection
          title="User administration"
          action={(
            <button type="button" onClick={() => refetch()}>
              Retry
            </button>
          )}
        >
          <EmptyState message="We could not load the user backlog." />
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="dashboard-grid dashboard-grid--stacked">
      <DashboardSection
        title="Pending approvals"
        action={(
          <button type="button" onClick={() => refetch()}>
            Refresh
          </button>
        )}
      >
        {(notice || errorNotice) && (
          <div className={`status-pill ${errorNotice ? 'status-pill--warning' : 'status-pill--success'}`}>
            {errorNotice || notice}
          </div>
        )}

        {pending.length ? (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Joined</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((user) => (
                <tr key={user._id}>
                  <td>
                    <strong>{user.name}</strong>
                    <div>
                      <small>{user.profile?.headline}</small>
                    </div>
                  </td>
                  <td>{user.email}</td>
                  <td>{formatStatus(user.role)}</td>
                  <td>{formatDate(user.createdAt)}</td>
                  <td>
                    <div className="button-row">
                      <button
                        type="button"
                        onClick={() => handleApprove(user)}
                        disabled={isUpdatingStatus}
                      >
                        {isUpdatingStatus ? 'Approving…' : 'Approve'}
                      </button>
                      <button type="button" onClick={() => handleDelete(user)} disabled={isDeleting}>
                      {isDeleting ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="No pending approvals. All caught up!" />
        )}
      </DashboardSection>

      <DashboardSection
        title="Users"
        action={(
          <div className="users-toolbar">
            <input
              type="search"
              className="inventory-toolbar__input"
              placeholder="Search name or email"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              aria-label="Search users"
            />
            <select
              className="inventory-toolbar__input inventory-toolbar__input--select"
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
              aria-label="Filter by role"
            >
              {roleOptions.map((option) => (
                <option key={option} value={option}>
                  {option === 'all' ? 'All roles' : formatStatus(option)}
                </option>
              ))}
            </select>
            <select
              className="inventory-toolbar__input inventory-toolbar__input--select"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filter by status"
            >
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {option === 'all' ? 'All statuses' : formatStatus(option)}
                </option>
              ))}
            </select>
            {filtersActive ? (
              <button type="button" className="users-toolbar__reset" onClick={resetFilters}>
                Reset
              </button>
            ) : null}
            <button type="button" className="users-toolbar__refresh" onClick={() => refetch()}>
              Refresh
            </button>
          </div>
        )}
      >
        {filteredUsers.length ? (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user._id}>
                  <td>
                    <div className="dashboard-table__user">
                      {user.profilePicture ? (
                        <img src={user.profilePicture} alt={user.name} />
                      ) : (
                        <div className="dashboard-table__user-placeholder">
                          {user.name?.charAt(0) ?? '?'}
                        </div>
                      )}
                      <span>{user.name}</span>
                    </div>
                  </td>
                  <td>{user.email}</td>
                  <td>{formatStatus(user.role)}</td>
                  <td>{formatStatus(user.status)}</td>
                  <td>{formatDate(user.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="No users match the current filters." />
        )}
      </DashboardSection>
    </div>
  );
};

export default AdminUsersPage;
