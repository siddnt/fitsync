import { Fragment, useState } from 'react';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import { useGetTraineeOrdersQuery } from '../../../services/dashboardApi.js';
import { useSubmitProductReviewMutation } from '../../../services/marketplaceApi.js';
import {
  formatCurrency,
  formatDateTime,
  formatStatus,
} from '../../../utils/format.js';
import '../Dashboard.css';

const groupByStatus = (orders = []) =>
  orders.reduce((acc, order) => {
    const key = order.status ?? 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

const calculateTotals = (orders = []) =>
  orders.reduce(
    (acc, order) => {
      const amount = typeof order.total === 'object' ? order.total.amount : order.total;
      return {
        amount: acc.amount + (amount || 0),
        currency: order.total?.currency || acc.currency || 'INR',
      };
    },
    { amount: 0, currency: 'INR' },
  );

const TraineeOrdersPage = () => {
  const { data, isLoading, isError, refetch } = useGetTraineeOrdersQuery();
  const orders = data?.data?.orders ?? [];
  const totals = calculateTotals(orders);
  const byStatus = groupByStatus(orders);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewForm, setReviewForm] = useState({ rating: 5, title: '', comment: '' });
  const [reviewError, setReviewError] = useState(null);
  const [reviewSuccess, setReviewSuccess] = useState(null);
  const [submitReview, { isLoading: isSubmitting }] = useSubmitProductReviewMutation();

  const openReviewModal = (orderId, item) => {
    setReviewTarget({
      orderId,
      productId: item.productId,
      productName: item.name,
      image: item.image ?? null,
    });
    setReviewForm({ rating: 5, title: '', comment: '' });
    setReviewError(null);
  };

  const closeReviewModal = () => {
    setReviewTarget(null);
    setReviewError(null);
  };

  const handleSubmitReview = async (event) => {
    event.preventDefault();
    if (!reviewTarget) {
      return;
    }
    try {
      await submitReview({
        productId: reviewTarget.productId,
        orderId: reviewTarget.orderId,
        rating: Number(reviewForm.rating),
        title: reviewForm.title,
        comment: reviewForm.comment,
      }).unwrap();
      setReviewSuccess('Review submitted! It may take a few moments to appear in the marketplace.');
      setReviewTarget(null);
      setReviewForm({ rating: 5, title: '', comment: '' });
      setReviewError(null);
      refetch();
      if (typeof window !== 'undefined') {
        window.setTimeout(() => setReviewSuccess(null), 3500);
      }
    } catch (error) {
      setReviewError(error?.data?.message ?? 'Unable to submit review. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <div className="dashboard-grid">
        {['Recent purchases', 'Spending summary'].map((title) => (
          <DashboardSection key={title} title={title}>
            <SkeletonPanel lines={6} />
          </DashboardSection>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="dashboard-grid">
        <DashboardSection
          title="Orders unavailable"
          action={(
            <button type="button" onClick={() => refetch()}>
              Retry
            </button>
          )}
        >
          <EmptyState message="We could not load your order history right now." />
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="dashboard-grid">
      <DashboardSection title="Recent purchases">
        {reviewSuccess ? (
          <p className="dashboard-message dashboard-message--success">{reviewSuccess}</p>
        ) : null}
        {orders.length ? (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Total</th>
                <th>Status</th>
                <th>Placed</th>
                <th>Items</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <Fragment key={order.id}>
                  <tr>
                    <td>{order.orderNumber ?? '—'}</td>
                    <td>{formatCurrency(order.total)}</td>
                    <td>{formatStatus(order.status)}</td>
                    <td>{formatDateTime(order.createdAt)}</td>
                    <td>{order.itemsCount ?? order.items?.length ?? '—'}</td>
                  </tr>
                  {(order.items?.length ?? 0) > 0 ? (
                    <tr className="order-items-row">
                      <td colSpan={5}>
                        <div className="order-items-list">
                          {order.items.map((item) => (
                            <div key={item.id} className="order-item-card">
                              <div className="order-item-card__primary">
                                {item.image ? (
                                  <img src={item.image} alt={item.name} />
                                ) : (
                                  <div className="order-item-card__placeholder">
                                    {(item.name ?? '?').slice(0, 1)}
                                  </div>
                                )}
                                <div>
                                  <strong>{item.name}</strong>
                                  <small>Qty {item.quantity ?? 0}</small>
                                </div>
                              </div>
                              <span className={`order-item-card__status order-item-card__status--${item.status}`}>
                                {formatStatus(item.status)}
                              </span>
                              <div className="order-item-card__actions">
                                {item.canReview ? (
                                  <button
                                    type="button"
                                    className="order-item-card__action"
                                    onClick={() => openReviewModal(order.id, item)}
                                  >
                                    Review product
                                  </button>
                                ) : item.reviewed ? (
                                  <span className="pill pill--muted">Reviewed</span>
                                ) : (
                                  <span className="pill pill--muted">Pending delivery</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="You have not placed any marketplace orders yet." />
        )}
      </DashboardSection>

      <DashboardSection title="Spending summary">
        {orders.length ? (
          <div className="stat-grid">
            <div className="stat-card">
              <small>Total spend</small>
              <strong>{formatCurrency(totals)}</strong>
              <small>Across {orders.length} orders</small>
            </div>
            {Object.entries(byStatus).map(([status, count]) => (
              <div key={status} className="stat-card">
                <small>{formatStatus(status)}</small>
                <strong>{count}</strong>
                <small>Orders</small>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message="Order analytics will show once you start shopping." />
        )}
      </DashboardSection>

      {reviewTarget ? (
        <div className="dashboard-overlay" role="dialog" aria-modal="true">
          <div className="dashboard-overlay__panel review-modal">
            <div className="review-modal__header">
              <div>
                <p className="eyebrow">Add review</p>
                <h3>{reviewTarget.productName}</h3>
              </div>
              <button type="button" className="review-modal__close" onClick={closeReviewModal}>
                Close
              </button>
            </div>
            <form className="review-modal__form" onSubmit={handleSubmitReview}>
              <label className="review-modal__field">
                <span>Rating</span>
                <div className="rating-input" role="radiogroup" aria-label="Select rating">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`rating-input__star${reviewForm.rating >= value ? ' rating-input__star--active' : ''}`}
                      onClick={() => setReviewForm((prev) => ({ ...prev, rating: value }))}
                      aria-checked={reviewForm.rating === value}
                      role="radio"
                    >
                      ★
                    </button>
                  ))}
                </div>
              </label>
              <label className="review-modal__field">
                <span>Headline (optional)</span>
                <input
                  type="text"
                  value={reviewForm.title}
                  maxLength={120}
                  onChange={(event) => setReviewForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Summarise your experience"
                />
              </label>
              <label className="review-modal__field">
                <span>Share more details</span>
                <textarea
                  value={reviewForm.comment}
                  maxLength={1000}
                  onChange={(event) => setReviewForm((prev) => ({ ...prev, comment: event.target.value }))}
                  placeholder="What did you like or dislike?"
                  rows={4}
                />
              </label>
              {reviewError ? (
                <p className="dashboard-message dashboard-message--error">{reviewError}</p>
              ) : null}
              <div className="review-modal__actions">
                <button type="button" onClick={closeReviewModal} className="review-modal__secondary">
                  Cancel
                </button>
                <button type="submit" className="review-modal__primary" disabled={isSubmitting}>
                  {isSubmitting ? 'Submitting…' : 'Submit review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default TraineeOrdersPage;
