import { Link, useSearchParams } from 'react-router-dom';
import '../marketplace/CheckoutPage.css';

const getFlowConfig = (flow, gymId) => {
  if (flow === 'gym-membership') {
    return {
      title: 'Membership payment cancelled',
      message: 'Your Stripe test checkout was cancelled before the membership was activated.',
      primaryLink: gymId ? `/gyms/${gymId}` : '/gyms',
      primaryLabel: gymId ? 'Return to gym' : 'Browse gyms',
      secondaryLink: '/dashboard/trainee',
      secondaryLabel: 'Open dashboard',
    };
  }

  if (flow === 'listing-subscription') {
    return {
      title: 'Subscription payment cancelled',
      message: 'Your listing subscription was not activated because the Stripe test checkout was cancelled.',
      primaryLink: '/dashboard/gym-owner/subscriptions',
      primaryLabel: 'Return to subscriptions',
      secondaryLink: '/dashboard/gym-owner',
      secondaryLabel: 'Open dashboard',
    };
  }

  if (flow === 'gym-sponsorship') {
    return {
      title: 'Sponsorship payment cancelled',
      message: 'Your sponsorship package was not activated because the Stripe test checkout was cancelled.',
      primaryLink: '/dashboard/gym-owner/sponsorship',
      primaryLabel: 'Return to sponsorships',
      secondaryLink: '/dashboard/gym-owner/analytics',
      secondaryLabel: 'Open analytics',
    };
  }

  return {
    title: 'Payment cancelled',
    message: 'The Stripe test checkout was cancelled before anything was activated.',
    primaryLink: '/',
    primaryLabel: 'Return home',
    secondaryLink: '/dashboard',
    secondaryLabel: 'Open dashboard',
  };
};

const PaymentCancelPage = () => {
  const [searchParams] = useSearchParams();
  const flow = String(searchParams.get('flow') || '').trim().toLowerCase();
  const gymId = String(searchParams.get('gymId') || '').trim();
  const flowConfig = getFlowConfig(flow, gymId);

  return (
    <div className="checkout-page">
      <header>
        <h1>{flowConfig.title}</h1>
        <p>No charges were recorded in this cancelled Stripe test checkout.</p>
      </header>
      <div className="checkout-cancel">
        <p className="checkout-cancel__message">
          {flowConfig.message}
        </p>
        <div className="checkout-cancel__actions">
          <Link to={flowConfig.primaryLink} className="btn btn-primary">
            {flowConfig.primaryLabel}
          </Link>
          <Link to={flowConfig.secondaryLink} className="btn btn-secondary">
            {flowConfig.secondaryLabel}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PaymentCancelPage;
