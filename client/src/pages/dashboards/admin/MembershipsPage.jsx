import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Pagination from '../components/Pagination.jsx';
import useTableSort from '../components/useTableSort.js';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import AutosuggestInput from '../../../ui/AutosuggestInput.jsx';
import { useGetAdminMembershipsQuery } from '../../../services/dashboardApi.js';
import { formatDate, formatStatus } from '../../../utils/format.js';
import '../Dashboard.css';

const getUserId = (user) => user?._id ?? user?.id ?? null;
const getGymId = (gym) => gym?._id ?? gym?.id ?? null;

const AdminMembershipsPage = () => {
  const { data, isLoading, isError, refetch } = useGetAdminMembershipsQuery();
  const memberships = data?.data?.memberships ?? [];

  const membershipSuggestions = useMemo(() => memberships.flatMap((m) => [m.trainee?.name, m.trainee?.email, m.gym?.name, m.gym?.city, m.trainer?.name].filter(Boolean)), [memberships]);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  const statusOptions = useMemo(() => {
    const values = new Set(memberships.map((m) => m.status).filter(Boolean));
    return ['all', ...values];
  }, [memberships]);

  const planOptions = useMemo(() => {
    const values = new Set(memberships.map((m) => m.plan).filter(Boolean));
    return ['all', ...values];
  }, [memberships]);

  const filtered = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return memberships.filter((m) => {
      if (statusFilter !== 'all' && m.status !== statusFilter) return false;
      if (planFilter !== 'all' && m.plan !== planFilter) return false;
      if (!query) return true;
      const haystacks = [
        m.trainee?.name, m.trainee?.email,
        m.gym?.name, m.gym?.city,
        m.trainer?.name,
      ].filter(Boolean).map((v) => v.toLowerCase());
      return haystacks.some((v) => v.includes(query));
    });
  }, [memberships, searchTerm, statusFilter, planFilter]);

  const filtersActive = searchTerm.trim() || statusFilter !== 'all' || planFilter !== 'all';
  const resetFilters = () => { setSearchTerm(''); setStatusFilter('all'); setPlanFilter('all'); };

  const summary = useMemo(() => ({
    total: memberships.length,
    active: memberships.filter((m) => m.status === 'active').length,
    expired: memberships.filter((m) => m.status === 'expired').length,
    cancelled: memberships.filter((m) => m.status === 'cancelled').length,
  }), [memberships]);

  const { sorted, sortKey, sortDir, onSort } = useTableSort(filtered, 'startDate', 'desc');
  const PAGE_SIZE = 10;
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginatedItems = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const thCls = (key) => `sortable${sortKey === key ? ` sort-${sortDir}` : ''}`;

  if (isLoading) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked">
        <DashboardSection title="Memberships"><SkeletonPanel lines={10} /></DashboardSection>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked">
        <DashboardSection title="Memberships" action={<button type="button" onClick={() => refetch()}>Retry</button>}>
          <EmptyState message="Could not load memberships." />
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="dashboard-grid dashboard-grid--stacked">
      <div className="admin-page-header">
        <h1>Memberships</h1>
        <p>Oversee gym memberships, track active plans, and monitor renewals.</p>
      </div>

      <DashboardSection title="Membership Overview">
        <div className="stat-grid">
          <div className="stat-card stat-card--blue"><small>Total</small><strong>{summary.total}</strong></div>
          <div className="stat-card stat-card--green"><small>Active</small><strong>{summary.active}</strong></div>
          <div className="stat-card stat-card--orange"><small>Expired</small><strong>{summary.expired}</strong></div>
          <div className="stat-card stat-card--red"><small>Cancelled</small><strong>{summary.cancelled}</strong></div>
        </div>
      </DashboardSection>

      <DashboardSection
        title="All Memberships"
        action={
          <div className="users-toolbar">
            <AutosuggestInput
              className="inventory-toolbar__input"
              placeholder="Search trainee, gym, trainer"
              value={searchTerm}
              onChange={setSearchTerm}
              suggestions={membershipSuggestions}
              ariaLabel="Search memberships"
            />
            <select className="inventory-toolbar__input inventory-toolbar__input--select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status">
              {statusOptions.map((o) => <option key={o} value={o}>{o === 'all' ? 'All statuses' : formatStatus(o)}</option>)}
            </select>
            <select className="inventory-toolbar__input inventory-toolbar__input--select" value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} aria-label="Filter by plan">
              {planOptions.map((o) => <option key={o} value={o}>{o === 'all' ? 'All plans' : formatStatus(o)}</option>)}
            </select>
            {filtersActive ? <button type="button" className="users-toolbar__reset" onClick={resetFilters}>Reset</button> : null}
            <button type="button" className="users-toolbar__refresh" onClick={() => refetch()}>Refresh</button>
          </div>
        }
      >
        {filtered.length ? (
          <>
            <div className="admin-table-wrapper">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th className={thCls('trainee.name')} onClick={() => onSort('trainee.name')}>Trainee</th>
                    <th className={thCls('gym.name')} onClick={() => onSort('gym.name')}>Gym</th>
                    <th className={thCls('trainer.name')} onClick={() => onSort('trainer.name')}>Trainer</th>
                    <th className={thCls('plan')} onClick={() => onSort('plan')}>Plan</th>
                    <th className={thCls('status')} onClick={() => onSort('status')}>Status</th>
                    <th className={thCls('startDate')} onClick={() => onSort('startDate')}>Start</th>
                    <th className={thCls('endDate')} onClick={() => onSort('endDate')}>End</th>
                    <th className={thCls('billing')} onClick={() => onSort('billing')}>Billing</th>
                    <th>Auto-Renew</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <strong>
                          {getUserId(m.trainee) ? (
                            <Link to={`/dashboard/admin/users/${getUserId(m.trainee)}`} className="dashboard-table__user--link">
                              {m.trainee?.name}
                            </Link>
                          ) : (
                            m.trainee?.name ?? '-'
                          )}
                        </strong>
                        <div><small>{m.trainee?.email}</small></div>
                      </td>
                      <td>
                        {getGymId(m.gym) ? (
                          <Link to={`/dashboard/admin/gyms/${getGymId(m.gym)}`} className="dashboard-table__user--link">
                            {m.gym?.name}
                          </Link>
                        ) : (
                          m.gym?.name ?? '-'
                        )}
                        <div><small>{m.gym?.city}</small></div>
                      </td>
                      <td>{getUserId(m.trainer) ? (
                          <Link to={`/dashboard/admin/users/${getUserId(m.trainer)}`} className="dashboard-table__user--link">
                            {m.trainer?.name}
                          </Link>
                        ) : (
                          m.trainer?.name ?? '-'
                        )}</td>
                      <td>{formatStatus(m.plan)}</td>
                      <td>
                        <span className={`status-pill status-pill--${m.status === 'active' ? 'success' : m.status === 'expired' ? 'warning' : 'default'}`}>
                          {formatStatus(m.status)}
                        </span>
                      </td>
                      <td>{formatDate(m.startDate)}</td>
                      <td>{formatDate(m.endDate)}</td>
                      <td>
                        {m.billing ? (
                          <>
                            Rs {m.billing.amount}
                            <div><small>{formatStatus(m.billing.status)}</small></div>
                          </>
                        ) : '-'}
                      </td>
                      <td>{m.autoRenew ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={currentPage} totalPages={totalPages} from={(currentPage - 1) * PAGE_SIZE + 1} to={Math.min(currentPage * PAGE_SIZE, sorted.length)} total={sorted.length} onPageChange={setCurrentPage} />
          </>
        ) : (
          <EmptyState message={filtersActive ? 'No memberships match filters.' : 'No memberships yet.'} />
        )}
      </DashboardSection>
    </div>
  );
};

export default AdminMembershipsPage;

