import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './CheckoutPage.css';
import { useAppDispatch, useAppSelector } from '../../app/hooks.js';
import { cartActions } from '../../features/cart/cartSlice.js';
import { useCreateMarketplaceOrderMutation } from '../../services/marketplaceApi.js';
import { formatCurrency } from '../../utils/format.js';

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

const CheckoutPage = () => {
  const items = useAppSelector((state) => state.cart.items);
  const { user } = useAppSelector((state) => state.auth);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [createOrder, { isLoading }] = useCreateMarketplaceOrderMutation();
  const [formState, setFormState] = useState(() => initialAddressState(user));
  const [error, setError] = useState(null);
  const [order, setOrder] = useState(null);

  useEffect(() => {
    setFormState((prev) => ({
      ...prev,
      firstName: user?.firstName ?? '',
      lastName: user?.lastName ?? '',
      email: user?.email ?? '',
    }));
  }, [user?.firstName, user?.lastName, user?.email]);

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
      };

      const response = await createOrder(payload).unwrap();
      setOrder(response?.data?.order ?? null);
      dispatch(cartActions.clearCart());
    } catch (apiError) {
      setError(apiError?.data?.message ?? 'We could not place the order right now. Please try again.');
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

      {error ? (
        <div className="checkout-error" role="alert">
          {error}
        </div>
      ) : null}

      <div className="checkout-layout">
        <form className="checkout-form" onSubmit={handleSubmit}>
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
              <option value="UPI">UPI</option>
              <option value="Credit / Debit Card">Credit / Debit Card</option>
            </select>
          </label>
          <button type="submit" disabled={isLoading || !user}>
            {isLoading ? 'Placing order...' : 'Place order'}
          </button>
        </form>

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
            <div className="checkout-summary__total">
              <dt>Total</dt>
              <dd>{formatCurrency(totals.total)}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  );
};

export default CheckoutPage;
