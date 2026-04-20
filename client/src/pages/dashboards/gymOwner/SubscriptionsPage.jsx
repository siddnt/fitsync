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
import PaginationBar from '../../../ui/PaginationBar.jsx';
import '../Dashboard.css';

const mapInvoices = (subscriptions = []) =>
  subscriptions
    .flatMap((subscription) =>
      (subscription.invoices ?? []).map((invoice) => ({
        id: `${subscription.id}-${invoice.paymentReference ?? invoice.paidOn ?? 'invoice'}-${invoice.amount ?? 0}`,
        gym: subscription.gym?.name ?? '—',
        paidOn: invoice.paidOn,
        amount: {
          amount: invoice.amount,
          currency: invoice.currency ?? subscription.amount?.currency ?? 'INR',
        },
        status: invoice.status,
        receiptUrl: invoice.receiptUrl ?? null,
      })),
    )
    .sort((a, b) => new Date(b.paidOn) - new Date(a.paidOn));

const GymOwnerSubscriptionsPage = () => {
  const dispatch = useDispatch();
  const [subPage, setSubPage] = useState(1);
  const [invPage, setInvPage] = useState(1);

  const {
    data: subscriptionsResponse,
    isLoading: isSubscriptionsLoading,
    isError: isSubscriptionsError,
    refetch: refetchSubscriptions,
  } = useGetGymOwnerSubscriptionsQuery({ page: subPage });

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

  const subscriptions = subscriptionsResponse?.data?.subscriptions ?? [];
  const subPagination = subscriptionsResponse?.data?.pagination ?? {};
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
    if (subscriptionGymFilter === 'all') return subscriptions;
    return subscriptions.filter((subscription) => subscription.gym?.id === subscriptionGymFilter);
  }, [subscriptions, subscriptionGymFilter]);

  // Server-side pagination meta for subscriptions
  const subTotalPages = subPagination.totalPages ?? 1;
  const subTotal = subPagination.total ?? filteredSubscriptions.length;
  const subStart = (subPage - 1) * (subPagination.limit ?? 10) + 1;
  const subEnd = Math.min(subPage * (subPagination.limit ?? 10), subTotal);
  const pagedSubscriptions = filteredSubscriptions; // server already sliced

  // Invoices are derived from current page subscriptions — paginate client-side
  const invTotalPages = Math.ceil(invoices.length / 10) || 1;
  const invTotal = invoices.length;
  const invStart = (invPage - 1) * 10 + 1;
  const invEnd = Math.min(invPage * 10, invTotal);
  const pagedInvoices = invoices.slice((invPage - 1) * 10, invPage * 10);

  const initialValues = {
    gymId: gymOptions.length === 1 ? gymOptions[0].id : '',
    planCode: plans[0]?.planCode ?? '',
    autoRenew: true,
  };

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
        autoRenew: Boolean(values.autoRenew),
      };

      const response = await checkoutSubscription(payload).unwrap();

      if (response?.data?.checkoutUrl) {
        window.location.href = response.data.checkoutUrl;
        return;
      }

      dispatch(setLastReceipt(response?.data?.subscription?._id ?? null));
      dispatch(selectPlan(null));
      dispatch(selectGym(null));

      await Promise.all([refetchSubscriptions(), refetchGyms()]);
      dispatch(resetForm('listingSubscription'));
    } catch (error) {
      const message = error?.data?.message ?? 'We could not activate this subscription. Please try again.';
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
          <>
            <div className="owner-plan-grid">
              {pagedSubscriptions.map((subscription) => {
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
            <PaginationBar page={subPage} totalPages={subTotalPages} totalItems={subTotal} startIndex={subStart} endIndex={subEnd} onPage={setSubPage} />
          </>
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
          <div className="admin-table-wrapper">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th style={{ width: '130px' }}>Date</th>
                  <th style={{ width: '25%' }}>Gym</th>
                  <th style={{ width: '100px' }}>Amount</th>
                  <th style={{ width: '150px' }}>Status</th>
                  <th style={{ width: '130px' }}>Receipt</th>
                </tr>
              </thead>
              <tbody>
                {pagedInvoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>{formatDate(invoice.paidOn)}</td>
                    <td>{invoice.gym}</td>
                    <td>{formatCurrency(invoice.amount)}</td>
                    <td>{formatStatus(invoice.status)}</td>
                    <td>
                      {invoice.receiptUrl ? (
                        <a href={invoice.receiptUrl} target="_blank" rel="noopener noreferrer">
                          Download
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <PaginationBar page={invPage} totalPages={invTotalPages} totalItems={invTotal} startIndex={invStart} endIndex={invEnd} onPage={setInvPage} />
          </div>
        ) : (
          <EmptyState message="Invoices will appear after your first billing cycle." />
        )}
      </DashboardSection>
    </div>
  );
};

export default GymOwnerSubscriptionsPage;
