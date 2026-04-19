import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import {
  useLazyGetSellerOrdersQuery,
  useReviewReturnRequestMutation,
  useUpdateSellerOrderStatusMutation,
  useUpdateSellerOrderTrackingMutation,
} from '../../../services/sellerApi.js';
import { formatCurrency, formatDate, formatNumber, formatStatus } from '../../../utils/format.js';
import { SELLER_ORDER_STATUSES } from '../../../constants/orderStatuses.js';
import SearchSuggestInput from '../../../components/dashboard/SearchSuggestInput.jsx';
import { matchesPrefix, matchesAcrossFields } from '../../../utils/search.js';
import { printShippingLabels } from '../../../utils/shippingLabels.js';
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
const ORDER_PAGE_LIMIT = 24;
const ORDER_QUEUE_OPTIONS = [
  { value: 'all', label: 'All items' },
  { value: 'backlog', label: 'Shipment backlog' },
  { value: 'returns', label: 'Pending returns' },
  { value: 'sla-risk', label: 'SLA at risk' },
];

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

const getVisibleItemsForQueue = (order, queueFilter) => {
  const items = order.items || [];

  if (queueFilter === 'backlog') {
    return items.filter((item) => !isDeliveredItem(item));
  }

  if (queueFilter === 'returns') {
    return items.filter((item) => String(item?.returnRequest?.status ?? '').toLowerCase() === 'requested');
  }

  if (queueFilter === 'sla-risk') {
    return items.filter((item) => deriveFulfillmentSla(order, item).tone === 'warning');
  }

  return items;
};

const buildSelectionKey = (orderId, itemId) => `${orderId}:${itemId}`;

const mergeUniqueOrders = (currentOrders = [], nextOrders = []) => {
  const orderMap = new Map(currentOrders.map((order) => [order.id, order]));

  nextOrders.forEach((order) => {
    if (!order?.id) {
      return;
    }

    orderMap.set(order.id, order);
  });

  return Array.from(orderMap.values());
};

