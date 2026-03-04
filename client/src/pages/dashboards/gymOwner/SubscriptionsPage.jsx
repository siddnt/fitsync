import { useEffect, useMemo, useRef, useState } from 'react';
import { SubmissionError } from 'redux-form';
import { useDispatch } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import {
  useGetGymOwnerGymsQuery,
  useGetGymOwnerSubscriptionsQuery,
} from '../../../services/dashboardApi.js';
import {
  useGetMonetisationOptionsQuery,
  useCreateListingStripeCheckoutSessionMutation,
  useConfirmOwnerPaymentSessionMutation,
  useCheckoutListingSubscriptionMutation,
} from '../../../services/ownerApi.js';
import ListingSubscriptionForm from '../../../features/monetisation/ListingSubscriptionForm.jsx';
import { setLastReceipt, selectPlan, selectGym } from '../../../features/monetisation/monetisationSlice.js';
import { formatCurrency, formatDate, formatStatus } from '../../../utils/format.js';
import '../Dashboard.css';

const mapInvoices = (subscriptions = []) =>
  subscriptions
    .flatMap((subscription) =>
      (subscription.invoices ?? []).map((invoice) => ({
        id: `${subscription.id}-${invoice.paidOn}`,
        gym: subscription.gym?.name ?? '—',
        paidOn: invoice.paidOn,
        amount: {
          amount: invoice.amount,
          currency: invoice.currency ?? subscription.amount?.currency ?? 'INR',
        },
        status: invoice.status,
      })),
    )
    .sort((a, b) => new Date(b.paidOn) - new Date(a.paidOn));

