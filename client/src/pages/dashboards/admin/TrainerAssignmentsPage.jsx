import { useMemo, useState } from 'react';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Pagination from '../components/Pagination.jsx';
import useTableSort from '../components/useTableSort.js';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import AutosuggestInput from '../../../ui/AutosuggestInput.jsx';
import { useGetAdminTrainerAssignmentsQuery } from '../../../services/dashboardApi.js';
import { formatDate, formatStatus } from '../../../utils/format.js';
import '../Dashboard.css';

const AdminTrainerAssignmentsPage = () => {
  const { data, isLoading, isError, refetch } = useGetAdminTrainerAssignmentsQuery();
  const assignments = data?.data?.assignments ?? [];

  const assignmentSuggestions = useMemo(() => assignments.flatMap((a) => [a.trainer?.name, a.trainer?.email, a.gym?.name, a.gym?.city, ...(a.trainees || []).map((t) => t.trainee?.name)].filter(Boolean)), [assignments]);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  const statusOptions = useMemo(() => {
    const values = new Set(assignments.map((a) => a.status).filter(Boolean));
    return ['all', ...values];
  }, [assignments]);

  const filtered = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return assignments.filter((a) => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (!query) return true;
      const haystacks = [
        a.trainer?.name, a.trainer?.email,
        a.gym?.name, a.gym?.city,
        ...(a.trainees || []).map((t) => t.trainee?.name),
      ].filter(Boolean).map((v) => v.toLowerCase());
      return haystacks.some((v) => v.includes(query));
    });
  }, [assignments, searchTerm, statusFilter]);

  const filtersActive = searchTerm.trim() || statusFilter !== 'all';
  const resetFilters = () => { setSearchTerm(''); setStatusFilter('all'); };

  const summary = useMemo(() => ({
    total: assignments.length,
    active: assignments.filter((a) => a.status === 'active').length,
    pending: assignments.filter((a) => a.status === 'pending').length,
    totalTrainees: assignments.reduce((s, a) => s + (a.trainees?.length ?? 0), 0),
  }), [assignments]);

  const { sorted, sortKey, sortDir, onSort } = useTableSort(filtered, 'trainer.name');
  const PAGE_SIZE = 10;
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginatedItems = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const thCls = (key) => `sortable${sortKey === key ? ` sort-${sortDir}` : ''}`;

  if (isLoading) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked">
        <DashboardSection title="Trainer Assignments"><SkeletonPanel lines={10} /></DashboardSection>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked">
        <DashboardSection title="Trainer Assignments" action={<button type="button" onClick={() => refetch()}>Retry</button>}>
          <EmptyState message="Could not load trainer assignments." />
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="dashboard-grid dashboard-grid--stacked">
      <div className="admin-page-header">
        <h1>Trainer Assignments</h1>
        <p>View trainer-gym assignments and their assigned trainees.</p>
      </div>

      <DashboardSection title="Assignments Overview">
        <div className="stat-grid">
          <div className="stat-card stat-card--blue"><small>Total Assignments</small><strong>{summary.total}</strong></div>
          <div className="stat-card stat-card--green"><small>Active</small><strong>{summary.active}</strong></div>
          <div className="stat-card stat-card--orange"><small>Pending</small><strong>{summary.pending}</strong></div>
          <div className="stat-card stat-card--purple"><small>Total Trainees</small><strong>{summary.totalTrainees}</strong></div>
        </div>
      </DashboardSection>

      <DashboardSection
        title="All Trainer Assignments"
        action={
          <div className="users-toolbar">
            <AutosuggestInput
              className="inventory-toolbar__input"
              placeholder="Search trainer, gym, trainee"
              value={searchTerm}
              onChange={setSearchTerm}
              suggestions={assignmentSuggestions}
              ariaLabel="Search assignments"
            />
            <select className="inventory-toolbar__input inventory-toolbar__input--select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status">
              {statusOptions.map((o) => <option key={o} value={o}>{o === 'all' ? 'All statuses' : formatStatus(o)}</option>)}
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
                    <th className={thCls('trainer.name')} onClick={() => onSort('trainer.name')}>Trainer</th>
                    <th className={thCls('gym.name')} onClick={() => onSort('gym.name')}>Gym</th>
                    <th className={thCls('status')} onClick={() => onSort('status')}>Status</th>
                    <th>Trainees</th>
                    <th className={thCls('createdAt')} onClick={() => onSort('createdAt')}>Requested</th>
                    <th className={thCls('approvedAt')} onClick={() => onSort('approvedAt')}>Approved</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <strong>{a.trainer?.name ?? '—'}</strong>
                        <div><small>{a.trainer?.email}</small></div>
                      </td>
                      <td>
                        {a.gym?.name ?? '—'}
                        <div><small>{a.gym?.city}</small></div>
                      </td>
                      <td>
                        <span className={`status-pill status-pill--${a.status === 'active' ? 'success' : a.status === 'pending' ? 'warning' : 'default'}`}>
                          {formatStatus(a.status)}
                        </span>
                      </td>
                      <td>
                        {a.trainees?.length ? (
                          <div className="admin-trainee-list">
                            {a.trainees.map((t, i) => (
                              <div key={t.trainee?.id ?? i} className="admin-trainee-chip">
                                <span>{t.trainee?.name ?? 'Unknown'}</span>
                                <small className={`status-dot status-dot--${t.status === 'active' ? 'success' : 'default'}`}>{formatStatus(t.status)}</small>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted">None assigned</span>
                        )}
                      </td>
                      <td>{formatDate(a.requestedAt)}</td>
                      <td>{a.approvedAt ? formatDate(a.approvedAt) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={currentPage} totalPages={totalPages} from={(currentPage - 1) * PAGE_SIZE + 1} to={Math.min(currentPage * PAGE_SIZE, sorted.length)} total={sorted.length} onPageChange={setCurrentPage} />
          </>
        ) : (
          <EmptyState message={filtersActive ? 'No assignments match filters.' : 'No trainer assignments yet.'} />
        )}
      </DashboardSection>
    </div>
  );
};

export default AdminTrainerAssignmentsPage;
