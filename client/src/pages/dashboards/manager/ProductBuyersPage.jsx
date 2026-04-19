import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import {
  useDeleteManagerProductMutation,
  useGetManagerProductBuyersQuery,
} from '../../../services/managerApi.js';
import { formatCurrency, formatDate, formatStatus } from '../../../utils/format.js';
import '../Dashboard.css';

const ProductBuyersPage = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useGetManagerProductBuyersQuery(productId);
  const [deleteProduct, { isLoading: isDeleting }] = useDeleteManagerProductMutation();
  const [notice, setNotice] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const responseData = data?.data;
  const product = responseData?.product;
  const buyers = responseData?.buyers ?? [];

  const filteredBuyers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return buyers;
    }
    return buyers.filter((buyer) => {
      const haystacks = [buyer.user?.name, buyer.user?.email, buyer.orderNumber, buyer.shippingAddress?.city]
        .filter(Boolean)
        .map((value) => value.toLowerCase());
      return haystacks.some((value) => value.includes(query));
    });
  }, [buyers, searchTerm]);

  const handleDelete = async () => {
    setNotice(null);
    const confirmed = window.confirm(
      `Permanently delete "${product?.name}"? This will remove it from all carts and delete its reviews. This cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteProduct(productId).unwrap();
      navigate('/dashboard/manager/products');
    } catch (error) {
      setNotice(error?.data?.message ?? 'Unable to delete product.');
    }
  };

  if (isLoading) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked ud-page">
        <DashboardSection title="Product Buyers"><SkeletonPanel lines={10} /></DashboardSection>
      </div>
    );
  }

  if (isError || !product) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked ud-page">
        <DashboardSection title="Product Buyers" action={<button type="button" onClick={() => navigate('/dashboard/manager/products')}>Back</button>}>
          <EmptyState message="Could not load product details." />
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="dashboard-grid dashboard-grid--stacked ud-page">
      <div className="ud-actions">
        <button type="button" className="ud-btn ud-btn--back" onClick={() => navigate('/dashboard/manager/products')}>
          Back to Products
        </button>
        <button type="button" className="ud-btn ud-btn--outline" onClick={() => refetch()}>
          Refresh
        </button>
        <button type="button" className="ud-btn ud-btn--danger" onClick={handleDelete} disabled={isDeleting}>
          {isDeleting ? 'Deleting...' : 'Delete Product'}
        </button>
      </div>

      {notice ? <div className="status-pill status-pill--warning">{notice}</div> : null}

      <DashboardSection title="Product Details">
        <div className="ud-card">
          <div className="ud-card__row">
            {product.image ? (
              <img className="ud-card__thumb" src={product.image} alt={product.name} style={{ width: '80px', height: '80px' }} />
            ) : null}
            <div className="ud-card__info">
              <p><strong style={{ fontSize: '1.05rem' }}>{product.name}</strong></p>
              <p><strong>Category:</strong> {formatStatus(product.category)}</p>
              <p><strong>Price:</strong> {formatCurrency(product.price)} · <strong>MRP:</strong> {formatCurrency(product.mrp)}</p>
              <p><strong>Stock:</strong> {product.stock} · <strong>Status:</strong> {formatStatus(product.status)}</p>
              <p><strong>Published:</strong> {product.isPublished ? 'Yes' : 'No'}</p>
              <p><strong>Rating:</strong> {product.reviews?.avgRating ?? '-'} ({product.reviews?.reviewCount ?? 0} reviews)</p>
              {product.seller ? <p><strong>Seller:</strong> {product.seller.name} ({product.seller.email})</p> : null}
              {product.description ? <p className="ud-card__desc text-muted">{product.description}</p> : null}
              <p className="text-muted">Listed {formatDate(product.createdAt)}</p>
            </div>
          </div>
        </div>
      </DashboardSection>

      <DashboardSection title="Buyer Summary">
        <div className="stat-grid">
          <div className="stat-card"><small>Total Orders</small><strong>{buyers.length}</strong></div>
          <div className="stat-card"><small>Total Units Sold</small><strong>{buyers.reduce((sum, buyer) => sum + (buyer.quantity ?? 0), 0)}</strong></div>
          <div className="stat-card"><small>Total Revenue</small><strong>{formatCurrency(buyers.reduce((sum, buyer) => sum + (buyer.price ?? 0) * (buyer.quantity ?? 0), 0))}</strong></div>
          <div className="stat-card"><small>Unique Buyers</small><strong>{new Set(buyers.map((buyer) => buyer.user?.id).filter(Boolean)).size}</strong></div>
        </div>
      </DashboardSection>

      <DashboardSection
        title={`Buyers (${buyers.length})`}
        action={
          <div className="users-toolbar">
            <input
              type="search"
              className="inventory-toolbar__input"
              placeholder="Search buyer, email, order #"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              aria-label="Search buyers"
            />
            {searchTerm.trim() ? (
              <button type="button" className="users-toolbar__reset" onClick={() => setSearchTerm('')}>
                Reset
              </button>
            ) : null}
          </div>
        }
      >
        {filteredBuyers.length ? (
          <div className="admin-table-wrapper">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Buyer</th>
                  <th>Order</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Item Status</th>
                  <th>City</th>
                  <th>Order Total</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredBuyers.map((buyer, index) => (
                  <tr key={`${buyer.orderId}-${index}`}>
                    <td>
                      <strong>{buyer.user?.name ?? '-'}</strong>
                      <div><small>{buyer.user?.email}</small></div>
                    </td>
                    <td>{buyer.orderNumber ?? '-'}</td>
                    <td>{buyer.quantity}</td>
                    <td>{formatCurrency(buyer.price)}</td>
                    <td>
                      <span className={`status-pill ${buyer.itemStatus === 'delivered' ? 'status-pill--success' : 'status-pill--warning'}`}>
                        {formatStatus(buyer.itemStatus)}
                      </span>
                    </td>
                    <td>{[buyer.shippingAddress?.city, buyer.shippingAddress?.state].filter(Boolean).join(', ') || '-'}</td>
                    <td>{formatCurrency(buyer.total)}</td>
                    <td>{formatDate(buyer.orderDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState message={searchTerm.trim() ? 'No buyers match the search.' : 'No one has bought this product yet.'} />
        )}
      </DashboardSection>
    </div>
  );
};

export default ProductBuyersPage;
