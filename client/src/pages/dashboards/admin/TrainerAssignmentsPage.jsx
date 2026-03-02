import { useMemo, useState } from 'react';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import { useGetAdminTrainerAssignmentsQuery } from '../../../services/dashboardApi.js';
import { formatDate, formatStatus } from '../../../utils/format.js';
import '../Dashboard.css';

const AdminTrainerAssignmentsPage = () => {
  const { data, isLoading, isError, refetch } = useGetAdminTrainerAssignmentsQuery();
  const assignments = data?.data?.assignments ?? [];

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

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
      <DashboardSection title="Assignments Overview">
        <div className="stat-grid">
          <div className="stat-card"><small>Total Assignments</small><strong>{summary.total}</strong></div>
          <div className="stat-card"><small>Active</small><strong>{summary.active}</strong></div>
          <div className="stat-card"><small>Pending</small><strong>{summary.pending}</strong></div>
          <div className="stat-card"><small>Total Trainees</small><strong>{summary.totalTrainees}</strong></div>
        </div>
      </DashboardSection>

      <DashboardSection
        title="All Trainer Assignments"
        action={
          <div className="users-toolbar">
            <input
              type="search"
              className="inventory-toolbar__input"
              placeholder="Search trainer, gym, trainee"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search assignments"
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
          <div className="admin-table-wrapper">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Trainer</th>
                  <th>Gym</th>
                  <th>Status</th>
                  <th>Trainees</th>
                  <th>Requested</th>
                  <th>Approved</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => (
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
        ) : (
          <EmptyState message={filtersActive ? 'No assignments match filters.' : 'No trainer assignments yet.'} />
        )}
      </DashboardSection>
    </div>
  );
};

export default AdminTrainerAssignmentsPage;
