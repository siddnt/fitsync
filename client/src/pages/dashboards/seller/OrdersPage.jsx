import { useMemo, useState } from 'react';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import {
  useGetSellerOrdersQuery,
  useUpdateSellerOrderStatusMutation,
} from '../../../services/sellerApi.js';
import { formatCurrency, formatDate, formatStatus } from '../../../utils/format.js';
import { SELLER_ORDER_STATUSES } from '../../../constants/orderStatuses.js';
import '../Dashboard.css';

const OrdersPage = () => {
  const {
    data: ordersResponse,
    isLoading,
    isError,
    refetch,
  } = useGetSellerOrdersQuery();

  const [updateOrderStatus, { isLoading: isUpdating }] = useUpdateSellerOrderStatusMutation();
  const [notice, setNotice] = useState(null);
  const [errorNotice, setErrorNotice] = useState(null);
  const [draftStatuses, setDraftStatuses] = useState({});

  const orders = ordersResponse?.data?.orders ?? [];
  const statusOptions = useMemo(() => {
    const allowed = new Set(ordersResponse?.data?.statusOptions ?? SELLER_ORDER_STATUSES.map((option) => option.value));
    return SELLER_ORDER_STATUSES.filter((option) => allowed.has(option.value));
  }, [ordersResponse]);

  const resolveDraftStatus = (orderId, itemId, currentStatus) =>
    draftStatuses[`${orderId}:${itemId}`] ?? currentStatus;

  const handleDraftChange = (orderId, itemId, value) => {
    setDraftStatuses((prev) => ({
      ...prev,
      [`${orderId}:${itemId}`]: value,
    }));
  };

  const handleUpdateStatus = async (orderId, itemId, currentStatus) => {
    const nextStatus = draftStatuses[`${orderId}:${itemId}`];
    if (!orderId || !itemId || !nextStatus || nextStatus === currentStatus) {
      return;
    }

    setNotice(null);
    setErrorNotice(null);

    try {
      await updateOrderStatus({ orderId, itemId, status: nextStatus }).unwrap();
      setNotice(`Item status updated to ${formatStatus(nextStatus)}.`);
      setDraftStatuses((prev) => ({
        ...prev,
        [`${orderId}:${itemId}`]: undefined,
      }));
      refetch();
    } catch (mutationError) {
      setErrorNotice(mutationError?.data?.message ?? 'Unable to update this order status.');
    }
  };

  if (isLoading) {
    return (
      <div className="dashboard-grid">
        <DashboardSection title="Orders">
          <SkeletonPanel lines={10} />
        </DashboardSection>
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
          <EmptyState message="We could not load your recent orders." />
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="dashboard-grid">
      <DashboardSection
        title="Orders"
        action={(
          <button type="button" onClick={() => refetch()}>
            Refresh
          </button>
        )}
      >
        {(notice || errorNotice) && (
          <div className={`status-pill ${errorNotice ? 'status-pill--warning' : 'status-pill--success'}`}>
            {errorNotice || notice}
          </div>
        )}

        {orders.length ? (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Date</th>
                <th>Status</th>
                <th>Items</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <strong>{order.orderNumber ?? order.id}</strong>
                    <div>
                      <small>{order.buyer?.name ?? order.buyer?.email ?? '—'}</small>
                    </div>
                  </td>
                  <td>{formatDate(order.createdAt)}</td>
                  <td>
                    <span className={`status-pill ${order.status === 'Delivered' ? 'status-pill--success' : 'status-pill--info'}`}>
                      {formatStatus(order.status)}
                    </span>
                  </td>
                  <td>
                    <div className="order-items-list">
                      {(order.items || []).map((item) => {
                        const draft = resolveDraftStatus(order.id, item.itemId ?? item.id, item.status);
                        const selectId = `${order.id}-${item.itemId ?? item.id}`;
                        return (
                          <div key={selectId} className="order-item-row">
                            <div className="order-item-row__details">
                              <strong>{item.name}</strong>
                              <span>× {item.quantity}</span>
                              <span className="order-item-row__status">Current: {formatStatus(item.status)}</span>
                            </div>
                            <div className="order-item-row__actions">
                              <select
                                id={selectId}
                                value={draft}
                                onChange={(event) => handleDraftChange(order.id, item.itemId ?? item.id, event.target.value)}
                                disabled={isUpdating}
                              >
                                {statusOptions.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => handleUpdateStatus(order.id, item.itemId ?? item.id, item.status)}
                                disabled={isUpdating || draft === item.status}
                              >
                                {isUpdating ? 'Saving…' : 'Update'}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </td>
                  <td>{formatCurrency(order.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="No orders yet. Start promoting your listings to boost sales." />
        )}
      </DashboardSection>
    </div>
  );
};

export default OrdersPage;
