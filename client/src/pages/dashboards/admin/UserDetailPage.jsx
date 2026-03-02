import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import { UserProfileHeader, RoleSections } from '../components/UserDetailContent.jsx';
import { useGetAdminUserDetailQuery } from '../../../services/dashboardApi.js';
import { useDeleteUserMutation, useUpdateUserStatusMutation } from '../../../services/adminApi.js';
import '../Dashboard.css';

const AdminUserDetailPage = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useGetAdminUserDetailQuery(userId);
  const [deleteUser, { isLoading: isDeleting }] = useDeleteUserMutation();
  const [updateUserStatus, { isLoading: isUpdating }] = useUpdateUserStatusMutation();
  const [notice, setNotice] = useState(null);

  const detail = data?.data;
  const user = detail?.user;

  const handleBack = () => navigate('/dashboard/admin/users');

  const handleDelete = async () => {
    setNotice(null);
    if (!window.confirm(`Permanently delete ${user?.name ?? 'this user'}? This cannot be undone.`)) return;
    try {
      await deleteUser(userId).unwrap();
      navigate('/dashboard/admin/users');
    } catch (err) {
      setNotice(err?.data?.message ?? 'Unable to delete user.');
    }
  };

  const handleToggleStatus = async () => {
    setNotice(null);
    const newStatus = user?.status === 'active' ? 'suspended' : 'active';
    try {
      await updateUserStatus({ userId, status: newStatus }).unwrap();
      setNotice(`User ${newStatus === 'active' ? 'activated' : 'suspended'}.`);
      refetch();
    } catch (err) {
      setNotice(err?.data?.message ?? 'Unable to update status.');
    }
  };

  if (isLoading) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked ud-page">
        <DashboardSection title="User Detail"><SkeletonPanel lines={12} /></DashboardSection>
      </div>
    );
  }

  if (isError || !user) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked ud-page">
        <DashboardSection title="User Detail" action={<button type="button" onClick={handleBack}>← Back</button>}>
          <EmptyState message="Could not load user details." />
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="dashboard-grid dashboard-grid--stacked ud-page">
      <div className="ud-actions">
        <button type="button" className="ud-btn ud-btn--back" onClick={handleBack}>← Back to Users</button>
        <button type="button" className="ud-btn ud-btn--outline" onClick={() => refetch()}>Refresh</button>
      </div>

      <UserProfileHeader
        user={user}
        notice={notice}
        actionSlot={
          <>
            <button
              type="button"
              className={`ud-btn ${user.status === 'active' ? 'ud-btn--warning' : 'ud-btn--success'}`}
              onClick={handleToggleStatus}
              disabled={isUpdating}
            >
              {user.status === 'active' ? 'Suspend' : 'Activate'}
            </button>
            <button
              type="button"
              className="ud-btn ud-btn--danger"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              Delete
            </button>
          </>
        }
      />

      <RoleSections detail={detail} />
    </div>
  );
};

export default AdminUserDetailPage;
