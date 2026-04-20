import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import {
  useGetManagerProductsQuery,
  useDeleteManagerProductMutation,
} from '../../../services/managerApi.js';
import { formatDate, formatStatus } from '../../../utils/format.js';
import '../Dashboard.css';

const ManagerProductsPage = () => {
  const { data, isLoading, isError, refetch } = useGetManagerProductsQuery();
  const [deleteProduct, { isLoading: isDeleting }] = useDeleteManagerProductMutation();
  const products = data?.data?.products ?? [];

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [notice, setNotice] = useState(null);
  const [errorNotice, setErrorNotice] = useState(null);

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
      <DashboardSection title="Product Overview">
        <div className="stat-grid">
          <div className="stat-card"><small>Total Products</small><strong>{summary.total}</strong></div>
          <div className="stat-card"><small>Published</small><strong>{summary.published}</strong></div>
          <div className="stat-card"><small>Out of Stock</small><strong>{summary.outOfStock}</strong></div>
          <div className="stat-card"><small>Total Stock</small><strong>{summary.totalStock}</strong></div>
          <div className="stat-card"><small>Avg Rating</small><strong>{summary.avgRating} ★</strong></div>
        </div>
      </DashboardSection>

      <DashboardSection
        title="All Products"
        action={
          <div className="users-toolbar">
            <input
              type="search"
              className="inventory-toolbar__input"
              placeholder="Search product or seller"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search products"
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
          <div className="admin-table-wrapper">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th style={{ width: '25%' }}>Product</th>
                  <th>Seller</th>
                  <th style={{ width: '130px' }}>Category</th>
                  <th style={{ width: '100px' }}>Price</th>
                  <th style={{ width: '100px' }}>MRP</th>
                  <th style={{ width: '90px' }}>Stock</th>
                  <th style={{ width: '150px' }}>Status</th>
                  <th style={{ width: '100px' }}>Rating</th>
                  <th style={{ width: '100px' }}>Reviews</th>
                  <th style={{ width: '130px' }}>Created</th>
                  <th style={{ width: '120px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="admin-product-cell">
                        {p.image && <img src={p.image} alt={p.name} className="admin-product-thumb" />}
                        <Link to={`/dashboard/manager/products/${p.id}`} className="dashboard-table__user--link">
                          {p.name}
                        </Link>
                      </div>
                    </td>
                    <td>
                      {p.seller?.name ?? '—'}
                      <div><small>{p.seller?.email}</small></div>
                    </td>
                    <td>{formatStatus(p.category)}</td>
                    <td>₹{p.price}</td>
                    <td>₹{p.mrp}</td>
                    <td>{p.stock}</td>
                    <td>
                      <span className={`status-pill status-pill--${p.status === 'available' ? 'success' : 'warning'}`}>
                        {formatStatus(p.status)}
                      </span>
                    </td>
                    <td>{p.reviews?.avgRating ? `${p.reviews.avgRating} ★` : '—'}</td>
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
        ) : (
          <EmptyState message={filtersActive ? 'No products match filters.' : 'No products yet.'} />
        )}
      </DashboardSection>
    </div>
  );
};

export default ManagerProductsPage;
