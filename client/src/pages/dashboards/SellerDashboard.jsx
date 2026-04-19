import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import DashboardSection from './components/DashboardSection.jsx';
import SellerCharts from './components/SellerCharts.jsx';
import EmptyState from './components/EmptyState.jsx';
import NotificationsPanel from './components/NotificationsPanel.jsx';
import SkeletonPanel from '../../ui/SkeletonPanel.jsx';
import { useGetSellerProductsQuery, useGetSellerOrdersQuery } from '../../services/sellerApi.js';
import { useGetMyNotificationsQuery } from '../../services/userApi.js';
import { formatCurrency, formatDate, formatNumber, formatStatus } from '../../utils/format.js';
import './Dashboard.css';

const IN_PROGRESS_STATUSES = new Set(['processing', 'in-transit', 'out-for-delivery']);
const ORDER_FULFILLMENT_RISK_HOURS = 72;

const normaliseStatus = (status) => (status ? status.toString().toLowerCase() : '');
const isDelivered = (status) => normaliseStatus(status) === 'delivered';
const isInProgress = (status) => IN_PROGRESS_STATUSES.has(normaliseStatus(status));

const getOrderAgeHours = (createdAt) => {
  const created = new Date(createdAt ?? 0).getTime();
  if (!created) {
    return 0;
  }

  return Math.max(0, Math.floor((Date.now() - created) / (60 * 60 * 1000)));
};

const buildAttentionEntries = (products = []) => products
  .filter((product) => product?.isPublished)
  .map((product) => {
    const recentSales = Number(product?.stats?.soldLast30Days ?? 0);
    const lifetimeSales = Number(product?.stats?.totalSold ?? 0);
    const stock = Number(product?.stock ?? 0);

    let priority = -1;
    let reason = '';

    if (stock <= 5 && recentSales > 0) {
      priority = 3;
      reason = 'Low stock with active demand';
    } else if (recentSales === 0 && lifetimeSales > 0) {
      priority = 2;
      reason = 'Previously sold, but quiet this month';
    } else if (recentSales === 0 && lifetimeSales === 0) {
      priority = 1;
      reason = 'No completed sales yet';
    }

    return { product, priority, reason, recentSales, stock };
  })
  .filter((entry) => entry.priority > 0)
  .sort((left, right) => {
    if (right.priority !== left.priority) {
      return right.priority - left.priority;
    }

    if (left.priority === 3) {
      return left.stock - right.stock;
    }

    return left.recentSales - right.recentSales;
  })
  .slice(0, 5);

