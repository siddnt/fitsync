import { useMemo, useState } from 'react';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import {
  useGetManagerPendingQuery,
  useApproveUserMutation,
  useRejectUserMutation,
} from '../../../services/managerApi.js';
import { formatDate, formatStatus } from '../../../utils/format.js';
import '../Dashboard.css';

const ApprovalsPage = () => {
  const { data, isLoading, isError, refetch } = useGetManagerPendingQuery();
  const [approveUser, { isLoading: isApproving }] = useApproveUserMutation();
  const [rejectUser, { isLoading: isRejecting }] = useRejectUserMutation();

  const pending = data?.data?.pending ?? [];
  const [notice, setNotice] = useState(null);
  const [errorNotice, setErrorNotice] = useState(null);
  const [roleTab, setRoleTab] = useState('all');

  const filteredPending = useMemo(() => {
    if (roleTab === 'all') return pending;
    return pending.filter((u) => u.role === roleTab);
  }, [pending, roleTab]);

  const handleApprove = async (user) => {
    setNotice(null);
    setErrorNotice(null);
    try {
      await approveUser(user._id).unwrap();
      setNotice(`${user.name ?? 'User'} has been approved.`);
      refetch();
    } catch (err) {
      setErrorNotice(err?.data?.message ?? 'Unable to approve this user.');
    }
  };

  const handleReject = async (user) => {
    setNotice(null);
    setErrorNotice(null);
    const confirmed = window.confirm(
      `Reject and remove ${user.name ?? 'this user'}? This action cannot be undone.`,
    );
    if (!confirmed) return;

    try {
      await rejectUser(user._id).unwrap();
      setNotice(`${user.name ?? 'User'} has been rejected and removed.`);
      refetch();
    } catch (err) {
      setErrorNotice(err?.data?.message ?? 'Unable to reject this user.');
    }
  };

  if (isLoading) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked">
        <DashboardSection title="Pending Approvals">
          <SkeletonPanel lines={10} />
        </DashboardSection>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked">
        <DashboardSection
          title="Pending Approvals"
          action={<button type="button" onClick={() => refetch()}>Retry</button>}
        >
          <EmptyState message="Could not load pending approvals." />
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="dashboard-grid dashboard-grid--stacked">
      <DashboardSection
        title="Pending Approvals"
        action={
          <div className="users-toolbar">
            <div className="manager-tabs">
              {['all', 'seller', 'gym-owner'].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={`manager-tab${roleTab === tab ? ' manager-tab--active' : ''}`}
                  onClick={() => setRoleTab(tab)}
                >
                  {tab === 'all' ? 'All' : formatStatus(tab)}
                </button>
              ))}
            </div>
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

        {filteredPending.length ? (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Location</th>
                <th>Applied</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPending.map((user) => (
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
                      <div>
                        <strong>{user.name}</strong>
                        {user.profile?.headline && (
                          <div><small>{user.profile.headline}</small></div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>{user.email}</td>
                  <td>
                    <span className="status-pill status-pill--warning">
                      {formatStatus(user.role)}
                    </span>
                  </td>
                  <td>{user.profile?.location || '—'}</td>
                  <td>{formatDate(user.createdAt)}</td>
                  <td>
                    <div className="button-row">
                      <button
                        type="button"
                        className="manager-btn manager-btn--approve"
                        onClick={() => handleApprove(user)}
                        disabled={isApproving}
                      >
                        {isApproving ? 'Approving…' : 'Approve'}
                      </button>
                      <button
                        type="button"
                        className="manager-btn manager-btn--reject"
                        onClick={() => handleReject(user)}
                        disabled={isRejecting}
                      >
                        {isRejecting ? 'Rejecting…' : 'Reject'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="No pending approvals right now. All caught up!" />
        )}
      </DashboardSection>
    </div>
  );
};

export default ApprovalsPage;
