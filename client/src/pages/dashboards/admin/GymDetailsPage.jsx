import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import { useGetAdminGymsQuery } from '../../../services/dashboardApi.js';
import { formatDate, formatNumber, formatStatus } from '../../../utils/format.js';
import '../Dashboard.css';

const getGymId = (gym) => String(gym?.id ?? gym?._id ?? '');
const getUserId = (user) => String(user?.id ?? user?._id ?? '');

const AdminGymDetailsPage = () => {
  const navigate = useNavigate();
  const { gymId } = useParams();
  const { data, isLoading, isError, refetch } = useGetAdminGymsQuery();

  const gyms = data?.data?.gyms ?? [];
  const gym = useMemo(
    () => gyms.find((entry) => getGymId(entry) === String(gymId)),
    [gyms, gymId],
  );

  const metricCards = [
    { label: 'Members', value: gym?.activeMembers ?? 0 },
    { label: 'Trainers', value: gym?.activeTrainers ?? 0 },
    { label: 'Impressions', value: formatNumber(gym?.analytics?.impressions ?? 0) },
    { label: 'Rating', value: gym?.analytics?.rating ?? 0 },
  ];

  if (isLoading) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked ud-page">
        <DashboardSection title="Gym details">
          <SkeletonPanel lines={8} />
        </DashboardSection>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked ud-page">
        <DashboardSection
          title="Gym details"
          action={(
            <div className="ud-actions">
              <button type="button" className="ud-btn" onClick={() => navigate('/dashboard/admin/gyms')}>
                Back to gyms
              </button>
              <button type="button" className="ud-btn" onClick={() => refetch()}>
                Retry
              </button>
            </div>
          )}
        >
          <EmptyState message="Could not load this gym right now." />
        </DashboardSection>
      </div>
    );
  }

  if (!gym) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked ud-page">
        <DashboardSection
          title="Gym details"
          action={(
            <button type="button" className="ud-btn" onClick={() => navigate('/dashboard/admin/gyms')}>
              Back to gyms
            </button>
          )}
        >
          <EmptyState message="Gym was not found in the current admin list." />
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="dashboard-grid dashboard-grid--stacked ud-page">
      <DashboardSection
        title="Gym details"
        action={(
          <button type="button" className="ud-btn" onClick={() => navigate('/dashboard/admin/gyms')}>
            Back to gyms
          </button>
        )}
      >
        <div className="user-detail__header">
          <div className="user-detail__avatar user-detail__avatar--placeholder user-detail__avatar--lg">
            {gym.name?.charAt(0) ?? 'G'}
          </div>
          <div className="user-detail__meta">
            <h3>{gym.name ?? 'Unnamed gym'}</h3>
            <small>{[gym.city, gym.state].filter(Boolean).join(', ') || 'Location unavailable'}</small>
            <div className="user-detail__badges">
              <span className={`status-pill ${gym.status === 'active' ? 'status-pill--success' : 'status-pill--warning'}`}>
                {formatStatus(gym.status ?? 'unknown')}
              </span>
              <span className={`status-pill ${gym.isPublished ? 'status-pill--success' : 'status-pill--warning'}`}>
                {gym.isPublished ? 'Published' : 'Unpublished'}
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

        <h4 className="user-detail__section-title">Gym account</h4>
        <div className="user-detail__grid">
          <div className="user-detail__item">
            <span className="user-detail__label">Gym name</span>
            <span>{gym.name ?? '-'}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Gym ID</span>
            <span>{getGymId(gym)}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Owner</span>
            <span>
              {getUserId(gym.owner) ? (
                <Link to={`/dashboard/admin/users/${getUserId(gym.owner)}`} className="dashboard-table__user--link">
                  {gym.owner?.name}
                </Link>
              ) : (
                gym.owner?.name ?? '-'
              )}
            </span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Owner email</span>
            <span>{gym.owner?.email ?? '-'}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Status</span>
            <span>{formatStatus(gym.status ?? 'unknown')}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Published</span>
            <span>{gym.isPublished ? 'Yes' : 'No'}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Sponsorship</span>
            <span>{formatStatus(gym.sponsorship?.tier ?? gym.sponsorship?.status ?? 'none')}</span>
          </div>
          <div className="user-detail__item">
            <span className="user-detail__label">Created</span>
            <span>{formatDate(gym.createdAt)}</span>
          </div>
          <div className="user-detail__item user-detail__item--full">
            <span className="user-detail__label">Location</span>
            <span>{[gym.city, gym.state].filter(Boolean).join(', ') || '-'}</span>
          </div>
        </div>
      </DashboardSection>
    </div>
  );
};

export default AdminGymDetailsPage;
