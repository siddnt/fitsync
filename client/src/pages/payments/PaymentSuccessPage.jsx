import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAppDispatch } from '../../app/hooks.js';
import { apiSlice } from '../../services/apiSlice.js';
import { useGetPaymentCheckoutSessionResultQuery } from '../../services/paymentsApi.js';
import { formatCurrency, formatDate, formatNumber, formatStatus } from '../../utils/format.js';
import '../marketplace/CheckoutPage.css';

const MAX_POLLS = 12;
const POLL_INTERVAL_MS = 5000;

const getFlowConfig = (flow, gymId) => {
  if (flow === 'gym-membership') {
    return {
      title: 'Membership payment confirmed',
      loadingTitle: 'Verifying your membership...',
      pendingTitle: 'We are still confirming your membership',
      primaryLink: gymId ? `/gyms/${gymId}` : '/gyms',
      primaryLabel: gymId ? 'Return to gym' : 'Browse gyms',
      secondaryLink: '/dashboard/trainee',
      secondaryLabel: 'Open dashboard',
    };
  }

  if (flow === 'listing-subscription') {
    return {
      title: 'Listing subscription confirmed',
      loadingTitle: 'Verifying your listing subscription...',
      pendingTitle: 'We are still confirming your subscription',
      primaryLink: '/dashboard/gym-owner/subscriptions',
      primaryLabel: 'Open subscriptions',
      secondaryLink: '/dashboard/gym-owner',
      secondaryLabel: 'Open dashboard',
    };
  }

  if (flow === 'gym-sponsorship') {
    return {
      title: 'Sponsorship payment confirmed',
      loadingTitle: 'Verifying your sponsorship...',
      pendingTitle: 'We are still confirming your sponsorship',
      primaryLink: '/dashboard/gym-owner/sponsorship',
      primaryLabel: 'Open sponsorships',
      secondaryLink: '/dashboard/gym-owner/analytics',
      secondaryLabel: 'Open analytics',
    };
  }

  return {
    title: 'Payment confirmed',
    loadingTitle: 'Verifying your payment...',
    pendingTitle: 'We are still confirming your payment',
    primaryLink: '/',
    primaryLabel: 'Return home',
    secondaryLink: '/dashboard',
    secondaryLabel: 'Open dashboard',
  };
};

