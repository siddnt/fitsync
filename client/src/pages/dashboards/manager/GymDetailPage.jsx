import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import {
  useDeleteGymByManagerMutation,
  useGetManagerGymDetailQuery,
} from '../../../services/managerApi.js';
import { formatCurrency, formatDate, formatStatus } from '../../../utils/format.js';
import '../Dashboard.css';

const GymDetailPage = () => {
  const { gymId } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useGetManagerGymDetailQuery(gymId);
  const [deleteGym, { isLoading: isDeleting }] = useDeleteGymByManagerMutation();
  const [notice, setNotice] = useState(null);

  const gym = data?.data;

  const handleDelete = async () => {
    setNotice(null);
    const confirmed = window.confirm(
      `Remove "${gym?.name}"? This will cancel memberships and listings. This cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteGym(gymId).unwrap();
      navigate('/dashboard/manager/gyms');
    } catch (error) {
      setNotice(error?.data?.message ?? 'Unable to delete gym.');
    }
  };

  if (isLoading) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked ud-page">
        <DashboardSection title="Gym Detail"><SkeletonPanel lines={14} /></DashboardSection>
      </div>
    );
  }

  if (isError || !gym) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked ud-page">
        <DashboardSection title="Gym Detail" action={<button type="button" onClick={() => navigate('/dashboard/manager/gyms')}>Back</button>}>
          <EmptyState message="Could not load gym details." />
        </DashboardSection>
      </div>
    );
  }

  const activeMembers = gym.members?.filter((member) => member.status === 'active') ?? [];
  const activeAssignments = gym.assignments?.filter((assignment) => assignment.status === 'active') ?? [];

  return (
    <div className="dashboard-grid dashboard-grid--stacked ud-page">
      <div className="ud-actions">
        <button type="button" className="ud-btn ud-btn--back" onClick={() => navigate('/dashboard/manager/gyms')}>
          Back to Gyms
        </button>
        <button type="button" className="ud-btn ud-btn--outline" onClick={() => refetch()}>
          Refresh
        </button>
        <button type="button" className="ud-btn ud-btn--danger" onClick={handleDelete} disabled={isDeleting}>
          {isDeleting ? 'Removing...' : 'Delete Gym'}
        </button>
      </div>

      {notice ? <div className="status-pill status-pill--warning">{notice}</div> : null}

      <DashboardSection title={gym.name}>
        <div className="stat-grid">
          <div className="stat-card">
            <small>Status</small>
            <strong>{formatStatus(gym.status)}</strong>
          </div>
          <div className="stat-card"><small>Published</small><strong>{gym.isPublished ? 'Yes' : 'No'}</strong></div>
          <div className="stat-card"><small>Active Members</small><strong>{activeMembers.length}</strong></div>
          <div className="stat-card"><small>Active Trainers</small><strong>{activeAssignments.length}</strong></div>
          <div className="stat-card"><small>Rating</small><strong>{gym.analytics?.rating ? `${gym.analytics.rating}` : '-'}</strong></div>
          <div className="stat-card"><small>Impressions</small><strong>{gym.analytics?.impressions ?? 0}</strong></div>
          <div className="stat-card"><small>Reviews</small><strong>{gym.reviews?.length ?? 0}</strong></div>
          <div className="stat-card"><small>Created</small><strong>{formatDate(gym.createdAt)}</strong></div>
        </div>
      </DashboardSection>

      <DashboardSection title="Gym Information">
        <div className="ud-card">
          {gym.description ? <p className="ud-card__desc" style={{ marginBottom: '0.75rem' }}>{gym.description}</p> : null}
          <p><strong>Location:</strong> {[gym.location?.address, gym.location?.city, gym.location?.state, gym.location?.postalCode].filter(Boolean).join(', ')}</p>
          {gym.pricing ? <p><strong>Pricing:</strong> {formatCurrency(gym.pricing.monthlyPrice)}/mo (MRP: {formatCurrency(gym.pricing.monthlyMrp)})</p> : null}
          {gym.schedule ? <p><strong>Schedule:</strong> {gym.schedule.openTime} - {gym.schedule.closeTime}</p> : null}
        </div>
      </DashboardSection>

      <DashboardSection title="Owner">
        {gym.owner ? (
          <div className="ud-card">
            <p><strong>{gym.owner.name}</strong></p>
            <p>{gym.owner.email}</p>
            {gym.owner.contactNumber ? <p>{gym.owner.contactNumber}</p> : null}
          </div>
        ) : <EmptyState message="No owner information." />}
      </DashboardSection>

      <DashboardSection title={`Members (${gym.members?.length ?? 0})`}>
        {gym.members?.length ? (
          <div className="ud-table-wrap">
            <table className="dashboard-table dashboard-table--compact">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Trainer</th>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Billing</th>
                </tr>
              </thead>
              <tbody>
                {gym.members.map((member) => (
                  <tr key={member.id}>
                    <td>{member.trainee?.name ?? '-'}</td>
                    <td>{member.trainer?.name ?? '-'}</td>
                    <td>{member.plan}</td>
                    <td>{formatStatus(member.status)}</td>
                    <td>{member.billing ? `${formatCurrency(member.billing.amount)} (${formatStatus(member.billing.status)})` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState message="No memberships found." />}
      </DashboardSection>
    </div>
  );
};

export default GymDetailPage;
