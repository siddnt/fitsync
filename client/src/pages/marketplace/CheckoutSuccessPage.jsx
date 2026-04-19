import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import './CheckoutPage.css';
import { useAppDispatch } from '../../app/hooks.js';
import { cartActions } from '../../features/cart/cartSlice.js';
import { useGetOrderByStripeSessionQuery } from '../../services/marketplaceApi.js';
import { formatCurrency, formatDateTime } from '../../utils/format.js';
import { downloadInvoicePdf, printInvoiceDocument } from '../../utils/invoice.js';
import {
  clearBuyNowCheckoutItem,
  clearPendingOrderSnapshot,
  readPendingOrderSnapshot,
} from './checkoutState.js';
import { clearMarketplacePromoCode } from './marketplaceStorage.js';

const MAX_POLLS = 12;
const POLL_INTERVAL_MS = 5000;
const ORDERS_PATH = '/dashboard/trainee/orders';

const CheckoutSuccessPage = () => {
  const [searchParams] = useSearchParams();
  const dispatch = useAppDispatch();
  const sessionId = searchParams.get('session_id');
  const [orderData, setOrderData] = useState(null);
  const [fetchError, setFetchError] = useState(
    sessionId ? null : 'Missing payment session. You can check your orders from the dashboard.',
  );
  const [pollCount, setPollCount] = useState(0);
  const pendingOrderSnapshot = readPendingOrderSnapshot();
  const promo = orderData?.promo ?? pendingOrderSnapshot?.promo ?? null;

  const {
    data: orderResponse,
    isLoading,
    error,
    isFetching,
    refetch,
  } = useGetOrderByStripeSessionQuery(sessionId, {
    skip: !sessionId || !!orderData,
    refetchOnMountOrArgChange: true,
  });

  const responseStatus = Number(orderResponse?.statusCode ?? 0);
  const responseMessage = String(orderResponse?.message ?? '');
  const hasResolvedOrder = Boolean(orderResponse?.data?.order);
  const isPendingResponse = !hasResolvedOrder
    && orderResponse?.success === false
    && responseStatus === 202;
  const isRetryableError = error?.status === 404 || error?.status === 202;
  const shouldPoll = Boolean(sessionId)
    && !orderData
    && (isPendingResponse || isRetryableError)
    && pollCount < MAX_POLLS;

  useEffect(() => {
    if (hasResolvedOrder) {
      setOrderData(orderResponse.data.order);
      setFetchError(null);
      clearPendingOrderSnapshot();
      clearMarketplacePromoCode();
      if (pendingOrderSnapshot?.checkoutMode === 'buy-now') {
        clearBuyNowCheckoutItem();
      } else {
        dispatch(cartActions.clearCart());
      }
      return;
    }

    if (!sessionId) {
      setFetchError('Missing payment session. You can check your orders from the dashboard.');
      return;
    }

    if (shouldPoll) {
      setFetchError(null);
      const timer = setTimeout(() => {
        setPollCount((prev) => prev + 1);
        refetch();
      }, POLL_INTERVAL_MS);
      return () => clearTimeout(timer);
    }

    if (isPendingResponse && pollCount >= MAX_POLLS) {
      setFetchError('Payment processing is taking longer than expected. Please check your orders in the dashboard.');
      return;
    }

    if (error) {
      setFetchError(error?.data?.message || 'Unable to load order details. You can view your orders in your dashboard.');
      return;
    }

    if (orderResponse?.success === false) {
      setFetchError(responseMessage || 'Unable to load order details. You can view your orders in your dashboard.');
    }
  }, [
    dispatch,
    error,
    hasResolvedOrder,
    isPendingResponse,
    orderResponse,
    pollCount,
    pendingOrderSnapshot?.checkoutMode,
    refetch,
    responseMessage,
    sessionId,
    shouldPoll,
  ]);

  const showLoading = !orderData && (isLoading || isFetching || shouldPoll);

  const handlePrintReceipt = () => {
    const result = printInvoiceDocument(orderData);
    if (!result.ok) {
      setFetchError(result.error);
      return;
    }
    setFetchError(null);
  };

  const handleDownloadReceipt = () => {
    const result = downloadInvoicePdf(orderData);
    if (!result.ok) {
      setFetchError(result.error);
      return;
    }
    setFetchError(null);
  };

  if (showLoading) {
    return (
      <div className="checkout-page">
        <div className="checkout-success checkout-success--loading">
          <div className="checkout-success__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          </div>
          <h2>Verifying your payment...</h2>
          <p className="checkout-success__message">
            {pollCount > 0
              ? `Checking payment status... (${Math.min(pollCount * 5, 60)}s)`
              : 'Please wait while we confirm your order details.'}
          </p>
          <Link to={ORDERS_PATH} className="btn btn-secondary" style={{ marginTop: '1rem' }}>
            View My Orders
          </Link>
        </div>
      </div>
    );
  }

  if (!orderData) {
    return (
      <div className="checkout-page">
        <div className="checkout-cancel">
          <h1>We are still confirming your order</h1>
          <p className="checkout-cancel__message">
            {fetchError || 'Unable to load the order details right now. You can check your orders from the dashboard.'}
          </p>
          <div className="checkout-cancel__actions">
            <Link to={ORDERS_PATH} className="btn btn-primary">
              View My Orders
            </Link>
            <Link to="/marketplace" className="btn btn-secondary">
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="checkout-page">
      <div className="checkout-success checkout-success--complete">
        <div className="checkout-success__icon checkout-success__icon--success">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>

        <div className="checkout-success__header">
          <h1>Payment Successful!</h1>
          <p className="checkout-success__subtitle">
            Thank you for your purchase. Your order has been confirmed.
          </p>
        </div>

        {fetchError ? (
          <div className="checkout-success__error" role="alert">
            {fetchError}
          </div>
        ) : null}

        <div className="checkout-success__order-number">
          <span className="label">Order Number</span>
          <span className="value">{orderData.orderNumber}</span>
        </div>

        <div className="checkout-success__items">
          <h3>Order Summary</h3>
          <ul>
            {orderData.items.map((item) => (
              <li key={item.id} className="checkout-success__item">
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    className="checkout-success__item-image"
                  />
                ) : null}
                <div className="checkout-success__item-details">
                  <span className="checkout-success__item-name">{item.name}</span>
                  <span className="checkout-success__item-qty">Qty: {item.quantity}</span>
                </div>
                <span className="checkout-success__item-price">
                  {formatCurrency(item.price * item.quantity)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="checkout-success__totals">
          <div className="checkout-success__total-row">
            <span>Subtotal</span>
            <span>{formatCurrency(orderData.subtotal)}</span>
          </div>
          {orderData.discountAmount > 0 ? (
            <div className="checkout-success__total-row">
              <span>Promo discount</span>
              <span>-{formatCurrency(orderData.discountAmount)}</span>
            </div>
          ) : null}
          {orderData.shippingCost > 0 ? (
            <div className="checkout-success__total-row">
              <span>Shipping</span>
              <span>{formatCurrency(orderData.shippingCost)}</span>
            </div>
          ) : null}
          {orderData.tax > 0 ? (
            <div className="checkout-success__total-row">
              <span>Tax</span>
              <span>{formatCurrency(orderData.tax)}</span>
            </div>
          ) : null}
          <div className="checkout-success__total-row checkout-success__total-row--grand">
            <span>Total Paid</span>
            <span>{formatCurrency(orderData.total)}</span>
          </div>
        </div>

        <div className="checkout-success__receipt">
          <div className="checkout-success__receipt-header">
            <div>
              <small>Receipt preview</small>
              <strong>{orderData.orderNumber}</strong>
            </div>
            <div className="checkout-success__receipt-actions">
              <button type="button" className="btn btn-secondary" onClick={handleDownloadReceipt}>
                Download PDF
              </button>
              <button type="button" className="btn btn-secondary" onClick={handlePrintReceipt}>
                Print receipt
              </button>
            </div>
          </div>
          <div className="checkout-success__receipt-grid">
            <div>
              <span>Issued</span>
              <strong>{formatDateTime(orderData.createdAt)}</strong>
            </div>
            <div>
              <span>Payment</span>
              <strong>{orderData.paymentMethod || 'Online payment'}</strong>
            </div>
            <div>
              <span>Items</span>
              <strong>{orderData.items?.length ?? 0}</strong>
            </div>
            <div>
              <span>Total</span>
              <strong>{formatCurrency(orderData.total)}</strong>
            </div>
          </div>
          <ul className="checkout-success__receipt-items">
            {(orderData.items ?? []).map((item) => (
              <li key={item.id}>
                <span>{item.name} x {item.quantity}</span>
                <strong>{formatCurrency((item.quantity ?? 0) * (item.price ?? 0))}</strong>
              </li>
            ))}
          </ul>
          <p className="checkout-success__receipt-note">
            A downloadable PDF and printable receipt are ready now, and the full invoice remains available from your orders dashboard.
          </p>
        </div>

        {promo ? (
          <div className="checkout-success__address">
            <h3>Promo perk applied</h3>
            <p>
              {promo?.code ? `${promo.code}: ` : ''}
              {promo?.description || promo?.label || 'Promo discount applied to this order.'}
              {promo?.discountAmount > 0 ? ` You saved ${formatCurrency(promo.discountAmount)}.` : ''}
            </p>
          </div>
        ) : null}

        <div className="checkout-success__address">
          <h3>Payment confirmation</h3>
          <p>
            Method: {orderData.paymentMethod || 'Online payment'}
            <br />
            Status: {orderData.paymentMethod === 'Cash on Delivery' ? 'Amount due on delivery' : 'Payment confirmed'}
            <br />
            Your confirmation email and future tracking updates will be sent to {orderData.shippingAddress?.email || 'your registered email'}.
          </p>
        </div>

        {orderData.shippingAddress ? (
          <div className="checkout-success__address">
            <h3>Shipping Address</h3>
            <p>
              {orderData.shippingAddress.firstName} {orderData.shippingAddress.lastName}
              <br />
              {orderData.shippingAddress.address}
              <br />
              {orderData.shippingAddress.city}, {orderData.shippingAddress.state} {orderData.shippingAddress.zipCode}
              <br />
              Phone: {orderData.shippingAddress.phone}
            </p>
          </div>
        ) : null}

        <div className="checkout-success__actions">
          <Link to="/marketplace" className="btn btn-primary">
            Continue Shopping
          </Link>
          <Link to={ORDERS_PATH} className="btn btn-secondary">
            Track Order
          </Link>
        </div>

        <div className="checkout-success__next-steps">
          <div className="checkout-success__next-step">
            <small>Order tracking</small>
            <strong>Follow courier updates</strong>
            <p>Open your orders dashboard to see item-level tracking, delivery status, and invoice access.</p>
            <Link to={ORDERS_PATH} className="btn btn-secondary">
              Open orders dashboard
            </Link>
          </div>
          <div className="checkout-success__next-step">
            <small>Returns and refunds</small>
            <strong>Review the return window</strong>
            <p>Delivered items can be returned from your orders page once the seller marks them fulfilled. Refund amounts and seller notes will appear item by item.</p>
            <Link to="/support/new?subject=Marketplace%20return%20question" className="btn btn-secondary">
              Ask about returns
            </Link>
          </div>
        </div>

        <p className="checkout-success__footer-note">
          We&apos;ve sent the order confirmation to <strong>{orderData.shippingAddress?.email}</strong>.
          You&apos;ll receive shipping updates via email.
        </p>
      </div>
    </div>
  );
};

export default CheckoutSuccessPage;
