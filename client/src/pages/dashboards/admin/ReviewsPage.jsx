import { useMemo, useState } from 'react';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Pagination from '../components/Pagination.jsx';
import useTableSort from '../components/useTableSort.js';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import AutosuggestInput from '../../../ui/AutosuggestInput.jsx';
import { useGetAdminReviewsQuery } from '../../../services/dashboardApi.js';
import { formatDate, formatStatus } from '../../../utils/format.js';
import '../Dashboard.css';

const TABS = ['gym', 'product'];

const AdminReviewsPage = () => {
  const { data, isLoading, isError, refetch } = useGetAdminReviewsQuery();
  const gymReviews = data?.data?.gymReviews ?? [];
  const productReviews = data?.data?.productReviews ?? [];

  const [activeTab, setActiveTab] = useState('gym');
  const [searchTerm, setSearchTerm] = useState('');
  const [ratingFilter, setRatingFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  const currentReviews = activeTab === 'gym' ? gymReviews : productReviews;

  const reviewSuggestions = useMemo(() => currentReviews.flatMap((r) => [r.user?.name, r.user?.email, r.gym?.name, r.product?.name, r.title].filter(Boolean)), [currentReviews]);

  const filtered = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return currentReviews.filter((r) => {
      if (ratingFilter !== 'all' && r.rating !== Number(ratingFilter)) return false;
      if (!query) return true;
      const haystacks = [
        r.user?.name, r.user?.email,
        r.gym?.name, r.product?.name,
        r.comment, r.title,
      ].filter(Boolean).map((v) => v.toLowerCase());
      return haystacks.some((v) => v.includes(query));
    });
  }, [currentReviews, searchTerm, ratingFilter]);

  const { sorted, sortKey, sortDir, onSort } = useTableSort(filtered, 'createdAt', 'desc');
  const PAGE_SIZE = 10;
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paginatedItems = sorted.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const thCls = (key) => `sortable${sortKey === key ? ` sort-${sortDir}` : ''}`;

  const filtersActive = searchTerm.trim() || ratingFilter !== 'all';
  const resetFilters = () => { setSearchTerm(''); setRatingFilter('all'); };

  const gymSummary = useMemo(() => ({
    total: gymReviews.length,
    avgRating: gymReviews.length
      ? (gymReviews.reduce((s, r) => s + r.rating, 0) / gymReviews.length).toFixed(1)
      : '0',
  }), [gymReviews]);

  const productSummary = useMemo(() => ({
    total: productReviews.length,
    avgRating: productReviews.length
      ? (productReviews.reduce((s, r) => s + r.rating, 0) / productReviews.length).toFixed(1)
      : '0',
    verified: productReviews.filter((r) => r.isVerifiedPurchase).length,
  }), [productReviews]);

  if (isLoading) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked">
        <DashboardSection title="Reviews"><SkeletonPanel lines={10} /></DashboardSection>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="dashboard-grid dashboard-grid--stacked">
        <DashboardSection title="Reviews" action={<button type="button" onClick={() => refetch()}>Retry</button>}>
          <EmptyState message="Could not load reviews." />
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="dashboard-grid dashboard-grid--stacked">
      <div className="admin-page-header">
        <h1>Reviews</h1>
        <p>Browse gym and product reviews, filter by rating, and track verified purchases.</p>
      </div>

      <DashboardSection title="Reviews Overview">
        <div className="stat-grid">
          <div className="stat-card stat-card--purple"><small>Gym Reviews</small><strong>{gymSummary.total}</strong><small>Avg {gymSummary.avgRating} ★</small></div>
          <div className="stat-card stat-card--cyan"><small>Product Reviews</small><strong>{productSummary.total}</strong><small>Avg {productSummary.avgRating} ★</small></div>
          <div className="stat-card stat-card--green"><small>Verified Purchases</small><strong>{productSummary.verified}</strong></div>
        </div>
      </DashboardSection>

      <DashboardSection
        title="All Reviews"
        action={
          <div className="users-toolbar">
            <div className="admin-tabs">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={`admin - tab ${activeTab === tab ? 'admin-tab--active' : ''} `}
                  onClick={() => { setActiveTab(tab); resetFilters(); }}
                >
                  {tab === 'gym' ? 'Gym Reviews' : 'Product Reviews'}
                </button>
              ))}
            </div>
            <AutosuggestInput
              className="inventory-toolbar__input"
              placeholder="Search reviewer, target, comment"
              value={searchTerm}
              onChange={setSearchTerm}
              suggestions={reviewSuggestions}
              ariaLabel="Search reviews"
            />
            <select className="inventory-toolbar__input inventory-toolbar__input--select" value={ratingFilter} onChange={(e) => setRatingFilter(e.target.value)} aria-label="Filter by rating">
              <option value="all">All ratings</option>
              {[5, 4, 3, 2, 1].map((r) => <option key={r} value={r}>{r} ★</option>)}
            </select>
            {filtersActive ? <button type="button" className="users-toolbar__reset" onClick={resetFilters}>Reset</button> : null}
            <button type="button" className="users-toolbar__refresh" onClick={() => refetch()}>Refresh</button>
          </div>
        }
      >
        {filtered.length ? (
          <>
            <div className="admin-table-wrapper">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th className={thCls('user.name')} onClick={() => onSort('user.name')}>Reviewer</th>
                    <th className={thCls(activeTab === 'gym' ? 'gym.name' : 'product.name')} onClick={() => onSort(activeTab === 'gym' ? 'gym.name' : 'product.name')}>{activeTab === 'gym' ? 'Gym' : 'Product'}</th>
                    <th className={thCls('rating')} onClick={() => onSort('rating')}>Rating</th>
                    {activeTab === 'product' && <th>Title</th>}
                    <th>Comment</th>
                    {activeTab === 'product' && <th>Verified</th>}
                    <th className={thCls('createdAt')} onClick={() => onSort('createdAt')}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.user?.name ?? '—'}</strong>
                        <div><small>{r.user?.email}</small></div>
                      </td>
                      <td>
                        {activeTab === 'gym' ? (
                          <>
                            {r.gym?.name ?? '—'}
                            <div><small>{r.gym?.city}</small></div>
                          </>
                        ) : (
                          <>
                            {r.product?.name ?? '—'}
                            <div><small>{formatStatus(r.product?.category)}</small></div>
                          </>
                        )}
                      </td>
                      <td>
                        <span className="admin-rating">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                      </td>
                      {activeTab === 'product' && <td>{r.title ?? '—'}</td>}
                      <td>
                        <div className="admin-review-comment">{r.comment ?? '—'}</div>
                      </td>
                      {activeTab === 'product' && (
                        <td>
                          {r.isVerifiedPurchase ? (
                            <span className="status-pill status-pill--success">Yes</span>
                          ) : 'No'}
                        </td>
                      )}
                      <td>{formatDate(r.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={currentPage} totalPages={totalPages} from={(currentPage - 1) * PAGE_SIZE + 1} to={Math.min(currentPage * PAGE_SIZE, sorted.length)} total={sorted.length} onPageChange={setCurrentPage} />
          </>
        ) : (
          <EmptyState message={filtersActive ? 'No reviews match filters.' : 'No reviews yet.'} />
        )}
      </DashboardSection>
    </div>
  );
};

export default AdminReviewsPage;
