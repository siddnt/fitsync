import { SubmissionError, reset as resetForm } from 'redux-form';
import { useDispatch } from 'react-redux';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import {
  useGetGymOwnerGymsQuery,
  useGetGymOwnerSponsorshipsQuery,
} from '../../../services/dashboardApi.js';
import {
  useGetMonetisationOptionsQuery,
  usePurchaseSponsorshipMutation,
} from '../../../services/ownerApi.js';
import SponsorshipForm from '../../../features/monetisation/SponsorshipForm.jsx';
import { setLastReceipt, selectGym, selectSponsorshipTier } from '../../../features/monetisation/monetisationSlice.js';
import { formatNumber, formatStatus } from '../../../utils/format.js';
import '../Dashboard.css';

const GymOwnerSponsorshipPage = () => {
  const dispatch = useDispatch();

  const {
    data: sponsorshipResponse,
    isLoading: isSponsorshipLoading,
    isError: isSponsorshipError,
    refetch: refetchSponsorships,
  } = useGetGymOwnerSponsorshipsQuery();

  const {
    data: gymsResponse,
    isLoading: isGymsLoading,
    isError: isGymsError,
    refetch: refetchGyms,
  } = useGetGymOwnerGymsQuery();

  const {
    data: monetisationResponse,
    isLoading: isPackagesLoading,
    isError: isPackagesError,
    refetch: refetchPackages,
  } = useGetMonetisationOptionsQuery();

  const [purchaseSponsorship] = usePurchaseSponsorshipMutation();

  const sponsorships = sponsorshipResponse?.data?.sponsorships ?? [];
  const gymOptions = gymsResponse?.data?.gyms ?? [];
  const packages = monetisationResponse?.data?.sponsorshipPackages ?? [];

  const isLoading = isSponsorshipLoading || isGymsLoading || isPackagesLoading;
  const isError = isSponsorshipError || isGymsError || isPackagesError;

  const initialValues = {
    gymId: gymOptions.length === 1 ? gymOptions[0].id : '',
    tier: packages[0]?.tier ?? '',
  };

  const handlePurchase = async (values) => {
    try {
      const payload = {
        gymId: values.gymId,
        tier: values.tier,
        paymentReference: values.paymentReference?.trim() || undefined,
      };

      const response = await purchaseSponsorship(payload).unwrap();

      const paymentReference =
        response?.data?.sponsorship?.paymentReference ||
        payload.paymentReference ||
        `${payload.tier}-${payload.gymId}`;

      dispatch(setLastReceipt(paymentReference));
      dispatch(selectSponsorshipTier(null));
      dispatch(selectGym(null));

      await Promise.all([refetchSponsorships(), refetchGyms()]);
      dispatch(resetForm('sponsorshipPurchase'));
    } catch (error) {
      const message = error?.data?.message ?? 'We could not activate this sponsorship. Please try again.';
      throw new SubmissionError({ _error: message });
    }
  };

  const handleRetry = () => {
    refetchSponsorships();
    refetchGyms();
    refetchPackages();
  };

  if (isLoading) {
    return (
      <div className="dashboard-grid dashboard-grid--owner">
        {['Launch sponsorship', 'Active sponsorships', 'Opportunities'].map((title) => (
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
          title="Sponsorship data unavailable"
          action={<button type="button" onClick={handleRetry}>Retry</button>}
        >
          <EmptyState message="We could not fetch sponsorship data." />
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="dashboard-grid dashboard-grid--owner">
      <DashboardSection title="Launch sponsorship" className="dashboard-section--span-12">
        {gymOptions.length && packages.length ? (
          <SponsorshipForm
            onSubmit={handlePurchase}
            gymOptions={gymOptions}
            packages={packages}
            initialValues={initialValues}
          />
        ) : (
          <EmptyState message="Add a gym and ensure packages are available to launch sponsorships." />
        )}
      </DashboardSection>

      <DashboardSection title="Active sponsorships" className="dashboard-section--span-6">
        {sponsorships.length ? (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Gym</th>
                <th>Tier</th>
                <th>Budget</th>
                <th>Impressions</th>
              </tr>
            </thead>
            <tbody>
              {sponsorships.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{formatStatus(item.sponsorship?.tier)}</td>
                  <td>{item.sponsorship?.monthlyBudget ? `${formatNumber(item.sponsorship.monthlyBudget)} credits` : '—'}</td>
                  <td>{formatNumber(item.impressions ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="Launch a sponsorship to feature your gym across FitSync." />
        )}
      </DashboardSection>

      <DashboardSection title="Opportunities" className="dashboard-section--span-6">
        {gymOptions.length ? (
          <ul>
            {gymOptions.map((gym) => {
              const active = sponsorships.find((s) => s.id === gym.id);
              if (active) {
                return (
                  <li key={`${gym.id}-active`}>Keep {gym.name} in the spotlight with {formatStatus(active.sponsorship?.tier)} tier placements.</li>
                );
              }

              const recommendedTier = packages.find((pkg) => pkg.tier === 'gold') ?? packages[0];
              return (
                <li key={`${gym.id}-recommendation`}>
                  Upgrade {gym.name} with the {recommendedTier?.label ?? 'recommended'} package to convert {formatNumber(gym.analytics?.impressions ?? 0)} weekly impressions.
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState message="We will recommend opportunities once your gyms gather traffic." />
        )}
      </DashboardSection>
    </div>
  );
};

export default GymOwnerSponsorshipPage;
