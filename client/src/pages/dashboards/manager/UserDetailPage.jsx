import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import { UserProfileHeader, RoleSections } from '../components/UserDetailContent.jsx';
import {
  useGetManagerUserDetailQuery,
  useUpdateSellerStatusMutation,
  useDeleteSellerByManagerMutation,
  useUpdateGymOwnerStatusMutation,
  useDeleteGymOwnerByManagerMutation,
} from '../../../services/managerApi.js';
import '../Dashboard.css';

const ManagerUserDetailPage = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useGetManagerUserDetailQuery(userId);
  const [updateSellerStatus, { isLoading: isUpdatingSeller }] = useUpdateSellerStatusMutation();
  const [deleteSeller, { isLoading: isDeletingSeller }] = useDeleteSellerByManagerMutation();
  const [updateGymOwnerStatus, { isLoading: isUpdatingOwner }] = useUpdateGymOwnerStatusMutation();
  const [deleteGymOwner, { isLoading: isDeletingOwner }] = useDeleteGymOwnerByManagerMutation();
  const [notice, setNotice] = useState(null);

  const detail = data?.data;
  const user = detail?.user;

  const handleBack = () => navigate(-1);

  const isSeller = user?.role === 'seller';
  const isGymOwner = user?.role === 'gym-owner';
  const isUpdating = isUpdatingSeller || isUpdatingOwner;
  const isDeleting = isDeletingSeller || isDeletingOwner;

  const handleToggleStatus = async () => {
    setNotice(null);
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    try {
      if (isSeller) {
        await updateSellerStatus({ userId, status: newStatus }).unwrap();
      } else if (isGymOwner) {
        if (newStatus === 'inactive') {
          const ok = window.confirm(
            `Deactivating ${user.name ?? 'this owner'} will suspend all their gyms, cancel memberships and trainer assignments. Continue?`,
          );
          if (!ok) return;
        }
        await updateGymOwnerStatus({ userId, status: newStatus }).unwrap();
      }
      setNotice(`User ${newStatus === 'active' ? 'activated' : 'deactivated'}.`);
      refetch();
    } catch (err) {
      setNotice(err?.data?.message ?? 'Unable to update status.');
    }
  };

  const handleDelete = async () => {
    setNotice(null);
    if (!window.confirm(`Permanently delete ${user?.name ?? 'this user'}? This cannot be undone.`)) return;
    try {
      if (isSeller) {
        await deleteSeller(userId).unwrap();
      } else if (isGymOwner) {
        await deleteGymOwner(userId).unwrap();
      }
      navigate(-1);
    } catch (err) {
      setNotice(err?.data?.message ?? 'Unable to delete user.');
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

  const canManage = isSeller || isGymOwner;

  return (
    <div className="dashboard-grid dashboard-grid--stacked ud-page">
      <div className="ud-actions">
        <button type="button" className="ud-btn ud-btn--back" onClick={handleBack}>← Back</button>
        <button type="button" className="ud-btn ud-btn--outline" onClick={() => refetch()}>Refresh</button>
      </div>

      <UserProfileHeader
        user={user}
        notice={notice}
        actionSlot={
          canManage ? (
            <>
              <button
                type="button"
                className={`ud-btn ${user.status === 'active' ? 'ud-btn--warning' : 'ud-btn--success'}`}
                onClick={handleToggleStatus}
                disabled={isUpdating}
              >
                {user.status === 'active' ? 'Deactivate' : 'Activate'}
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
          ) : null
        }
      />

      <RoleSections detail={detail} />
    </div>
  );
};

export default ManagerUserDetailPage;
