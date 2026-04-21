import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import { useGetManagerProductBuyersQuery, useDeleteManagerProductMutation } from '../../../services/managerApi.js';
import { formatDate, formatStatus } from '../../../utils/format.js';
import '../Dashboard.css';

const currency = (v) => `₹${Number(v ?? 0).toLocaleString('en-IN')}`;

const ManagerProductBuyersPage = () => {
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
    const q = searchTerm.trim().toLowerCase();
    if (!q) return buyers;
    return buyers.filter((b) => {
      const haystacks = [b.user?.name, b.user?.email, b.orderNumber, b.shippingAddress?.city].filter(Boolean).map((v) => v.toLowerCase());
      return haystacks.some((v) => v.includes(q));
    });
  }, [buyers, searchTerm]);

  const handleBack = () => navigate('/dashboard/manager/products');

  const handleDelete = async () => {
    setNotice(null);
    if (!window.confirm(`Permanently delete "${product?.name}"? This will remove it from all carts and delete its reviews. This cannot be undone.`)) return;
    try {
      await deleteProduct(productId).unwrap();
      navigate('/dashboard/manager/products');
    } catch (err) {
      setNotice(err?.data?.message ?? 'Unable to delete product.');
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
        <DashboardSection title="Product Buyers" action={<button type="button" onClick={handleBack}>← Back</button>}>
          <EmptyState message="Could not load product details." />
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="dashboard-grid dashboard-grid--stacked ud-page">
      <div className="ud-actions">
        <button type="button" className="ud-btn ud-btn--back" onClick={handleBack}>← Back to Products</button>
        <button type="button" className="ud-btn ud-btn--outline" onClick={() => refetch()}>Refresh</button>
        <button type="button" className="ud-btn ud-btn--danger" onClick={handleDelete} disabled={isDeleting}>
          {isDeleting ? 'Deleting…' : 'Delete Product'}
        </button>
      </div>

      {notice && <div className="status-pill status-pill--warning">{notice}</div>}

      {/* Product Info */}
      <DashboardSection title="Product Details">
        <div className="ud-card">
          <div className="ud-card__row">
            {product.image && <img className="ud-card__thumb" src={product.image} alt={product.name} style={{ width: '80px', height: '80px' }} />}
            <div className="ud-card__info">
              <p><strong style={{ fontSize: '1.05rem' }}>{product.name}</strong></p>
              <p><strong>Category:</strong> {formatStatus(product.category)}</p>
              <p><strong>Price:</strong> {currency(product.price)} · <strong>MRP:</strong> {currency(product.mrp)}</p>
              <p><strong>Stock:</strong> {product.stock} · <strong>Status:</strong>{' '}
                <span className={`status-pill ${product.status === 'available' ? 'status-pill--success' : 'status-pill--warning'}`}>
                  {formatStatus(product.status)}
                </span>
              </p>
              <p><strong>Published:</strong> {product.isPublished ? 'Yes' : 'No'}</p>
              <p><strong>Rating:</strong> {product.reviews?.avgRating ? `${product.reviews.avgRating} ★` : '—'} ({product.reviews?.reviewCount ?? 0} reviews)</p>
              {product.seller && <p><strong>Seller:</strong> {product.seller.name} ({product.seller.email})</p>}
              {product.description && <p className="ud-card__desc text-muted">{product.description}</p>}
              <p className="text-muted">Listed {formatDate(product.createdAt)}</p>
            </div>
          </div>
        </div>
      </DashboardSection>

      {/* Summary */}
      <DashboardSection title="Buyer Summary">
        <div className="stat-grid">
          <div className="stat-card"><small>Total Orders</small><strong>{buyers.length}</strong></div>
          <div className="stat-card"><small>Total Units Sold</small><strong>{buyers.reduce((s, b) => s + (b.quantity ?? 0), 0)}</strong></div>
          <div className="stat-card"><small>Total Revenue</small><strong>{currency(buyers.reduce((s, b) => s + (b.price ?? 0) * (b.quantity ?? 0), 0))}</strong></div>
          <div className="stat-card"><small>Unique Buyers</small><strong>{new Set(buyers.map((b) => b.user?.id).filter(Boolean)).size}</strong></div>
        </div>
      </DashboardSection>

      {/* Buyers Table */}
      <DashboardSection
        title={`Buyers (${buyers.length})`}
        action={
          <div className="users-toolbar">
            <input
              type="search"
              className="inventory-toolbar__input"
              placeholder="Search buyer, email, order #"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search buyers"
            />
            {searchTerm.trim() && (
              <button type="button" className="users-toolbar__reset" onClick={() => setSearchTerm('')}>Reset</button>
            )}
          </div>
        }
      >
        {filteredBuyers.length === 0 ? (
          <EmptyState message={searchTerm.trim() ? 'No buyers match the search.' : 'No one has bought this product yet.'} />
        ) : (
          <div className="admin-table-wrapper">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th style={{ width: '25%' }}>Buyer</th>
                  <th style={{ width: '25%' }}>Order #</th>
                  <th style={{ width: '100px' }}>Qty</th>
                  <th style={{ width: '100px' }}>Price</th>
                  <th style={{ width: '150px' }}>Item Status</th>
                  <th>City</th>
                  <th style={{ width: '15%' }}>Order Total</th>
                  <th style={{ width: '130px' }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredBuyers.map((b, i) => (
                  <tr key={`${b.orderId}-${i}`}>
                    <td>
                      <div className="ud-inline-img">
                        {b.user?.profilePicture && <img src={b.user.profilePicture} alt="" />}
                        <div>
                          <strong>{b.user?.name ?? '—'}</strong>
                          <div><small>{b.user?.email}</small></div>
                          {b.user?.contactNumber && <div><small>📞 {b.user.contactNumber}</small></div>}
                        </div>
                      </div>
                    </td>
                    <td>{b.orderNumber ?? '—'}</td>
                    <td>{b.quantity}</td>
                    <td>{currency(b.price)}</td>
                    <td>
                      <span className={`status-pill ${b.itemStatus === 'delivered' ? 'status-pill--success' : 'status-pill--warning'}`}>
                        {formatStatus(b.itemStatus)}
                      </span>
                    </td>
                    <td>{[b.shippingAddress?.city, b.shippingAddress?.state].filter(Boolean).join(', ') || '—'}</td>
                    <td>{currency(b.total)}</td>
                    <td>{formatDate(b.orderDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DashboardSection>
    </div>
  );
};

export default ManagerProductBuyersPage;