const GymOwnerSubscriptionsPage = () => {
  const dispatch = useDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const processedSessionRef = useRef(null);
  const [stripeNotice, setStripeNotice] = useState(null);

  const {
    data: subscriptionsResponse,
    isLoading: isSubscriptionsLoading,
    isError: isSubscriptionsError,
    refetch: refetchSubscriptions,
  } = useGetGymOwnerSubscriptionsQuery();

  const {
    data: gymsResponse,
    isLoading: isGymsLoading,
    isError: isGymsError,
    refetch: refetchGyms,
  } = useGetGymOwnerGymsQuery();

  const {
    data: monetisationResponse,
    isLoading: isPlansLoading,
    isError: isPlansError,
    refetch: refetchPlans,
  } = useGetMonetisationOptionsQuery();

  const [createStripeCheckoutSession] = useCreateListingStripeCheckoutSessionMutation();
  const [confirmOwnerPaymentSession] = useConfirmOwnerPaymentSessionMutation();
  const [checkoutListingSubscription] = useCheckoutListingSubscriptionMutation();

  const subscriptions = subscriptionsResponse?.data?.subscriptions ?? [];
  const invoices = mapInvoices(subscriptions);
  const gymOptions = gymsResponse?.data?.gyms ?? [];
  const plans = monetisationResponse?.data?.listingPlans ?? [];

  const [subscriptionGymFilter, setSubscriptionGymFilter] = useState('all');

  const subscriptionGymOptions = useMemo(() => {
    const unique = new Map();
    subscriptions.forEach((subscription) => {
      const gymId = subscription.gym?.id;
      if (gymId && !unique.has(gymId)) {
        unique.set(gymId, subscription.gym?.name ?? 'Unnamed gym');
      }
    });
    const entries = Array.from(unique.entries()).map(([value, label]) => ({ value, label }));
    return [{ value: 'all', label: 'All gyms' }, ...entries];
  }, [subscriptions]);

  const filteredSubscriptions = useMemo(() => {
    if (subscriptionGymFilter === 'all') {
      return subscriptions;
    }
    return subscriptions.filter((subscription) => subscription.gym?.id === subscriptionGymFilter);
  }, [subscriptions, subscriptionGymFilter]);

  const initialValues = {
    gymId: gymOptions.length === 1 ? gymOptions[0].id : '',
    planCode: plans[0]?.planCode ?? '',
    autoRenew: true,
  };

  const isLoading = isSubscriptionsLoading || isGymsLoading || isPlansLoading;
  const isError = isSubscriptionsError || isGymsError || isPlansError;
  const stripeStatus = searchParams.get('stripe');
  const paymentSessionId = searchParams.get('payment_session_id');
  const stripeSessionId = searchParams.get('session_id');

  const handleRetry = () => {
    refetchSubscriptions();
    refetchGyms();
    refetchPlans();
  };

  useEffect(() => {
    const clearStripeQuery = () => {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('stripe');
      nextParams.delete('payment_session_id');
      nextParams.delete('session_id');
      setSearchParams(nextParams, { replace: true });
    };

    if (!stripeStatus) {
      processedSessionRef.current = null;
      return;
    }

    if (stripeStatus === 'cancelled') {
      setStripeNotice('Stripe checkout was cancelled. No changes were made.');
      clearStripeQuery();
      return;
    }

    if (stripeStatus !== 'success' || !paymentSessionId) {
      clearStripeQuery();
      return;
    }

    if (processedSessionRef.current === paymentSessionId) {
      return;
    }
    processedSessionRef.current = paymentSessionId;

    const confirmPayment = async () => {
      try {
        const response = await confirmOwnerPaymentSession({
          paymentSessionId,
          sessionId: stripeSessionId || undefined,
        }).unwrap();

        const reference =
          response?.data?.paymentReference ||
          response?.data?.subscription?.invoices?.[0]?.paymentReference ||
          null;

        if (reference) {
          dispatch(setLastReceipt(reference));
        }

        setStripeNotice('Payment successful. Subscription activated.');
        await Promise.all([refetchSubscriptions(), refetchGyms()]);
      } catch (error) {
        const message = error?.data?.message ?? 'Payment completed, but confirmation failed. Please refresh and retry.';
        setStripeNotice(message);
      } finally {
        clearStripeQuery();
      }
    };

    confirmPayment();
  }, [
    stripeStatus,
    paymentSessionId,
    stripeSessionId,
    confirmOwnerPaymentSession,
    dispatch,
    refetchSubscriptions,
    refetchGyms,
    searchParams,
    setSearchParams,
  ]);

  const handleCheckout = async (values) => {
    try {
      const payload = {
        gymId: values.gymId,
        planCode: values.planCode,
        autoRenew: Boolean(values.autoRenew),
      };

      const response = await createStripeCheckoutSession(payload).unwrap();
      const checkoutUrl = response?.data?.checkoutUrl;

      if (!checkoutUrl) {
        throw new Error('Missing Stripe checkout URL.');
      }

      dispatch(selectPlan(null));
      dispatch(selectGym(null));
      window.location.assign(checkoutUrl);
    } catch (error) {
      if (error?.status === 503) {
        try {
          const fallbackReference = `manual-${Date.now()}`;
          const response = await checkoutListingSubscription({
            gymId: values.gymId,
            planCode: values.planCode,
            autoRenew: Boolean(values.autoRenew),
            paymentReference: fallbackReference,
          }).unwrap();

          const reference =
            response?.data?.subscription?.invoices?.[0]?.paymentReference ||
            fallbackReference;

          dispatch(setLastReceipt(reference));
          setStripeNotice('Stripe is unavailable; subscription activated with manual fallback.');
          await Promise.all([refetchSubscriptions(), refetchGyms()]);
          return;
        } catch (fallbackError) {
          const fallbackMessage = fallbackError?.data?.message ?? 'Unable to activate this subscription.';
          throw new SubmissionError({ _error: fallbackMessage });
        }
      }

      const message = error?.data?.message ?? error?.message ?? 'Unable to start Stripe checkout. Please try again.';
      throw new SubmissionError({ _error: message });
    }
  };

  if (isLoading) {
    return (
      <div className="dashboard-grid dashboard-grid--owner">
        {['Activate listing plan', 'Active subscriptions', 'Billing history'].map((title) => (
          <DashboardSection key={title} title={title}>
            <SkeletonPanel lines={6} />
          </DashboardSection>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="dashboard-grid dashboard-grid--owner">
        <DashboardSection
          title="Subscriptions unavailable"
          action={<button type="button" onClick={handleRetry}>Retry</button>}
        >
          <EmptyState message="We could not fetch your subscriptions or plans." />
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="dashboard-grid dashboard-grid--owner">
      <DashboardSection title="Activate listing plan" className="dashboard-section--span-12">
        {stripeNotice ? <p className="form-success">{stripeNotice}</p> : null}
        {gymOptions.length && plans.length ? (
          <ListingSubscriptionForm
            onSubmit={handleCheckout}
            gymOptions={gymOptions}
            plans={plans}
            initialValues={initialValues}
          />
        ) : (
          <EmptyState message="Add a gym and ensure plans are available to activate a subscription." />
        )}
      </DashboardSection>

      <DashboardSection
        title="Active subscriptions"
        className="dashboard-section--span-6"
        action={(
          <select
            className="dashboard-select"
            value={subscriptionGymFilter}
            onChange={(event) => setSubscriptionGymFilter(event.target.value)}
            aria-label="Filter subscriptions by gym"
          >
            {subscriptionGymOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )}
      >
        {filteredSubscriptions.length ? (
          <div className="owner-plan-grid">
            {filteredSubscriptions.map((subscription) => {
              const latestInvoice = [...(subscription.invoices ?? [])]
                .sort((a, b) => new Date(b.paidOn) - new Date(a.paidOn))[0];
              const statusSlug = (subscription.status || 'active')
                .toString()
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-');
              const latestInvoiceAmount = latestInvoice
                ? {
                    amount: latestInvoice.amount,
                    currency: latestInvoice.currency ?? subscription.amount?.currency ?? 'INR',
                  }
                : null;
              return (
                <article key={subscription.id} className="owner-plan-card">
                  <header className="owner-plan-card__header">
                    <div>
                      <p className="owner-plan-card__eyebrow">{subscription.gym?.city ?? 'Location pending'}</p>
                      <h4>{subscription.gym?.name ?? 'Unnamed gym'}</h4>
                      <small>{formatStatus(subscription.planCode)}</small>
                    </div>
                    <span className={`owner-plan-card__status owner-plan-card__status--${statusSlug}`}>
                      {formatStatus(subscription.status)}
                    </span>
                  </header>
                  <dl className="owner-plan-card__metrics">
                    <div>
                      <dt>Billing</dt>
                      <dd>{formatCurrency(subscription.amount)}</dd>
                    </div>
                    <div>
                      <dt>Renews</dt>
                      <dd>{formatDate(subscription.periodEnd)}</dd>
                    </div>
                    <div>
                      <dt>Auto-renew</dt>
                      <dd>{subscription.autoRenew ? 'On' : 'Off'}</dd>
                    </div>
                  </dl>
                  {latestInvoice ? (
                    <details className="owner-plan-card__details">
                      <summary>Latest invoice</summary>
                      <p>
                        {formatDate(latestInvoice.paidOn)} · {formatCurrency(latestInvoiceAmount)} · {formatStatus(latestInvoice.status)}
                      </p>
                    </details>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            message={subscriptionGymFilter === 'all'
              ? 'Subscribe to a marketplace plan to boost visibility.'
              : 'No subscriptions found for this gym.'}
          />
        )}
      </DashboardSection>

      <DashboardSection title="Billing history" className="dashboard-section--span-6">
        {invoices.length ? (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Gym</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td>{formatDate(invoice.paidOn)}</td>
                  <td>{invoice.gym}</td>
                  <td>{formatCurrency(invoice.amount)}</td>
                  <td>{formatStatus(invoice.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="Invoices will appear after your first billing cycle." />
        )}
      </DashboardSection>
    </div>
  );
};

export default GymOwnerSubscriptionsPage;
