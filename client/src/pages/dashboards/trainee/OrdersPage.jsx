import { Fragment, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import { useAppDispatch } from '../../../app/hooks.js';
import { cartActions } from '../../../features/cart/cartSlice.js';
import { useGetTraineeOrdersQuery } from '../../../services/dashboardApi.js';
import {
  useRequestOrderItemReturnMutation,
  useSubmitProductReviewMutation,
} from '../../../services/marketplaceApi.js';
import {
  formatCurrency,
  formatDateTime,
  formatStatus,
} from '../../../utils/format.js';
import '../Dashboard.css';

const ORDER_TRACKING_STEPS = ['processing', 'in-transit', 'out-for-delivery', 'delivered'];

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const getAmount = (value) => {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === 'object') {
    return Number(value.amount ?? value.value ?? 0) || 0;
  }

  return Number(value) || 0;
};

const groupByStatus = (orders = []) =>
  orders.reduce((acc, order) => {
    const key = order.status ?? 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

const calculateTotals = (orders = []) =>
  orders.reduce(
    (acc, order) => ({
      amount: acc.amount + getAmount(order.total),
      currency: order.total?.currency || acc.currency || 'INR',
    }),
    { amount: 0, currency: 'INR' },
  );

const formatShippingAddress = (shippingAddress) => {
  if (!shippingAddress) {
    return 'Address unavailable';
  }

  return [
    shippingAddress.address,
    [shippingAddress.city, shippingAddress.state].filter(Boolean).join(', '),
    shippingAddress.zipCode,
  ]
    .filter(Boolean)
    .join(' | ');
};

const buildTrackingSteps = (item) => {
  const historyEntries = Array.isArray(item?.statusHistory) ? item.statusHistory : [];
  const historyMap = historyEntries.reduce((acc, entry) => {
    const key = entry?.status;
    if (key && !acc[key]) {
      acc[key] = entry;
    }
    return acc;
  }, {});

  const currentStatus = item?.status ?? 'processing';
  const currentIndex = Math.max(ORDER_TRACKING_STEPS.indexOf(currentStatus), 0);

  return ORDER_TRACKING_STEPS.map((step, index) => {
    const matchedEntry = historyMap[step] ?? null;
    const isComplete = Boolean(matchedEntry) || index < currentIndex;
    const isCurrent = step === currentStatus;

    return {
      key: step,
      label: formatStatus(step),
      updatedAt: matchedEntry?.updatedAt ?? (isCurrent ? item?.tracking?.updatedAt ?? null : null),
      state: isCurrent ? 'current' : isComplete ? 'complete' : 'upcoming',
    };
  });
};

const buildInvoiceMarkup = (order) => {
  const itemRows = (order.items ?? [])
    .map((item) => `
      <tr>
        <td>${escapeHtml(item.name)}</td>
        <td>${escapeHtml(String(item.quantity ?? 0))}</td>
        <td>${escapeHtml(formatCurrency(item.price))}</td>
        <td>${escapeHtml(formatCurrency(item.subtotal))}</td>
      </tr>
    `)
    .join('');

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <title>Invoice ${escapeHtml(order.orderNumber ?? 'Order')}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #111827; margin: 32px; }
          h1, h2, h3, p { margin: 0; }
          .header, .meta, .totals { display: flex; justify-content: space-between; gap: 24px; }
          .header { align-items: flex-start; margin-bottom: 24px; }
          .meta, .totals { margin-top: 24px; }
          .card { border: 1px solid #d1d5db; border-radius: 12px; padding: 16px; flex: 1; }
          table { border-collapse: collapse; margin-top: 24px; width: 100%; }
          th, td { border-bottom: 1px solid #e5e7eb; padding: 12px; text-align: left; }
          th { color: #6b7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; }
          .totals-row { display: flex; justify-content: space-between; margin: 8px 0; }
          .total-strong { font-size: 18px; font-weight: 700; }
          .muted { color: #6b7280; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>FitSync Invoice</h1>
            <p class="muted">Order ${escapeHtml(order.orderNumber ?? '-')}</p>
          </div>
          <div>
            <p><strong>Issued:</strong> ${escapeHtml(formatDateTime(order.createdAt))}</p>
            <p><strong>Payment:</strong> ${escapeHtml(order.paymentMethod ?? 'N/A')}</p>
          </div>
        </div>

        <div class="meta">
          <div class="card">
            <h3>Ship to</h3>
            <p style="margin-top: 8px;">${escapeHtml([
              [order.shippingAddress?.firstName, order.shippingAddress?.lastName].filter(Boolean).join(' '),
              order.shippingAddress?.phone,
              formatShippingAddress(order.shippingAddress),
              order.shippingAddress?.email,
            ].filter(Boolean).join('\n'))}</p>
          </div>
          <div class="card">
            <h3>Order summary</h3>
            <div class="totals-row"><span>Subtotal</span><span>${escapeHtml(formatCurrency(order.subtotal))}</span></div>
            <div class="totals-row"><span>Tax</span><span>${escapeHtml(formatCurrency(order.tax))}</span></div>
            <div class="totals-row"><span>Shipping</span><span>${escapeHtml(formatCurrency(order.shippingCost))}</span></div>
            <div class="totals-row total-strong"><span>Total</span><span>${escapeHtml(formatCurrency(order.total))}</span></div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Unit price</th>
              <th>Line total</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>
      </body>
    </html>
  `;
};

const TraineeOrdersPage = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useGetTraineeOrdersQuery();
  const orders = data?.data?.orders ?? [];
  const totals = calculateTotals(orders);
  const byStatus = groupByStatus(orders);

  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewForm, setReviewForm] = useState({ rating: 5, title: '', comment: '' });
  const [reviewError, setReviewError] = useState(null);
  const [returnTarget, setReturnTarget] = useState(null);
  const [returnReason, setReturnReason] = useState('');
  const [returnError, setReturnError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [pageError, setPageError] = useState(null);

  const [submitReview, { isLoading: isSubmittingReview }] = useSubmitProductReviewMutation();
  const [requestReturn, { isLoading: isSubmittingReturn }] = useRequestOrderItemReturnMutation();

  const clearPageMessages = () => {
    setNotice(null);
    setPageError(null);
  };

  const flashNotice = (message) => {
    setNotice(message);
    if (typeof window !== 'undefined') {
      window.setTimeout(() => setNotice(null), 3500);
    }
  };

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

  const openReturnModal = (orderId, item) => {
    setReturnTarget({
      orderId,
      itemId: item.id,
      productName: item.name,
    });
    setReturnReason('');
    setReturnError(null);
  };

  const closeReviewModal = () => {
    setReviewTarget(null);
    setReviewError(null);
  };

  const closeReturnModal = () => {
    setReturnTarget(null);
    setReturnError(null);
  };

  const handleSubmitReview = async (event) => {
    event.preventDefault();
    if (!reviewTarget) {
      return;
    }

    try {
      clearPageMessages();
      await submitReview({
        productId: reviewTarget.productId,
        orderId: reviewTarget.orderId,
        rating: Number(reviewForm.rating),
        title: reviewForm.title,
        comment: reviewForm.comment,
      }).unwrap();
      setReviewTarget(null);
      setReviewForm({ rating: 5, title: '', comment: '' });
      setReviewError(null);
      flashNotice('Review submitted. It may take a few moments to appear in the marketplace.');
      refetch();
    } catch (error) {
      setReviewError(error?.data?.message ?? 'Unable to submit review. Please try again.');
    }
  };

  const handleSubmitReturn = async (event) => {
    event.preventDefault();
    if (!returnTarget) {
      return;
    }

    const trimmedReason = returnReason.trim();
    if (!trimmedReason) {
      setReturnError('Please share the reason for your return request.');
      return;
    }

    try {
      clearPageMessages();
      await requestReturn({
        orderId: returnTarget.orderId,
        itemId: returnTarget.itemId,
        reason: trimmedReason,
      }).unwrap();
      setReturnTarget(null);
      setReturnReason('');
      setReturnError(null);
      flashNotice('Return request submitted. The seller will review it shortly.');
      refetch();
    } catch (error) {
      setReturnError(error?.data?.message ?? 'Unable to submit your return request.');
    }
  };

  const handleReorder = (order) => {
    const reorderableItems = (order.items ?? []).filter((item) => item.productId);
    if (!reorderableItems.length) {
      setPageError('No reorderable items were found for this order.');
      return;
    }

    clearPageMessages();
    reorderableItems.forEach((item) => {
      dispatch(cartActions.addItem({
        id: item.productId,
        name: item.name,
        image: item.image ?? null,
        price: getAmount(item.price),
        quantity: item.quantity ?? 1,
        seller: item.seller ?? null,
      }));
    });
    flashNotice(`${reorderableItems.length} item${reorderableItems.length === 1 ? '' : 's'} added to your cart.`);
    navigate('/cart');
  };

  const handlePrintInvoice = (order) => {
    if (typeof window === 'undefined') {
      return;
    }

    const invoiceWindow = window.open('', '_blank', 'noopener,noreferrer');
    if (!invoiceWindow) {
      setPageError('Allow pop-ups to print the invoice for this order.');
      return;
    }

    invoiceWindow.document.write(buildInvoiceMarkup(order));
    invoiceWindow.document.close();
    invoiceWindow.focus();
    invoiceWindow.print();
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
        {notice ? (
          <p className="dashboard-message dashboard-message--success">{notice}</p>
        ) : null}
        {pageError ? (
          <p className="dashboard-message dashboard-message--error">{pageError}</p>
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
                    <td>
                      <div className="order-summary">
                        <div>
                          <strong>{order.orderNumber ?? 'N/A'}</strong>
                          <small>{order.shippingAddress?.city ?? 'Shipping city unavailable'}</small>
                        </div>
                        <div className="order-summary__actions">
                          <button
                            type="button"
                            className="order-item-card__action"
                            onClick={() => handlePrintInvoice(order)}
                          >
                            Print invoice
                          </button>
                          <button
                            type="button"
                            className="order-item-card__action"
                            onClick={() => handleReorder(order)}
                          >
                            Reorder
                          </button>
                        </div>
                      </div>
                    </td>
                    <td>{formatCurrency(order.total)}</td>
                    <td>{formatStatus(order.status)}</td>
                    <td>{formatDateTime(order.createdAt)}</td>
                    <td>{order.itemsCount ?? order.items?.length ?? 'N/A'}</td>
                  </tr>

                  <tr className="order-items-row">
                    <td colSpan={5}>
                      <div className="order-info-grid">
                        <div className="order-info-card">
                          <small>Ship to</small>
                          <strong>{[
                            order.shippingAddress?.firstName,
                            order.shippingAddress?.lastName,
                          ].filter(Boolean).join(' ') || 'Customer'}</strong>
                          <p>{formatShippingAddress(order.shippingAddress)}</p>
                          <small>{order.shippingAddress?.phone || order.shippingAddress?.email || 'Contact unavailable'}</small>
                        </div>
                        <div className="order-info-card">
                          <small>Payment and totals</small>
                          <strong>{order.paymentMethod ?? 'Cash on Delivery'}</strong>
                          <p>
                            Subtotal {formatCurrency(order.subtotal)}
                            {' | '}
                            Tax {formatCurrency(order.tax)}
                            {' | '}
                            Shipping {formatCurrency(order.shippingCost)}
                          </p>
                          <small>Total charged {formatCurrency(order.total)}</small>
                        </div>
                      </div>

                      {(order.items?.length ?? 0) > 0 ? (
                        <div className="order-items-list">
                          {order.items.map((item) => {
                            const trackingSteps = buildTrackingSteps(item);
                            const returnStatus = item.returnRequest?.status ?? 'none';
                            const canRequestReturn = item.status === 'delivered' && returnStatus === 'none';

                            return (
                              <div key={item.id} className="order-item-card order-item-card--detailed">
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
                                    <small>
                                      Qty {item.quantity ?? 0}
                                      {' | '}
                                      Unit {formatCurrency(item.price)}
                                      {' | '}
                                      Line total {formatCurrency(item.subtotal)}
                                    </small>
                                  </div>
                                </div>

                                <span className={`order-item-card__status order-item-card__status--${item.status}`}>
                                  {formatStatus(item.status)}
                                </span>

                                <div className="order-item-card__actions">
                                  {item.tracking?.trackingUrl ? (
                                    <a
                                      href={item.tracking.trackingUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="order-item-card__action"
                                    >
                                      Track package
                                    </a>
                                  ) : null}

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
                                  ) : null}

                                  {canRequestReturn ? (
                                    <button
                                      type="button"
                                      className="order-item-card__action"
                                      onClick={() => openReturnModal(order.id, item)}
                                    >
                                      Request return
                                    </button>
                                  ) : returnStatus !== 'none' ? (
                                    <span className="pill pill--muted">
                                      Return {formatStatus(returnStatus)}
                                    </span>
                                  ) : null}

                                  <button
                                    type="button"
                                    className="order-item-card__action"
                                    onClick={() => handleReorder({ ...order, items: [item] })}
                                  >
                                    Buy again
                                  </button>
                                </div>

                                <div className="order-item-card__details">
                                  <div className="order-item-card__detail-block">
                                    <small>Tracking timeline</small>
                                    <div className="order-tracking-steps">
                                      {trackingSteps.map((step) => (
                                        <div
                                          key={`${item.id}-${step.key}`}
                                          className={`order-tracking-step order-tracking-step--${step.state}`}
                                        >
                                          <span className="order-tracking-step__dot" />
                                          <div>
                                            <strong>{step.label}</strong>
                                            <small>{step.updatedAt ? formatDateTime(step.updatedAt) : 'Awaiting update'}</small>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                    {item.tracking?.carrier || item.tracking?.trackingNumber ? (
                                      <p className="order-item-card__detail-text">
                                        {[
                                          item.tracking?.carrier ? `Carrier: ${item.tracking.carrier}` : null,
                                          item.tracking?.trackingNumber ? `Tracking #: ${item.tracking.trackingNumber}` : null,
                                        ].filter(Boolean).join(' | ')}
                                      </p>
                                    ) : (
                                      <p className="order-item-card__detail-text">Seller has not shared courier details yet.</p>
                                    )}
                                  </div>

                                  <div className="order-item-card__detail-block">
                                    <small>Return and refund</small>
                                    <strong>{returnStatus === 'none' ? 'No return requested' : formatStatus(returnStatus)}</strong>
                                    <p className="order-item-card__detail-text">
                                      {item.returnRequest?.reason || 'No return note has been added for this item.'}
                                    </p>
                                    <small>
                                      {item.returnRequest?.requestedAt
                                        ? `Requested ${formatDateTime(item.returnRequest.requestedAt)}`
                                        : 'Delivered items can be returned once the seller has marked them fulfilled.'}
                                    </small>
                                    {item.returnRequest?.refundAmount ? (
                                      <small>Refund amount {formatCurrency(item.returnRequest.refundAmount)}</small>
                                    ) : null}
                                    {item.returnRequest?.note ? (
                                      <small>Seller note: {item.returnRequest.note}</small>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </td>
                  </tr>
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
                      *
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
                <button type="submit" className="review-modal__primary" disabled={isSubmittingReview}>
                  {isSubmittingReview ? 'Submitting...' : 'Submit review'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {returnTarget ? (
        <div className="dashboard-overlay" role="dialog" aria-modal="true">
          <div className="dashboard-overlay__panel review-modal">
            <div className="review-modal__header">
              <div>
                <p className="eyebrow">Request return</p>
                <h3>{returnTarget.productName}</h3>
              </div>
              <button type="button" className="review-modal__close" onClick={closeReturnModal}>
                Close
              </button>
            </div>
            <form className="review-modal__form" onSubmit={handleSubmitReturn}>
              <label className="review-modal__field">
                <span>Reason for return</span>
                <textarea
                  value={returnReason}
                  maxLength={500}
                  onChange={(event) => setReturnReason(event.target.value)}
                  placeholder="Describe the issue with this item"
                  rows={5}
                />
              </label>
              {returnError ? (
                <p className="dashboard-message dashboard-message--error">{returnError}</p>
              ) : null}
              <div className="review-modal__actions">
                <button type="button" onClick={closeReturnModal} className="review-modal__secondary">
                  Cancel
                </button>
                <button type="submit" className="review-modal__primary" disabled={isSubmittingReturn}>
                  {isSubmittingReturn ? 'Submitting...' : 'Submit return request'}
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
