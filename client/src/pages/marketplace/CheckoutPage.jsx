import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import './CheckoutPage.css';
import { useAppDispatch, useAppSelector } from '../../app/hooks.js';
import { cartActions } from '../../features/cart/cartSlice.js';
import {
  useCreateMarketplaceOrderMutation,
  useCreateMarketplaceCheckoutSessionMutation,
  usePreviewMarketplacePricingMutation,
} from '../../services/marketplaceApi.js';
import { formatCurrency } from '../../utils/format.js';
import {
  clearBuyNowCheckoutItem,
  normalizeCheckoutItem,
  readBuyNowCheckoutItem,
  saveBuyNowCheckoutItem,
  writePendingOrderSnapshot,
} from './checkoutState.js';
import {
  clearMarketplacePromoCode,
  readMarketplacePromoCode,
  readSavedCheckoutAddresses,
  saveCheckoutAddress,
  removeSavedCheckoutAddress,
} from './marketplaceStorage.js';

const phonePattern = /^[0-9]{10}$/;
const pinPattern = /^[0-9]{6}$/;
const cityStatePattern = /^[A-Za-z ]+$/;

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
});

const buildBasePricing = (items = []) => {
  const subtotal = items.reduce(
    (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0),
    0,
  );
  const tax = 0;
  const shippingCost = 0;

  return {
    subtotal,
    tax,
    shippingCost,
    discountAmount: 0,
    total: subtotal + tax + shippingCost,
    promo: null,
  };
};

