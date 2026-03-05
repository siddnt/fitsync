import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Pagination from '../components/Pagination.jsx';
import useTableSort from '../components/useTableSort.js';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import AutosuggestInput from '../../../ui/AutosuggestInput.jsx';
import { useGetAdminProductBuyersQuery } from '../../../services/dashboardApi.js';
import { useDeleteProductMutation } from '../../../services/adminApi.js';
import { formatDate, formatStatus } from '../../../utils/format.js';
import '../Dashboard.css';

const currency = (v) => `₹${Number(v ?? 0).toLocaleString('en-IN')}`;
const getUserId = (user) => user?._id ?? user?.id ?? null;

const AdminProductBuyersPage = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useGetAdminProductBuyersQuery(productId);
  const [deleteProduct, { isLoading: isDeleting }] = useDeleteProductMutation();
  const [notice, setNotice] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const responseData = data?.data;
  const product = responseData?.product;
  const buyers = responseData?.buyers ?? [];

  const buyerSuggestions = useMemo(() => buyers.flatMap((b) => [b.user?.name, b.orderNumber].filter(Boolean)), [buyers]);

  const filteredBuyers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return buyers;
    return buyers.filter((b) => {
      const haystacks = [b.user?.name, b.user?.email, b.orderNumber, b.shippingAddress?.city].filter(Boolean).map((v) => v.toLowerCase());
      return haystacks.some((v) => v.includes(q));
    });
  }, [buyers, searchTerm]);

  const { sorted, sortKey, sortDir, onSort } = useTableSort(filteredBuyers, 'createdAt', 'desc');
  const PAGE_SIZE = 10;
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginatedBuyers = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const thCls = (key) => `sortable${sortKey === key ? ` sort-${sortDir}` : ''}`;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    const safeTotalPages = Math.max(totalPages, 1);
    if (currentPage > safeTotalPages) {
      setCurrentPage(safeTotalPages);
    }
  }, [currentPage, totalPages]);

  const handleBack = () => navigate('/dashboard/admin/products');

  const handleDelete = async () => {
    setNotice(null);
    if (!window.confirm(`Permanently delete "${product?.name}"? This will remove it from all carts and delete its reviews. This cannot be undone.`)) return;
    try {
      await deleteProduct(productId).unwrap();
      navigate('/dashboard/admin/products');
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
        <DashboardSection title="Product Buyers" action={<button type="button" onClick={handleBack}>Back</button>}>
          <EmptyState message="Could not load product details." />
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="dashboard-grid dashboard-grid--stacked ud-page">
      {/* Actions bar */}
      <div className="ud-actions">
        <button type="button" className="ud-btn ud-btn--back" onClick={handleBack}>Back to Products</button>
        <button type="button" className="ud-btn ud-btn--outline" onClick={() => refetch()}>Refresh</button>
        <button type="button" className="ud-btn ud-btn--danger" onClick={handleDelete} disabled={isDeleting}>
          {isDeleting ? 'Deleting...' : 'Delete Product'}
        </button>
      </div>

      {notice && <div className="status-pill status-pill--warning">{notice}</div>}

      {/* -- Product Info -- */}
      <DashboardSection title="Product Details">
        <div className="ud-card">
          <div className="ud-card__row">
            {product.image && <img className="ud-card__thumb" src={product.image} alt={product.name} style={{ width: '80px', height: '80px' }} />}
            <div className="ud-card__info">
              <p><strong style={{ fontSize: '1.05rem' }}>{product.name}</strong></p>
              <p><strong>Category:</strong> {formatStatus(product.category)}</p>
              <p><strong>Price:</strong> {currency(product.price)} | <strong>MRP:</strong> {currency(product.mrp)}</p>
              <p><strong>Stock:</strong> {product.stock} | <strong>Status:</strong>{' '}
                <span className={`status-pill ${product.status === 'available' ? 'status-pill--success' : 'status-pill--warning'}`}>
                  {formatStatus(product.status)}
                </span>
              </p>
              <p><strong>Published:</strong> {product.isPublished ? 'Yes' : 'No'}</p>
              <p><strong>Rating:</strong> {product.reviews?.avgRating ? `${product.reviews.avgRating} *` : '-'} ({product.reviews?.reviewCount ?? 0} reviews)</p>
              {product.seller && (
                <p>
                  <strong>Seller:</strong>{' '}
                  {getUserId(product.seller) ? (
                    <Link to={`/dashboard/admin/users/${getUserId(product.seller)}`} className="dashboard-table__user--link">
                      {product.seller.name}
                    </Link>
                  ) : (
                    product.seller.name
                  )}{' '}
                  ({product.seller.email})
                </p>
              )}
              {product.description && <p className="ud-card__desc text-muted">{product.description}</p>}
              <p className="text-muted">Listed {formatDate(product.createdAt)}</p>
            </div>
          </div>
        </div>
      </DashboardSection>

      {/* -- Summary -- */}
      <DashboardSection title="Buyer Summary">
        <div className="stat-grid">
          <div className="stat-card stat-card--blue"><small>Total Orders</small><strong>{buyers.length}</strong></div>
          <div className="stat-card stat-card--green">
            <small>Total Units Sold</small>
            <strong>{buyers.reduce((s, b) => s + (b.quantity ?? 0), 0)}</strong>
          </div>
          <div className="stat-card stat-card--orange">
            <small>Total Revenue</small>
            <strong>{currency(buyers.reduce((s, b) => s + (b.price ?? 0) * (b.quantity ?? 0), 0))}</strong>
          </div>
          <div className="stat-card stat-card--purple">
            <small>Unique Buyers</small>
            <strong>{new Set(buyers.map((b) => b.user?.id).filter(Boolean)).size}</strong>
          </div>
        </div>
      </DashboardSection>

      {/* -- Buyers Table -- */}
      <DashboardSection
        title={`Buyers (${buyers.length})`}
        action={
          <div className="users-toolbar">
            <AutosuggestInput
              className="inventory-toolbar__input"
              placeholder="Search buyer or order #"
              value={searchTerm}
              onChange={setSearchTerm}
              suggestions={buyerSuggestions}
              ariaLabel="Search buyers"
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
          <>
            <div className="admin-table-wrapper">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th className={thCls('user.name')} onClick={() => onSort('user.name')}>Buyer</th>
                    <th className={thCls('orderNumber')} onClick={() => onSort('orderNumber')}>Order #</th>
                    <th className={thCls('quantity')} onClick={() => onSort('quantity')}>Qty</th>
                    <th className={thCls('price')} onClick={() => onSort('price')}>Price</th>
                    <th className={thCls('itemStatus')} onClick={() => onSort('itemStatus')}>Item Status</th>
                    <th className={thCls('shippingAddress.city')} onClick={() => onSort('shippingAddress.city')}>City</th>
                    <th className={thCls('orderTotal')} onClick={() => onSort('orderTotal')}>Order Total</th>
                    <th className={thCls('createdAt')} onClick={() => onSort('createdAt')}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedBuyers.map((b, i) => (
                    <tr key={`${b.orderId}-${i}`}>
                      <td>
                        <div className="ud-inline-img">
                          {b.user?.profilePicture && <img src={b.user.profilePicture} alt="" />}
                          <div>
                            <strong>
                              {getUserId(b.user) ? (
                                <Link to={`/dashboard/admin/users/${getUserId(b.user)}`} className="dashboard-table__user--link">
                                  {b.user?.name}
                                </Link>
                              ) : (
                                b.user?.name ?? '-'
                              )}
                            </strong>
                            <div><small>{b.user?.email}</small></div>
                            {b.user?.contactNumber && <div><small>Phone: {b.user.contactNumber}</small></div>}
                          </div>
                        </div>
                      </td>
                      <td>{b.orderNumber ?? '-'}</td>
                      <td>{b.quantity}</td>
                      <td>{currency(b.price)}</td>
                      <td>
                        <span className={`status-pill ${b.itemStatus === 'delivered' ? 'status-pill--success' : 'status-pill--warning'}`}>
                          {formatStatus(b.itemStatus)}
                        </span>
                      </td>
                      <td>{[b.shippingAddress?.city, b.shippingAddress?.state].filter(Boolean).join(', ') || '-'}</td>
                      <td>{currency(b.total)}</td>
                      <td>{formatDate(b.orderDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={currentPage} totalPages={totalPages} from={(currentPage - 1) * PAGE_SIZE + 1} to={Math.min(currentPage * PAGE_SIZE, sorted.length)} total={sorted.length} onPageChange={setCurrentPage} />
          </>
        )}
      </DashboardSection>
    </div>
  );
};

export default AdminProductBuyersPage;



