import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import { useGetAdminUsersQuery } from '../../../services/dashboardApi.js';
import { formatDate, formatStatus } from '../../../utils/format.js';
import '../Dashboard.css';

const getUserId = (user) => String(user?._id ?? user?.id ?? '');

const AdminUserDetailsPage = () => {
  const navigate = useNavigate();
  const { userId } = useParams();
  const { data, isLoading, isError, refetch } = useGetAdminUsersQuery();

  const allUsers = useMemo(() => {
    const pending = data?.data?.pending ?? [];
    const recent = data?.data?.recent ?? [];
    const byId = new Map();

    [...pending, ...recent].forEach((user) => {
      const id = getUserId(user);
      if (!id) {
        return;
      }
      if (!byId.has(id)) {
        byId.set(id, user);
      } else {
        byId.set(id, { ...byId.get(id), ...user });
      }
    });

    return Array.from(byId.values());
  }, [data?.data?.pending, data?.data?.recent]);

  const user = useMemo(
    () => allUsers.find((entry) => getUserId(entry) === String(userId)),
    [allUsers, userId],
  );

  const metricCards = [
    {
      label: 'Memberships',
      value: user?.memberships ?? user?.traineeMetrics?.activeMemberships ?? 0,
    },
    {
      label: 'Orders',
      value: user?.orders ?? 0,
    },
    {
      label: 'Gyms Owned',
      value: user?.gymsOwned ?? user?.ownerMetrics?.totalGyms ?? 0,
    },
    {
      label: 'Active Trainees',
      value: user?.trainerMetrics?.activeTrainees ?? 0,
    },
  ];

  if (isLoading) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked ud-page">
        <DashboardSection title="User details">
          <SkeletonPanel lines={8} />
        </DashboardSection>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked ud-page">
        <DashboardSection
          title="User details"
          action={(
            <div className="ud-actions">
              <button type="button" className="ud-btn" onClick={() => navigate('/dashboard/admin/users')}>
                Back to users
              </button>
              <button type="button" className="ud-btn" onClick={() => refetch()}>
                Retry
              </button>
            </div>
          )}
        >
          <EmptyState message="Could not load this user right now." />
        </DashboardSection>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked ud-page">
        <DashboardSection
          title="User details"
          action={(
            <button type="button" className="ud-btn" onClick={() => navigate('/dashboard/admin/users')}>
              Back to users
            </button>
          )}
        >
          <EmptyState message="User was not found in the current admin list." />
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="dashboard-grid dashboard-grid--stacked ud-page">
      <DashboardSection
        title="User details"
        action={(
          <button type="button" className="ud-btn" onClick={() => navigate('/dashboard/admin/users')}>
            Back to users
          </button>
        )}
      >
        <div className="user-detail__header">
          {user.profilePicture ? (
            <img
              className="user-detail__avatar user-detail__avatar--lg"
              src={user.profilePicture}
              alt={user.name ?? 'User'}
            />
          ) : (
            <div className="user-detail__avatar user-detail__avatar--placeholder user-detail__avatar--lg">
              {user.name?.charAt(0) ?? '?'}
            </div>
          )}
          <div className="user-detail__meta">
            <h3>{user.name ?? 'Unnamed user'}</h3>
            <small>{user.email ?? 'No email'}</small>
            <div className="user-detail__badges">
              <span className="status-pill">{formatStatus(user.role ?? 'unknown')}</span>
              <span className={`status-pill status-pill--${user.status === 'active' ? 'success' : 'warning'}`}>
                {formatStatus(user.status ?? 'unknown')}
              </span>
            </div>
          </div>
        </div>

        <div className="user-detail__stats">
          {metricCards.map((metric) => (
            <div key={metric.label} className="user-detail__stat">
              <span className="user-detail__stat-value">{metric.value}</span>
              <span className="user-detail__stat-label">{metric.label}</span>
            </div>
          ))}
        </div>

        <h4 className="user-detail__section-title">Account</h4>
        <div className="user-detail__grid">
          <div className="user-detail__item">
            <span className="user-detail__label">Name</span>
            <span>{user.name ?? '-'}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Email</span>
            <span>{user.email ?? '-'}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Role</span>
            <span>{formatStatus(user.role ?? 'unknown')}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Status</span>
            <span>{formatStatus(user.status ?? 'unknown')}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Joined</span>
            <span>{formatDate(user.createdAt)}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">User ID</span>
            <span>{getUserId(user)}</span>
          </div>
          <div className="user-detail__item user-detail__item--full">
            <span className="user-detail__label">Headline</span>
            <span>{user.profile?.headline || user.bio || '-'}</span>
          </div>
          <div className="user-detail__item user-detail__item--full">
            <span className="user-detail__label">Location</span>
            <span>{user.profile?.location || user.address || '-'}</span>
          </div>
        </div>
      </DashboardSection>
    </div>
  );
};

export default AdminUserDetailsPage;
