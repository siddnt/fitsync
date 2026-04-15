import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import './CheckoutPage.css';
import { clearPendingOrderSnapshot } from './checkoutState.js';

const CheckoutCancelPage = () => {
  useEffect(() => {
    clearPendingOrderSnapshot();
  }, []);

  return (
    <div className="checkout-page">
      <header>
        <h1>Payment Cancelled</h1>
        <p>Your payment was cancelled. No charges were made.</p>
      </header>
      <div className="checkout-cancel">
        <p className="checkout-cancel__message">
          If you experienced any issues during checkout, please try again or contact our support team.
        </p>
        <div className="checkout-cancel__actions">
          <Link to="/marketplace/checkout" className="btn btn-primary">
            Return to Checkout
          </Link>
          <Link to="/marketplace" className="btn btn-secondary">
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
};

export default CheckoutCancelPage;