const OrdersPage = () => {
  const [searchParams] = useSearchParams();
  const [fetchSellerOrders] = useLazyGetSellerOrdersQuery();

  const [updateOrderStatus, { isLoading: isUpdating }] = useUpdateSellerOrderStatusMutation();
  const [updateTracking, { isLoading: isUpdatingTracking }] = useUpdateSellerOrderTrackingMutation();
  const [reviewReturnRequest, { isLoading: isReviewingReturn }] = useReviewReturnRequestMutation();
  const [notice, setNotice] = useState(null);
  const [errorNotice, setErrorNotice] = useState(null);
  const [draftStatuses, setDraftStatuses] = useState({});
  const [trackingDrafts, setTrackingDrafts] = useState({});
  const [returnDrafts, setReturnDrafts] = useState({});
  const [statusFilter, setStatusFilter] = useState('all');
  const [queueFilter, setQueueFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItemKeys, setSelectedItemKeys] = useState([]);
  const [batchStatus, setBatchStatus] = useState('processing');
  const [isBatchUpdating, setIsBatchUpdating] = useState(false);
  const [orders, setOrders] = useState([]);
  const [ordersError, setOrdersError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [ordersPagination, setOrdersPagination] = useState({
    hasMore: false,
    nextCursor: null,
  });
  const [statusOptions, setStatusOptions] = useState(SELLER_ORDER_STATUSES);

  const fetchOrdersPage = useCallback(async ({ cursor = null, reset = false } = {}) => {
    if (reset) {
      setIsLoading(true);
      setOrdersError(null);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const response = await fetchSellerOrders({
        pagination: 'cursor',
        limit: ORDER_PAGE_LIMIT,
        ...(cursor ? { cursor } : {}),
      }).unwrap();

      const nextOrders = Array.isArray(response?.data?.orders) ? response.data.orders : [];
      const nextPagination = response?.data?.pagination ?? {};
      const allowed = new Set(response?.data?.statusOptions ?? SELLER_ORDER_STATUSES.map((option) => option.value));

      setOrders((current) => (reset ? nextOrders : mergeUniqueOrders(current, nextOrders)));
      setOrdersPagination({
        hasMore: Boolean(nextPagination?.hasMore),
        nextCursor: nextPagination?.nextCursor ?? null,
      });
      setStatusOptions(SELLER_ORDER_STATUSES.filter((option) => allowed.has(option.value)));

      return response;
    } catch (requestError) {
      if (reset) {
        setOrders([]);
        setOrdersPagination({ hasMore: false, nextCursor: null });
        setOrdersError(requestError);
      } else {
        setErrorNotice(requestError?.data?.message ?? 'Unable to load more orders right now.');
      }

      throw requestError;
    } finally {
      if (reset) {
        setIsLoading(false);
      } else {
        setIsLoadingMore(false);
      }
    }
  }, [fetchSellerOrders]);

  useEffect(() => {
    fetchOrdersPage({ reset: true }).catch(() => {});
  }, [fetchOrdersPage]);

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

  const visibleOrders = useMemo(
    () =>
      filteredOrders
        .map((order) => ({
          ...order,
          visibleItems: getVisibleItemsForQueue(order, queueFilter),
        }))
        .filter((order) => order.visibleItems.length),
    [filteredOrders, queueFilter],
  );

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
    shown: visibleOrders.length,
    delivered: visibleOrders.filter((order) => (order.status ?? '').toString().toLowerCase() === 'delivered').length,
    visibleValue: visibleOrders.reduce(
      (sum, order) =>
        sum
        + (order.visibleItems || []).reduce(
          (itemSum, item) => itemSum + Number(item.price || 0) * Number(item.quantity || 0),
          0,
        ),
      0,
    ),
    deliveredValue: visibleOrders.reduce(
      (sum, order) =>
        sum
        + (order.visibleItems || [])
          .filter((item) => isDeliveredItem(item))
          .reduce(
            (itemSum, item) => itemSum + Number(item.price || 0) * Number(item.quantity || 0),
            0,
          ),
      0,
    ),
  }), [visibleOrders]);

  const operationalStats = useMemo(() => {
    const backlogItems = [];
    const pendingReturns = [];
    const slaAtRisk = [];

    visibleOrders.forEach((order) => {
      (order.visibleItems || []).forEach((item) => {
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
  }, [visibleOrders]);

  const visibleSelections = useMemo(
    () =>
      visibleOrders.flatMap((order) =>
        (order.visibleItems || []).map((item) => ({
          key: buildSelectionKey(order.id, item.itemId ?? item.id),
          order,
          item,
        })),
      ),
    [visibleOrders],
  );

  const allVisibleSelected = visibleSelections.length > 0
    && visibleSelections.every((entry) => selectedItemKeys.includes(entry.key));

  const selectedEntries = useMemo(
    () => visibleSelections.filter((entry) => selectedItemKeys.includes(entry.key)),
    [selectedItemKeys, visibleSelections],
  );

  const isFiltering = statusFilter !== 'all' || queueFilter !== 'all' || Boolean(searchQuery.trim());

  useEffect(() => {
    if (statusFilter === 'all') {
      return;
    }

    const available = statusFilterOptions.some((option) => option.value === statusFilter);
    if (!available) {
      setStatusFilter('all');
    }
  }, [statusFilter, statusFilterOptions]);

  useEffect(() => {
    const requestedQueue = String(searchParams.get('queue') || '').trim().toLowerCase();
    const available = ORDER_QUEUE_OPTIONS.some((option) => option.value === requestedQueue);
    setQueueFilter(available ? requestedQueue : 'all');
  }, [searchParams]);

  useEffect(() => {
    if (statusOptions.some((option) => option.value === batchStatus)) {
      return;
    }

    setBatchStatus(statusOptions[0]?.value ?? 'processing');
  }, [batchStatus, statusOptions]);

  useEffect(() => {
    const visibleKeys = new Set(visibleSelections.map((entry) => entry.key));
    setSelectedItemKeys((current) => current.filter((key) => visibleKeys.has(key)));
  }, [visibleSelections]);

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
      await fetchOrdersPage({ reset: true });
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
      await fetchOrdersPage({ reset: true });
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
      await fetchOrdersPage({ reset: true });
    } catch (mutationError) {
      setErrorNotice(mutationError?.data?.message ?? 'Unable to review this return request.');
    }
  };

  const toggleItemSelection = (orderId, itemId) => {
    const key = buildSelectionKey(orderId, itemId);
    setSelectedItemKeys((current) =>
      current.includes(key)
        ? current.filter((entry) => entry !== key)
        : [...current, key],
    );
  };

  const toggleAllVisibleItems = () => {
    const visibleKeys = visibleSelections.map((entry) => entry.key);

    setSelectedItemKeys((current) => {
      if (allVisibleSelected) {
        return current.filter((key) => !visibleKeys.includes(key));
      }

      const next = new Set(current);
      visibleKeys.forEach((key) => next.add(key));
      return Array.from(next);
    });
  };

  const toggleOrderSelection = (order) => {
    const orderKeys = (order.visibleItems || []).map((item) => buildSelectionKey(order.id, item.itemId ?? item.id));
    const orderFullySelected = orderKeys.length > 0 && orderKeys.every((key) => selectedItemKeys.includes(key));

    setSelectedItemKeys((current) => {
      if (orderFullySelected) {
        return current.filter((key) => !orderKeys.includes(key));
      }

      const next = new Set(current);
      orderKeys.forEach((key) => next.add(key));
      return Array.from(next);
    });
  };

  const handleBatchStatusUpdate = async () => {
    if (!selectedEntries.length) {
      return;
    }

    setNotice(null);
    setErrorNotice(null);
    setIsBatchUpdating(true);

    try {
      for (const entry of selectedEntries) {
        await updateOrderStatus({
          orderId: entry.order.id,
          itemId: entry.item.itemId ?? entry.item.id,
          status: batchStatus,
          note: 'Batch fulfillment update',
        }).unwrap();
      }

      setSelectedItemKeys([]);
      setNotice(`Updated ${selectedEntries.length} item${selectedEntries.length === 1 ? '' : 's'} to ${formatStatus(batchStatus)}.`);
      await fetchOrdersPage({ reset: true });
    } catch (mutationError) {
      setErrorNotice(mutationError?.data?.message ?? 'Unable to update every selected order item.');
    } finally {
      setIsBatchUpdating(false);
    }
  };

  const refreshOrders = useCallback(async () => {
    await fetchOrdersPage({ reset: true });
  }, [fetchOrdersPage]);

  const handleLoadMoreOrders = useCallback(async () => {
    if (!ordersPagination.hasMore || !ordersPagination.nextCursor || isLoadingMore) {
      return;
    }

    await fetchOrdersPage({ cursor: ordersPagination.nextCursor }).catch(() => {});
  }, [fetchOrdersPage, isLoadingMore, ordersPagination.hasMore, ordersPagination.nextCursor]);

  const buildShippingLabelPayload = (order, item) => ({
    orderNumber: order.orderNumber ?? order.id,
    createdAt: order.createdAt,
    status: formatStatus(item.status ?? order.status),
    itemName: item.name,
    quantity: item.quantity,
    shippingAddress: order.shippingAddress,
    carrier: item?.tracking?.carrier ?? '',
    trackingNumber: item?.tracking?.trackingNumber ?? '',
  });

  const handlePrintLabels = (entries) => {
    setNotice(null);
    setErrorNotice(null);
    const printable = entries.filter((entry) => entry.order?.shippingAddress);
    if (!printable.length) {
      setErrorNotice('Shipping labels need a saved delivery address before they can be printed.');
      return;
    }

    const result = printShippingLabels(printable.map((entry) => buildShippingLabelPayload(entry.order, entry.item)));
    if (!result.ok) {
      setErrorNotice(result.error);
      return;
    }

    setNotice(`Opened ${printable.length} shipping label${printable.length === 1 ? '' : 's'} for printing.`);
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

  const approvalError = ordersError?.status === 403 ? ordersError : null;
  const approvalMessage = approvalError?.data?.message
    ?? 'Your seller account is awaiting admin approval. Hang tight, order management will unlock once you are activated.';

  if (approvalError) {
    return (
      <div className="dashboard-grid">
        <DashboardSection
          title="Orders"
          action={(
            <button type="button" onClick={() => refreshOrders()}>
              Refresh
            </button>
          )}
        >
          <EmptyState message={approvalMessage} />
        </DashboardSection>
      </div>
    );
  }

  if (ordersError) {
    return (
      <div className="dashboard-grid">
        <DashboardSection
          title="Orders unavailable"
          action={(
            <button type="button" onClick={() => refreshOrders()}>
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
          <button type="button" onClick={() => refreshOrders()}>
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

        <div className="filter-chip-row">
          {ORDER_QUEUE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`filter-chip${queueFilter === option.value ? ' filter-chip--active' : ''}`}
              onClick={() => setQueueFilter(option.value)}
            >
              {option.label}
            </button>
          ))}
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
            <small>Visible order value</small>
            <strong>{formatCurrency(filteredStats.visibleValue)}</strong>
            <small>
              {`${formatCurrency(filteredStats.deliveredValue)} delivered value across ${formatNumber(filteredStats.delivered)} completed orders`}
            </small>
          </div>
        </div>

        {(notice || errorNotice) && (
          <div className={`status-pill ${errorNotice ? 'status-pill--warning' : 'status-pill--success'}`}>
            {errorNotice || notice}
          </div>
        )}

        {visibleOrders.length ? (
          <div className="orders-bulk-bar">
            <label className="selection-toggle">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleAllVisibleItems}
                disabled={isBatchUpdating}
              />
              <span>Select shown items</span>
            </label>
            <span className="orders-bulk-bar__count">{formatNumber(selectedEntries.length)} selected</span>
            <div className="orders-bulk-bar__actions">
              <select
                value={batchStatus}
                onChange={(event) => setBatchStatus(event.target.value)}
                disabled={!selectedEntries.length || isBatchUpdating}
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button type="button" onClick={handleBatchStatusUpdate} disabled={!selectedEntries.length || isBatchUpdating}>
                {isBatchUpdating ? 'Updating...' : 'Batch update status'}
              </button>
              <button type="button" onClick={() => handlePrintLabels(selectedEntries)} disabled={!selectedEntries.length || isBatchUpdating}>
                Print labels
              </button>
            </div>
          </div>
        ) : null}

        {visibleOrders.length ? (
          <>
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
                {visibleOrders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <strong>{order.orderNumber ?? order.id}</strong>
                      <div>
                        <small>{order.buyer?.name ?? order.buyer?.email ?? '-'}</small>
                      </div>
                      <div className="dashboard-table__meta">
                        <small>
                          {order.shippingAddress
                            ? [order.shippingAddress.city, order.shippingAddress.state].filter(Boolean).join(', ')
                            : 'Address unavailable'}
                        </small>
                        <button type="button" className="orders-table__select-order" onClick={() => toggleOrderSelection(order)}>
                          Select order items
                        </button>
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
                        {(order.visibleItems || []).map((item) => {
                          const itemId = item.itemId ?? item.id;
                          const draft = resolveDraftStatus(order.id, itemId, item.status);
                          const trackingDraft = resolveTrackingDraft(order.id, itemId, item.tracking);
                          const returnDraft = resolveReturnDraft(order.id, itemId);
                          const selectId = `${order.id}-${itemId}`;
                          const slaState = deriveFulfillmentSla(order, item);

                          return (
                            <div key={selectId} className="order-item-row">
                              <div className="order-item-row__details">
                                <label className="selection-toggle selection-toggle--compact">
                                  <input
                                    type="checkbox"
                                    checked={selectedItemKeys.includes(buildSelectionKey(order.id, itemId))}
                                    onChange={() => toggleItemSelection(order.id, itemId)}
                                    disabled={isBatchUpdating}
                                  />
                                  <span>Select</span>
                                </label>
                                <strong>
                                  <Link to={`/dashboard/seller/products/${item.id}`}>
                                    {item.name}
                                  </Link>
                                </strong>
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
                                <button
                                  type="button"
                                  onClick={() => handlePrintLabels([{ key: buildSelectionKey(order.id, itemId), order, item }])}
                                >
                                  Print label
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
                    <td>
                      {formatCurrency(
                        (order.visibleItems || []).reduce(
                          (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
                          0,
                        ),
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {ordersPagination.hasMore ? (
              <div className="inventory-load-more">
                <button type="button" onClick={handleLoadMoreOrders} disabled={isLoadingMore}>
                  {isLoadingMore ? 'Loading more...' : 'Load more orders'}
                </button>
              </div>
            ) : null}
          </>
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
