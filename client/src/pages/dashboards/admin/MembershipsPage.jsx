import { useEffect, useMemo, useState } from 'react';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import { useGetAdminMembershipsQuery } from '../../../services/dashboardApi.js';
import { formatDate, formatStatus } from '../../../utils/format.js';
import PaginationBar from '../../../ui/PaginationBar.jsx';
import '../Dashboard.css';

const AdminMembershipsPage = () => {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, refetch } = useGetAdminMembershipsQuery({ page });
  const memberships = data?.data?.memberships ?? [];
  const pagination = data?.data?.pagination ?? {};

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');

  useEffect(() => { setPage(1); }, [searchTerm, statusFilter, planFilter]);

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

  const totalPages = pagination.totalPages ?? 1;
  const totalItems = pagination.total ?? memberships.length;
  const startIndex = (page - 1) * (pagination.limit ?? 10) + 1;
  const endIndex = Math.min(page * (pagination.limit ?? 10), totalItems);

  const summary = useMemo(() => ({
    total: totalItems,
    active: memberships.filter((m) => m.status === 'active').length,
    expired: memberships.filter((m) => m.status === 'expired').length,
    cancelled: memberships.filter((m) => m.status === 'cancelled').length,
  }), [memberships, totalItems]);

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
      <DashboardSection title="Membership Overview">
        <div className="stat-grid">
          <div className="stat-card"><small>Total</small><strong>{summary.total}</strong></div>
          <div className="stat-card"><small>Active</small><strong>{summary.active}</strong></div>
          <div className="stat-card"><small>Expired</small><strong>{summary.expired}</strong></div>
          <div className="stat-card"><small>Cancelled</small><strong>{summary.cancelled}</strong></div>
        </div>
      </DashboardSection>

      <DashboardSection
        title="All Memberships"
        action={
          <div className="users-toolbar">
            <input
              type="search"
              className="inventory-toolbar__input"
              placeholder="Search trainee, gym, trainer"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search memberships"
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
          <div className="admin-table-wrapper">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Trainee</th>
                  <th style={{ width: '25%' }}>Gym</th>
                  <th>Trainer</th>
                  <th>Plan</th>
                  <th style={{ width: '150px' }}>Status</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Billing</th>
                  <th>Auto-Renew</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <strong>{m.trainee?.name ?? '—'}</strong>
                      <div><small>{m.trainee?.email}</small></div>
                    </td>
                    <td>
                      {m.gym?.name ?? '—'}
                      <div><small>{m.gym?.city}</small></div>
                    </td>
                    <td>{m.trainer?.name ?? '—'}</td>
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
                          ₹{m.billing.amount}
                          <div><small>{formatStatus(m.billing.status)}</small></div>
                        </>
                      ) : '—'}
                    </td>
                    <td>{m.autoRenew ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationBar page={page} totalPages={totalPages} totalItems={totalItems} startIndex={startIndex} endIndex={endIndex} onPage={setPage} />
          </div>
        ) : (
          <EmptyState message={filtersActive ? 'No memberships match filters.' : 'No memberships yet.'} />
        )}
      </DashboardSection>
    </div>
  );
};

export default AdminMembershipsPage;
