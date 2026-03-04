import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Pagination from '../components/Pagination.jsx';
import useTableSort from '../components/useTableSort.js';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import AutosuggestInput from '../../../ui/AutosuggestInput.jsx';
import { useGetAdminSubscriptionsQuery } from '../../../services/dashboardApi.js';
import { formatCurrency, formatDate, formatStatus } from '../../../utils/format.js';
import '../Dashboard.css';

const TYPE_OPTIONS = [
  { value: 'all', label: 'All types' },
  { value: 'listing', label: 'Listing Subscriptions' },
  { value: 'sponsorship', label: 'Sponsorships' },
];
const getUserId = (user) => user?._id ?? user?.id ?? null;
const getGymId = (gym) => gym?._id ?? gym?.id ?? null;

const AdminSubscriptionsPage = () => {
  const { data, isLoading, isError, refetch } = useGetAdminSubscriptionsQuery();
  const listingSubs = data?.data?.listingSubscriptions ?? [];
  const sponsorships = data?.data?.sponsorships ?? [];

  const [typeFilter, setTypeFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  /* Derive visible rows based on type filter */
  const currentItems = useMemo(() => {
    if (typeFilter === 'listing') return listingSubs.map((i) => ({ ...i, _type: 'listing' }));
    if (typeFilter === 'sponsorship') return sponsorships.map((i) => ({ ...i, _type: 'sponsorship' }));
    return [
      ...listingSubs.map((i) => ({ ...i, _type: 'listing' })),
      ...sponsorships.map((i) => ({ ...i, _type: 'sponsorship' })),
    ];
  }, [typeFilter, listingSubs, sponsorships]);

  const statusOptions = useMemo(() => {
    const values = new Set(currentItems.map((i) => i.status).filter(Boolean));
    return ['all', ...values];
  }, [currentItems]);

  const filtered = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return currentItems.filter((i) => {
      if (statusFilter !== 'all' && i.status !== statusFilter) return false;
      if (!query) return true;
      const haystacks = [
        i.owner?.name, i.owner?.email, i.gym?.name,
        i.planCode, i.package,
      ].filter(Boolean).map((v) => v.toLowerCase());
      return haystacks.some((v) => v.includes(query));
    });
  }, [currentItems, searchTerm, statusFilter]);

  const subscriptionSuggestions = useMemo(() => currentItems.flatMap((i) => [i.owner?.name, i.owner?.email, i.gym?.name, i.planCode, i.package].filter(Boolean)), [currentItems]);

  const { sorted, sortKey, sortDir, onSort } = useTableSort(filtered, 'createdAt', 'desc');
  const PAGE_SIZE = 10;
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginatedItems = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const thCls = (key) => `sortable${sortKey === key ? ` sort-${sortDir}` : ''}`;

  const filtersActive = searchTerm.trim() || statusFilter !== 'all' || typeFilter !== 'all';
  const resetFilters = () => { setSearchTerm(''); setStatusFilter('all'); setTypeFilter('all'); };

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

  /* Plan popularity - which plans have the most subscribers */
  const planPopularity = useMemo(() => {
    const map = {};
    const add = (label, type, amount, status) => {
      if (!label) return;
      const key = `${type}::${label}`;
      if (!map[key]) map[key] = { plan: label, type, subscribers: 0, active: 0, revenue: 0 };
      map[key].subscribers += 1;
      if (status === 'active') map[key].active += 1;
      map[key].revenue += Number(amount) || 0;
    };
    listingSubs.forEach((s) => add(s.planCode, 'Listing', s.amount, s.status));
    sponsorships.forEach((s) => add(s.package, 'Sponsorship', s.amount, s.status));
    return Object.values(map).sort((a, b) => b.subscribers - a.subscribers);
  }, [listingSubs, sponsorships]);

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
      <div className="admin-page-header">
        <h1>Subscriptions</h1>
        <p>Manage listing subscriptions and sponsorship plans across all gym owners.</p>
      </div>

      <DashboardSection title="Subscriptions Overview">
        <div className="stat-grid">
          <div className="stat-card stat-card--blue"><small>Listing Subs</small><strong>{listingSummary.total}</strong><small>{listingSummary.active} active</small></div>
          <div className="stat-card stat-card--green"><small>Listing Revenue</small><strong>Rs {listingSummary.totalRevenue.toLocaleString('en-IN')}</strong></div>
          <div className="stat-card stat-card--purple"><small>Sponsorships</small><strong>{sponsorshipSummary.total}</strong><small>{sponsorshipSummary.active} active</small></div>
          <div className="stat-card stat-card--red"><small>Expired Sponsorships</small><strong>{sponsorshipSummary.expired}</strong></div>
        </div>
      </DashboardSection>

      {/* Popular Plans */}
      <DashboardSection title="Most Popular Plans" collapsible>
        {planPopularity.length ? (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Plan / Package</th>
                <th>Type</th>
                <th>Subscribers</th>
                <th>Active</th>
                <th>Total Revenue</th>
              </tr>
            </thead>
            <tbody>
              {planPopularity.map((p, i) => (
                <tr key={`${p.type}-${p.plan}`}>
                  <td><strong>{i + 1}</strong></td>
                  <td><strong>{formatStatus(p.plan)}</strong></td>
                  <td>
                    <span className={`status-pill status-pill--${p.type === 'Listing' ? 'info' : 'sponsor'}`}>
                      {p.type}
                    </span>
                  </td>
                  <td>{p.subscribers}</td>
                  <td>{p.active}</td>
                  <td>{formatCurrency(p.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="No plans data available." />
        )}
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
            <AutosuggestInput
              className="inventory-toolbar__input"
              placeholder="Search owner, gym..."
              value={searchTerm}
              onChange={setSearchTerm}
              suggestions={subscriptionSuggestions}
              ariaLabel="Search subscriptions"
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
                    <th className={thCls('_type')} onClick={() => onSort('_type')}>Type</th>
                    <th className={thCls('gym.name')} onClick={() => onSort('gym.name')}>Gym</th>
                    <th className={thCls('owner.name')} onClick={() => onSort('owner.name')}>Owner</th>
                    <th>Plan / Package</th>
                    <th className={thCls('amount')} onClick={() => onSort('amount')}>Amount</th>
                    <th className={thCls('status')} onClick={() => onSort('status')}>Status</th>
                    <th>Period / Expiry</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.map((item) => (
                    <tr key={`${item._type}-${item.id}`}>
                      <td>
                        <span className={`status-pill status-pill--${item._type === 'listing' ? 'info' : 'sponsor'}`}>
                          {item._type === 'listing' ? 'Listing' : 'Sponsorship'}
                        </span>
                      </td>
                      <td>
                        {getGymId(item.gym) ? (
                          <Link to={`/dashboard/admin/gyms/${getGymId(item.gym)}`} className="dashboard-table__user--link">
                            {item.gym?.name}
                          </Link>
                        ) : (
                          item.gym?.name ?? '-'
                        )}
                        {item.gym?.city && <div><small>{item.gym.city}</small></div>}
                      </td>
                      <td>
                        {getUserId(item.owner) ? (
                          <Link to={`/dashboard/admin/users/${getUserId(item.owner)}`} className="dashboard-table__user--link">
                            {item.owner?.name}
                          </Link>
                        ) : (
                          item.owner?.name ?? '-'
                        )}
                        {item.owner?.email && <div><small>{item.owner.email}</small></div>}
                      </td>
                      <td>{item._type === 'listing' ? formatStatus(item.planCode) : (item.package ?? '-')}</td>
                      <td>{item._type === 'listing' ? `Rs ${item.amount}` : '-'}</td>
                      <td>
                        <span className={`status-pill status-pill--${item.status === 'active' ? 'success' : item.status === 'expired' ? 'warning' : 'default'}`}>
                          {formatStatus(item.status)}
                        </span>
                      </td>
                      <td>
                        {item._type === 'listing'
                          ? `${formatDate(item.periodStart)} - ${formatDate(item.periodEnd)}`
                          : (item.expiresAt ? `Expires ${formatDate(item.expiresAt)}` : '-')}
                      </td>
                      <td>
                        {item._type === 'listing'
                          ? `${item.autoRenew ? 'Auto-renew' : 'Manual'} | ${item.invoiceCount} inv.`
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={currentPage} totalPages={totalPages} from={(currentPage - 1) * PAGE_SIZE + 1} to={Math.min(currentPage * PAGE_SIZE, sorted.length)} total={sorted.length} onPageChange={setCurrentPage} />
          </>
        ) : (
          <EmptyState message={filtersActive ? 'No subscriptions match filters.' : 'No subscriptions yet.'} />
        )}
      </DashboardSection>
    </div>
  );
};

export default AdminSubscriptionsPage;

