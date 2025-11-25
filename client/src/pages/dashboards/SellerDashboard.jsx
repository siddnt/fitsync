import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import DashboardSection from './components/DashboardSection.jsx';
import SellerCharts from './components/SellerCharts.jsx';
import EmptyState from './components/EmptyState.jsx';
import SkeletonPanel from '../../ui/SkeletonPanel.jsx';
import { useGetSellerProductsQuery, useGetSellerOrdersQuery } from '../../services/sellerApi.js';
import { formatCurrency, formatDate, formatNumber, formatStatus } from '../../utils/format.js';
import './Dashboard.css';

const IN_PROGRESS_STATUSES = new Set(['processing', 'in-transit', 'out-for-delivery']);
const normaliseStatus = (status) => (status ? status.toString().toLowerCase() : '');
const isDelivered = (status) => normaliseStatus(status) === 'delivered';
const isInProgress = (status) => IN_PROGRESS_STATUSES.has(normaliseStatus(status));

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

  const isLoading = isProductsLoading || isOrdersLoading;
  const hasError = isProductsError || isOrdersError;
  const approvalError = [productsError, ordersError].find((err) => err?.status === 403);
  const approvalMessage = approvalError?.data?.message
    ?? 'Your seller account is awaiting admin approval. Hang tight—we\'ll unlock the seller console as soon as you are activated.';

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
    () =>
      orders.filter((order) =>
        (order.items || []).some((item) => isInProgress(item.status)),
      ),
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

  if (isLoading) {
    return (
      <div className="seller-overview-layout">
        <DashboardSection title="Catalogue snapshot" className="seller-overview__catalogue">
          <SkeletonPanel lines={6} />
        </DashboardSection>
        <DashboardSection title="Analytics" className="seller-overview__analytics">
          <SkeletonPanel lines={12} />
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
                <small>Published conversion</small>
                <strong>
                  {products.length
                    ? `${Math.round((publishedProducts.length / products.length) * 100)}%`
                    : '—'}
                </strong>
                <small>Keep at least three live listings</small>
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
          </>
        ) : (
          <EmptyState message="Add your first product to kickstart the marketplace." />
        )}
      </DashboardSection>

      <DashboardSection title="Analytics" className="seller-overview__analytics">
        <SellerCharts orders={orders} deliveredOrders={deliveredOrders} products={products} />
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
                    <td>{order.buyer?.name ?? order.buyer?.email ?? '—'}</td>
                    <td>
                      {Array.isArray(order.items) && order.items.length
                        ? order.items
                          .filter((item) => isInProgress(item.status))
                          .map((item) =>
                            [item?.name, item?.status ? formatStatus(item.status) : null]
                              .filter(Boolean)
                              .join(' · '),
                          )
                          .filter(Boolean)
                          .join('; ')
                        : '—'}
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
                    <td>{product.name}</td>
                    <td>{formatStatus(product.status)}</td>
                    <td>{formatNumber(product.stock ?? 0)}</td>
                    <td>{formatDate(product.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState message="Inventory levels look healthy across published listings." />
        )}
      </DashboardSection>
    </div>
  );
};

export default SellerDashboard;
