import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Pagination from '../components/Pagination.jsx';
import useTableSort from '../components/useTableSort.js';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import AutosuggestInput from '../../../ui/AutosuggestInput.jsx';
import { useGetAdminProductsQuery } from '../../../services/dashboardApi.js';
import { useDeleteProductMutation } from '../../../services/adminApi.js';
import { formatDate, formatStatus } from '../../../utils/format.js';
import '../Dashboard.css';

const getUserId = (user) => user?._id ?? user?.id ?? null;

const AdminProductsPage = () => {
  const { data, isLoading, isError, refetch } = useGetAdminProductsQuery();
  const [deleteProduct, { isLoading: isDeleting }] = useDeleteProductMutation();
  const products = data?.data?.products ?? [];

  const productSuggestions = useMemo(() => products.map((p) => p.name).filter(Boolean), [products]);

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [notice, setNotice] = useState(null);
  const [errorNotice, setErrorNotice] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  const categoryOptions = useMemo(() => {
    const values = new Set(products.map((p) => p.category).filter(Boolean));
    return ['all', ...values];
  }, [products]);

  const statusOptions = useMemo(() => {
    const values = new Set(products.map((p) => p.status).filter(Boolean));
    return ['all', ...values];
  }, [products]);

  const filtered = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (!query) return true;
      const haystacks = [p.name, p.seller?.name, p.seller?.email, p.category].filter(Boolean).map((v) => v.toLowerCase());
      return haystacks.some((v) => v.includes(query));
    });
  }, [products, searchTerm, categoryFilter, statusFilter]);

  const filtersActive = searchTerm.trim() || categoryFilter !== 'all' || statusFilter !== 'all';
  const resetFilters = () => { setSearchTerm(''); setCategoryFilter('all'); setStatusFilter('all'); };

  const handleDelete = async (product) => {
    setNotice(null);
    setErrorNotice(null);
    const confirmed = window.confirm(
      `Permanently delete "${product.name}"? This will remove it from all carts and delete its reviews. This cannot be undone.`,
    );
    if (!confirmed) return;
    try {
      await deleteProduct(product.id).unwrap();
      setNotice(`"${product.name}" deleted successfully.`);
      refetch();
    } catch (err) {
      setErrorNotice(err?.data?.message ?? 'Unable to delete product.');
    }
  };

  const summary = useMemo(() => ({
    total: products.length,
    published: products.filter((p) => p.isPublished).length,
    outOfStock: products.filter((p) => p.status === 'out-of-stock').length,
    totalStock: products.reduce((s, p) => s + (p.stock ?? 0), 0),
    avgRating: products.length
      ? (products.reduce((s, p) => s + (p.reviews?.avgRating ?? 0), 0) / products.length).toFixed(1)
      : '0',
  }), [products]);

  const { sorted, sortKey, sortDir, onSort } = useTableSort(filtered, 'name');
  const PAGE_SIZE = 10;
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginatedItems = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const thCls = (key) => `sortable${sortKey === key ? ` sort-${sortDir}` : ''}`;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter, statusFilter]);

  useEffect(() => {
    const safeTotalPages = Math.max(totalPages, 1);
    if (currentPage > safeTotalPages) {
      setCurrentPage(safeTotalPages);
    }
  }, [currentPage, totalPages]);

  if (isLoading) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked">
        <DashboardSection title="Products"><SkeletonPanel lines={10} /></DashboardSection>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked">
        <DashboardSection title="Products" action={<button type="button" onClick={() => refetch()}>Retry</button>}>
          <EmptyState message="Could not load products." />
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="dashboard-grid dashboard-grid--stacked">
      <div className="admin-page-header">
        <h1>Products</h1>
        <p>Manage marketplace products, track inventory, and review seller listings.</p>
      </div>

      <DashboardSection title="Product Overview">
        <div className="stat-grid">
          <div className="stat-card stat-card--blue"><small>Total Products</small><strong>{summary.total}</strong></div>
          <div className="stat-card stat-card--green"><small>Published</small><strong>{summary.published}</strong></div>
          <div className="stat-card stat-card--red"><small>Out of Stock</small><strong>{summary.outOfStock}</strong></div>
          <div className="stat-card stat-card--purple"><small>Total Stock</small><strong>{summary.totalStock}</strong></div>
          <div className="stat-card stat-card--orange"><small>Avg Rating</small><strong>{summary.avgRating} *</strong></div>
        </div>
      </DashboardSection>

      <DashboardSection
        title="All Products"
        action={
          <div className="users-toolbar">
            <AutosuggestInput
              className="inventory-toolbar__input"
              placeholder="Search product"
              value={searchTerm}
              onChange={setSearchTerm}
              suggestions={productSuggestions}
              ariaLabel="Search products"
            />
            <select className="inventory-toolbar__input inventory-toolbar__input--select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} aria-label="Filter by category">
              {categoryOptions.map((o) => <option key={o} value={o}>{o === 'all' ? 'All categories' : formatStatus(o)}</option>)}
            </select>
            <select className="inventory-toolbar__input inventory-toolbar__input--select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status">
              {statusOptions.map((o) => <option key={o} value={o}>{o === 'all' ? 'All statuses' : formatStatus(o)}</option>)}
            </select>
            {filtersActive ? <button type="button" className="users-toolbar__reset" onClick={resetFilters}>Reset</button> : null}
            <button type="button" className="users-toolbar__refresh" onClick={() => refetch()}>Refresh</button>
          </div>
        }
      >
        {(notice || errorNotice) && (
          <div className={`status-pill ${errorNotice ? 'status-pill--warning' : 'status-pill--success'}`} style={{ marginBottom: '0.75rem' }}>
            {errorNotice || notice}
          </div>
        )}

        {filtered.length ? (
          <>
            <div className="admin-table-wrapper">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th className={thCls('name')} onClick={() => onSort('name')}>Product</th>
                    <th className={thCls('seller.name')} onClick={() => onSort('seller.name')}>Seller</th>
                    <th className={thCls('category')} onClick={() => onSort('category')}>Category</th>
                    <th className={thCls('price')} onClick={() => onSort('price')}>Price</th>
                    <th className={thCls('mrp')} onClick={() => onSort('mrp')}>MRP</th>
                    <th className={thCls('stock')} onClick={() => onSort('stock')}>Stock</th>
                    <th className={thCls('status')} onClick={() => onSort('status')}>Status</th>
                    <th className={thCls('reviews.avgRating')} onClick={() => onSort('reviews.avgRating')}>Rating</th>
                    <th className={thCls('reviews.count')} onClick={() => onSort('reviews.count')}>Reviews</th>
                    <th className={thCls('createdAt')} onClick={() => onSort('createdAt')}>Created</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div className="admin-product-cell">
                          {p.image && <img src={p.image} alt={p.name} className="admin-product-thumb" />}
                          <Link to={`/dashboard/admin/products/${p.id}`} className="dashboard-table__user--link">
                            {p.name}
                          </Link>
                        </div>
                      </td>
                      <td>
                        {getUserId(p.seller) ? (
                          <Link to={`/dashboard/admin/users/${getUserId(p.seller)}`} className="dashboard-table__user--link">
                            {p.seller?.name}
                          </Link>
                        ) : (
                          p.seller?.name ?? '-'
                        )}
                        <div><small>{p.seller?.email}</small></div>
                      </td>
                      <td>{formatStatus(p.category)}</td>
                      <td>Rs {p.price}</td>
                      <td>Rs {p.mrp}</td>
                      <td>{p.stock}</td>
                      <td>
                        <span className={`status-pill status-pill--${p.status === 'available' ? 'success' : 'warning'}`}>
                          {formatStatus(p.status)}
                        </span>
                      </td>
                      <td>{p.reviews?.avgRating ? `${p.reviews.avgRating} *` : '-'}</td>
                      <td>{p.reviews?.reviewCount ?? 0}</td>
                      <td>{formatDate(p.createdAt)}</td>
                      <td>
                        <button
                          type="button"
                          className="manager-btn manager-btn--reject"
                          onClick={() => handleDelete(p)}
                          disabled={isDeleting}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={currentPage} totalPages={totalPages} from={(currentPage - 1) * PAGE_SIZE + 1} to={Math.min(currentPage * PAGE_SIZE, sorted.length)} total={sorted.length} onPageChange={setCurrentPage} />
          </>
        ) : (
          <EmptyState message={filtersActive ? 'No products match filters.' : 'No products yet.'} />
        )}
      </DashboardSection>
    </div>
  );
};

export default AdminProductsPage;

