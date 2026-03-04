import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import './CheckoutPage.css';
import { useAppDispatch, useAppSelector } from '../../app/hooks.js';
import { cartActions } from '../../features/cart/cartSlice.js';
import {
  useCreateMarketplaceOrderMutation,
  useConfirmMarketplaceCodOrderMutation,
  useCreateMarketplacePaymentIntentMutation,
  useCreateMarketplaceUpiSessionMutation,
  useConfirmMarketplaceUpiPaymentMutation,
  useConfirmMarketplacePaymentSessionMutation,
} from '../../services/marketplaceApi.js';
import { formatCurrency } from '../../utils/format.js';
import { INDIAN_CITIES, INDIAN_STATES } from '../../constants/indianLocations.js';
import AutosuggestInput from '../../ui/AutosuggestInput.jsx';

const phonePattern = /^[0-9]{10}$/;
const pinPattern = /^[0-9]{6}$/;
const cityStatePattern = /^[A-Za-z ]+$/;
const UPI_APP_OPTIONS = ['Any UPI app', 'Google Pay', 'PhonePe', 'Paytm', 'BHIM'];
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
const codFeeEstimate = Number(import.meta.env.VITE_COD_FEE || 49);
const isUpiPaymentMethod = (value) => String(value || '').trim().toLowerCase().startsWith('upi');

const initialAddressState = (user) => ({
  firstName: user?.firstName ?? '',
  lastName: user?.lastName ?? '',
  email: user?.email ?? '',
  phone: user?.contactNumber ?? '',
  address: '',
  city: '',
  state: '',
  zipCode: '',
  paymentMethod: 'Cash on Delivery',
  preferredUpiApp: UPI_APP_OPTIONS[0],
});

const buildReturnUrl = (paymentSessionId) => {
  const url = new URL(window.location.href);
  url.searchParams.set('payment_session_id', paymentSessionId);
  return url.toString();
};

const MarketplaceEmbeddedPaymentForm = ({
  clientSecret,
  paymentSessionId,
  onSuccess,
  onError,
  onCancel,
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [localMessage, setLocalMessage] = useState(null);
  const [confirmMarketplacePaymentSession, { isLoading }] = useConfirmMarketplacePaymentSessionMutation();

  const handlePayment = async (event) => {
    event.preventDefault();
    if (!stripe || !elements) {
      return;
    }

    onError(null);
    setLocalMessage(null);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: buildReturnUrl(paymentSessionId),
      },
      redirect: 'if_required',
    });

    if (error) {
      onError(error.message || 'Payment could not be completed.');
      return;
    }

    const resolvedIntent = paymentIntent ?? (await stripe.retrievePaymentIntent(clientSecret)).paymentIntent;
    if (!resolvedIntent) {
      onError('Unable to verify payment status.');
      return;
    }

    if (resolvedIntent.status === 'succeeded') {
      try {
        const response = await confirmMarketplacePaymentSession({
          paymentSessionId,
          paymentIntentId: resolvedIntent.id,
        }).unwrap();
        onSuccess(response?.data?.order ?? null);
      } catch (confirmError) {
        onError(confirmError?.data?.message ?? 'Payment captured, but order confirmation failed.');
      }
      return;
    }

    if (resolvedIntent.status === 'processing') {
      setLocalMessage('Payment is processing. Please wait a moment.');
      return;
    }

    setLocalMessage('Complete the steps in your UPI app and return to continue.');
  };

  return (
    <form className="checkout-payment-panel__form" onSubmit={handlePayment}>
      <PaymentElement />
      {localMessage ? <p className="checkout-payment-panel__message">{localMessage}</p> : null}
      <div className="checkout-payment-panel__actions">
        <button type="submit" disabled={!stripe || isLoading}>
          {isLoading ? 'Confirming...' : 'Pay now'}
        </button>
        <button type="button" className="ghost-button" onClick={onCancel} disabled={isLoading}>
          Change payment details
        </button>
      </div>
    </form>
  );
};

const CheckoutPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const processedSessionRef = useRef(null);
  const processedIntentRef = useRef(null);
  const items = useAppSelector((state) => state.cart.items);
  const { user } = useAppSelector((state) => state.auth);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [createOrder, { isLoading: isPlacingCodOrder }] = useCreateMarketplaceOrderMutation();
  const [confirmMarketplaceCodOrder, { isLoading: isConfirmingCodOrder }] =
    useConfirmMarketplaceCodOrderMutation();
  const [createMarketplacePaymentIntent, { isLoading: isPreparingPaymentIntent }] =
    useCreateMarketplacePaymentIntentMutation();
  const [createMarketplaceUpiSession, { isLoading: isCreatingUpiSession }] =
    useCreateMarketplaceUpiSessionMutation();
  const [confirmMarketplaceUpiPayment, { isLoading: isConfirmingUpiPayment }] =
    useConfirmMarketplaceUpiPaymentMutation();
  const [confirmMarketplacePaymentSession, { isLoading: isConfirmingStripePayment }] =
    useConfirmMarketplacePaymentSessionMutation();
  const [formState, setFormState] = useState(() => initialAddressState(user));
  const [error, setError] = useState(null);
  const [order, setOrder] = useState(null);
  const [stripeNotice, setStripeNotice] = useState(null);
  const [pendingStripePayment, setPendingStripePayment] = useState(null);
  const [pendingDemoUpiPayment, setPendingDemoUpiPayment] = useState(null);
  const [pendingCodConfirmationOrder, setPendingCodConfirmationOrder] = useState(null);
  const isLoading =
    isPlacingCodOrder ||
    isConfirmingCodOrder ||
    isPreparingPaymentIntent ||
    isCreatingUpiSession ||
    isConfirmingUpiPayment ||
    isConfirmingStripePayment;
  const stripePromise = useMemo(
    () => (pendingStripePayment?.publishableKey ? loadStripe(pendingStripePayment.publishableKey) : null),
    [pendingStripePayment?.publishableKey],
  );

  const stripeStatus = searchParams.get('stripe');
  const paymentSessionId = searchParams.get('payment_session_id');
  const stripeSessionId = searchParams.get('session_id');
  const redirectedIntentClientSecret = searchParams.get('payment_intent_client_secret');

  useEffect(() => {
    setFormState((prev) => ({
      ...prev,
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      email: user?.email ?? '',
    }));
  }, [user?.firstName, user?.lastName, user?.email]);

  useEffect(() => {
    if (isUpiPaymentMethod(formState.paymentMethod)) {
      setPendingStripePayment(null);
      setPendingCodConfirmationOrder(null);
      return;
    }
    setPendingDemoUpiPayment(null);
    if (formState.paymentMethod !== 'Cash on Delivery') {
      setPendingCodConfirmationOrder(null);
    }
  }, [formState.paymentMethod]);

  useEffect(() => {
    const clearIntentQuery = () => {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('payment_intent');
      nextParams.delete('payment_intent_client_secret');
      nextParams.delete('redirect_status');
      setSearchParams(nextParams, { replace: true });
    };

    if (!redirectedIntentClientSecret || !paymentSessionId) {
      processedIntentRef.current = null;
      return;
    }

    const fingerprint = `${paymentSessionId}:${redirectedIntentClientSecret}`;
    if (processedIntentRef.current === fingerprint) {
      return;
    }
    processedIntentRef.current = fingerprint;

    const confirmIntentAfterRedirect = async () => {
      try {
        let publishableKey = pendingStripePayment?.publishableKey || import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

        if (!publishableKey) {
          const response = await fetch(`${apiBaseUrl}/payments/config`, {
            credentials: 'include',
          });
          const payload = await response.json();
          publishableKey = payload?.data?.publishableKey || null;
        }

        if (!publishableKey) {
          throw new Error('Stripe publishable key is missing.');
        }

        const stripe = await loadStripe(publishableKey);
        if (!stripe) {
          throw new Error('Stripe failed to initialize.');
        }

        const { paymentIntent, error: retrieveError } = await stripe.retrievePaymentIntent(redirectedIntentClientSecret);
        if (retrieveError) {
          throw retrieveError;
        }

        if (!paymentIntent || paymentIntent.status !== 'succeeded') {
          setStripeNotice('Payment is not completed yet. Please wait and retry.');
          return;
        }

        const confirmation = await confirmMarketplacePaymentSession({
          paymentSessionId,
          paymentIntentId: paymentIntent.id,
        }).unwrap();

        setOrder(confirmation?.data?.order ?? null);
        setStripeNotice('Payment successful. Your order has been placed.');
        setPendingStripePayment(null);
        setPendingDemoUpiPayment(null);
        setPendingCodConfirmationOrder(null);
        dispatch(cartActions.clearCart());
      } catch (confirmError) {
        setError(
          confirmError?.data?.message
          ?? confirmError?.message
          ?? 'Payment captured, but order confirmation failed.',
        );
      } finally {
        clearIntentQuery();
      }
    };

    confirmIntentAfterRedirect();
  }, [
    redirectedIntentClientSecret,
    paymentSessionId,
    searchParams,
    setSearchParams,
    pendingStripePayment?.publishableKey,
    confirmMarketplacePaymentSession,
    dispatch,
  ]);

  useEffect(() => {
    const clearStripeQuery = () => {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('stripe');
      nextParams.delete('payment_session_id');
      nextParams.delete('session_id');
      setSearchParams(nextParams, { replace: true });
    };

    if (!stripeStatus) {
      processedSessionRef.current = null;
      return;
    }

    if (stripeStatus === 'cancelled') {
      setStripeNotice('Stripe checkout was cancelled. Your cart is still available.');
      clearStripeQuery();
      return;
    }

    if (stripeStatus !== 'success' || !paymentSessionId) {
      clearStripeQuery();
      return;
    }

    if (processedSessionRef.current === paymentSessionId) {
      return;
    }
    processedSessionRef.current = paymentSessionId;

    const confirmStripePayment = async () => {
      try {
        const response = await confirmMarketplacePaymentSession({
          paymentSessionId,
          sessionId: stripeSessionId || undefined,
        }).unwrap();

        setOrder(response?.data?.order ?? null);
        setStripeNotice('Payment successful. Your order has been placed.');
        setPendingDemoUpiPayment(null);
        setPendingCodConfirmationOrder(null);
        dispatch(cartActions.clearCart());
      } catch (confirmError) {
        setError(
          confirmError?.data?.message
          ?? 'Payment completed, but order confirmation failed. Please refresh and retry.',
        );
      } finally {
        clearStripeQuery();
      }
    };

    confirmStripePayment();
  }, [
    stripeStatus,
    paymentSessionId,
    stripeSessionId,
    searchParams,
    setSearchParams,
    confirmMarketplacePaymentSession,
    dispatch,
  ]);

  const totals = useMemo(() => {
    const subtotal = items.reduce(
      (sum, item) => sum + (item.price || 0) * (item.quantity || 0),
      0,
    );
    const tax = 0;
    const shipping = 0;
    const useCodFee = formState.paymentMethod === 'Cash on Delivery';
    const codFee = useCodFee && Number.isFinite(codFeeEstimate) && codFeeEstimate > 0
      ? codFeeEstimate
      : 0;
    const total = subtotal + tax + shipping + codFee;

    return { subtotal, tax, shipping, codFee, total };
  }, [items, formState.paymentMethod]);

  const handleChange = (event) => {
    const { name } = event.target;
    let { value } = event.target;

    if (name === 'phone') {
      value = value.replace(/\D/g, '').slice(0, 10);
    }

    if (name === 'zipCode') {
      value = value.replace(/\D/g, '').slice(0, 6);
    }

    if (name === 'city' || name === 'state') {
      value = value.replace(/[^A-Za-z\s]/g, '');
    }

    setFormState((prev) => {
      const nextState = { ...prev, [name]: value };
      if (name === 'paymentMethod' && !isUpiPaymentMethod(value)) {
        nextState.preferredUpiApp = UPI_APP_OPTIONS[0];
      }
      return nextState;
    });
  };

  const handleCopyDemoUpiUri = async () => {
    if (!pendingDemoUpiPayment?.upiUri) {
      return;
    }

    try {
      await navigator.clipboard.writeText(pendingDemoUpiPayment.upiUri);
      setStripeNotice('Demo UPI link copied.');
    } catch (_error) {
      setError('Could not copy UPI link. Please copy it manually.');
    }
  };

  const handleConfirmDemoUpi = async () => {
    if (!pendingDemoUpiPayment?.paymentSessionId) {
      return;
    }

    setError(null);
    try {
      const confirmation = await confirmMarketplaceUpiPayment({
        paymentSessionId: pendingDemoUpiPayment.paymentSessionId,
        transactionReference: `demo-confirm-${Date.now()}`,
      }).unwrap();

      setOrder(confirmation?.data?.order ?? null);
      setStripeNotice('Demo UPI payment marked successful. Your order has been placed.');
      setPendingDemoUpiPayment(null);
      setPendingCodConfirmationOrder(null);
      dispatch(cartActions.clearCart());
    } catch (confirmError) {
      setError(
        confirmError?.data?.message
        ?? confirmError?.message
        ?? 'Unable to confirm UPI payment.',
      );
    }
  };

  const handleConfirmCodOrder = async () => {
    if (!pendingCodConfirmationOrder?.id) {
      return;
    }

    setError(null);
    try {
      const response = await confirmMarketplaceCodOrder(pendingCodConfirmationOrder.id).unwrap();
      setOrder(response?.data?.order ?? null);
      setPendingCodConfirmationOrder(null);
      setStripeNotice('Cash on Delivery order confirmed.');
      dispatch(cartActions.clearCart());
    } catch (confirmError) {
      setError(
        confirmError?.data?.message
        ?? confirmError?.message
        ?? 'Unable to confirm Cash on Delivery order.',
      );
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);

    if (!user) {
      setError('Please sign in to place an order.');
      return;
    }

    if (!items.length) {
      setError('Your cart is empty. Add a product before checking out.');
      return;
    }

    if (!phonePattern.test(formState.phone)) {
      setError('Phone number must be exactly 10 digits.');
      return;
    }

    if (!pinPattern.test(formState.zipCode)) {
      setError('PIN code must be a 6-digit number.');
      return;
    }

    if (!cityStatePattern.test(formState.city.trim())) {
      setError('City should contain letters only.');
      return;
    }

    if (!cityStatePattern.test(formState.state.trim())) {
      setError('State should contain letters only.');
      return;
    }

    try {
      const payload = {
        items: items.map((item) => ({
          productId: item.id,
          quantity: item.quantity,
        })),
        shippingAddress: {
          firstName: formState.firstName.trim(),
          lastName: formState.lastName.trim(),
          email: formState.email.trim(),
          phone: formState.phone.trim(),
          address: formState.address.trim(),
          city: formState.city.trim(),
          state: formState.state.trim(),
          zipCode: formState.zipCode.trim(),
        },
        paymentMethod: formState.paymentMethod,
        preferredUpiApp: isUpiPaymentMethod(formState.paymentMethod)
          ? formState.preferredUpiApp
          : undefined,
      };

      if (formState.paymentMethod === 'Cash on Delivery') {
        const response = await createOrder(payload).unwrap();
        const createdOrder = response?.data?.order ?? null;
        if (createdOrder?.cod && !createdOrder.cod.isConfirmed) {
          setPendingCodConfirmationOrder(createdOrder);
          setStripeNotice('Confirm your COD order below to keep it active.');
        } else {
          setOrder(createdOrder);
          dispatch(cartActions.clearCart());
        }
        setPendingStripePayment(null);
        setPendingDemoUpiPayment(null);
        return;
      }

      if (isUpiPaymentMethod(formState.paymentMethod)) {
        const response = await createMarketplaceUpiSession(payload).unwrap();
        const upiData = response?.data;

        if (!upiData?.paymentSessionId || !upiData?.upiUri) {
          throw new Error('Unable to initialize UPI payment.');
        }

        setPendingStripePayment(null);
        setPendingDemoUpiPayment({
          paymentSessionId: upiData.paymentSessionId,
          upiId: upiData.upiId,
          payeeName: upiData.payeeName,
          upiUri: upiData.upiUri,
          amount: upiData.amount,
          currency: upiData.currency || 'INR',
        });
        setStripeNotice('UPI payment session is ready. Scan QR or use UPI link, then confirm below.');
        return;
      }

      const response = await createMarketplacePaymentIntent(payload).unwrap();
      const clientSecret = response?.data?.clientSecret;
      const createdPaymentSessionId = response?.data?.paymentSessionId;
      const publishableKey = response?.data?.publishableKey || import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || null;

      if (!clientSecret || !createdPaymentSessionId || !publishableKey) {
        throw new Error('Unable to initialize secure payment.');
      }

      setPendingStripePayment({
        clientSecret,
        paymentSessionId: createdPaymentSessionId,
        publishableKey,
      });
      setPendingDemoUpiPayment(null);
      setStripeNotice('Secure payment form is ready below.');
    } catch (apiError) {
      setError(apiError?.data?.message ?? apiError?.message ?? 'We could not place the order right now. Please try again.');
    }
  };

  const handleContinueShopping = () => {
    navigate('/marketplace');
  };

  if (order) {
    return (
      <div className="checkout-page">
        <header>
          <h1>Order confirmed</h1>
          <p>Thank you for your purchase. We have sent the order details to your email.</p>
        </header>
        <div className="checkout-success">
          <p className="checkout-success__number">Order number: {order.orderNumber}</p>
          <ul className="checkout-success__items">
            {(order.items ?? []).map((item) => (
              <li key={item.id}>
                <span>{item.name}</span>
                <span>x{item.quantity}</span>
                <span>{formatCurrency(item.price * item.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="checkout-success__total">
            <span>Total paid</span>
            <strong>{formatCurrency(order.total)}</strong>
          </div>
          <button type="button" onClick={handleContinueShopping}>
            Back to marketplace
          </button>
        </div>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="checkout-page">
        <header>
          <h1>Checkout</h1>
          <p>Add some products to your cart to continue.</p>
        </header>
        <div className="checkout-empty">
          <Link to="/marketplace">Browse the marketplace</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="checkout-page">
      <header>
        <h1>Checkout</h1>
        <p>Provide your delivery details to complete the purchase.</p>
      </header>

      {!user ? (
        <div className="checkout-auth">
          <p>You need an account to place orders.</p>
          <Link to="/auth/login">Sign in to continue</Link>
        </div>
      ) : null}

      {stripeNotice ? (
        <div className="checkout-success" role="status">
          {stripeNotice}
        </div>
      ) : null}

      {error ? (
        <div className="checkout-error" role="alert">
          {error}
        </div>
      ) : null}

      <div className="checkout-layout">
        <aside className="checkout-summary">
          <h2>Order summary</h2>
          <ul>
            {items.map((item) => (
              <li key={item.id}>
                <span>
                  {item.name}
                  <small> x{item.quantity}</small>
                </span>
                <span>{formatCurrency(item.price * item.quantity)}</span>
              </li>
            ))}
          </ul>
          <dl>
            <div>
              <dt>Subtotal</dt>
              <dd>{formatCurrency(totals.subtotal)}</dd>
            </div>
            <div>
              <dt>Shipping</dt>
              <dd>{totals.shipping ? formatCurrency(totals.shipping) : 'Free'}</dd>
            </div>
            <div>
              <dt>Tax</dt>
              <dd>{totals.tax ? formatCurrency(totals.tax) : 'N/A'}</dd>
            </div>
            <div>
              <dt>COD fee</dt>
              <dd>{totals.codFee ? formatCurrency(totals.codFee) : 'N/A'}</dd>
            </div>
            <div className="checkout-summary__total">
              <dt>Total</dt>
              <dd>{formatCurrency(totals.total)}</dd>
            </div>
          </dl>
        </aside>

        <div className="checkout-main">
          <form className="checkout-form" onSubmit={handleSubmit}>
            <fieldset>
              <legend><span className="step-badge">1</span> Shipping Details</legend>
              <div className="checkout-form__grid">
                <label>
                  First name
                  <input
                    required
                    name="firstName"
                    value={formState.firstName}
                    onChange={handleChange}
                    autoComplete="given-name"
                  />
                </label>
                <label>
                  Last name
                  <input
                    required
                    name="lastName"
                    value={formState.lastName}
                    onChange={handleChange}
                    autoComplete="family-name"
                  />
                </label>
              </div>
              <div className="checkout-form__grid">
                <label>
                  Email
                  <input
                    required
                    type="email"
                    name="email"
                    value={formState.email}
                    onChange={handleChange}
                    autoComplete="email"
                  />
                </label>
                <label>
                  Phone number
                  <input
                    required
                    type="tel"
                    name="phone"
                    value={formState.phone}
                    onChange={handleChange}
                    pattern="[0-9]{10}"
                    inputMode="numeric"
                    placeholder="9876543210"
                    autoComplete="tel"
                  />
                </label>
              </div>
              <label>
                Address
                <input
                  required
                  name="address"
                  value={formState.address}
                  onChange={handleChange}
                  autoComplete="street-address"
                />
              </label>
              <div className="checkout-form__grid">
                <label>
                  City
                  <AutosuggestInput
                    value={formState.city}
                    onChange={(val) => setFormState((prev) => ({ ...prev, city: val }))}
                    suggestions={INDIAN_CITIES}
                    placeholder="Bengaluru"
                    ariaLabel="City"
                  />
                </label>
                <label>
                  State
                  <AutosuggestInput
                    value={formState.state}
                    onChange={(val) => setFormState((prev) => ({ ...prev, state: val }))}
                    suggestions={INDIAN_STATES}
                    placeholder="Karnataka"
                    ariaLabel="State"
                  />
                </label>
                <label>
                  PIN code
                  <input
                    required
                    name="zipCode"
                    value={formState.zipCode}
                    onChange={handleChange}
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    placeholder="560001"
                    autoComplete="postal-code"
                  />
                </label>
              </div>
            </fieldset>

            <fieldset>
              <legend><span className="step-badge">2</span> Payment Method</legend>
              <label>
                Payment method
                <select
                  name="paymentMethod"
                  value={formState.paymentMethod}
                  onChange={handleChange}
                >
                  <option value="Cash on Delivery">Cash on Delivery</option>
                  <option value="UPI">UPI</option>
                  <option value="Credit / Debit Card">Credit / Debit Card</option>
                </select>
              </label>
              {isUpiPaymentMethod(formState.paymentMethod) ? (
                <label>
                  Preferred UPI app
                  <select
                    name="preferredUpiApp"
                    value={formState.preferredUpiApp}
                    onChange={handleChange}
                  >
                    {UPI_APP_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {formState.paymentMethod === 'Cash on Delivery' ? (
                <p className="checkout-form__hint">
                  Cash on Delivery adds {formatCurrency(totals.codFee)}. You must confirm the order after placing.
                </p>
              ) : (
                <p className="checkout-form__hint">
                  {isUpiPaymentMethod(formState.paymentMethod)
                    ? 'A UPI QR and UPI link will be generated below for manual confirmation.'
                    : 'Secure card flow will open below.'}
                </p>
              )}
            </fieldset>

            <button type="submit" disabled={isLoading || !user || Boolean(pendingCodConfirmationOrder)}>
              {isLoading
                ? 'Processing...'
                : formState.paymentMethod === 'Cash on Delivery'
                  ? 'Place order'
                  : isUpiPaymentMethod(formState.paymentMethod)
                    ? 'Continue to UPI payment'
                    : 'Continue to secure payment'}
            </button>
          </form>

          {pendingCodConfirmationOrder ? (
            <section className="checkout-payment-panel">
              <h3>Confirm Cash on Delivery</h3>
              <p className="checkout-payment-panel__message">
                Order {pendingCodConfirmationOrder.orderNumber} is created but pending confirmation.
                {pendingCodConfirmationOrder?.cod?.confirmationDeadline
                  ? ` Confirm before ${new Date(pendingCodConfirmationOrder.cod.confirmationDeadline).toLocaleString()}.`
                  : ''}
              </p>
              <div className="checkout-payment-panel__actions">
                <button type="button" onClick={handleConfirmCodOrder} disabled={isLoading}>
                  {isLoading ? 'Confirming...' : 'Confirm COD order'}
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setPendingCodConfirmationOrder(null)}
                  disabled={isLoading}
                >
                  Decide later
                </button>
              </div>
            </section>
          ) : null}

          {pendingDemoUpiPayment && isUpiPaymentMethod(formState.paymentMethod) ? (
            <section className="checkout-payment-panel">
              <h3>UPI Payment</h3>
              <div className="checkout-demo-upi">
                <p className="checkout-payment-panel__message">
                  Project UPI mode. Complete payment in your UPI app, then confirm.
                </p>
                <img
                  className="checkout-demo-upi__qr"
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(pendingDemoUpiPayment.upiUri)}`}
                  alt="Demo UPI QR"
                />
                <div className="checkout-demo-upi__meta">
                  <p>UPI ID: {pendingDemoUpiPayment.upiId}</p>
                  <p>Payee: {pendingDemoUpiPayment.payeeName}</p>
                  <p>Amount: {formatCurrency(Number(pendingDemoUpiPayment.amount || 0))}</p>
                </div>
                <div className="checkout-payment-panel__actions">
                  <button type="button" onClick={handleConfirmDemoUpi} disabled={isLoading}>
                    {isLoading ? 'Confirming...' : 'I paid'}
                  </button>
                  <button type="button" className="ghost-button" onClick={handleCopyDemoUpiUri}>
                    Copy UPI Link
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => setPendingDemoUpiPayment(null)}
                    disabled={isLoading}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </section>
          ) : null}

          {pendingStripePayment?.clientSecret && stripePromise && !isUpiPaymentMethod(formState.paymentMethod) ? (
            <section className="checkout-payment-panel">
              <h3>Complete Payment</h3>
              <Elements
                stripe={stripePromise}
                options={{ clientSecret: pendingStripePayment.clientSecret }}
              >
                <MarketplaceEmbeddedPaymentForm
                  clientSecret={pendingStripePayment.clientSecret}
                  paymentSessionId={pendingStripePayment.paymentSessionId}
                  onSuccess={(confirmedOrder) => {
                    setOrder(confirmedOrder);
                    setStripeNotice('Payment successful. Your order has been placed.');
                    setPendingStripePayment(null);
                    setPendingDemoUpiPayment(null);
                    setPendingCodConfirmationOrder(null);
                    dispatch(cartActions.clearCart());
                  }}
                  onError={(message) => {
                    setError(message);
                  }}
                  onCancel={() => {
                    setPendingStripePayment(null);
                  }}
                />
              </Elements>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
