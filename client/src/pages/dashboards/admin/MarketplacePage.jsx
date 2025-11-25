import { useMemo, useState } from 'react';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import { useGetAdminMarketplaceQuery } from '../../../services/dashboardApi.js';
import { formatCurrency, formatDateTime, formatStatus } from '../../../utils/format.js';
import '../Dashboard.css';

const AdminMarketplacePage = () => {
  const { data, isLoading, isError, refetch } = useGetAdminMarketplaceQuery();
  const rawOrders = data?.data?.orders;

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const orders = useMemo(
    () => (Array.isArray(rawOrders) ? rawOrders : []),
    [rawOrders],
  );

  const statusOptions = useMemo(() => {
    const unique = new Set();
    orders.forEach((order) => {
      if (order?.status) {
        unique.add(order.status.toString().toLowerCase());
      }
    });
    return ['all', ...unique];
  }, [orders]);

  const categoryOptions = useMemo(() => {
    const unique = new Set();
    orders.forEach((order) => {
      (order.items || []).forEach((item) => {
        if (item?.category) {
          unique.add(item.category.toString().toLowerCase());
        }
      });
    });
    return ['all', ...unique];
  }, [orders]);

  const filtersActive = useMemo(
    () => Boolean(searchTerm.trim() || statusFilter !== 'all' || categoryFilter !== 'all'),
    [searchTerm, statusFilter, categoryFilter],
  );

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setCategoryFilter('all');
  };

  const filteredOrders = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return orders.filter((order) => {
      const normalisedStatus = order?.status?.toString().toLowerCase() || 'processing';
      if (statusFilter !== 'all' && normalisedStatus !== statusFilter) {
        return false;
      }

      if (categoryFilter !== 'all') {
        const categories = (order.items || [])
          .map((item) => item?.category?.toString().toLowerCase())
          .filter(Boolean);
        if (!categories.some((category) => category === categoryFilter)) {
          return false;
        }
      }

      if (!query) {
        return true;
      }

      const searchableFields = [
        order.orderNumber,
        order.id,
        order.user?.name,
        order.user?.email,
        order.seller?.name,
        order.seller?.email,
        ...(order.items || []).map((item) => item?.name),
      ]
        .filter(Boolean)
        .map((value) => value.toString().toLowerCase());

      return searchableFields.some((value) => value.includes(query));
    });
  }, [orders, searchTerm, statusFilter, categoryFilter]);

  const summary = useMemo(() => {
    if (!orders.length) {
      return {
        total: 0,
        processing: 0,
        fulfilled: 0,
        revenue: 0,
      };
    }
    return orders.reduce(
      (acc, order) => {
        acc.total += 1;
        acc.revenue += Number(order.total?.amount ?? order.total ?? 0);
        const status = (order.status || '').toString().toLowerCase();
        if (status === 'delivered') {
          acc.fulfilled += 1;
        }
        if (status === 'processing') {
          acc.processing += 1;
        }
        return acc;
      },
      { total: 0, processing: 0, fulfilled: 0, revenue: 0 },
    );
  }, [orders]);

  const topProducts = useMemo(() => {
    const counters = new Map();
    orders.forEach((order) => {
      (order.items || []).forEach((item) => {
        if (!item?.name) return;
        counters.set(item.name, (counters.get(item.name) || 0) + (item.quantity || 0));
      });
    });
    return [...counters.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, quantity]) => ({ name, quantity }));
  }, [orders]);

  if (isLoading) {
    return (
      <div className="dashboard-grid dashboard-grid--admin">
        <DashboardSection title="Marketplace overview" className="dashboard-section--span-12">
          <SkeletonPanel lines={8} />
        </DashboardSection>
        <DashboardSection title="Order feed" className="dashboard-section--span-12">
          <SkeletonPanel lines={8} />
        </DashboardSection>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="dashboard-grid dashboard-grid--admin">
        <DashboardSection
          title="Marketplace overview"
          className="dashboard-section--span-12"
          action={(
            <button type="button" onClick={() => refetch()}>
              Retry
            </button>
          )}
        >
          <EmptyState message="We could not fetch the marketplace orders." />
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="dashboard-grid dashboard-grid--admin">
      <DashboardSection
        title="Marketplace overview"
        className="dashboard-section--span-12"
        action={(
          <button type="button" onClick={() => refetch()}>
            Refresh
          </button>
        )}
      >
        {orders.length ? (
          <div className="stat-grid">
            <div className="stat-card">
              <small>Total orders</small>
              <strong>{summary.total}</strong>
              <small>{summary.processing} in processing</small>
            </div>
            <div className="stat-card">
              <small>Fulfilled</small>
              <strong>{summary.fulfilled}</strong>
              <small>{orders.length ? `${Math.round((summary.fulfilled / orders.length) * 100)}% success` : '—'}</small>
            </div>
            <div className="stat-card">
              <small>Gross revenue</small>
              <strong>{formatCurrency({ amount: summary.revenue })}</strong>
              <small>Including shipping & taxes</small>
            </div>
          </div>
        ) : (
          <EmptyState message="Orders will populate once customers start buying." />
        )}
      </DashboardSection>

      <DashboardSection
        title="Orders"
        className="dashboard-section--span-12"
        action={(
          <div className="users-toolbar">
            <input
              type="search"
              className="inventory-toolbar__input"
              placeholder="Search order, buyer, seller"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              aria-label="Search orders"
            />
            <select
              className="inventory-toolbar__input inventory-toolbar__input--select"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filter by status"
            >
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {option === 'all' ? 'All statuses' : formatStatus(option)}
                </option>
              ))}
            </select>
            <select
              className="inventory-toolbar__input inventory-toolbar__input--select"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              aria-label="Filter by category"
            >
              {categoryOptions.map((option) => (
                <option key={option} value={option}>
                  {option === 'all' ? 'All categories' : formatStatus(option)}
                </option>
              ))}
            </select>
            {filtersActive ? (
              <button type="button" className="users-toolbar__reset" onClick={resetFilters}>
                Reset
              </button>
            ) : null}
            <button type="button" className="users-toolbar__refresh" onClick={() => refetch()}>
              Refresh
            </button>
          </div>
        )}
      >
        {filteredOrders.length ? (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Buyer</th>
                <th>Seller</th>
                <th>Items</th>
                <th>Category</th>
                <th>Status</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => {
                const itemList = order.items ?? [];
                const categories = [...new Set(itemList.map((i) => i.category).filter(Boolean))];
                const categoryDisplay = categories.length > 1 ? 'Mixed' : (categories[0] || '—');
                
                return (
                  <tr key={order.id}>
                    <td>
                      <strong>{order.orderNumber ?? order.id}</strong>
                      <div>
                        <small>{formatDateTime(order.createdAt)}</small>
                      </div>
                    </td>
                    <td>
                      {order.user?.name ?? '—'}
                      <div><small>{order.user?.email}</small></div>
                    </td>
                    <td>
                      {order.seller?.name ?? '—'}
                      <div><small>{order.seller?.email}</small></div>
                    </td>
                    <td>
                      {itemList.length} items
                      <div><small>{itemList.map((i) => i.name).slice(0, 2).join(', ')}{itemList.length > 2 ? '...' : ''}</small></div>
                    </td>
                    <td>{formatStatus(categoryDisplay)}</td>
                    <td>{formatStatus(order.status)}</td>
                    <td>{formatCurrency(order.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <EmptyState message={filtersActive ? 'No orders match the current filters.' : 'No orders yet.'} />
        )}
      </DashboardSection>

      <DashboardSection title="Top Selling Products" className="dashboard-section--span-12">
        {topProducts.length ? (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Product Name</th>
                <th>Units Sold</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.map((product, index) => (
                <tr key={product.name}>
                  <td>
                    <strong>{index + 1}. {product.name}</strong>
                  </td>
                  <td>{product.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="Sales data will appear when customers purchase items." />
        )}
      </DashboardSection>
    </div>
  );
};

export default AdminMarketplacePage;
