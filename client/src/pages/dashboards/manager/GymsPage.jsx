import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import AutosuggestInput from '../../../ui/AutosuggestInput.jsx';
import {
  useGetManagerGymsQuery,
  useDeleteGymByManagerMutation,
} from '../../../services/managerApi.js';
import { formatDate, formatNumber, formatStatus } from '../../../utils/format.js';
import '../Dashboard.css';

const GymsPage = () => {
  const { data, isLoading, isError, refetch } = useGetManagerGymsQuery();
  const [deleteGym, { isLoading: isDeleting }] = useDeleteGymByManagerMutation();

  const gyms = data?.data?.gyms ?? [];

  const gymSuggestions = useMemo(() => gyms.map((g) => g.name).filter(Boolean), [gyms]);
  const [notice, setNotice] = useState(null);
  const [errorNotice, setErrorNotice] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sponsorshipFilter, setSponsorshipFilter] = useState('all');

  const filteredGyms = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return gyms.filter((gym) => {
      if (statusFilter !== 'all' && gym.status !== statusFilter) return false;
      const tier = gym.sponsorship?.tier ?? 'none';
      if (sponsorshipFilter !== 'all' && tier !== sponsorshipFilter) return false;
      if (!query) return true;
      return [gym.name, gym.city, gym.owner?.name, gym.owner?.email]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(query));
    });
  }, [gyms, searchTerm, statusFilter, sponsorshipFilter]);

  const handleDelete = async (gym) => {
    setNotice(null);
    setErrorNotice(null);
    const confirmed = window.confirm(
      `Remove ${gym.name}? This will cancel all memberships, trainer assignments, and listing subscriptions associated with this gym. This cannot be undone.`,
    );
    if (!confirmed) return;
    try {
      await deleteGym(gym.id).unwrap();
      setNotice('Gym removed successfully.');
      refetch();
    } catch (err) {
      setErrorNotice(err?.data?.message ?? 'Unable to remove the gym.');
    }
  };

  if (isLoading) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked">
        <DashboardSection title="Gyms"><SkeletonPanel lines={10} /></DashboardSection>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked">
        <DashboardSection title="Gyms" action={<button type="button" onClick={() => refetch()}>Retry</button>}>
          <EmptyState message="Could not load gyms." />
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="dashboard-grid dashboard-grid--stacked">
      <DashboardSection
        title="Gyms"
        action={
          <div className="users-toolbar">
            <AutosuggestInput
              className="inventory-toolbar__input"
              placeholder="Search gym"
              value={searchTerm}
              onChange={setSearchTerm}
              suggestions={gymSuggestions}
              ariaLabel="Search gyms"
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
            <select
              className="inventory-toolbar__input inventory-toolbar__input--select"
              value={sponsorshipFilter}
              onChange={(e) => setSponsorshipFilter(e.target.value)}
              aria-label="Filter by sponsorship"
            >
              <option value="all">All sponsorships</option>
              <option value="none">None</option>
              <option value="basic">Basic</option>
              <option value="premium">Premium</option>
              <option value="elite">Elite</option>
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

        {filteredGyms.length ? (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Owner</th>
                <th>Status</th>
                <th>Members</th>
                <th>Sponsorship</th>
                <th>Impressions</th>
                <th>Created</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredGyms.map((gym) => (
                <tr key={gym.id}>
                  <td>
                    <Link to={`/dashboard/manager/gyms/${gym.id}`} className="dashboard-table__user--link">
                      {gym.name}
                    </Link>
                    <div><small>{gym.city}</small></div>
                  </td>
                  <td>
                    {gym.owner?.name ?? '—'}
                    <div><small>{gym.owner?.email}</small></div>
                  </td>
                  <td>
                    <span className={`status-pill ${gym.status === 'active' ? 'status-pill--success' : 'status-pill--warning'}`}>
                      {formatStatus(gym.status)}
                    </span>
                  </td>
                  <td>{formatNumber(gym.activeMembers ?? 0)}</td>
                  <td>{formatStatus(gym.sponsorship?.tier ?? 'none')}</td>
                  <td>{formatNumber(gym.analytics?.impressions ?? 0)}</td>
                  <td>{formatDate(gym.createdAt)}</td>
                  <td>
                    <button
                      type="button"
                      className="manager-btn manager-btn--reject"
                      onClick={() => handleDelete(gym)}
                      disabled={isDeleting}
                    >
                      {isDeleting ? 'Removing…' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="No gyms match your filters." />
        )}
      </DashboardSection>
    </div>
  );
};

export default GymsPage;
