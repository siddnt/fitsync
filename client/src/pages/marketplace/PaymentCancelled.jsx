import { Link } from 'react-router-dom';
import './PaymentSuccess.css';

const PaymentCancelled = () => {
  return (
    <div className="payment-result-page">
      <div className="payment-result-card cancelled">
        <div className="payment-result-icon">✗</div>
        <h1>Payment Cancelled</h1>
        <p>Your payment was cancelled. No charges were made to your account.</p>
        
        <div className="payment-result-actions">
          <Link to="/checkout" className="btn btn-primary">
            Try Again
          </Link>
          <Link to="/marketplace" className="btn btn-secondary">
            Back to Marketplace
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PaymentCancelled;
