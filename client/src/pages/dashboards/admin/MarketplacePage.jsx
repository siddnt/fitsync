import { useMemo } from 'react';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import { useGetAdminMarketplaceQuery } from '../../../services/dashboardApi.js';
import { formatCurrency, formatDateTime, formatStatus } from '../../../utils/format.js';
import '../Dashboard.css';

const AdminMarketplacePage = () => {
  const { data, isLoading, isError, refetch } = useGetAdminMarketplaceQuery();
  const rawOrders = data?.data?.orders;

  const orders = useMemo(
    () => (Array.isArray(rawOrders) ? rawOrders : []),
    [rawOrders],
  );

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
      <div className="dashboard-grid">
        <DashboardSection title="Marketplace overview">
          <SkeletonPanel lines={8} />
        </DashboardSection>
        <DashboardSection title="Order feed">
          <SkeletonPanel lines={8} />
        </DashboardSection>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="dashboard-grid">
        <DashboardSection
          title="Marketplace overview"
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
    <div className="dashboard-grid">
      <DashboardSection
        title="Marketplace overview"
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

      <DashboardSection title="Order feed">
        {orders.length ? (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Buyer</th>
                <th>Status</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <strong>{order.orderNumber ?? order.id}</strong>
                    <div>
                      <small>{formatDateTime(order.createdAt)}</small>
                    </div>
                  </td>
                  <td>{order.user?.name ?? '—'}</td>
                  <td>{formatStatus(order.status)}</td>
                  <td>{formatCurrency(order.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="No orders yet." />
        )}
      </DashboardSection>

      <DashboardSection title="Top products">
        {topProducts.length ? (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Units sold</th>
              </tr>
            </thead>
            <tbody>
              {topProducts.map((product) => (
                <tr key={product.name}>
                  <td>{product.name}</td>
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
