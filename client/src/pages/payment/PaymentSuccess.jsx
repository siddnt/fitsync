import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useVerifySessionMutation } from '../../services/paymentApi.js';
import './PaymentSuccess.css';

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [verifySession] = useVerifySessionMutation();
  const [status, setStatus] = useState('loading');
  const [receiptUrl, setReceiptUrl] = useState(null);
  const [contextUrl, setContextUrl] = useState('/');

  useEffect(() => {
    if (!sessionId) {
      setStatus('error');
      return;
    }

    let mounted = true;

    const verify = async () => {
      try {
        const response = await verifySession({ sessionId }).unwrap();
        if (!mounted) return;

        if (response?.data?.status === 'paid') {
          setStatus('success');
          setReceiptUrl(response.data.receiptUrl);

          const type = response.data.metadata?.type;
          const source = response.data.metadata?.source;
          if (type === 'marketplace') setContextUrl('/marketplace');
          else if (type === 'gym_membership') setContextUrl('/dashboard');
          else if (type === 'listing_subscription' && source === 'gym-create') setContextUrl('/dashboard/gym-owner/gyms');
          else if (type === 'listing_subscription') setContextUrl('/dashboard/gym-owner/subscriptions');
          else if (type === 'sponsorship') setContextUrl('/dashboard/gym-owner/sponsorship');
        } else {
          setStatus('error');
        }
      } catch (err) {
        if (!mounted) return;
        setStatus('error');
      }
    };

    verify();

    return () => {
      mounted = false;
    };
  }, [sessionId, verifySession]);

  if (status === 'loading') {
    return (
      <div className="payment-success-page">
        <div className="payment-card">
          <div className="payment-spinner" />
          <h2>Verifying payment...</h2>
          <p>Please wait while we confirm your payment with our secure provider.</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="payment-success-page">
        <div className="payment-card payment-error">
          <h2>Payment issue</h2>
          <p>We could not verify your payment at this time. If you were charged, please contact support.</p>
          <Link to="/" className="payment-btn">Return home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="payment-success-page">
      <div className="payment-card payment-done">
        <h2 className="success-title">Payment successful!</h2>
        <p>Your transaction has been securely processed. Thank you for using FitSync.</p>
        
        <div className="payment-actions">
          {receiptUrl ? (
            <a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="payment-btn payment-btn--outline">
              Download Receipt
            </a>
          ) : null}
          <Link to={contextUrl} className="payment-btn">
            Continue to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
