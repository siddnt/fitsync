import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './CartPage.css';
import { useAppDispatch, useAppSelector } from '../../app/hooks.js';
import { cartActions } from '../../features/cart/cartSlice.js';
import {
  useGetMarketplacePublicPromosQuery,
  usePreviewMarketplacePricingMutation,
} from '../../services/marketplaceApi.js';
import { formatCurrency } from '../../utils/format.js';
import {
  clearMarketplacePromoCode,
  readMarketplacePromoCode,
  writeMarketplacePromoCode,
} from './marketplaceStorage.js';

const buildLocalTotals = (items = []) => {
  const subtotal = items.reduce(
    (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0),
    0,
  );
  const tax = 0;
  const shipping = 0;

  return {
    subtotal,
    tax,
    shippingCost: shipping,
    discountAmount: 0,
    total: subtotal + tax + shipping,
    promo: null,
  };
};

const CartPage = () => {
  const items = useAppSelector((state) => state.cart.items);
  const { user } = useAppSelector((state) => state.auth);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [promoInput, setPromoInput] = useState(() => readMarketplacePromoCode());
  const [promoMessage, setPromoMessage] = useState(null);
  const [pricing, setPricing] = useState(null);
  const [previewMarketplacePricing, { isLoading: isPreviewingPricing }] = usePreviewMarketplacePricingMutation();
  const { data: publicPromosResponse } = useGetMarketplacePublicPromosQuery();

  const publicPromos = Array.isArray(publicPromosResponse?.data?.promos) ? publicPromosResponse.data.promos : [];
  const localTotals = useMemo(() => buildLocalTotals(items), [items]);
  const displayPricing = pricing ?? localTotals;
  const appliedPromo = displayPricing.promo ?? null;

  useEffect(() => {
    if (!user || !items.length) {
      setPricing(null);
      return;
    }

    const savedPromoCode = readMarketplacePromoCode();
    if (!savedPromoCode) {
      setPricing(null);
      return;
    }

    let ignore = false;

    previewMarketplacePricing({ items, promoCode: savedPromoCode })
      .unwrap()
      .then((response) => {
        if (ignore) {
          return;
        }

        setPricing(response?.data?.pricing ?? null);
        setPromoInput(savedPromoCode);
        if (response?.data?.pricing?.discountAmount > 0) {
          setPromoMessage(`${savedPromoCode} applied. You saved ${formatCurrency(response.data.pricing.discountAmount)}.`);
        } else {
          setPromoMessage(`${savedPromoCode} is active for this order.`);
        }
      })
      .catch((error) => {
        if (ignore) {
          return;
        }

        clearMarketplacePromoCode();
        setPricing(null);
        setPromoMessage(error?.data?.message || 'The saved promo code no longer applies to this cart.');
      });

    return () => {
      ignore = true;
    };
  }, [items, previewMarketplacePricing, user]);

  const handleQuantityChange = (id, delta) => {
    const current = items.find((item) => item.id === id);
    if (!current) {
      return;
    }
    const nextQuantity = (current.quantity || 0) + delta;
    dispatch(cartActions.setQuantity({ id, quantity: nextQuantity }));
  };

  const handleRemove = (id) => {
    dispatch(cartActions.removeItem(id));
  };

  const handleCheckout = () => {
    navigate('/checkout');
  };

  const handleApplyPromo = async () => {
    const normalized = promoInput.trim().toUpperCase();
    if (!normalized) {
      setPromoMessage('Enter a promo code first.');
      return;
    }

    try {
      const response = await previewMarketplacePricing({
        items,
        promoCode: normalized,
      }).unwrap();

      const nextPricing = response?.data?.pricing ?? null;
      writeMarketplacePromoCode(normalized);
      setPricing(nextPricing);
      setPromoInput(normalized);
      setPromoMessage(
        nextPricing?.discountAmount > 0
          ? `${normalized} applied. You saved ${formatCurrency(nextPricing.discountAmount)}.`
          : `${normalized} applied.`,
      );
    } catch (error) {
      if (appliedPromo?.code === normalized) {
        setPricing(null);
      }
      clearMarketplacePromoCode();
      setPromoMessage(error?.data?.message || 'That promo code could not be applied.');
    }
  };

  const handleClearPromo = () => {
    clearMarketplacePromoCode();
    setPricing(null);
    setPromoInput('');
    setPromoMessage(null);
  };

  if (!user) {
    return (
      <div className="cart-page">
        <header>
          <h1>Your cart</h1>
          <p>Sign in to view your cart and continue with checkout.</p>
        </header>
        <div className="cart-empty">
          <p>Your cart is available only for signed-in accounts.</p>
          <div className="cart-empty__actions">
            <Link to="/auth/login" className="cart-empty__link">
              Sign in
            </Link>
            <Link to="/marketplace" className="cart-empty__link cart-empty__link--secondary">
              Browse marketplace
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="cart-page">
        <header>
          <h1>Your cart</h1>
          <p>Add products to start building your order.</p>
        </header>
        <div className="cart-empty">
          <p>Your cart is empty right now.</p>
          <Link to="/marketplace" className="cart-empty__link">
            Browse the marketplace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="cart-page">
      <header>
        <h1>Your cart</h1>
        <p>Review your selected products before heading to checkout.</p>
      </header>

      <div className="cart-layout">
        <section className="cart-items">
          {items.map((item) => (
            <article key={item.id} className="cart-item">
              <div className="cart-item__media">
                {item.image ? (
                  <img src={item.image} alt={item.name} loading="lazy" />
                ) : (
                  <div className="cart-item__placeholder" aria-hidden>
                    {(item.name ?? '?').slice(0, 1)}
                  </div>
                )}
              </div>
              <div className="cart-item__content">
                <div>
                  <h3>{item.name}</h3>
                  {item.seller?.name ? (
                    <p className="cart-item__seller">Seller: {item.seller.name}</p>
                  ) : null}
                </div>
                <div className="cart-item__pricing">
                  <span>{formatCurrency(item.price)}</span>
                </div>
                <div className="cart-item__controls">
                  <div className="cart-item__quantity">
                    <button type="button" onClick={() => handleQuantityChange(item.id, -1)}>
                      -
                    </button>
                    <span>{item.quantity}</span>
                    <button type="button" onClick={() => handleQuantityChange(item.id, 1)}>
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    className="cart-item__remove"
                    onClick={() => handleRemove(item.id)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>

        <aside className="cart-summary">
          <h2>Order summary</h2>
          <dl>
            <div>
              <dt>Subtotal</dt>
              <dd>{formatCurrency(displayPricing.subtotal)}</dd>
            </div>
            {displayPricing.discountAmount > 0 ? (
              <div className="cart-summary__discount">
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
            <div className="cart-summary__total">
              <dt>Total</dt>
              <dd>{formatCurrency(displayPricing.total)}</dd>
            </div>
          </dl>
          <div className="cart-summary__promo">
            <div className="cart-summary__promo-header">
              <strong>Promo code</strong>
              {appliedPromo ? (
                <button type="button" onClick={handleClearPromo}>
                  Remove
                </button>
              ) : null}
            </div>
            <div className="cart-summary__promo-row">
              <input
                type="text"
                value={promoInput}
                onChange={(event) => setPromoInput(event.target.value.toUpperCase())}
                placeholder="Enter promo code"
              />
              <button type="button" onClick={handleApplyPromo} disabled={isPreviewingPricing}>
                {isPreviewingPricing ? 'Applying...' : 'Apply'}
              </button>
            </div>
            {promoMessage ? <p className="cart-summary__promo-note">{promoMessage}</p> : null}
            {appliedPromo ? (
              <p className="cart-summary__promo-note">
                <strong>{appliedPromo.label}:</strong> {appliedPromo.description || `${appliedPromo.code} is active for this order.`}
              </p>
            ) : publicPromos.length ? (
              <div className="cart-summary__promo-chips">
                {publicPromos.map((promo) => (
                  <button key={promo.id ?? promo.code} type="button" onClick={() => setPromoInput(promo.code)}>
                    {promo.code}
                  </button>
                ))}
              </div>
            ) : null}
            <p className="cart-summary__promo-note">
              Promo codes are created by FitSync admins. Public active codes appear here when available.
            </p>
          </div>
          <button
            type="button"
            className="cart-summary__checkout"
            onClick={handleCheckout}
          >
            Proceed to checkout
          </button>
        </aside>
      </div>
    </div>
  );
};

export default CartPage;
