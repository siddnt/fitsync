import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import {
  useGetManagerProductsQuery,
  useDeleteManagerProductMutation,
} from '../../../services/managerApi.js';
import { formatCurrency, formatDate, formatStatus } from '../../../utils/format.js';
import '../Dashboard.css';

const ProductsPage = () => {
  const { data, isLoading, isError, refetch } = useGetManagerProductsQuery();
  const [deleteProduct, { isLoading: isDeleting }] = useDeleteManagerProductMutation();
  const products = data?.data?.products ?? [];

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [notice, setNotice] = useState(null);
  const [errorNotice, setErrorNotice] = useState(null);

  const categoryOptions = useMemo(() => ['all', ...new Set(products.map((product) => product.category).filter(Boolean))], [products]);
  const statusOptions = useMemo(() => ['all', ...new Set(products.map((product) => product.status).filter(Boolean))], [products]);

  const filtered = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return products.filter((product) => {
      if (categoryFilter !== 'all' && product.category !== categoryFilter) {
        return false;
      }
      if (statusFilter !== 'all' && product.status !== statusFilter) {
        return false;
      }
      if (!query) {
        return true;
      }
      const haystacks = [product.name, product.seller?.name, product.seller?.email, product.category]
        .filter(Boolean)
        .map((value) => value.toLowerCase());
      return haystacks.some((value) => value.includes(query));
    });
  }, [products, searchTerm, categoryFilter, statusFilter]);

  const filtersActive = searchTerm.trim() || categoryFilter !== 'all' || statusFilter !== 'all';

  const handleDelete = async (product) => {
    setNotice(null);
    setErrorNotice(null);
    const confirmed = window.confirm(
      `Permanently delete "${product.name}"? This will remove it from all carts and delete its reviews. This cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await deleteProduct(product.id).unwrap();
      setNotice(`"${product.name}" deleted successfully.`);
      refetch();
    } catch (error) {
      setErrorNotice(error?.data?.message ?? 'Unable to delete product.');
    }
  };

  const summary = useMemo(() => ({
    total: products.length,
    published: products.filter((product) => product.isPublished).length,
    outOfStock: products.filter((product) => product.status === 'out-of-stock').length,
    totalStock: products.reduce((sum, product) => sum + (product.stock ?? 0), 0),
    avgRating: products.length
      ? (products.reduce((sum, product) => sum + (product.reviews?.avgRating ?? 0), 0) / products.length).toFixed(1)
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
          <div className="stat-card"><small>Avg Rating</small><strong>{summary.avgRating}</strong></div>
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
              onChange={(event) => setSearchTerm(event.target.value)}
              aria-label="Search products"
            />
            <select
              className="inventory-toolbar__input inventory-toolbar__input--select"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              aria-label="Filter by category"
            >
              {categoryOptions.map((option) => (
                <option key={option} value={option}>
                  {option === 'all' ? 'All categories' : formatStatus(option)}
                </option>
              ))}
            </select>
            <select
              className="inventory-toolbar__input inventory-toolbar__input--select"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filter by status"
            >
              {statusOptions.map((option) => (
                <option key={option} value={option}>
                  {option === 'all' ? 'All statuses' : formatStatus(option)}
                </option>
              ))}
            </select>
            {filtersActive ? (
              <button
                type="button"
                className="users-toolbar__reset"
                onClick={() => {
                  setSearchTerm('');
                  setCategoryFilter('all');
                  setStatusFilter('all');
                }}
              >
                Reset
              </button>
            ) : null}
            <button type="button" className="users-toolbar__refresh" onClick={() => refetch()}>
              Refresh
            </button>
          </div>
        }
      >
        {notice || errorNotice ? (
          <div className={`status-pill ${errorNotice ? 'status-pill--warning' : 'status-pill--success'}`} style={{ marginBottom: '0.75rem' }}>
            {errorNotice || notice}
          </div>
        ) : null}

        {filtered.length ? (
          <div className="admin-table-wrapper">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Seller</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>MRP</th>
                  <th>Stock</th>
                  <th>Status</th>
                  <th>Rating</th>
                  <th>Reviews</th>
                  <th>Created</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <div className="admin-product-cell">
                        {product.image ? <img src={product.image} alt={product.name} className="admin-product-thumb" /> : null}
                        <Link to={`/dashboard/manager/products/${product.id}`} className="dashboard-table__user--link">
                          {product.name}
                        </Link>
                      </div>
                    </td>
                    <td>
                      {product.seller?.name ?? '-'}
                      <div><small>{product.seller?.email}</small></div>
                    </td>
                    <td>{formatStatus(product.category)}</td>
                    <td>{formatCurrency(product.price)}</td>
                    <td>{formatCurrency(product.mrp)}</td>
                    <td>{product.stock}</td>
                    <td>
                      <span className={`status-pill status-pill--${product.status === 'available' ? 'success' : 'warning'}`}>
                        {formatStatus(product.status)}
                      </span>
                    </td>
                    <td>{product.reviews?.avgRating ? `${product.reviews.avgRating}` : '-'}</td>
                    <td>{product.reviews?.reviewCount ?? 0}</td>
                    <td>{formatDate(product.createdAt)}</td>
                    <td>
                      <button
                        type="button"
                        className="manager-btn manager-btn--reject"
                        onClick={() => handleDelete(product)}
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

export default ProductsPage;
