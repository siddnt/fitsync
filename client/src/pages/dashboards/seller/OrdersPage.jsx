import { useEffect, useMemo, useState } from 'react';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import {
  useGetSellerOrdersQuery,
  useUpdateSellerOrderStatusMutation,
} from '../../../services/sellerApi.js';
import { formatCurrency, formatDate, formatNumber, formatStatus } from '../../../utils/format.js';
import { SELLER_ORDER_STATUSES } from '../../../constants/orderStatuses.js';
import '../Dashboard.css';

const OrdersPage = () => {
  const {
    data: ordersResponse,
    isLoading,
    isError,
    error,
    refetch,
  } = useGetSellerOrdersQuery();

  const [updateOrderStatus, { isLoading: isUpdating }] = useUpdateSellerOrderStatusMutation();
  const [notice, setNotice] = useState(null);
  const [errorNotice, setErrorNotice] = useState(null);
  const [draftStatuses, setDraftStatuses] = useState({});
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const orders = ordersResponse?.data?.orders ?? [];
  const statusOptions = useMemo(() => {
    const allowed = new Set(ordersResponse?.data?.statusOptions ?? SELLER_ORDER_STATUSES.map((option) => option.value));
    return SELLER_ORDER_STATUSES.filter((option) => allowed.has(option.value));
  }, [ordersResponse]);

  const statusFilterOptions = useMemo(
    () => [
      { value: 'all', label: 'All' },
      ...statusOptions.map((option) => ({
        value: option.value.toLowerCase(),
        label: option.label,
      })),
    ],
    [statusOptions],
  );

  const statusCounts = useMemo(() => {
    const counts = orders.reduce((acc, order) => {
      const key = (order.status ?? '').toString().toLowerCase() || 'unknown';
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
    counts.all = orders.length;
    return counts;
  }, [orders]);

  // Apply status and search filters without mutating the fetched dataset.
  const filteredOrders = useMemo(() => {
    const next = orders.filter((order) => {
      const normalisedStatus = (order.status ?? '').toString().toLowerCase();
      const statusMatch = statusFilter === 'all' ? true : normalisedStatus === statusFilter;

      const query = searchQuery.trim().toLowerCase();
      if (!query) {
        return statusMatch;
      }

      const searchable = [
        order.orderNumber,
        order.id,
        order.buyer?.name,
        order.buyer?.email,
      ]
        .map((value) => (value ?? '').toString().toLowerCase())
        .some((value) => value.includes(query));

      return statusMatch && searchable;
    });

    return next;
  }, [orders, statusFilter, searchQuery]);

  const filteredStats = useMemo(() => ({
    shown: filteredOrders.length,
    delivered: filteredOrders.filter((order) => (order.status ?? '').toString().toLowerCase() === 'delivered').length,
    revenue: filteredOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0),
  }), [filteredOrders]);

  const isFiltering = statusFilter !== 'all' || Boolean(searchQuery.trim());

  useEffect(() => {
    if (statusFilter === 'all') {
      return;
    }

    const available = statusFilterOptions.some((option) => option.value === statusFilter);
    if (!available) {
      setStatusFilter('all');
    }
  }, [statusFilter, statusFilterOptions]);

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

  const approvalError = error?.status === 403 ? error : null;
  const approvalMessage = approvalError?.data?.message
    ?? 'Your seller account is awaiting admin approval. Hang tight—order management will unlock once you are activated.';

  if (approvalError) {
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
          <EmptyState message={approvalMessage} />
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
        <div className="inventory-toolbar orders-toolbar">
          <input
            type="text"
            className="inventory-toolbar__input"
            placeholder="Search order number or buyer"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          <select
            className="inventory-toolbar__input inventory-toolbar__input--select"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            {statusFilterOptions.map((option) => {
              const countKey = option.value === 'all' ? 'all' : option.value.toLowerCase();
              const count = statusCounts[countKey] ?? 0;
              const labelWithCount = count ? `${option.label} (${count})` : option.label;
              return (
                <option key={option.value} value={option.value}>
                  {labelWithCount}
                </option>
              );
            })}
          </select>
        </div>

        <div className="stat-grid orders-stat-grid">
          <div className="stat-card">
            <small>Orders shown</small>
            <strong>{formatNumber(filteredStats.shown)}</strong>
            <small>{formatNumber(orders.length)} total</small>
          </div>
          <div className="stat-card">
            <small>Delivered</small>
            <strong>{formatNumber(filteredStats.delivered)}</strong>
            <small>Within current filters</small>
          </div>
          <div className="stat-card">
            <small>Gross revenue</small>
            <strong>{formatCurrency(filteredStats.revenue)}</strong>
            <small>Filtered selection</small>
          </div>
        </div>

        {(notice || errorNotice) && (
          <div className={`status-pill ${errorNotice ? 'status-pill--warning' : 'status-pill--success'}`}>
            {errorNotice || notice}
          </div>
        )}

        {filteredOrders.length ? (
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
              {filteredOrders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <strong>{order.orderNumber ?? order.id}</strong>
                    <div>
                      <small>{order.buyer?.name ?? order.buyer?.email ?? '—'}</small>
                    </div>
                  </td>
                  <td>{formatDate(order.createdAt)}</td>
                  <td>
                    <span className={`status-pill ${order.status === 'delivered' ? 'status-pill--success' : 'status-pill--info'}`}>
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
          <EmptyState
            message={
              isFiltering
                ? 'No orders match the current filters.'
                : 'No orders yet. Start promoting your listings to boost sales.'
            }
          />
        )}
      </DashboardSection>
    </div>
  );
};

export default OrdersPage;
