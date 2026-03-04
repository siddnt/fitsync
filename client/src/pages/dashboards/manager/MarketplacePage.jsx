import { useMemo, useState } from 'react';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import AutosuggestInput from '../../../ui/AutosuggestInput.jsx';
import { useGetManagerMarketplaceQuery } from '../../../services/managerApi.js';
import { formatCurrency, formatDateTime, formatStatus } from '../../../utils/format.js';
import '../Dashboard.css';

const MarketplacePage = () => {
  const { data, isLoading, isError, refetch } = useGetManagerMarketplaceQuery();
  const rawOrders = data?.data?.orders;

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const orders = useMemo(() => (Array.isArray(rawOrders) ? rawOrders : []), [rawOrders]);

  const orderSuggestions = useMemo(() => orders.flatMap((o) => [o.orderNumber, o.user?.name, o.user?.email, o.seller?.name].filter(Boolean)), [orders]);

  const statusOptions = useMemo(() => {
    const unique = new Set();
    orders.forEach((o) => { if (o?.status) unique.add(o.status.toLowerCase()); });
    return ['all', ...unique];
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return orders.filter((order) => {
      if (statusFilter !== 'all' && (order?.status?.toLowerCase() || 'processing') !== statusFilter) return false;
      if (!query) return true;
      return [order.orderNumber, order.id, order.user?.name, order.user?.email, order.seller?.name]
        .filter(Boolean)
        .some((v) => v.toString().toLowerCase().includes(query));
    });
  }, [orders, searchTerm, statusFilter]);

  const summary = useMemo(() => {
    if (!orders.length) return { total: 0, delivered: 0, revenue: 0 };
    return orders.reduce((acc, order) => {
      acc.total += 1;
      acc.revenue += Number(order.total?.amount ?? order.total ?? 0);
      if ((order.status || '').toLowerCase() === 'delivered') acc.delivered += 1;
      return acc;
    }, { total: 0, delivered: 0, revenue: 0 });
  }, [orders]);

  if (isLoading) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked">
        <DashboardSection title="Marketplace"><SkeletonPanel lines={10} /></DashboardSection>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked">
        <DashboardSection title="Marketplace" action={<button type="button" onClick={() => refetch()}>Retry</button>}>
          <EmptyState message="Could not load marketplace data." />
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="dashboard-grid dashboard-grid--stacked">
      <DashboardSection title="Marketplace Overview">
        <div className="stat-grid">
          <div className="stat-card">
            <small>Total Orders</small>
            <strong>{summary.total}</strong>
          </div>
          <div className="stat-card">
            <small>Delivered</small>
            <strong>{summary.delivered}</strong>
          </div>
          <div className="stat-card">
            <small>Gross Revenue</small>
            <strong>{formatCurrency({ amount: summary.revenue })}</strong>
          </div>
        </div>
      </DashboardSection>

      <DashboardSection
        title="Orders"
        action={
          <div className="users-toolbar">
            <AutosuggestInput
              className="inventory-toolbar__input"
              placeholder="Search order, buyer, seller"
              value={searchTerm}
              onChange={setSearchTerm}
              suggestions={orderSuggestions}
              ariaLabel="Search orders"
            />
            <select
              className="inventory-toolbar__input inventory-toolbar__input--select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
            >
              {statusOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt === 'all' ? 'All statuses' : formatStatus(opt)}
                </option>
              ))}
            </select>
            <button type="button" className="users-toolbar__refresh" onClick={() => refetch()}>
              Refresh
            </button>
          </div>
        }
      >
        {filteredOrders.length ? (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Buyer</th>
                <th>Seller</th>
                <th>Items</th>
                <th>Status</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <strong>{order.orderNumber ?? order.id}</strong>
                    <div><small>{formatDateTime(order.createdAt)}</small></div>
                  </td>
                  <td>
                    {order.user?.name ?? '—'}
                    <div><small>{order.user?.email}</small></div>
                  </td>
                  <td>
                    {order.seller?.name ?? '—'}
                    <div><small>{order.seller?.email}</small></div>
                  </td>
                  <td>{order.items?.length ?? 0} items</td>
                  <td>
                    <span className={`status-pill ${order.status === 'delivered' ? 'status-pill--success' : 'status-pill--warning'}`}>
                      {formatStatus(order.status)}
                    </span>
                  </td>
                  <td>{formatCurrency(order.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="No orders match your filters." />
        )}
      </DashboardSection>
    </div>
  );
};

export default MarketplacePage;
