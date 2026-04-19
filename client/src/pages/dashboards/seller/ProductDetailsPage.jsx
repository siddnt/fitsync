import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAppDispatch } from '../../../app/hooks.js';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import GrowthLineChart from '../components/GrowthLineChart.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import { openProductPanel } from '../../../features/seller/sellerSlice.js';
import { useGetSellerProductQuery } from '../../../services/sellerApi.js';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
  formatStatus,
} from '../../../utils/format.js';
import '../Dashboard.css';
import './SellerProductDetailsPage.css';

const formatMetadataLabel = (value) => String(value ?? '')
  .split(/[\s-_]+/)
  .filter(Boolean)
  .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
  .join(' ');

const buildRecentSalesSeries = (recentDaily = [], windowDays = 30) => {
  const today = new Date();
  const bucketMap = new Map(
    (Array.isArray(recentDaily) ? recentDaily : []).map((bucket) => [bucket.date, Number(bucket.quantity) || 0]),
  );

  return Array.from({ length: windowDays }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (windowDays - index - 1));
    const key = date.toISOString().slice(0, 10);

    return {
      id: key,
      label: date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      units: bucketMap.get(key) ?? 0,
    };
  });
};

const ProductDetailsPage = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useGetSellerProductQuery(productId, {
    skip: !productId,
  });

  const product = data?.data?.product ?? null;
  const performance = data?.data?.performance ?? null;
  const recentOrders = data?.data?.recentOrders ?? [];
  const reviewItems = product?.reviews?.items ?? [];

  const recentSalesSeries = useMemo(
    () => buildRecentSalesSeries(product?.stats?.recentDaily ?? []),
    [product?.stats?.recentDaily],
  );

  const metadataEntries = useMemo(() => {
    const metadata = product?.metadata && typeof product.metadata === 'object'
      ? Object.entries(product.metadata)
      : [];

    return metadata
      .filter(([key, value]) => value && !['imageProvider', 'imagePublicId'].includes(String(key)))
      .map(([key, value]) => ({
        key,
        label: formatMetadataLabel(key),
        value: String(value),
      }));
  }, [product?.metadata]);

  const statsCards = useMemo(() => {
    if (!product || !performance) {
      return [];
    }

    return [
      {
        label: 'Lifetime units sold',
        value: formatNumber(product?.stats?.totalSold ?? 0),
        detail: `${formatNumber(product?.stats?.soldLast30Days ?? 0)} in the last 30 days`,
      },
      {
        label: 'Delivered revenue',
        value: formatCurrency(performance.deliveredRevenue ?? 0),
        detail: `${formatNumber(performance.deliveredOrdersCount ?? 0)} delivered orders`,
      },
      {
        label: 'Gross order value',
        value: formatCurrency(performance.grossRevenue ?? 0),
        detail: `${formatNumber(performance.ordersCount ?? 0)} total orders`,
      },
      {
        label: 'Revenue in last 30 days',
        value: formatCurrency(performance.revenueLast30Days ?? 0),
        detail: `${formatNumber(performance.unitsLast30Days ?? 0)} units shipped recently`,
      },
      {
        label: 'Open units',
        value: formatNumber(performance.openUnits ?? 0),
        detail: `${formatNumber(performance.unitsOrdered ?? 0)} ordered vs ${formatNumber(performance.unitsDelivered ?? 0)} delivered`,
      },
      {
        label: 'Return queue',
        value: formatNumber((performance.pendingReturnCount ?? 0) + (performance.approvedReturnCount ?? 0)),
        detail: `${formatNumber(performance.refundedCount ?? 0)} refunded items`,
      },
      {
        label: 'Average rating',
        value: product?.reviews?.count
          ? `${Number(product?.reviews?.averageRating ?? 0).toFixed(1)} / 5`
          : 'No ratings',
        detail: `${formatNumber(product?.reviews?.count ?? 0)} review${Number(product?.reviews?.count ?? 0) === 1 ? '' : 's'}`,
      },
      {
        label: 'Current stock',
        value: formatNumber(product?.stock ?? 0),
        detail: product?.stats?.inStock ? 'Listing is ready to sell' : 'Restock or reopen availability',
      },
    ];
  }, [performance, product]);

  const handleEditProduct = () => {
    if (!product?.id) {
      return;
    }

    dispatch(openProductPanel(product.id));
    navigate('/dashboard/seller/inventory');
  };

  if (isLoading || (isFetching && !product)) {
    return (
      <div className="dashboard-grid">
        <DashboardSection title="Product performance">
          <SkeletonPanel lines={16} />
        </DashboardSection>
      </div>
    );
  }

  const approvalError = error?.status === 403 ? error : null;
  const approvalMessage = approvalError?.data?.message
    ?? 'Your seller account is awaiting admin approval. Product performance will unlock as soon as you are activated.';

  if (approvalError) {
    return (
      <div className="dashboard-grid">
        <DashboardSection
          title="Product performance"
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
          title="Product performance unavailable"
          action={(
            <button type="button" onClick={() => refetch()}>
              Retry
            </button>
          )}
        >
          <EmptyState message="We could not load this seller product right now." />
        </DashboardSection>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="dashboard-grid">
        <DashboardSection title="Product performance">
          <EmptyState message="This product does not exist or is no longer available in your seller catalogue." />
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="dashboard-grid dashboard-grid--stacked">
      <DashboardSection
        title="Product performance"
        action={(
          <div className="seller-product-detail__header-actions">
            <Link to="/dashboard/seller/inventory">Back to inventory</Link>
            <button type="button" onClick={handleEditProduct}>
              Edit listing
            </button>
            {product.isPublished ? (
              <Link to={`/marketplace/products/${product.id}`}>View public page</Link>
            ) : null}
          </div>
        )}
      >
        <div className="seller-product-detail__hero">
          <div className="seller-product-detail__media">
            {product.image ? (
              <img src={product.image} alt={product.name} />
            ) : (
              <div className="seller-product-detail__media-placeholder" aria-hidden="true">
                {(product.name ?? '?').slice(0, 1)}
              </div>
            )}
          </div>
          <div className="seller-product-detail__summary">
            <div className="seller-product-detail__eyebrow-row">
              <span className={`status-pill ${product.isPublished ? 'status-pill--success' : 'status-pill--info'}`}>
                {product.isPublished ? 'Published' : 'Draft'}
              </span>
              <span className={`status-pill ${product.stats?.inStock ? 'status-pill--success' : 'status-pill--warning'}`}>
                {product.stats?.inStock ? 'In stock' : 'Stock attention needed'}
              </span>
            </div>
            <h1>{product.name}</h1>
            <p className="seller-product-detail__description">{product.description}</p>
            <div className="seller-product-detail__price-row">
              <strong>{formatCurrency(product.price)}</strong>
              {Number(product.mrp ?? 0) > Number(product.price ?? 0) ? (
                <span>{formatCurrency(product.mrp)} MRP</span>
              ) : null}
              <span>{formatStatus(product.category)}</span>
            </div>
            <dl className="seller-product-detail__facts">
              <div>
                <dt>Status</dt>
                <dd>{formatStatus(product.status)}</dd>
              </div>
              <div>
                <dt>Stock</dt>
                <dd>{formatNumber(product.stock ?? 0)} units</dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd>{formatDate(product.createdAt)}</dd>
              </div>
              <div>
                <dt>Last updated</dt>
                <dd>{formatDate(product.updatedAt)}</dd>
              </div>
              <div>
                <dt>Last sold</dt>
                <dd>{product.stats?.lastSoldAt ? formatDate(product.stats.lastSoldAt) : 'No completed sale yet'}</dd>
              </div>
              <div>
                <dt>Last review</dt>
                <dd>{product.reviews?.lastReviewedAt ? formatDate(product.reviews.lastReviewedAt) : 'No review yet'}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="stat-grid seller-product-detail__stat-grid">
          {statsCards.map((card) => (
            <div key={card.label} className="stat-card">
              <small>{card.label}</small>
              <strong>{card.value}</strong>
              <small>{card.detail}</small>
            </div>
          ))}
        </div>
      </DashboardSection>

      <div className="seller-product-detail__dual-grid">
        <DashboardSection
          title="Recent sales trend"
          action={<span className="dashboard-timeframe-label">Last 30 days</span>}
          className="seller-product-detail__chart-panel"
        >
          <GrowthLineChart
            data={recentSalesSeries}
            series={[{ dataKey: 'units', stroke: '#51cf66', label: 'Units sold' }]}
          />
        </DashboardSection>

        <DashboardSection
          title="Performance summary"
          action={<span className="dashboard-timeframe-label">Operational snapshot</span>}
          className="seller-product-detail__summary-panel"
        >
          <div className="seller-product-detail__summary-list">
            <div className="seller-product-detail__summary-item">
              <small>Units ordered</small>
              <strong>{formatNumber(performance?.unitsOrdered ?? 0)}</strong>
              <span>Total units from every customer order containing this product.</span>
            </div>
            <div className="seller-product-detail__summary-item">
              <small>Units delivered</small>
              <strong>{formatNumber(performance?.unitsDelivered ?? 0)}</strong>
              <span>Units already marked delivered and eligible for realised revenue.</span>
            </div>
            <div className="seller-product-detail__summary-item">
              <small>Approved returns</small>
              <strong>{formatNumber(performance?.approvedReturnCount ?? 0)}</strong>
              <span>Approved cases that still need the refund or receiving workflow completed.</span>
            </div>
            <div className="seller-product-detail__summary-item">
              <small>Metadata fields</small>
              <strong>{formatNumber(metadataEntries.length)}</strong>
              <span>{metadataEntries.length ? 'Product specs published with the listing.' : 'No extra product specs saved yet.'}</span>
            </div>
          </div>
        </DashboardSection>
      </div>

      <DashboardSection
        title="Recent orders"
        action={<Link to="/dashboard/seller/orders">Open order management</Link>}
      >
        {recentOrders.length ? (
          <div className="seller-product-detail__table-wrap">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Buyer</th>
                  <th>Quantity</th>
                  <th>Subtotal</th>
                  <th>Status</th>
                  <th>Destination</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <strong>{order.orderNumber ?? order.orderId}</strong>
                      <div className="dashboard-table__meta">
                        <small>{order.paymentMethod ?? 'Payment method unavailable'}</small>
                      </div>
                    </td>
                    <td>
                      <strong>{order.buyer?.name ?? order.buyer?.email ?? 'Guest order'}</strong>
                      <div className="dashboard-table__meta">
                        <small>{order.buyer?.email ?? 'Email unavailable'}</small>
                      </div>
                    </td>
                    <td>{formatNumber(order.quantity ?? 0)}</td>
                    <td>{formatCurrency(order.subtotal ?? 0)}</td>
                    <td>
                      <span className={`status-pill ${order.status === 'delivered' ? 'status-pill--success' : 'status-pill--info'}`}>
                        {formatStatus(order.status)}
                      </span>
                    </td>
                    <td>
                      {[order.shippingAddress?.city, order.shippingAddress?.state].filter(Boolean).join(', ') || 'Not available'}
                    </td>
                    <td>{formatDateTime(order.lastStatusAt ?? order.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState message="No orders for this product yet." />
        )}
      </DashboardSection>

      <div className="seller-product-detail__dual-grid">
        <DashboardSection title="Customer reviews">
          {reviewItems.length ? (
            <div className="seller-product-detail__review-list">
              {reviewItems.map((review) => (
                <article key={review.id} className="seller-product-detail__review-card">
                  <div className="seller-product-detail__review-header">
                    <div>
                      <strong>{review.user?.name ?? 'FitSync customer'}</strong>
                      <small>{formatDateTime(review.createdAt)}</small>
                    </div>
                    <span>{formatNumber(review.rating, { maximumFractionDigits: 1 })}/5</span>
                  </div>
                  {review.title ? <h3>{review.title}</h3> : null}
                  <p>{review.comment || 'No comment provided.'}</p>
                  <small>{review.isVerifiedPurchase ? 'Verified purchase' : 'Community review'}</small>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState message="No reviews for this product yet." />
          )}
        </DashboardSection>

        <DashboardSection title="Product metadata">
          {metadataEntries.length ? (
            <dl className="seller-product-detail__metadata-list">
              {metadataEntries.map((entry) => (
                <div key={entry.key}>
                  <dt>{entry.label}</dt>
                  <dd>{entry.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <EmptyState message="No additional metadata is stored for this product." />
          )}
        </DashboardSection>
      </div>
    </div>
  );
};

export default ProductDetailsPage;
