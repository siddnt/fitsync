import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './CartPage.css';
import { useAppDispatch, useAppSelector } from '../../app/hooks.js';
import { cartActions } from '../../features/cart/cartSlice.js';
import { formatCurrency } from '../../utils/format.js';
import {
  MARKETPLACE_PROMO_CODES,
  clearMarketplacePromoCode,
  getMarketplacePromoDefinition,
  readMarketplacePromoCode,
  writeMarketplacePromoCode,
} from './marketplaceStorage.js';

const CartPage = () => {
  const items = useAppSelector((state) => state.cart.items);
  const { user } = useAppSelector((state) => state.auth);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [promoInput, setPromoInput] = useState(() => readMarketplacePromoCode());
  const [promoCode, setPromoCode] = useState(() => readMarketplacePromoCode());
  const [promoMessage, setPromoMessage] = useState(null);
  const appliedPromo = useMemo(() => getMarketplacePromoDefinition(promoCode), [promoCode]);

  const totals = useMemo(() => {
    const subtotal = items.reduce(
      (sum, item) => sum + (item.price || 0) * (item.quantity || 0),
      0,
    );
    const tax = 0;
    const shipping = 0;
    const total = subtotal + tax + shipping;

    return { subtotal, tax, shipping, total };
  }, [items]);

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

  const handleApplyPromo = () => {
    const normalized = promoInput.trim().toUpperCase();
    const promo = getMarketplacePromoDefinition(normalized);
    if (!promo) {
      setPromoMessage('That promo code is not available in this demo checkout.');
      return;
    }
    writeMarketplacePromoCode(normalized);
    setPromoCode(normalized);
    setPromoInput(normalized);
    setPromoMessage(`${promo.label} applied.`);
  };

  const handleClearPromo = () => {
    clearMarketplacePromoCode();
    setPromoCode('');
    setPromoInput('');
    setPromoMessage(null);
  };

  if (!items.length) {
    return (
      <div className="cart-page">
        <header>
          <h1>Your cart</h1>
          <p>{user ? 'Add products to start building your order.' : 'Sign in to add products and complete your purchase.'}</p>
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
            <div className="cart-summary__total">
              <dt>Total</dt>
              <dd>{formatCurrency(totals.total)}</dd>
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
              <button type="button" onClick={handleApplyPromo}>
                Apply
              </button>
            </div>
            {promoMessage ? <p className="cart-summary__promo-note">{promoMessage}</p> : null}
            {appliedPromo ? (
              <p className="cart-summary__promo-note">
                <strong>{appliedPromo.label}:</strong> {appliedPromo.summary}
              </p>
            ) : (
              <div className="cart-summary__promo-chips">
                {MARKETPLACE_PROMO_CODES.map((promo) => (
                  <button key={promo.code} type="button" onClick={() => setPromoInput(promo.code)}>
                    {promo.code}
                  </button>
                ))}
              </div>
            )}
            <p className="cart-summary__promo-note">
              Demo promos unlock fulfillment perks and support cues without changing the live checkout total.
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
