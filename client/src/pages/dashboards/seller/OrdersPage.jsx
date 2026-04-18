import { useEffect, useMemo, useState } from 'react';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import {
  useGetSellerOrdersQuery,
  useReviewReturnRequestMutation,
  useUpdateSellerOrderStatusMutation,
  useUpdateSellerOrderTrackingMutation,
} from '../../../services/sellerApi.js';
import { formatCurrency, formatDate, formatNumber, formatStatus } from '../../../utils/format.js';
import { SELLER_ORDER_STATUSES } from '../../../constants/orderStatuses.js';
import SearchSuggestInput from '../../../components/dashboard/SearchSuggestInput.jsx';
import { matchesPrefix, matchesAcrossFields } from '../../../utils/search.js';
import '../Dashboard.css';

const resolveTrackingShape = (tracking = {}) => ({
  carrier: tracking?.carrier ?? '',
  trackingNumber: tracking?.trackingNumber ?? '',
  trackingUrl: tracking?.trackingUrl ?? '',
  status: tracking?.status ?? 'preparing',
});

const resolveReturnShape = (draft = {}) => ({
  decision: draft?.decision ?? 'approved',
  note: draft?.note ?? '',
});

const ORDER_FULFILLMENT_SLA_HOURS = 48;
const ORDER_FULFILLMENT_RISK_HOURS = 72;

const getOrderAgeHours = (createdAt) => {
  const created = new Date(createdAt ?? 0).getTime();
  if (!created) {
    return 0;
  }
  return Math.max(0, Math.floor((Date.now() - created) / (60 * 60 * 1000)));
};

const getTrackingStatus = (item) => String(item?.tracking?.status ?? '').trim().toLowerCase();

const isDeliveredItem = (item) => {
  const status = String(item?.status ?? '').trim().toLowerCase();
  const trackingStatus = getTrackingStatus(item);
  return status === 'delivered' || trackingStatus === 'delivered';
};

const deriveFulfillmentSla = (order, item) => {
  if (isDeliveredItem(item)) {
    return { label: 'Delivered', tone: 'success' };
  }

  const ageHours = getOrderAgeHours(order?.createdAt);
  if (ageHours >= ORDER_FULFILLMENT_RISK_HOURS) {
    return { label: 'At risk', tone: 'warning' };
  }
  if (ageHours >= ORDER_FULFILLMENT_SLA_HOURS) {
    return { label: 'Due now', tone: 'info' };
  }
  return { label: 'On track', tone: 'success' };
};