const SellerDashboard = () => {
  const {
    data: productsResponse,
    isLoading: isProductsLoading,
    isError: isProductsError,
    refetch: refetchProducts,
    error: productsError,
  } = useGetSellerProductsQuery();

  const {
    data: ordersResponse,
    isLoading: isOrdersLoading,
    isError: isOrdersError,
    refetch: refetchOrders,
    error: ordersError,
  } = useGetSellerOrdersQuery();

  const { data: notificationsResponse } = useGetMyNotificationsQuery({ limit: 6 });

  const isLoading = isProductsLoading || isOrdersLoading;
  const hasError = isProductsError || isOrdersError;
  const approvalError = [productsError, ordersError].find((err) => err?.status === 403);
  const approvalMessage = approvalError?.data?.message
    ?? 'Your seller account is awaiting admin approval. The seller console will unlock as soon as you are activated.';

  const rawProducts = productsResponse?.data?.products;
  const rawOrders = ordersResponse?.data?.orders;

  const products = useMemo(
    () => (Array.isArray(rawProducts) ? rawProducts : []),
    [rawProducts],
  );

  const orders = useMemo(
    () => (Array.isArray(rawOrders) ? rawOrders : []),
    [rawOrders],
  );

  const publishedProducts = useMemo(
    () => products.filter((product) => product?.isPublished),
    [products],
  );

  const lowStockProducts = useMemo(
    () => products.filter((product) => (product?.stock ?? 0) <= 5 && product?.isPublished),
    [products],
  );

  const deliveredOrders = useMemo(
    () =>
      orders.filter(
        (order) => (order.items || []).length && (order.items || []).every((item) => isDelivered(item.status)),
      ),
    [orders],
  );

  const inProgressOrders = useMemo(
    () => orders.filter((order) => (order.items || []).some((item) => isInProgress(item.status))),
    [orders],
  );

  const deliveredOrdersValue = useMemo(
    () => deliveredOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0),
    [deliveredOrders],
  );

  const totalInProgressValue = useMemo(
    () =>
      orders.reduce(
        (sum, order) =>
          sum
          + (order.items || [])
            .filter((item) => isInProgress(item.status))
            .reduce(
              (itemSum, item) => itemSum + Number(item.price || 0) * Number(item.quantity || 0),
              0,
            ),
        0,
      ),
    [orders],
  );

  const shipmentBacklogItems = useMemo(
    () => orders.flatMap((order) => (order.items || []).filter((item) => !isDelivered(item.status))),
    [orders],
  );

  const pendingReturnItems = useMemo(
    () =>
      orders.flatMap((order) =>
        (order.items || []).filter(
          (item) => String(item?.returnRequest?.status ?? '').trim().toLowerCase() === 'requested',
        ),
      ),
    [orders],
  );

  const slaRiskItems = useMemo(
    () =>
      orders.flatMap((order) =>
        (order.items || []).filter(
          (item) => !isDelivered(item.status) && getOrderAgeHours(order.createdAt) >= ORDER_FULFILLMENT_RISK_HOURS,
        ),
      ),
    [orders],
  );

  const totalUnitsSoldLast30Days = useMemo(
    () => products.reduce((sum, product) => sum + (Number(product?.stats?.soldLast30Days) || 0), 0),
    [products],
  );

  const productsWithRecentSales = useMemo(
    () => products.filter((product) => Number(product?.stats?.soldLast30Days ?? 0) > 0).length,
    [products],
  );

  const topSellingProducts = useMemo(
    () =>
      [...products]
        .sort((left, right) => {
          const recentGap = Number(right?.stats?.soldLast30Days ?? 0) - Number(left?.stats?.soldLast30Days ?? 0);
          if (recentGap !== 0) {
            return recentGap;
          }

          return Number(right?.stats?.totalSold ?? 0) - Number(left?.stats?.totalSold ?? 0);
        })
        .slice(0, 5),
    [products],
  );

  const productsNeedingAttention = useMemo(
    () => buildAttentionEntries(products),
    [products],
  );

  const notifications = notificationsResponse?.data?.notifications ?? [];

  if (isLoading) {
    return (
      <div className="seller-overview-layout">
        <DashboardSection title="Catalogue snapshot" className="seller-overview__catalogue">
          <SkeletonPanel lines={6} />
        </DashboardSection>
        <DashboardSection title="Analytics" className="seller-overview__analytics">
          <SkeletonPanel lines={12} />
        </DashboardSection>
        <DashboardSection title="Product performance" className="seller-overview__orders">
          <SkeletonPanel lines={8} />
        </DashboardSection>
        <DashboardSection title="Orders in progress" className="seller-overview__orders">
          <SkeletonPanel lines={6} />
        </DashboardSection>
        <DashboardSection title="Low stock alerts" className="seller-overview__low-stock">
          <SkeletonPanel lines={6} />
        </DashboardSection>
      </div>
    );
  }

  if (approvalError) {
    return (
      <div className="dashboard-grid">
        <DashboardSection
          title="Seller dashboard"
          action={(
            <button
              type="button"
              onClick={() => {
                refetchProducts();
                refetchOrders();
              }}
            >
              Refresh
            </button>
          )}
        >
          <EmptyState message={approvalMessage} />
        </DashboardSection>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="dashboard-grid">
        <DashboardSection
          title="Seller dashboard"
          action={(
            <button
              type="button"
              onClick={() => {
                refetchProducts();
                refetchOrders();
              }}
            >
              Retry
            </button>
          )}
        >
          <EmptyState message="We could not fetch your seller analytics right now." />
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="seller-overview-layout">
      <DashboardSection
        title="Catalogue snapshot"
        action={(
          <Link to="/dashboard/seller/inventory">Manage inventory</Link>
        )}
        className="seller-overview__catalogue"
      >
        {products.length ? (
          <>
            <p className="seller-overview__intro">Monitor catalogue health at a glance and keep your bestsellers in stock.</p>
            <div className="stat-grid seller-overview__stat-grid">
              <div className="stat-card">
                <small>Total products</small>
                <strong>{formatNumber(products.length)}</strong>
                <small>{formatNumber(publishedProducts.length)} published</small>
              </div>
              <div className="stat-card">
                <small>Units sold recently</small>
                <strong>{formatNumber(totalUnitsSoldLast30Days)}</strong>
                <small>{formatNumber(productsWithRecentSales)} products recorded sales in the last 30 days</small>
              </div>
              <div className="stat-card">
                <small>Delivered orders</small>
                <strong>{formatNumber(deliveredOrders.length)}</strong>
                <small>{formatCurrency(deliveredOrdersValue)}</small>
              </div>
              <div className="stat-card">
                <small>In-progress volume</small>
                <strong>{formatCurrency(totalInProgressValue)}</strong>
                <small>{formatNumber(inProgressOrders.length)} orders in fulfilment</small>
              </div>
            </div>
            <div className="seller-overview__action-grid">
              <Link to="/dashboard/seller/orders?queue=backlog" className="seller-overview__action-card">
                <span className="seller-overview__action-eyebrow">Shipment backlog</span>
                <strong>{formatNumber(shipmentBacklogItems.length)} open item{shipmentBacklogItems.length === 1 ? '' : 's'}</strong>
                <p>Move active orders through processing, in-transit, and delivery without losing queue visibility.</p>
                <span className="seller-overview__action-cta">Open fulfilment queue</span>
              </Link>
              <Link to="/dashboard/seller/orders?queue=returns" className="seller-overview__action-card">
                <span className="seller-overview__action-eyebrow">Return review queue</span>
                <strong>{formatNumber(pendingReturnItems.length)} request{pendingReturnItems.length === 1 ? '' : 's'} waiting</strong>
                <p>Review buyer return cases quickly before they become support escalations or refund disputes.</p>
                <span className="seller-overview__action-cta">Review pending returns</span>
              </Link>
              <Link to="/dashboard/seller/orders?queue=sla-risk" className="seller-overview__action-card">
                <span className="seller-overview__action-eyebrow">Fulfilment SLA risk</span>
                <strong>{formatNumber(slaRiskItems.length)} overdue item{slaRiskItems.length === 1 ? '' : 's'}</strong>
                <p>Prioritise orders older than {formatNumber(ORDER_FULFILLMENT_RISK_HOURS)} hours that still are not delivered.</p>
                <span className="seller-overview__action-cta">Prioritise overdue items</span>
              </Link>
              <Link to="/dashboard/seller/inventory" className="seller-overview__action-card">
                <span className="seller-overview__action-eyebrow">Inventory readiness</span>
                <strong>{formatNumber(lowStockProducts.length)} low-stock listing{lowStockProducts.length === 1 ? '' : 's'}</strong>
                <p>Top up thin inventory and keep live listings healthy before demand spills into stockouts.</p>
                <span className="seller-overview__action-cta">Open inventory actions</span>
              </Link>
            </div>
          </>
        ) : (
          <EmptyState message="Add your first product to kickstart the marketplace." />
        )}
      </DashboardSection>

      <DashboardSection title="Analytics" className="seller-overview__analytics">
        <SellerCharts orders={orders} deliveredOrders={deliveredOrders} products={products} />
      </DashboardSection>

      <DashboardSection
        title="Product performance"
        action={(
          <Link to="/dashboard/seller/inventory">Inspect all products</Link>
        )}
        className="seller-overview__orders"
      >
        {products.length ? (
          <div className="seller-overview__performance-grid">
            <div className="seller-overview__table-wrapper">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Top sellers</th>
                    <th>Sold in 30 days</th>
                    <th>Lifetime sold</th>
                    <th>Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {topSellingProducts.map((product) => (
                    <tr key={product.id}>
                      <td>
                        <strong>
                          <Link to={`/dashboard/seller/products/${product.id}`}>
                            {product.name}
                          </Link>
                        </strong>
                        <div className="dashboard-table__meta">
                          <small>{formatStatus(product.category)}</small>
                        </div>
                      </td>
                      <td>{formatNumber(product?.stats?.soldLast30Days ?? 0)}</td>
                      <td>{formatNumber(product?.stats?.totalSold ?? 0)}</td>
                      <td>
                        {Number(product?.reviews?.count ?? 0)
                          ? `${Number(product?.reviews?.averageRating ?? 0).toFixed(1)} / 5`
                          : 'No reviews'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="seller-overview__table-wrapper">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Listings needing attention</th>
                    <th>Reason</th>
                    <th>Stock</th>
                    <th>Sold in 30 days</th>
                  </tr>
                </thead>
                <tbody>
                  {productsNeedingAttention.length ? (
                    productsNeedingAttention.map(({ product, reason, stock, recentSales }) => (
                      <tr key={product.id}>
                        <td>
                          <strong>
                            <Link to={`/dashboard/seller/products/${product.id}`}>
                              {product.name}
                            </Link>
                          </strong>
                        </td>
                        <td>{reason}</td>
                        <td>{formatNumber(stock)}</td>
                        <td>{formatNumber(recentSales)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4">No product alerts right now. Your published catalogue looks healthy.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <EmptyState message="Add products to unlock per-product performance tracking." />
        )}
      </DashboardSection>

      <DashboardSection
        title="Orders in progress"
        action={(
          <Link to="/dashboard/seller/orders">View all orders</Link>
        )}
        className="seller-overview__orders"
      >
        {inProgressOrders.length ? (
          <div className="seller-overview__table-wrapper">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Buyer</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {inProgressOrders.slice(0, 5).map((order) => (
                  <tr key={order.id}>
                    <td>
                      <strong>{order.orderNumber ?? order.id}</strong>
                      <div>
                        <small>{formatDate(order.createdAt)}</small>
                      </div>
                    </td>
                    <td>{order.buyer?.name ?? order.buyer?.email ?? '-'}</td>
                    <td>
                      {Array.isArray(order.items) && order.items.length
                        ? order.items
                          .filter((item) => isInProgress(item.status))
                          .map((item) =>
                            [item?.name, item?.status ? formatStatus(item.status) : null]
                              .filter(Boolean)
                              .join(' - '),
                          )
                          .filter(Boolean)
                          .join('; ')
                        : '-'}
                    </td>
                    <td>
                      {formatCurrency(
                        (order.items || [])
                          .filter((item) => isInProgress(item.status))
                          .reduce(
                            (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
                            0,
                          ),
                      )}
                    </td>
                    <td>{formatStatus(order.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState message="No in-progress orders. Great job staying on top of fulfilment." />
        )}
      </DashboardSection>

      <DashboardSection
        title="Low stock alerts"
        action={(
          <Link to="/dashboard/seller/inventory">Replenish stock</Link>
        )}
        className="seller-overview__low-stock"
      >
        {lowStockProducts.length ? (
          <div className="seller-overview__table-wrapper">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Status</th>
                  <th>Stock</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {lowStockProducts.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <Link to={`/dashboard/seller/products/${product.id}`}>
                        {product.name}
                      </Link>
                    </td>
                    <td>{formatStatus(product.status)}</td>
                    <td>{formatNumber(product.stock ?? 0)}</td>
                    <td>
                      <div>{formatDate(product.updatedAt)}</div>
                      <div className="dashboard-table__meta">
                        <small>{formatNumber(product?.stats?.soldLast30Days ?? 0)} sold in 30 days</small>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState message="Inventory levels look healthy across published listings." />
        )}
      </DashboardSection>

      <DashboardSection title="Seller notifications" className="seller-overview__orders">
        <NotificationsPanel
          notifications={notifications}
          emptyMessage="Return requests, low-stock alerts, and fulfilment updates will appear here."
        />
      </DashboardSection>
    </div>
  );
};

export default SellerDashboard;