const PaymentSuccessPage = () => {
  const [searchParams] = useSearchParams();
  const dispatch = useAppDispatch();
  const sessionId = searchParams.get('session_id');
  const flow = String(searchParams.get('flow') || '').trim().toLowerCase();
  const gymId = String(searchParams.get('gymId') || '').trim();
  const flowConfig = useMemo(() => getFlowConfig(flow, gymId), [flow, gymId]);
  const [paymentResult, setPaymentResult] = useState(null);
  const [fetchError, setFetchError] = useState(
    sessionId ? null : 'Missing payment session. You can check the related dashboard section instead.',
  );
  const [pollCount, setPollCount] = useState(0);

  const {
    data: paymentResponse,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useGetPaymentCheckoutSessionResultQuery(sessionId, {
    skip: !sessionId || !!paymentResult,
    refetchOnMountOrArgChange: true,
  });

  const resolvedPayload = paymentResponse?.data?.membership
    || paymentResponse?.data?.subscription
    || paymentResponse?.data?.sponsorship
    || null;
  const responseStatus = Number(paymentResponse?.statusCode ?? 0);
  const responseMessage = String(paymentResponse?.message ?? '');
  const isPendingResponse = !resolvedPayload
    && paymentResponse?.success === false
    && responseStatus === 202;
  const isRetryableError = error?.status === 404 || error?.status === 202;
  const shouldPoll = Boolean(sessionId)
    && !paymentResult
    && (isPendingResponse || isRetryableError)
    && pollCount < MAX_POLLS;

  useEffect(() => {
    if (resolvedPayload) {
      setPaymentResult(paymentResponse.data);
      setFetchError(null);
      return;
    }

    if (!sessionId) {
      setFetchError('Missing payment session. You can check the related dashboard section instead.');
      return;
    }

    if (shouldPoll) {
      setFetchError(null);
      const timer = setTimeout(() => {
        setPollCount((prev) => prev + 1);
        refetch();
      }, POLL_INTERVAL_MS);
      return () => clearTimeout(timer);
    }

    if (isPendingResponse && pollCount >= MAX_POLLS) {
      setFetchError('Payment processing is taking longer than expected. Please retry from the related dashboard section.');
      return;
    }

    if (error) {
      setFetchError(error?.data?.message || 'Unable to load payment details right now.');
      return;
    }

    if (paymentResponse?.success === false) {
      setFetchError(responseMessage || 'Unable to load payment details right now.');
    }
  }, [
    error,
    isPendingResponse,
    paymentResponse,
    pollCount,
    refetch,
    resolvedPayload,
    responseMessage,
    sessionId,
    shouldPoll,
  ]);

  useEffect(() => {
    if (!paymentResult) {
      return;
    }

    if (flow === 'gym-membership') {
      dispatch(apiSlice.util.invalidateTags([
        ...(gymId ? [{ type: 'GymMembership', id: gymId }, { type: 'Gym', id: gymId }] : []),
        { type: 'GymList', id: 'LIST' },
        'Dashboard',
      ]));
      return;
    }

    if (flow === 'listing-subscription') {
      dispatch(apiSlice.util.invalidateTags(['Subscription', 'Dashboard', 'Analytics']));
      return;
    }

    if (flow === 'gym-sponsorship') {
      dispatch(apiSlice.util.invalidateTags(['Dashboard', 'Analytics']));
    }
  }, [dispatch, flow, gymId, paymentResult]);

  const showLoading = !paymentResult && (isLoading || isFetching || shouldPoll);

  if (showLoading) {
    return (
      <div className="checkout-page">
        <div className="checkout-success checkout-success--loading">
          <div className="checkout-success__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          </div>
          <h2>{flowConfig.loadingTitle}</h2>
          <p className="checkout-success__message">
            {pollCount > 0
              ? `Checking payment status... (${Math.min(pollCount * 5, 60)}s)`
              : 'Please wait while we confirm your Stripe test payment.'}
          </p>
          <Link to={flowConfig.primaryLink} className="btn btn-secondary" style={{ marginTop: '1rem' }}>
            {flowConfig.primaryLabel}
          </Link>
        </div>
      </div>
    );
  }

  if (!paymentResult) {
    return (
      <div className="checkout-page">
        <div className="checkout-cancel">
          <h1>{flowConfig.pendingTitle}</h1>
          <p className="checkout-cancel__message">
            {fetchError || 'Unable to load the payment details right now.'}
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
  }

  const membership = paymentResult.membership ?? null;
  const subscription = paymentResult.subscription ?? null;
  const sponsorship = paymentResult.sponsorship ?? null;

  return (
    <div className="checkout-page">
      <div className="checkout-success checkout-success--complete">
        <div className="checkout-success__icon checkout-success__icon--success">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>

        <div className="checkout-success__header">
          <h1>{flowConfig.title}</h1>
          <p className="checkout-success__subtitle">
            Stripe test checkout finished successfully and the related FitSync record is now active.
          </p>
        </div>

        {paymentResult.paymentReference ? (
          <div className="checkout-success__order-number">
            <span className="label">Payment Reference</span>
            <span className="value">{paymentResult.paymentReference}</span>
          </div>
        ) : null}

        {membership ? (
          <>
            <div className="checkout-success__totals">
              <div className="checkout-success__total-row">
                <span>Gym</span>
                <span>{membership.gym?.name || '--'}</span>
              </div>
              <div className="checkout-success__total-row">
                <span>Plan</span>
                <span>{formatStatus(membership.plan)}</span>
              </div>
              <div className="checkout-success__total-row">
                <span>Trainer</span>
                <span>{membership.trainer?.name || '--'}</span>
              </div>
              <div className="checkout-success__total-row checkout-success__total-row--grand">
                <span>Amount paid</span>
                <span>{formatCurrency(membership.billing)}</span>
              </div>
            </div>
            <div className="checkout-success__address">
              <h3>Membership details</h3>
              <p>
                Status: {formatStatus(membership.status)}
                <br />
                Auto renew: {membership.autoRenew ? 'Enabled' : 'Manual'}
                <br />
                Ends on: {membership.endDate ? formatDate(membership.endDate) : '--'}
              </p>
            </div>
          </>
        ) : null}

        {subscription ? (
          <>
            <div className="checkout-success__totals">
              <div className="checkout-success__total-row">
                <span>Gym</span>
                <span>{subscription.gym?.name || '--'}</span>
              </div>
              <div className="checkout-success__total-row">
                <span>Plan</span>
                <span>{formatStatus(subscription.planCode)}</span>
              </div>
              <div className="checkout-success__total-row">
                <span>Status</span>
                <span>{formatStatus(subscription.status)}</span>
              </div>
              <div className="checkout-success__total-row checkout-success__total-row--grand">
                <span>Amount paid</span>
                <span>{formatCurrency(subscription.amount)}</span>
              </div>
            </div>
            <div className="checkout-success__address">
              <h3>Subscription details</h3>
              <p>
                Active until: {subscription.periodEnd ? formatDate(subscription.periodEnd) : '--'}
                <br />
                Auto renew: {subscription.autoRenew ? 'Enabled' : 'Manual'}
                <br />
                Invoices on file: {subscription.invoices?.length ?? 0}
              </p>
            </div>
          </>
        ) : null}

        {sponsorship ? (
          <>
            <div className="checkout-success__totals">
              <div className="checkout-success__total-row">
                <span>Gym</span>
                <span>{sponsorship.gym?.name || '--'}</span>
              </div>
              <div className="checkout-success__total-row">
                <span>Tier</span>
                <span>{formatStatus(sponsorship.sponsorship?.tier)}</span>
              </div>
              <div className="checkout-success__total-row">
                <span>Monthly budget</span>
                <span>{formatCurrency({ amount: sponsorship.sponsorship?.monthlyBudget ?? 0 })}</span>
              </div>
              <div className="checkout-success__total-row checkout-success__total-row--grand">
                <span>Amount paid</span>
                <span>{formatCurrency({ amount: sponsorship.sponsorship?.amount ?? 0 })}</span>
              </div>
            </div>
            <div className="checkout-success__address">
              <h3>Sponsorship details</h3>
              <p>
                Status: {formatStatus(sponsorship.sponsorship?.status)}
                <br />
                Ends on: {sponsorship.sponsorship?.endDate ? formatDate(sponsorship.sponsorship.endDate) : '--'}
                <br />
                Reach included: {formatNumber(sponsorship.sponsorship?.reach ?? 0)}
              </p>
            </div>
          </>
        ) : null}

        <div className="checkout-success__actions">
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

export default PaymentSuccessPage;
