import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Pagination from '../components/Pagination.jsx';
import useTableSort from '../components/useTableSort.js';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import AutosuggestInput from '../../../ui/AutosuggestInput.jsx';
import { useGetAdminBookingsQuery } from '../../../services/dashboardApi.js';
import { formatDate, formatStatus } from '../../../utils/format.js';
import '../Dashboard.css';

const getUserId = (user) => user?._id ?? user?.id ?? null;
const getGymId = (gym) => gym?._id ?? gym?.id ?? null;

const AdminBookingsPage = () => {
  const { data, isLoading, isError, refetch } = useGetAdminBookingsQuery();
  const bookings = data?.data?.bookings ?? [];

  const bookingSuggestions = useMemo(() => bookings.flatMap((b) => [b.user?.name, b.trainer?.name, b.gym?.name, b.gymName].filter(Boolean)), [bookings]);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
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

  const { sorted, sortKey, sortDir, onSort } = useTableSort(filtered, 'bookingDate', 'desc');
  const PAGE_SIZE = 10;
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginatedItems = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const thCls = (key) => `sortable${sortKey === key ? ` sort-${sortDir}` : ''}`;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, typeFilter]);

  useEffect(() => {
    const safeTotalPages = Math.max(totalPages, 1);
    if (currentPage > safeTotalPages) {
      setCurrentPage(safeTotalPages);
    }
  }, [currentPage, totalPages]);

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
      <div className="admin-page-header">
        <h1>Bookings</h1>
        <p>Track gym and trainer bookings across the platform.</p>
      </div>

      <DashboardSection title="Booking Overview">
        <div className="stat-grid">
          <div className="stat-card stat-card--blue"><small>Total</small><strong>{summary.total}</strong></div>
          <div className="stat-card stat-card--green"><small>Confirmed</small><strong>{summary.confirmed}</strong></div>
          <div className="stat-card stat-card--orange"><small>Pending</small><strong>{summary.pending}</strong></div>
          <div className="stat-card stat-card--purple"><small>Completed</small><strong>{summary.completed}</strong></div>
          <div className="stat-card stat-card--red"><small>Cancelled</small><strong>{summary.cancelled}</strong></div>
        </div>
      </DashboardSection>

      <DashboardSection
        title="All Bookings"
        action={
          <div className="users-toolbar">
            <AutosuggestInput
              className="inventory-toolbar__input"
              placeholder="Search user, trainer, gym"
              value={searchTerm}
              onChange={setSearchTerm}
              suggestions={bookingSuggestions}
              ariaLabel="Search bookings"
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
          <>
            <div className="admin-table-wrapper">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th className={thCls('user.name')} onClick={() => onSort('user.name')}>User</th>
                    <th className={thCls('trainer.name')} onClick={() => onSort('trainer.name')}>Trainer</th>
                    <th className={thCls('gym.name')} onClick={() => onSort('gym.name')}>Gym</th>
                    <th className={thCls('bookingDate')} onClick={() => onSort('bookingDate')}>Date</th>
                    <th>Time</th>
                    <th className={thCls('type')} onClick={() => onSort('type')}>Type</th>
                    <th className={thCls('status')} onClick={() => onSort('status')}>Status</th>
                    <th className={thCls('paymentStatus')} onClick={() => onSort('paymentStatus')}>Payment</th>
                    <th className={thCls('price')} onClick={() => onSort('price')}>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <strong>
                          {getUserId(b.user) ? (
                            <Link to={`/dashboard/admin/users/${getUserId(b.user)}`} className="dashboard-table__user--link">
                              {b.user?.name}
                            </Link>
                          ) : (
                            b.user?.name ?? '-'
                          )}
                        </strong>
                        <div><small>{b.user?.email}</small></div>
                      </td>
                      <td>
                        {getUserId(b.trainer) ? (
                          <Link to={`/dashboard/admin/users/${getUserId(b.trainer)}`} className="dashboard-table__user--link">
                            {b.trainer?.name}
                          </Link>
                        ) : (
                          b.trainer?.name ?? '-'
                        )}
                        <div><small>{b.trainer?.email}</small></div>
                      </td>
                      <td>
                        {getGymId(b.gym) ? (
                          <Link to={`/dashboard/admin/gyms/${getGymId(b.gym)}`} className="dashboard-table__user--link">
                            {b.gym?.name ?? b.gymName}
                          </Link>
                        ) : (
                          b.gym?.name ?? b.gymName ?? '-'
                        )}
                        <div><small>{b.gym?.city}</small></div>
                      </td>
                      <td>{formatDate(b.bookingDate)}</td>
                      <td>{b.startTime} - {b.endTime}</td>
                      <td>{formatStatus(b.type)}</td>
                      <td>
                        <span className={`status-pill status-pill--${b.status === 'confirmed' || b.status === 'completed' ? 'success' : b.status === 'cancelled' ? 'warning' : 'default'}`}>
                          {formatStatus(b.status)}
                        </span>
                      </td>
                      <td>{formatStatus(b.paymentStatus)}</td>
                      <td>Rs {b.price}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={currentPage} totalPages={totalPages} from={(currentPage - 1) * PAGE_SIZE + 1} to={Math.min(currentPage * PAGE_SIZE, sorted.length)} total={sorted.length} onPageChange={setCurrentPage} />
          </>
        ) : (
          <EmptyState message={filtersActive ? 'No bookings match filters.' : 'No bookings yet.'} />
        )}
      </DashboardSection>
    </div>
  );
};

export default AdminBookingsPage;

