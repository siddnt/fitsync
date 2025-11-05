import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import DashboardSection from './components/DashboardSection.jsx';
import EmptyState from './components/EmptyState.jsx';
import SkeletonPanel from '../../ui/SkeletonPanel.jsx';
import { useGetSellerProductsQuery, useGetSellerOrdersQuery } from '../../services/sellerApi.js';
import { formatCurrency, formatDate, formatNumber, formatStatus } from '../../utils/format.js';
import './Dashboard.css';

const SellerDashboard = () => {
  const {
    data: productsResponse,
    isLoading: isProductsLoading,
    isError: isProductsError,
    refetch: refetchProducts,
  } = useGetSellerProductsQuery();

  const {
    data: ordersResponse,
    isLoading: isOrdersLoading,
    isError: isOrdersError,
    refetch: refetchOrders,
  } = useGetSellerOrdersQuery();

  const isLoading = isProductsLoading || isOrdersLoading;
  const hasError = isProductsError || isOrdersError;

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
        (order) => (order.items || []).length && (order.items || []).every((item) => item.status === 'delivered'),
      ),
    [orders],
  );

  const outstandingOrders = useMemo(
    () =>
      orders.filter((order) =>
        (order.items || []).some((item) => item.status !== 'delivered' && item.status !== 'cancelled'),
      ),
    [orders],
  );

  const deliveredOrdersValue = useMemo(
    () => deliveredOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0),
    [deliveredOrders],
  );

  const totalOutstandingValue = useMemo(
    () =>
      orders.reduce(
        (sum, order) =>
          sum
          + (order.items || [])
            .filter((item) => item.status !== 'delivered' && item.status !== 'cancelled')
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
      <div className="dashboard-grid">
        {['Catalogue snapshot', 'Outstanding orders', 'Low stock alerts'].map((section) => (
          <DashboardSection key={section} title={section}>
            <SkeletonPanel lines={6} />
          </DashboardSection>
        ))}
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
    <div className="dashboard-grid">
      <DashboardSection
        title="Catalogue snapshot"
        action={(
          <Link to="/dashboard/seller/inventory">Manage inventory</Link>
        )}
      >
        {products.length ? (
          <div className="stat-grid">
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
              <small>Outstanding volume</small>
              <strong>{formatCurrency(totalOutstandingValue)}</strong>
              <small>{formatNumber(outstandingOrders.length)} orders in fulfilment</small>
            </div>
          </div>
        ) : (
          <EmptyState message="Add your first product to kickstart the marketplace." />
        )}
      </DashboardSection>

      <DashboardSection
        title="Outstanding orders"
        action={(
          <Link to="/dashboard/seller/orders">View all orders</Link>
        )}
      >
        {outstandingOrders.length ? (
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
              {outstandingOrders.slice(0, 5).map((order) => (
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
                        .filter((item) => item.status !== 'delivered' && item.status !== 'cancelled')
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
                        .filter((item) => item.status !== 'delivered' && item.status !== 'cancelled')
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
        ) : (
          <EmptyState message="No pending orders. Great job staying on top of fulfilment." />
        )}
      </DashboardSection>

      <DashboardSection
        title="Low stock alerts"
        action={(
          <Link to="/dashboard/seller/inventory">Replenish stock</Link>
        )}
      >
        {lowStockProducts.length ? (
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
        ) : (
          <EmptyState message="Inventory levels look healthy across published listings." />
        )}
      </DashboardSection>
    </div>
  );
};

export default SellerDashboard;