const CheckoutPage = () => {
  const items = useAppSelector((state) => state.cart.items);
  const { user } = useAppSelector((state) => state.auth);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [createOrder, { isLoading: isCreatingOrder }] = useCreateMarketplaceOrderMutation();
  const [createCheckoutSession, { isLoading: isCreatingSession }] = useCreateMarketplaceCheckoutSessionMutation();
  const [previewMarketplacePricing] = usePreviewMarketplacePricingMutation();
  const [formState, setFormState] = useState(() => initialAddressState(user));
  const [error, setError] = useState(null);
  const [order, setOrder] = useState(null);
  const [saveAddressForLater, setSaveAddressForLater] = useState(true);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [pricing, setPricing] = useState(null);
  const [promoNotice, setPromoNotice] = useState(null);

  const isLoading = isCreatingOrder || isCreatingSession;
  const isCardPayment = formState.paymentMethod === 'Credit / Debit Card';
  const isBuyNowMode = searchParams.get('mode') === 'buy-now';
  const userAddressKey = user?._id ?? user?.id ?? user?.email ?? '';

  const buyNowStateItem = useMemo(
    () => normalizeCheckoutItem(location.state?.checkoutMode === 'buy-now' ? location.state?.checkoutItem : null),
    [location.state],
  );

  useEffect(() => {
    if (isBuyNowMode && buyNowStateItem) {
      saveBuyNowCheckoutItem(buyNowStateItem);
      return;
    }

    if (!isBuyNowMode) {
      clearBuyNowCheckoutItem();
    }
  }, [buyNowStateItem, isBuyNowMode]);

  const buyNowItem = useMemo(() => {
    if (!isBuyNowMode) {
      return null;
    }

    return buyNowStateItem || readBuyNowCheckoutItem();
  }, [buyNowStateItem, isBuyNowMode]);

  const checkoutItems = useMemo(
    () => (isBuyNowMode ? (buyNowItem ? [buyNowItem] : []) : items),
    [buyNowItem, isBuyNowMode, items],
  );

  const basePricing = useMemo(() => buildBasePricing(checkoutItems), [checkoutItems]);
  const displayPricing = pricing ?? basePricing;

  useEffect(() => {
    setFormState((prev) => ({
      ...prev,
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      email: user?.email ?? '',
    }));
  }, [user?.firstName, user?.lastName, user?.email]);

  useEffect(() => {
    if (!userAddressKey) {
      setSavedAddresses([]);
      return;
    }
    setSavedAddresses(readSavedCheckoutAddresses(userAddressKey));
  }, [userAddressKey]);

  useEffect(() => {
    if (!user || !checkoutItems.length) {
      setPricing(null);
      setPromoNotice(null);
      return;
    }

    const promoCode = readMarketplacePromoCode();
    if (!promoCode) {
      setPricing(null);
      setPromoNotice(null);
      return;
    }

    let ignore = false;

    previewMarketplacePricing({ items: checkoutItems, promoCode })
      .unwrap()
      .then((response) => {
        if (ignore) {
          return;
        }

        setPricing(response?.data?.pricing ?? null);
        if (response?.data?.pricing?.discountAmount > 0) {
          setPromoNotice(`${promoCode} saved ${formatCurrency(response.data.pricing.discountAmount)} on this order.`);
        } else {
          setPromoNotice(`${promoCode} is active for this order.`);
        }
      })
      .catch((apiError) => {
        if (ignore) {
          return;
        }

        clearMarketplacePromoCode();
        setPricing(null);
        setPromoNotice(apiError?.data?.message || 'The saved promo code no longer applies.');
      });

    return () => {
      ignore = true;
    };
  }, [checkoutItems, previewMarketplacePricing, user]);

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

    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const applySavedAddress = (address) => {
    if (!address) {
      return;
    }
    setFormState((prev) => ({
      ...prev,
      ...address,
      paymentMethod: prev.paymentMethod,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);

    if (!user) {
      setError('Please sign in to place an order.');
      return;
    }

    if (!checkoutItems.length) {
      setError(isBuyNowMode
        ? 'This Buy now item is no longer available. Please return to the product page and try again.'
        : 'Your cart is empty. Add a product before checking out.');
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

    const shippingAddress = {
      firstName: formState.firstName.trim(),
      lastName: formState.lastName.trim(),
      email: formState.email.trim(),
      phone: formState.phone.trim(),
      address: formState.address.trim(),
      city: formState.city.trim(),
      state: formState.state.trim(),
      zipCode: formState.zipCode.trim(),
    };

    if (saveAddressForLater && userAddressKey) {
      setSavedAddresses(saveCheckoutAddress(userAddressKey, shippingAddress));
    }

    const appliedPromoCode = displayPricing.promo?.code ?? null;

    try {
      if (formState.paymentMethod === 'Credit / Debit Card') {
        const payload = {
          items: checkoutItems.map((item) => ({
            productId: item.id,
            quantity: item.quantity,
          })),
          shippingAddress,
          promoCode: appliedPromoCode,
        };

        const orderSnapshot = {
          checkoutMode: isBuyNowMode ? 'buy-now' : 'cart',
          items: checkoutItems.map((item) => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            image: item.image,
          })),
          subtotal: displayPricing.subtotal,
          tax: displayPricing.tax,
          shippingCost: displayPricing.shippingCost,
          discountAmount: displayPricing.discountAmount,
          total: displayPricing.total,
          shippingAddress: payload.shippingAddress,
          promo: displayPricing.promo ?? null,
        };
        writePendingOrderSnapshot(orderSnapshot);

        const response = await createCheckoutSession(payload).unwrap();
        const checkoutUrl = response?.data?.checkoutUrl;

        if (checkoutUrl) {
          window.location.href = checkoutUrl;
        } else {
          setError('Failed to create checkout session. Please try again.');
        }
      } else {
        const payload = {
          items: checkoutItems.map((item) => ({
            productId: item.id,
            quantity: item.quantity,
          })),
          shippingAddress,
          paymentMethod: formState.paymentMethod,
          promoCode: appliedPromoCode,
        };

        const response = await createOrder(payload).unwrap();
        setOrder(response?.data?.order ?? null);
        clearMarketplacePromoCode();
        if (isBuyNowMode) {
          clearBuyNowCheckoutItem();
        } else {
          dispatch(cartActions.clearCart());
        }
      }
    } catch (apiError) {
      setError(apiError?.data?.message ?? 'We could not place the order right now. Please try again.');
    }
  };

  const handleContinueShopping = () => {
    if (isBuyNowMode) {
      clearBuyNowCheckoutItem();
    }
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
          {order.promo?.description ? (
            <p className="checkout-success__info">Promo applied: {order.promo.description}</p>
          ) : null}
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

  if (!checkoutItems.length) {
    return (
      <div className="checkout-page">
        <header>
          <h1>Checkout</h1>
          <p>{isBuyNowMode ? 'The selected Buy now item is unavailable.' : 'Add some products to your cart to continue.'}</p>
        </header>
        <div className="checkout-empty">
          <Link to="/marketplace">{isBuyNowMode ? 'Return to marketplace' : 'Browse the marketplace'}</Link>
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

      {error ? (
        <div className="checkout-error" role="alert">
          {error}
        </div>
      ) : null}

      <div className="checkout-layout">
        <form className="checkout-form" onSubmit={handleSubmit}>
          {savedAddresses.length ? (
            <div className="checkout-address-book">
              <div className="checkout-address-book__header">
                <strong>Saved addresses</strong>
                <span>Use a previous address instead of typing everything again.</span>
              </div>
              <div className="checkout-address-book__list">
                {savedAddresses.map((entry) => (
                  <article key={entry.id} className="checkout-address-card">
                    <p>{entry.address?.address}</p>
                    <small>
                      {[entry.address?.city, entry.address?.state, entry.address?.zipCode].filter(Boolean).join(', ')}
                    </small>
                    <div className="checkout-address-card__actions">
                      <button type="button" onClick={() => applySavedAddress(entry.address)}>
                        Use this address
                      </button>
                      <button
                        type="button"
                        className="checkout-address-card__remove"
                        onClick={() => setSavedAddresses(removeSavedCheckoutAddress(userAddressKey, entry.id))}
                      >
                        Remove
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          <div className="checkout-form__grid">
            <label>
              First name
              <input
                required
                name="firstName"
                value={formState.firstName}
                onChange={handleChange}
              />
            </label>
            <label>
              Last name
              <input
                required
                name="lastName"
                value={formState.lastName}
                onChange={handleChange}
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
            />
          </label>
          <div className="checkout-form__grid">
            <label>
              City
              <input
                required
                name="city"
                value={formState.city}
                onChange={handleChange}
                pattern="[A-Za-z ]+"
                placeholder="Bengaluru"
              />
            </label>
            <label>
              State
              <input
                required
                name="state"
                value={formState.state}
                onChange={handleChange}
                pattern="[A-Za-z ]+"
                placeholder="Karnataka"
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
              />
            </label>
          </div>
          <label>
            Payment method
            <select
              name="paymentMethod"
              value={formState.paymentMethod}
              onChange={handleChange}
            >
              <option value="Cash on Delivery">Cash on Delivery</option>
              <option value="Credit / Debit Card">Credit / Debit Card</option>
            </select>
          </label>
          <label className="checkout-form__toggle">
            <input
              type="checkbox"
              checked={saveAddressForLater}
              onChange={(event) => setSaveAddressForLater(event.target.checked)}
            />
            <span>Save this address for faster checkout next time.</span>
          </label>
          <button type="submit" disabled={isLoading || !user}>
            {isLoading ? (isCardPayment ? 'Connecting to payment...' : 'Processing...') : (isCardPayment ? 'Continue to payment' : 'Place order')}
          </button>
        </form>

        <aside className="checkout-summary">
          <h2>Order summary</h2>
          <ul>
            {checkoutItems.map((item) => (
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
              <dd>{formatCurrency(displayPricing.subtotal)}</dd>
            </div>
            {displayPricing.discountAmount > 0 ? (
              <div className="checkout-summary__discount">
                <dt>Promo discount</dt>
                <dd>-{formatCurrency(displayPricing.discountAmount)}</dd>
              </div>
            ) : null}
            <div>
              <dt>Shipping</dt>
              <dd>{displayPricing.shippingCost ? formatCurrency(displayPricing.shippingCost) : 'Free'}</dd>
            </div>
            <div>
              <dt>Tax</dt>
              <dd>{displayPricing.tax ? formatCurrency(displayPricing.tax) : 'N/A'}</dd>
            </div>
            <div className="checkout-summary__total">
              <dt>Total</dt>
              <dd>{formatCurrency(displayPricing.total)}</dd>
            </div>
          </dl>
          {displayPricing.promo ? (
            <div className="checkout-summary__promo">
              <strong>Promo applied: {displayPricing.promo.code}</strong>
              <p>{displayPricing.promo.description || `${displayPricing.promo.label} is active for this order.`}</p>
              {promoNotice ? <small>{promoNotice}</small> : null}
            </div>
          ) : promoNotice ? (
            <div className="checkout-summary__promo">
              <strong>Promo update</strong>
              <p>{promoNotice}</p>
              <small>Apply another code from the cart if needed.</small>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
};

export default CheckoutPage;
