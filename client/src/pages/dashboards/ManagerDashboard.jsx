import { Link } from 'react-router-dom';
import DashboardSection from './components/DashboardSection.jsx';
import EmptyState from './components/EmptyState.jsx';
import SkeletonPanel from '../../ui/SkeletonPanel.jsx';
import { useGetManagerOverviewQuery } from '../../services/dashboardApi.js';
import { formatDate, formatNumber, formatStatus } from '../../utils/format.js';
import './Dashboard.css';

const ManagerDashboard = () => {
  const {
    data: response,
    isLoading,
    isError,
    error,
    refetch,
  } = useGetManagerOverviewQuery();

  const approvalPending = error?.status === 403;
  const approvalMessage =
    error?.data?.message
    ?? 'Your manager account is awaiting admin approval. You can access the manager console after activation.';

  if (isLoading) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked">
        <DashboardSection title="Overview">
          <SkeletonPanel lines={6} />
        </DashboardSection>
        <DashboardSection title="Recent pending approvals">
          <SkeletonPanel lines={6} />
        </DashboardSection>
      </div>
    );
  }

  if (approvalPending) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked">
        <DashboardSection
          title="Manager Console"
          action={<button type="button" onClick={() => refetch()}>Refresh</button>}
        >
          <EmptyState message={approvalMessage} />
        </DashboardSection>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked">
        <DashboardSection
          title="Manager Console"
          action={<button type="button" onClick={() => refetch()}>Retry</button>}
        >
          <EmptyState message="Could not load the manager dashboard." />
        </DashboardSection>
      </div>
    );
  }

  const { stats, recentPending } = response?.data ?? {};
  const operationalShortcuts = [
    {
      id: 'claim-ticket',
      label: 'Claim next ticket',
      value: formatNumber(stats?.newMessages ?? 0),
      meta: `${formatNumber(stats?.openMessages ?? 0)} open support conversations waiting in the queue`,
      to: '/dashboard/manager/messages',
    },
    {
      id: 'review-gyms',
      label: 'Review flagged gyms',
      value: formatNumber(stats?.flaggedGyms ?? 0),
      meta: 'Draft, suspended, or unpublished listings need attention',
      to: '/dashboard/manager/gyms',
    },
    {
      id: 'approvals',
      label: 'Approve pending accounts',
      value: formatNumber(stats?.pendingApprovals ?? 0),
      meta: 'Seller and gym owner applications waiting for review',
      to: '/dashboard/manager/approvals',
    },
    {
      id: 'communications',
      label: 'Open communications',
      value: formatNumber(stats?.openMessages ?? 0),
      meta: 'Escalations and owner follow-ups across gyms',
      to: '/dashboard/manager/communications',
    },
  ];

  return (
    <div className="dashboard-grid dashboard-grid--stacked">
      <DashboardSection title="Overview">
        <div className="stat-grid">
          <div className="stat-card stat-card--manager-accent">
            <small>Pending approvals</small>
            <strong>{formatNumber(stats?.pendingApprovals ?? 0)}</strong>
            <small>Sellers and gym owners waiting for review</small>
          </div>
          <div className="stat-card">
            <small>Active sellers</small>
            <strong>{formatNumber(stats?.activeSellers ?? 0)}</strong>
          </div>
          <div className="stat-card">
            <small>Active gym owners</small>
            <strong>{formatNumber(stats?.activeGymOwners ?? 0)}</strong>
          </div>
          <div className="stat-card">
            <small>Total gyms</small>
            <strong>{formatNumber(stats?.totalGyms ?? 0)}</strong>
          </div>
          <div className="stat-card">
            <small>Orders in 30 days</small>
            <strong>{formatNumber(stats?.recentOrders ?? 0)}</strong>
          </div>
          <div className="stat-card">
            <small>Open messages</small>
            <strong>{formatNumber(stats?.openMessages ?? 0)}</strong>
          </div>
        </div>
      </DashboardSection>

      <DashboardSection title="Operational shortcuts">
        <div className="dashboard-link-grid">
          {operationalShortcuts.map((shortcut) => (
            <Link key={shortcut.id} className="dashboard-link-card" to={shortcut.to}>
              <small>{shortcut.label}</small>
              <strong>{shortcut.value}</strong>
              <span>{shortcut.meta}</span>
            </Link>
          ))}
        </div>
      </DashboardSection>

      <DashboardSection
        title="Recent Pending Approvals"
        action={<button type="button" onClick={() => refetch()}>Refresh</button>}
      >
        {recentPending?.length ? (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Applied</th>
              </tr>
            </thead>
            <tbody>
              {recentPending.map((user) => (
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
                  <td>{formatDate(user.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="No pending approvals. All caught up!" />
        )}
      </DashboardSection>
    </div>
  );
};

export default ManagerDashboard;
