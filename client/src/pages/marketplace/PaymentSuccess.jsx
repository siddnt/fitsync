import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import './PaymentSuccess.css';

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    // You can optionally fetch payment details from your backend
    if (sessionId) {
      console.log('Payment session ID:', sessionId);
    }
  }, [sessionId]);

  return (
    <div className="payment-result-page">
      <div className="payment-result-card success">
        <div className="payment-result-icon">✓</div>
        <h1>Payment Successful!</h1>
        <p>Thank you for your purchase. Your order has been confirmed.</p>
        
        {sessionId && (
          <div className="payment-session-info">
            <small>Session ID: {sessionId}</small>
          </div>
        )}

        <div className="payment-result-actions">
          <Link to="/marketplace" className="btn btn-primary">
            Continue Shopping
          </Link>
          <Link to="/profile" className="btn btn-secondary">
            View Orders
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
