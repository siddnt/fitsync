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

  const subscriptions = subscriptionsResponse?.data?.subscriptions ?? [];
  const invoices = mapInvoices(subscriptions);
  const gymOptions = gymsResponse?.data?.gyms ?? [];
  const plans = monetisationResponse?.data?.listingPlans ?? [];

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
        paymentReference: values.paymentReference?.trim() || undefined,
      };

      const response = await checkoutSubscription(payload).unwrap();

      const paymentReference =
        response?.data?.subscription?.invoices?.[0]?.paymentReference ||
        payload.paymentReference ||
        response?.data?.subscription?._id;

      dispatch(setLastReceipt(paymentReference));
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
      <div className="dashboard-grid">
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
      <div className="dashboard-grid">
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
    <div className="dashboard-grid">
      <DashboardSection title="Activate listing plan">
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

      <DashboardSection title="Active subscriptions">
        {subscriptions.length ? (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Gym</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Renews</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((subscription) => (
                <tr key={subscription.id}>
                  <td>{subscription.gym?.name ?? '—'}</td>
                  <td>{formatStatus(subscription.planCode)}</td>
                  <td>{formatStatus(subscription.status)}</td>
                  <td>{formatDate(subscription.periodEnd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="Subscribe to a marketplace plan to boost visibility." />
        )}
      </DashboardSection>

      <DashboardSection title="Billing history">
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