const OrdersPage = () => {
  const {
    data: ordersResponse,
    isLoading,
    isError,
    error,
    refetch,
  } = useGetSellerOrdersQuery();

  const [updateOrderStatus, { isLoading: isUpdating }] = useUpdateSellerOrderStatusMutation();
  const [updateTracking, { isLoading: isUpdatingTracking }] = useUpdateSellerOrderTrackingMutation();
  const [reviewReturnRequest, { isLoading: isReviewingReturn }] = useReviewReturnRequestMutation();
  const [notice, setNotice] = useState(null);
  const [errorNotice, setErrorNotice] = useState(null);
  const [draftStatuses, setDraftStatuses] = useState({});
  const [trackingDrafts, setTrackingDrafts] = useState({});
  const [returnDrafts, setReturnDrafts] = useState({});
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

  const filteredOrders = useMemo(() => {
    const next = orders.filter((order) => {
      const normalisedStatus = (order.status ?? '').toString().toLowerCase();
      const statusMatch = statusFilter === 'all' ? true : normalisedStatus === statusFilter;

      const query = searchQuery.trim().toLowerCase();
      if (!query) {
        return statusMatch;
      }

      const searchable = matchesAcrossFields(
        [
          order.orderNumber,
          order.id,
          order.buyer?.name,
          order.buyer?.email,
          ...((order.items || []).map((item) => item?.name)),
        ],
        query,
      );

      return statusMatch && searchable;
    });

    return next;
  }, [orders, statusFilter, searchQuery]);

  const searchSuggestions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return [];
    }

    const suggestions = [];
    const seen = new Set();

    orders.forEach((order) => {
      [
        {
          value: order.orderNumber ?? order.id,
          meta: `Order • ${order.buyer?.name ?? order.buyer?.email ?? 'Unknown buyer'}`,
        },
        {
          value: order.buyer?.name,
          meta: `Buyer • ${order.buyer?.email ?? 'No email'}`,
        },
        ...((order.items || []).map((item) => ({
          value: item?.name,
          meta: `Item • ${formatStatus(item?.status ?? order.status)}`,
        }))),
      ].forEach((entry, index) => {
        const normalized = entry.value?.toString().trim();
        if (!normalized) {
          return;
        }
        const lower = normalized.toLowerCase();
        if (!matchesPrefix(lower, query)) {
          return;
        }
        const key = `${index}:${lower}`;
        if (seen.has(key)) {
          return;
        }
        seen.add(key);
        suggestions.push({
          id: key,
          label: normalized,
          meta: entry.meta,
        });
      });
    });

    return suggestions;
  }, [orders, searchQuery]);

  const filteredStats = useMemo(() => ({
    shown: filteredOrders.length,
    delivered: filteredOrders.filter((order) => (order.status ?? '').toString().toLowerCase() === 'delivered').length,
    revenue: filteredOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0),
  }), [filteredOrders]);

  const operationalStats = useMemo(() => {
    const backlogItems = [];
    const pendingReturns = [];
    const slaAtRisk = [];

    filteredOrders.forEach((order) => {
      (order.items || []).forEach((item) => {
        if (!isDeliveredItem(item)) {
          backlogItems.push(item);
        }
        if (String(item?.returnRequest?.status ?? '').toLowerCase() === 'requested') {
          pendingReturns.push(item);
        }
        if (deriveFulfillmentSla(order, item).tone === 'warning') {
          slaAtRisk.push(item);
        }
      });
    });

    return {
      shipmentBacklog: backlogItems.length,
      pendingReturns: pendingReturns.length,
      slaAtRisk: slaAtRisk.length,
    };
  }, [filteredOrders]);

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

  const resolveTrackingDraft = (orderId, itemId, currentTracking) =>
    trackingDrafts[`${orderId}:${itemId}`] ?? resolveTrackingShape(currentTracking);

  const resolveReturnDraft = (orderId, itemId) =>
    returnDrafts[`${orderId}:${itemId}`] ?? resolveReturnShape();

  const handleDraftChange = (orderId, itemId, value) => {
    setDraftStatuses((prev) => ({
      ...prev,
      [`${orderId}:${itemId}`]: value,
    }));
  };

  const handleTrackingDraftChange = (orderId, itemId, field, value, currentTracking) => {
    const key = `${orderId}:${itemId}`;
    setTrackingDrafts((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] ?? resolveTrackingShape(currentTracking)),
        [field]: value,
      },
    }));
  };

  const handleReturnDraftChange = (orderId, itemId, field, value) => {
    const key = `${orderId}:${itemId}`;
    setReturnDrafts((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] ?? resolveReturnShape()),
        [field]: value,
      },
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

  const handleUpdateTracking = async (orderId, itemId, currentTracking) => {
    const nextTracking = resolveTrackingDraft(orderId, itemId, currentTracking);
    if (!nextTracking.carrier.trim() || !nextTracking.trackingNumber.trim()) {
      setErrorNotice('Carrier and tracking number are required before saving tracking.');
      return;
    }

    setNotice(null);
    setErrorNotice(null);

    try {
      await updateTracking({
        orderId,
        itemId,
        carrier: nextTracking.carrier.trim(),
        trackingNumber: nextTracking.trackingNumber.trim(),
        trackingUrl: nextTracking.trackingUrl.trim(),
        status: nextTracking.status,
      }).unwrap();
      setNotice('Tracking details updated.');
      refetch();
    } catch (mutationError) {
      setErrorNotice(mutationError?.data?.message ?? 'Unable to update tracking for this item.');
    }
  };

  const handleReturnReview = async (orderId, itemId) => {
    const nextReturn = resolveReturnDraft(orderId, itemId);
    setNotice(null);
    setErrorNotice(null);

    try {
      await reviewReturnRequest({
        orderId,
        itemId,
        decision: nextReturn.decision,
        note: nextReturn.note,
      }).unwrap();
      setNotice(`Return request ${formatStatus(nextReturn.decision)}.`);
      setReturnDrafts((prev) => ({
        ...prev,
        [`${orderId}:${itemId}`]: undefined,
      }));
      refetch();
    } catch (mutationError) {
      setErrorNotice(mutationError?.data?.message ?? 'Unable to review this return request.');
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
    ?? 'Your seller account is awaiting admin approval. Hang tight, order management will unlock once you are activated.';

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
          <SearchSuggestInput
            id="seller-orders-search"
            value={searchQuery}
            onChange={setSearchQuery}
            onSelect={(suggestion) => setSearchQuery(suggestion.label)}
            suggestions={searchSuggestions}
            placeholder="Search by order number, buyer name, buyer email, or item name"
            ariaLabel="Search seller orders"
            noResultsText="No seller orders match those search attributes."
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
            <small>Shipment backlog</small>
            <strong>{formatNumber(operationalStats.shipmentBacklog)}</strong>
            <small>Items still moving through fulfillment</small>
          </div>
          <div className="stat-card">
            <small>Pending return requests</small>
            <strong>{formatNumber(operationalStats.pendingReturns)}</strong>
            <small>Customer decisions waiting on seller review</small>
          </div>
          <div className="stat-card">
            <small>Fulfillment SLA at risk</small>
            <strong>{formatNumber(operationalStats.slaAtRisk)}</strong>
            <small>{`Older than ${ORDER_FULFILLMENT_RISK_HOURS} hours without delivery`}</small>
          </div>
          <div className="stat-card">
            <small>Gross revenue</small>
            <strong>{formatCurrency(filteredStats.revenue)}</strong>
            <small>{formatNumber(filteredStats.delivered)} delivered within current filters</small>
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
                      <small>{order.buyer?.name ?? order.buyer?.email ?? '-'}</small>
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
                        const itemId = item.itemId ?? item.id;
                        const draft = resolveDraftStatus(order.id, itemId, item.status);
                        const trackingDraft = resolveTrackingDraft(order.id, itemId, item.tracking);
                        const returnDraft = resolveReturnDraft(order.id, itemId);
                        const selectId = `${order.id}-${itemId}`;
                        const slaState = deriveFulfillmentSla(order, item);

                        return (
                          <div key={selectId} className="order-item-row">
                            <div className="order-item-row__details">
                              <strong>{item.name}</strong>
                              <span>x {item.quantity}</span>
                              <span className="order-item-row__status">Current: {formatStatus(item.status)}</span>
                              <span className="order-item-row__substatus">
                                Tracking: {item.tracking?.status ? formatStatus(item.tracking.status) : 'Not added'}
                              </span>
                              <span className={`order-item-row__substatus order-item-row__substatus--${slaState.tone}`}>
                                Fulfillment SLA: {slaState.label}
                              </span>
                              <span className="order-item-row__substatus">
                                Return: {item.returnRequest?.status ? formatStatus(item.returnRequest.status) : 'None'}
                              </span>
                            </div>
                            <div className="order-item-row__actions order-item-row__actions--stacked">
                              <div className="order-item-row__inline">
                                <select
                                  id={selectId}
                                  value={draft}
                                  onChange={(event) => handleDraftChange(order.id, itemId, event.target.value)}
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
                                  onClick={() => handleUpdateStatus(order.id, itemId, item.status)}
                                  disabled={isUpdating || draft === item.status}
                                >
                                  {isUpdating ? 'Saving...' : 'Update'}
                                </button>
                              </div>

                              <div className="order-item-row__nested-grid">
                                <input
                                  type="text"
                                  className="inventory-toolbar__input"
                                  placeholder="Carrier"
                                  value={trackingDraft.carrier}
                                  onChange={(event) =>
                                    handleTrackingDraftChange(order.id, itemId, 'carrier', event.target.value, item.tracking)
                                  }
                                  disabled={isUpdatingTracking}
                                />
                                <input
                                  type="text"
                                  className="inventory-toolbar__input"
                                  placeholder="Tracking number"
                                  value={trackingDraft.trackingNumber}
                                  onChange={(event) =>
                                    handleTrackingDraftChange(order.id, itemId, 'trackingNumber', event.target.value, item.tracking)
                                  }
                                  disabled={isUpdatingTracking}
                                />
                                <input
                                  type="url"
                                  className="inventory-toolbar__input"
                                  placeholder="Tracking URL"
                                  value={trackingDraft.trackingUrl}
                                  onChange={(event) =>
                                    handleTrackingDraftChange(order.id, itemId, 'trackingUrl', event.target.value, item.tracking)
                                  }
                                  disabled={isUpdatingTracking}
                                />
                                <select
                                  value={trackingDraft.status}
                                  onChange={(event) =>
                                    handleTrackingDraftChange(order.id, itemId, 'status', event.target.value, item.tracking)
                                  }
                                  disabled={isUpdatingTracking}
                                >
                                  <option value="preparing">Preparing</option>
                                  <option value="label-created">Label created</option>
                                  <option value="in-transit">In transit</option>
                                  <option value="out-for-delivery">Out for delivery</option>
                                  <option value="delivered">Delivered</option>
                                </select>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleUpdateTracking(order.id, itemId, item.tracking)}
                                disabled={isUpdatingTracking}
                              >
                                {isUpdatingTracking ? 'Saving...' : 'Save tracking'}
                              </button>

                              {item.returnRequest?.status === 'requested' ? (
                                <div className="order-item-row__return-box">
                                  <small>Requested on {formatDate(item.returnRequest.requestedAt)}</small>
                                  {item.returnRequest.reason ? (
                                    <small>Reason: {item.returnRequest.reason}</small>
                                  ) : null}
                                  <select
                                    value={returnDraft.decision}
                                    onChange={(event) =>
                                      handleReturnDraftChange(order.id, itemId, 'decision', event.target.value)
                                    }
                                    disabled={isReviewingReturn}
                                  >
                                    <option value="approved">Approve return</option>
                                    <option value="rejected">Reject return</option>
                                    <option value="refunded">Mark refunded</option>
                                  </select>
                                  <textarea
                                    className="inventory-toolbar__input order-item-row__textarea"
                                    placeholder="Optional seller note"
                                    value={returnDraft.note}
                                    onChange={(event) =>
                                      handleReturnDraftChange(order.id, itemId, 'note', event.target.value)
                                    }
                                    disabled={isReviewingReturn}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleReturnReview(order.id, itemId)}
                                    disabled={isReviewingReturn}
                                  >
                                    {isReviewingReturn ? 'Saving...' : 'Review return'}
                                  </button>
                                </div>
                              ) : item.returnRequest?.status && item.returnRequest.status !== 'none' ? (
                                <div className="order-item-row__return-box">
                                  <small>
                                    Return {formatStatus(item.returnRequest.status)}
                                    {item.returnRequest.reviewedAt ? ` on ${formatDate(item.returnRequest.reviewedAt)}` : ''}
                                  </small>
                                  {item.returnRequest.note ? (
                                    <small>Note: {item.returnRequest.note}</small>
                                  ) : null}
                                </div>
                              ) : null}
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
