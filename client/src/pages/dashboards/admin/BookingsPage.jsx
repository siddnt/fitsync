import { useMemo, useState } from 'react';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import { useGetAdminBookingsQuery } from '../../../services/dashboardApi.js';
import { formatDate, formatStatus } from '../../../utils/format.js';
import '../Dashboard.css';

const AdminBookingsPage = () => {
  const { data, isLoading, isError, refetch } = useGetAdminBookingsQuery();
  const bookings = data?.data?.bookings ?? [];

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const statusOptions = useMemo(() => {
    const values = new Set(bookings.map((b) => b.status).filter(Boolean));
    return ['all', ...values];
  }, [bookings]);

  const typeOptions = useMemo(() => {
    const values = new Set(bookings.map((b) => b.type).filter(Boolean));
    return ['all', ...values];
  }, [bookings]);

  const filtered = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return bookings.filter((b) => {
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;
      if (typeFilter !== 'all' && b.type !== typeFilter) return false;
      if (!query) return true;
      const haystacks = [
        b.user?.name, b.user?.email,
        b.trainer?.name, b.trainer?.email,
        b.gym?.name, b.gymName,
      ].filter(Boolean).map((v) => v.toLowerCase());
      return haystacks.some((v) => v.includes(query));
    });
  }, [bookings, searchTerm, statusFilter, typeFilter]);

  const filtersActive = searchTerm.trim() || statusFilter !== 'all' || typeFilter !== 'all';
  const resetFilters = () => { setSearchTerm(''); setStatusFilter('all'); setTypeFilter('all'); };

  const summary = useMemo(() => ({
    total: bookings.length,
    confirmed: bookings.filter((b) => b.status === 'confirmed').length,
    pending: bookings.filter((b) => b.status === 'pending').length,
    completed: bookings.filter((b) => b.status === 'completed').length,
    cancelled: bookings.filter((b) => b.status === 'cancelled').length,
  }), [bookings]);

  if (isLoading) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked">
        <DashboardSection title="Bookings"><SkeletonPanel lines={10} /></DashboardSection>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked">
        <DashboardSection title="Bookings" action={<button type="button" onClick={() => refetch()}>Retry</button>}>
          <EmptyState message="Could not load bookings." />
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="dashboard-grid dashboard-grid--stacked">
      <DashboardSection title="Booking Overview">
        <div className="stat-grid">
          <div className="stat-card"><small>Total</small><strong>{summary.total}</strong></div>
          <div className="stat-card"><small>Confirmed</small><strong>{summary.confirmed}</strong></div>
          <div className="stat-card"><small>Pending</small><strong>{summary.pending}</strong></div>
          <div className="stat-card"><small>Completed</small><strong>{summary.completed}</strong></div>
          <div className="stat-card"><small>Cancelled</small><strong>{summary.cancelled}</strong></div>
        </div>
      </DashboardSection>

      <DashboardSection
        title="All Bookings"
        action={
          <div className="users-toolbar">
            <input
              type="search"
              className="inventory-toolbar__input"
              placeholder="Search user, trainer, gym"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search bookings"
            />
            <select className="inventory-toolbar__input inventory-toolbar__input--select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status">
              {statusOptions.map((o) => <option key={o} value={o}>{o === 'all' ? 'All statuses' : formatStatus(o)}</option>)}
            </select>
            <select className="inventory-toolbar__input inventory-toolbar__input--select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} aria-label="Filter by type">
              {typeOptions.map((o) => <option key={o} value={o}>{o === 'all' ? 'All types' : formatStatus(o)}</option>)}
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
                  <th>User</th>
                  <th>Trainer</th>
                  <th>Gym</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Price</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <strong>{b.user?.name ?? '—'}</strong>
                      <div><small>{b.user?.email}</small></div>
                    </td>
                    <td>
                      {b.trainer?.name ?? '—'}
                      <div><small>{b.trainer?.email}</small></div>
                    </td>
                    <td>
                      {b.gym?.name ?? b.gymName ?? '—'}
                      <div><small>{b.gym?.city}</small></div>
                    </td>
                    <td>{formatDate(b.bookingDate)}</td>
                    <td>{b.startTime} – {b.endTime}</td>
                    <td>{formatStatus(b.type)}</td>
                    <td>
                      <span className={`status-pill status-pill--${b.status === 'confirmed' || b.status === 'completed' ? 'success' : b.status === 'cancelled' ? 'warning' : 'default'}`}>
                        {formatStatus(b.status)}
                      </span>
                    </td>
                    <td>{formatStatus(b.paymentStatus)}</td>
                    <td>₹{b.price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState message={filtersActive ? 'No bookings match filters.' : 'No bookings yet.'} />
        )}
      </DashboardSection>
    </div>
  );
};

export default AdminBookingsPage;
