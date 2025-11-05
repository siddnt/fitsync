import { useState } from 'react';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import { useGetAdminUsersQuery } from '../../../services/dashboardApi.js';
import { useDeleteUserMutation } from '../../../services/adminApi.js';
import { formatDate, formatStatus } from '../../../utils/format.js';
import '../Dashboard.css';

const AdminUsersPage = () => {
  const { data, isLoading, isError, refetch } = useGetAdminUsersQuery();
  const [deleteUser, { isLoading: isDeleting }] = useDeleteUserMutation();
  const pending = data?.data?.pending ?? [];
  const recent = data?.data?.recent ?? [];
  const [notice, setNotice] = useState(null);
  const [errorNotice, setErrorNotice] = useState(null);

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

  if (isLoading) {
    return (
      <div className="dashboard-grid">
        <DashboardSection title="Pending approvals">
          <SkeletonPanel lines={8} />
        </DashboardSection>
        <DashboardSection title="Recently joined">
          <SkeletonPanel lines={8} />
        </DashboardSection>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="dashboard-grid">
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
    <div className="dashboard-grid">
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
                    <button type="button" onClick={() => handleDelete(user)} disabled={isDeleting}>
                      {isDeleting ? 'Deleting…' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="No pending approvals. All caught up!" />
        )}
      </DashboardSection>

      <DashboardSection title="Recently joined">
        {recent.length ? (
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
              {recent.map((user) => (
                <tr key={user._id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{formatStatus(user.role)}</td>
                  <td>{formatStatus(user.status)}</td>
                  <td>{formatDate(user.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="New sign-ups will appear here." />
        )}
      </DashboardSection>
    </div>
  );
};

export default AdminUsersPage;
