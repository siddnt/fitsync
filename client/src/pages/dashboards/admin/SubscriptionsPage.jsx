import { useEffect, useMemo, useState } from 'react';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import { useGetAdminSubscriptionsQuery } from '../../../services/dashboardApi.js';
import { formatDate, formatStatus } from '../../../utils/format.js';
import PaginationBar from '../../../ui/PaginationBar.jsx';
import '../Dashboard.css';

const TYPE_OPTIONS = [
  { value: 'all', label: 'All types' },
  { value: 'listing', label: 'Listing Subscriptions' },
  { value: 'sponsorship', label: 'Sponsorships' },
];

const AdminSubscriptionsPage = () => {
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data, isLoading, isError, refetch } = useGetAdminSubscriptionsQuery({ page, search: searchTerm, type: typeFilter, status: statusFilter });
  const listingSubs = data?.data?.listingSubscriptions ?? [];
  const sponsorships = data?.data?.sponsorships ?? [];
  const pagination = data?.data?.pagination ?? {};

  useEffect(() => { setPage(1); }, [searchTerm, statusFilter, typeFilter]);

  /* Derive visible rows based on type filter - Server now filters the collections */
  const currentItems = useMemo(() => {
    return [
      ...listingSubs.map((i) => ({ ...i, _type: 'listing' })),
      ...sponsorships.map((i) => ({ ...i, _type: 'sponsorship' })),
    ];
  }, [listingSubs, sponsorships]);

  const statusOptions = ['all', 'active', 'pending', 'expired'];

  const filtered = currentItems; // Backend now performs filtering

  const filtersActive = searchTerm.trim() || statusFilter !== 'all' || typeFilter !== 'all';
  const resetFilters = () => { setSearchTerm(''); setStatusFilter('all'); setTypeFilter('all'); };

  // Calculate total across both datasets using the server provided pagination objects
  const totalItems = (pagination.listingSubscriptions?.total ?? 0) + (pagination.sponsorships?.total ?? 0);
  const maxPages = Math.max(pagination.listingSubscriptions?.totalPages ?? 1, pagination.sponsorships?.totalPages ?? 1);
  const totalPages = maxPages;
  const startIndex = (page - 1) * 10 + 1;
  const endIndex = Math.min(page * 10, totalItems);
  const pagedItems = filtered; // Server already sliced

  const listingSummary = useMemo(() => ({
    total: listingSubs.length,
    active: listingSubs.filter((s) => s.status === 'active').length,
    totalRevenue: listingSubs.reduce((s, sub) => s + (sub.amount ?? 0), 0),
  }), [listingSubs]);

  const sponsorshipSummary = useMemo(() => ({
    total: sponsorships.length,
    active: sponsorships.filter((s) => s.status === 'active').length,
    expired: sponsorships.filter((s) => s.status === 'expired').length,
  }), [sponsorships]);

  if (isLoading) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked">
        <DashboardSection title="Subscriptions"><SkeletonPanel lines={10} /></DashboardSection>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked">
        <DashboardSection title="Subscriptions" action={<button type="button" onClick={() => refetch()}>Retry</button>}>
          <EmptyState message="Could not load subscriptions." />
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="dashboard-grid dashboard-grid--stacked">
      <DashboardSection title="Subscriptions Overview">
        <div className="stat-grid">
          <div className="stat-card"><small>Listing Subs</small><strong>{listingSummary.total}</strong><small>{listingSummary.active} active</small></div>
          <div className="stat-card"><small>Listing Revenue</small><strong>₹{listingSummary.totalRevenue.toLocaleString('en-IN')}</strong></div>
          <div className="stat-card"><small>Sponsorships</small><strong>{sponsorshipSummary.total}</strong><small>{sponsorshipSummary.active} active</small></div>
          <div className="stat-card"><small>Expired Sponsorships</small><strong>{sponsorshipSummary.expired}</strong></div>
        </div>
      </DashboardSection>

      <DashboardSection
        title="Subscription Details"
        action={
          <div className="users-toolbar">
            <select
              className="inventory-toolbar__input inventory-toolbar__input--select"
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setStatusFilter('all'); }}
              aria-label="Filter by type"
            >
              {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <input
              type="search"
              className="inventory-toolbar__input"
              placeholder="Search owner, gym…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search subscriptions"
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
                  <th>Type</th>
                  <th style={{ width: '25%' }}>Gym</th>
                  <th>Owner</th>
                  <th>Plan / Package</th>
                  <th style={{ width: '100px' }}>Amount</th>
                  <th style={{ width: '150px' }}>Status</th>
                  <th>Period / Expiry</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {pagedItems.map((item) => (
                  <tr key={`${item._type}-${item.id}`}>
                    <td>
                      <span className={`status-pill status-pill--${item._type === 'listing' ? 'info' : 'sponsor'}`}>
                        {item._type === 'listing' ? 'Listing' : 'Sponsorship'}
                      </span>
                    </td>
                    <td>
                      {item.gym?.name ?? '—'}
                      {item.gym?.city && <div><small>{item.gym.city}</small></div>}
                    </td>
                    <td>
                      {item.owner?.name ?? '—'}
                      {item.owner?.email && <div><small>{item.owner.email}</small></div>}
                    </td>
                    <td>{item._type === 'listing' ? formatStatus(item.planCode) : (item.package ?? '—')}</td>
                    <td>{item._type === 'listing' ? `₹${item.amount}` : '—'}</td>
                    <td>
                      <span className={`status-pill status-pill--${item.status === 'active' ? 'success' : item.status === 'expired' ? 'warning' : 'default'}`}>
                        {formatStatus(item.status)}
                      </span>
                    </td>
                    <td>
                      {item._type === 'listing'
                        ? `${formatDate(item.periodStart)} – ${formatDate(item.periodEnd)}`
                        : (item.expiresAt ? `Expires ${formatDate(item.expiresAt)}` : '—')}
                    </td>
                    <td>
                      {item._type === 'listing'
                        ? `${item.autoRenew ? 'Auto-renew' : 'Manual'} · ${item.invoiceCount} inv.`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationBar page={page} totalPages={totalPages} totalItems={totalItems} startIndex={startIndex} endIndex={endIndex} onPage={setPage} />
          </div>
        ) : (
          <EmptyState message={filtersActive ? 'No items match the current filters.' : 'No subscriptions or sponsorships yet.'} />
        )}
      </DashboardSection>
    </div>
  );
};

export default AdminSubscriptionsPage;
