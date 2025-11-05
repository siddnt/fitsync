import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import { useGetTraineeOrdersQuery } from '../../../services/dashboardApi.js';
import {
  formatCurrency,
  formatDateTime,
  formatStatus,
} from '../../../utils/format.js';
import '../Dashboard.css';

const groupByStatus = (orders = []) =>
  orders.reduce((acc, order) => {
    const key = order.status ?? 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

const calculateTotals = (orders = []) =>
  orders.reduce(
    (acc, order) => {
      const amount = typeof order.total === 'object' ? order.total.amount : order.total;
      return {
        amount: acc.amount + (amount || 0),
        currency: order.total?.currency || acc.currency || 'INR',
      };
    },
    { amount: 0, currency: 'INR' },
  );

const TraineeOrdersPage = () => {
  const { data, isLoading, isError, refetch } = useGetTraineeOrdersQuery();
  const orders = data?.data?.orders ?? [];
  const totals = calculateTotals(orders);
  const byStatus = groupByStatus(orders);

  if (isLoading) {
    return (
      <div className="dashboard-grid">
        {['Recent purchases', 'Spending summary'].map((title) => (
          <DashboardSection key={title} title={title}>
            <SkeletonPanel lines={6} />
          </DashboardSection>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="dashboard-grid">
        <DashboardSection
          title="Orders unavailable"
          action={(
            <button type="button" onClick={() => refetch()}>
              Retry
            </button>
          )}
        >
          <EmptyState message="We could not load your order history right now." />
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="dashboard-grid">
      <DashboardSection title="Recent purchases">
        {orders.length ? (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Total</th>
                <th>Status</th>
                <th>Placed</th>
                <th>Items</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>{order.orderNumber ?? '—'}</td>
                  <td>{formatCurrency(order.total)}</td>
                  <td>{formatStatus(order.status)}</td>
                  <td>{formatDateTime(order.createdAt)}</td>
                  <td>{order.itemsCount ?? order.items?.length ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="You have not placed any marketplace orders yet." />
        )}
      </DashboardSection>

      <DashboardSection title="Spending summary">
        {orders.length ? (
          <div className="stat-grid">
            <div className="stat-card">
              <small>Total spend</small>
              <strong>{formatCurrency(totals)}</strong>
              <small>Across {orders.length} orders</small>
            </div>
            {Object.entries(byStatus).map(([status, count]) => (
              <div key={status} className="stat-card">
                <small>{formatStatus(status)}</small>
                <strong>{count}</strong>
                <small>Orders</small>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message="Order analytics will show once you start shopping." />
        )}
      </DashboardSection>
    </div>
  );
};

export default TraineeOrdersPage;
