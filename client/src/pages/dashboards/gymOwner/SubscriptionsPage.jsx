import { useMemo, useState } from 'react';
import { SubmissionError, reset as resetForm } from 'redux-form';
import { useDispatch } from 'react-redux';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import {
  useGetGymOwnerGymsQuery,
  useGetGymOwnerSubscriptionsQuery,
} from '../../../services/dashboardApi.js';
import {
  useGetMonetisationOptionsQuery,
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
        id: `${subscription.id}-${invoice.paymentReference ?? invoice.paidOn}`,
        gym: subscription.gym?.name ?? '--',
        paidOn: invoice.paidOn,
        amount: {
          amount: invoice.amount,
          currency: invoice.currency ?? subscription.amount?.currency ?? 'INR',
        },
        status: invoice.status,
        paymentReference: invoice.paymentReference ?? '',
        planCode: subscription.planCode,
      })),
    )
    .sort((a, b) => new Date(b.paidOn) - new Date(a.paidOn));

const getDaysRemaining = (dateValue) =>
  Math.max(0, Math.ceil((new Date(dateValue).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

const GymOwnerSubscriptionsPage = () => {
  const dispatch = useDispatch();

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

  const [checkoutSubscription] = useCheckoutListingSubscriptionMutation();

  const subscriptions = useMemo(
    () => subscriptionsResponse?.data?.subscriptions ?? [],
    [subscriptionsResponse?.data?.subscriptions],
  );
  const invoices = useMemo(() => mapInvoices(subscriptions), [subscriptions]);
  const gymOptions = useMemo(
    () => gymsResponse?.data?.gyms ?? [],
    [gymsResponse?.data?.gyms],
  );
  const plans = useMemo(
    () => monetisationResponse?.data?.listingPlans ?? [],
    [monetisationResponse?.data?.listingPlans],
  );

  const [subscriptionGymFilter, setSubscriptionGymFilter] = useState('all');
  const [subscriptionDraft, setSubscriptionDraft] = useState(null);

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

  const initialValues = useMemo(() => ({
    gymId: subscriptionDraft?.gymId ?? (gymOptions.length === 1 ? gymOptions[0].id : ''),
    planCode: subscriptionDraft?.planCode ?? (plans[0]?.planCode ?? ''),
  }), [gymOptions, plans, subscriptionDraft]);

  const subscriptionSummary = useMemo(() => ({
    activePlans: filteredSubscriptions.length,
    autoRenewing: filteredSubscriptions.filter((subscription) => subscription.autoRenew).length,
    paidInvoices: invoices.filter((invoice) => invoice.status === 'paid').length,
    nextRenewal: [...filteredSubscriptions]
      .sort((left, right) => new Date(left.periodEnd) - new Date(right.periodEnd))[0] ?? null,
  }), [filteredSubscriptions, invoices]);

  const isLoading = isSubscriptionsLoading || isGymsLoading || isPlansLoading;
  const isError = isSubscriptionsError || isGymsError || isPlansError;

  const handleRetry = () => {
    refetchSubscriptions();
    refetchGyms();
    refetchPlans();
  };

  const handleCheckout = async (values) => {
    try {
      const payload = {
        gymId: values.gymId,
        planCode: values.planCode,
      };

      const response = await checkoutSubscription(payload).unwrap();

      const paymentReference =
        response?.data?.subscription?.invoices?.[0]?.paymentReference ||
        response?.data?.subscription?._id;

      dispatch(setLastReceipt(paymentReference));
      dispatch(selectPlan(null));
      dispatch(selectGym(null));

      await Promise.all([refetchSubscriptions(), refetchGyms()]);
      dispatch(resetForm('listingSubscription'));
      setSubscriptionDraft(null);
    } catch (error) {
      const message = error?.data?.message ?? 'We could not activate this subscription. Please try again.';
      throw new SubmissionError({ _error: message });
    }
  };

  const handleRenewSubscription = (subscription) => {
    setSubscriptionDraft({
      gymId: subscription.gym?.id ?? '',
      planCode: subscription.planCode,
    });
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
        {gymOptions.length && plans.length ? (
          <>
            {subscriptionDraft ? (
              <div className="dashboard-controls" style={{ marginBottom: '1rem' }}>
                <span className="dashboard-timeframe-label">
                  Renewal preset ready for {gymOptions.find((gym) => gym.id === subscriptionDraft.gymId)?.name ?? 'selected gym'}
                </span>
                <button type="button" className="ghost-button" onClick={() => setSubscriptionDraft(null)}>
                  Clear preset
                </button>
              </div>
            ) : null}
            <ListingSubscriptionForm
              onSubmit={handleCheckout}
              gymOptions={gymOptions}
              plans={plans}
              initialValues={initialValues}
            />
          </>
        ) : (
          <EmptyState message="Add a gym and ensure plans are available to activate a subscription." />
        )}
      </DashboardSection>

      <DashboardSection title="Subscription health" className="dashboard-section--span-12">
        <div className="stat-grid">
          <div className="stat-card">
            <small>Active plans</small>
            <strong>{subscriptionSummary.activePlans}</strong>
            <small>Visible in the current filter</small>
          </div>
          <div className="stat-card">
            <small>Auto renew enabled</small>
            <strong>{subscriptionSummary.autoRenewing}</strong>
            <small>Plans that renew without manual checkout</small>
          </div>
          <div className="stat-card">
            <small>Paid invoices</small>
            <strong>{subscriptionSummary.paidInvoices}</strong>
            <small>Successful listing-plan billing records</small>
          </div>
          <div className="stat-card">
            <small>Next renewal point</small>
            <strong>{subscriptionSummary.nextRenewal ? formatDate(subscriptionSummary.nextRenewal.periodEnd) : '--'}</strong>
            <small>{subscriptionSummary.nextRenewal?.gym?.name ?? 'No active plans selected'}</small>
          </div>
        </div>
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
                      <dt>Auto renew</dt>
                      <dd>{subscription.autoRenew ? 'Enabled' : 'Manual'}</dd>
                    </div>
                    <div>
                      <dt>Ends</dt>
                      <dd>{formatDate(subscription.periodEnd)}</dd>
                    </div>
                    <div>
                      <dt>Days left</dt>
                      <dd>{getDaysRemaining(subscription.periodEnd)}</dd>
                    </div>
                  </dl>
                  <p className="owner-plan-card__note">
                    {subscription.invoices?.length ?? 0} invoice{(subscription.invoices?.length ?? 0) === 1 ? '' : 's'} on file
                    {latestInvoice?.paymentReference ? ` | Ref ${latestInvoice.paymentReference}` : ''}
                  </p>
                  {latestInvoice ? (
                    <details className="owner-plan-card__details">
                      <summary>Latest invoice</summary>
                      <p>
                        {formatDate(latestInvoice.paidOn)} | {formatCurrency(latestInvoiceAmount)} | {formatStatus(latestInvoice.status)}
                      </p>
                      {latestInvoice.paymentReference ? <p>Payment reference: {latestInvoice.paymentReference}</p> : null}
                    </details>
                  ) : null}
                  <div className="dashboard-card-link-row">
                    <button type="button" className="ghost-button" onClick={() => handleRenewSubscription(subscription)}>
                      Renew this plan
                    </button>
                  </div>
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
                <th>Reference</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td>{formatDate(invoice.paidOn)}</td>
                  <td>{invoice.gym}</td>
                  <td>{formatCurrency(invoice.amount)}</td>
                  <td>{formatStatus(invoice.status)}</td>
                  <td>{invoice.paymentReference || '--'}</td>
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
