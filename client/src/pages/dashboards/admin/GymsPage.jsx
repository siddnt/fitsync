import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Pagination from '../components/Pagination.jsx';
import useTableSort from '../components/useTableSort.js';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import AutosuggestInput from '../../../ui/AutosuggestInput.jsx';
import { useGetAdminGymsQuery } from '../../../services/dashboardApi.js';
import { useDeleteGymMutation } from '../../../services/adminApi.js';
import { formatDate, formatNumber, formatStatus } from '../../../utils/format.js';
import '../Dashboard.css';

const getUserId = (user) => user?.id ?? user?._id ?? null;
const getGymId = (gym) => gym?.id ?? gym?._id ?? null;

const RANK_BADGES = ['🥇', '🥈', '🥉'];
const RANK_CLASSES = ['rank-badge--gold', 'rank-badge--silver', 'rank-badge--bronze'];

const RankBadge = ({ index }) => {
  if (index < 3) {
    return <span className={`rank-badge ${RANK_CLASSES[index]}`}>{RANK_BADGES[index]}</span>;
  }
  return <span className="rank-badge rank-badge--default">{index + 1}</span>;
};

const AdminGymsPage = () => {
  const { data, isLoading, isError, refetch } = useGetAdminGymsQuery();
  const [deleteGym, { isLoading: isDeleting }] = useDeleteGymMutation();
  const gyms = data?.data?.gyms ?? [];

  const gymSuggestions = useMemo(() => gyms.map((g) => g.name).filter(Boolean), [gyms]);
  const [notice, setNotice] = useState(null);
  const [errorNotice, setErrorNotice] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  const statusOptions = useMemo(() => {
    const values = new Set(gyms.map((g) => g.status).filter(Boolean));
    return ['all', ...values];
  }, [gyms]);

  const filteredGyms = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return gyms.filter((gym) => {
      if (statusFilter !== 'all' && gym.status !== statusFilter) return false;
      if (!query) return true;
      const haystacks = [gym.name, gym.city, gym.state, gym.owner?.name, gym.owner?.email].filter(Boolean).map((v) => v.toLowerCase());
      return haystacks.some((v) => v.includes(query));
    });
  }, [gyms, searchTerm, statusFilter]);

  const { sorted, sortKey, sortDir, onSort } = useTableSort(filteredGyms, 'createdAt', 'desc');
  const PAGE_SIZE = 10;
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginatedGyms = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const thCls = (key) => `sortable${sortKey === key ? ` sort-${sortDir}` : ''}`;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    const safeTotalPages = Math.max(totalPages, 1);
    if (currentPage > safeTotalPages) {
      setCurrentPage(safeTotalPages);
    }
  }, [currentPage, totalPages]);

  const filtersActive = searchTerm.trim() || statusFilter !== 'all';
  const resetFilters = () => { setSearchTerm(''); setStatusFilter('all'); };

  /* -- Contributor Rankings -- */

  const topGymsByMembers = useMemo(() =>
    [...gyms].sort((a, b) => (b.activeMembers ?? 0) - (a.activeMembers ?? 0)).slice(0, 5),
    [gyms]);

  const topGymsByImpressions = useMemo(() =>
    [...gyms].sort((a, b) => (b.analytics?.impressions ?? 0) - (a.analytics?.impressions ?? 0)).slice(0, 5),
    [gyms]);

  const topOwners = useMemo(() => {
    const map = {};
    gyms.forEach((g) => {
      const o = g.owner;
      if (!o?.name) return;
      const key = getUserId(o) || o.name;
      if (!map[key]) {
        map[key] = {
          id: getUserId(o),
          name: o.name,
          email: o.email,
          gyms: 0,
          totalMembers: 0,
          totalImpressions: 0,
        };
      }
      map[key].gyms += 1;
      map[key].totalMembers += g.activeMembers ?? 0;
      map[key].totalImpressions += g.analytics?.impressions ?? 0;
    });
    return Object.values(map).sort((a, b) => b.gyms - a.gyms).slice(0, 5);
  }, [gyms]);

  const topCities = useMemo(() => {
    const map = {};
    gyms.forEach((g) => {
      const city = g.city;
      if (!city) return;
      if (!map[city]) map[city] = { name: city, state: g.state, gyms: 0, totalMembers: 0, totalTrainers: 0 };
      map[city].gyms += 1;
      map[city].totalMembers += g.activeMembers ?? 0;
      map[city].totalTrainers += g.activeTrainers ?? 0;
    });
    return Object.values(map).sort((a, b) => b.gyms - a.gyms).slice(0, 5);
  }, [gyms]);

  const handleDelete = async (gym) => {
    if (!gym) return;
    setNotice(null);
    setErrorNotice(null);
    const confirmed = window.confirm(`Remove ${gym.name}? This will cancel memberships and listings.`);
    if (!confirmed) return;
    try {
      await deleteGym(gym.id).unwrap();
      setNotice('Gym removed successfully.');
      refetch();
    } catch (mutationError) {
      setErrorNotice(mutationError?.data?.message ?? 'Unable to delete the gym.');
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
        <DashboardSection title="Gym administration" action={<button type="button" onClick={() => refetch()}>Retry</button>}>
          <EmptyState message="We could not load the gyms list." />
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="dashboard-grid dashboard-grid--stacked">
      <div className="admin-page-header">
        <h1>Gym Administration</h1>
        <p>Manage all registered gyms, monitor membership counts, and control listings.</p>
      </div>

      <DashboardSection title="Gym Overview">
        <div className="admin-stat-grid">
          <div className="stat-card stat-card--purple"><small>Total Gyms</small><strong>{gyms.length}</strong></div>
          <div className="stat-card stat-card--green"><small>Published</small><strong>{gyms.filter((g) => g.isPublished).length}</strong></div>
          <div className="stat-card stat-card--blue"><small>Active Members</small><strong>{gyms.reduce((s, g) => s + (g.activeMembers ?? 0), 0)}</strong></div>
          <div className="stat-card stat-card--orange"><small>Active Trainers</small><strong>{gyms.reduce((s, g) => s + (g.activeTrainers ?? 0), 0)}</strong></div>
        </div>
      </DashboardSection>

      <DashboardSection title="All Gyms">
        {/* ── Standalone toolbar ── */}
        <div className="admin-toolbar">
          <AutosuggestInput className="inventory-toolbar__input" placeholder="Search gym" value={searchTerm} onChange={setSearchTerm} suggestions={gymSuggestions} ariaLabel="Search gyms" />
          <select className="inventory-toolbar__input inventory-toolbar__input--select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status">
            {statusOptions.map((o) => <option key={o} value={o}>{o === 'all' ? 'All statuses' : formatStatus(o)}</option>)}
          </select>
          {filtersActive ? <button type="button" className="admin-toolbar__reset" onClick={resetFilters}>Reset</button> : null}
          <button type="button" className="admin-toolbar__refresh" onClick={() => refetch()}>Refresh</button>
        </div>

        {(notice || errorNotice) && (
          <div className={`status-pill ${errorNotice ? 'status-pill--warning' : 'status-pill--success'}`}>
            {errorNotice || notice}
          </div>
        )}

        {filteredGyms.length ? (
          <>
            <div className="admin-table-wrapper">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th className={thCls('name')} onClick={() => onSort('name')}>Name</th>
                    <th className={thCls('owner.name')} onClick={() => onSort('owner.name')}>Owner</th>
                    <th className={thCls('status')} onClick={() => onSort('status')}>Status</th>
                    <th className={thCls('activeMembers')} onClick={() => onSort('activeMembers')}>Members</th>
                    <th className={thCls('activeTrainers')} onClick={() => onSort('activeTrainers')}>Trainers</th>
                    <th className={thCls('sponsorship.tier')} onClick={() => onSort('sponsorship.tier')}>Sponsorship</th>
                    <th className={thCls('analytics.impressions')} onClick={() => onSort('analytics.impressions')}>Impressions</th>
                    <th className={thCls('createdAt')} onClick={() => onSort('createdAt')}>Created</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedGyms.map((gym) => (
                    <tr key={getGymId(gym) ?? gym.name}>
                      <td>
                        {getGymId(gym) ? (
                          <Link to={`/dashboard/admin/gyms/${getGymId(gym)}`} className="dashboard-table__user--link">
                            {gym.name}
                          </Link>
                        ) : (
                          <strong>{gym.name}</strong>
                        )}
                        <div className="location-cell">
                          <span className="location-cell__icon">📍</span>
                          <small>{gym.city}{gym.state ? `, ${gym.state}` : ''}</small>
                        </div>
                      </td>
                      <td>
                        {getUserId(gym.owner) ? (
                          <Link to={`/dashboard/admin/users/${getUserId(gym.owner)}`} className="dashboard-table__user--link">
                            {gym.owner?.name}
                          </Link>
                        ) : (
                          gym.owner?.name ?? '-'
                        )}
                        <div><small>{gym.owner?.email}</small></div>
                      </td>
                      <td>
                        <span className={`status-pill ${gym.status === 'active' ? 'status-pill--success' : 'status-pill--warning'}`}>
                          {formatStatus(gym.status)}
                        </span>
                      </td>
                      <td>{gym.activeMembers}</td>
                      <td>{gym.activeTrainers}</td>
                      <td>{formatStatus(gym.sponsorship?.tier)}</td>
                      <td>{formatNumber(gym.analytics?.impressions ?? 0)}</td>
                      <td>{formatDate(gym.createdAt)}</td>
                      <td>
                        <button type="button" onClick={() => handleDelete(gym)} disabled={isDeleting}>
                          {isDeleting ? 'Removing...' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={currentPage} totalPages={totalPages} from={(currentPage - 1) * PAGE_SIZE + 1} to={Math.min(currentPage * PAGE_SIZE, sorted.length)} total={sorted.length} onPageChange={setCurrentPage} />
          </>
        ) : (
          <EmptyState message={filtersActive ? 'No gyms match filters.' : 'No gyms to review right now.'} />
        )}
      </DashboardSection>

      {/* ── Leaderboards in 2-column grid ── */}
      <div className="admin-leaderboard-grid">
        <DashboardSection title="Top Gyms by Members" collapsible>
          {topGymsByMembers.length ? (
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Gym</th>
                  <th>City</th>
                  <th>Members</th>
                  <th>Trainers</th>
                </tr>
              </thead>
              <tbody>
                {topGymsByMembers.map((g, i) => (
                  <tr key={getGymId(g) ?? g.name}>
                    <td><RankBadge index={i} /></td>
                    <td>
                      {getGymId(g) ? (
                        <Link to={`/dashboard/admin/gyms/${getGymId(g)}`} className="dashboard-table__user--link">
                          <strong>{g.name}</strong>
                        </Link>
                      ) : (
                        <strong>{g.name}</strong>
                      )}
                    </td>
                    <td>{g.city ?? '-'}</td>
                    <td><strong>{g.activeMembers ?? 0}</strong></td>
                    <td>{g.activeTrainers ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState message="No gym data available." />
          )}
        </DashboardSection>

        <DashboardSection title="Top Gyms by Impressions" collapsible>
          {topGymsByImpressions.length ? (
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Gym</th>
                  <th>City</th>
                  <th>Impressions</th>
                  <th>Members</th>
                </tr>
              </thead>
              <tbody>
                {topGymsByImpressions.map((g, i) => (
                  <tr key={getGymId(g) ?? g.name}>
                    <td><RankBadge index={i} /></td>
                    <td>
                      {getGymId(g) ? (
                        <Link to={`/dashboard/admin/gyms/${getGymId(g)}`} className="dashboard-table__user--link">
                          <strong>{g.name}</strong>
                        </Link>
                      ) : (
                        <strong>{g.name}</strong>
                      )}
                    </td>
                    <td>{g.city ?? '-'}</td>
                    <td><strong>{formatNumber(g.analytics?.impressions ?? 0)}</strong></td>
                    <td>{g.activeMembers ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState message="No impressions data available." />
          )}
        </DashboardSection>

        <DashboardSection title="Top Gym Owners" collapsible>
          {topOwners.length ? (
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Owner</th>
                  <th>Gyms</th>
                  <th>Members</th>
                  <th>Impressions</th>
                </tr>
              </thead>
              <tbody>
                {topOwners.map((o, i) => (
                  <tr key={o.id ?? o.name}>
                    <td><RankBadge index={i} /></td>
                    <td>
                      <strong>
                        {o.id ? (
                          <Link to={`/dashboard/admin/users/${o.id}`} className="dashboard-table__user--link">
                            {o.name}
                          </Link>
                        ) : (
                          o.name
                        )}
                      </strong>
                      <div><small>{o.email}</small></div>
                    </td>
                    <td>{o.gyms}</td>
                    <td>{o.totalMembers}</td>
                    <td>{formatNumber(o.totalImpressions)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState message="No owner data available." />
          )}
        </DashboardSection>

        <DashboardSection title="Top Cities" collapsible>
          {topCities.length ? (
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>City</th>
                  <th>State</th>
                  <th>Gyms</th>
                  <th>Members</th>
                </tr>
              </thead>
              <tbody>
                {topCities.map((c, i) => (
                  <tr key={c.name}>
                    <td><RankBadge index={i} /></td>
                    <td><strong>{c.name}</strong></td>
                    <td>{c.state ?? '-'}</td>
                    <td>{c.gyms}</td>
                    <td>{c.totalMembers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <EmptyState message="No city data available." />
          )}
        </DashboardSection>
      </div>
    </div>
  );
};

export default AdminGymsPage;
