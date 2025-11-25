import { useMemo, useState } from 'react';
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
import { formatDate, formatNumber, formatStatus } from '../../../utils/format.js';
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

  const [sponsorshipGymFilter, setSponsorshipGymFilter] = useState('all');

  const sponsorshipGymOptions = useMemo(() => {
    const visibleGyms = gymOptions.map((gym) => ({ value: gym.id, label: gym.name ?? 'Unnamed gym' }));
    return [{ value: 'all', label: 'All gyms' }, ...visibleGyms];
  }, [gymOptions]);

  const filteredSponsorships = useMemo(() => {
    if (sponsorshipGymFilter === 'all') {
      return sponsorships;
    }
    return sponsorships.filter((item) => item.id === sponsorshipGymFilter);
  }, [sponsorships, sponsorshipGymFilter]);

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

      <DashboardSection
        title="Active sponsorships"
        className="dashboard-section--span-6"
        action={(
          <select
            className="dashboard-select"
            value={sponsorshipGymFilter}
            onChange={(event) => setSponsorshipGymFilter(event.target.value)}
            aria-label="Filter sponsorships by gym"
          >
            {sponsorshipGymOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )}
      >
        {filteredSponsorships.length ? (
          <div className="owner-plan-grid">
            {filteredSponsorships.map((item) => (
              <article key={item.id} className="owner-plan-card owner-plan-card--sponsorship">
                <header className="owner-plan-card__header">
                  <div>
                    <p className="owner-plan-card__eyebrow">{item.city ?? 'Location pending'}</p>
                    <h4>{item.name}</h4>
                    <small>{formatStatus(item.sponsorship?.tier)}</small>
                  </div>
                  <span className="owner-plan-card__status">
                    {item.sponsorship?.monthlyBudget ? `${formatNumber(item.sponsorship.monthlyBudget)} credits` : 'Custom budget'}
                  </span>
                </header>
                <dl className="owner-plan-card__metrics">
                  <div>
                    <dt>Impressions</dt>
                    <dd>{formatNumber(item.impressions ?? 0)}</dd>
                  </div>
                  <div>
                    <dt>Started</dt>
                    <dd>{formatDate(item.sponsorship?.startDate)}</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>{formatStatus(item.sponsorship?.status ?? item.sponsorship?.tier)}</dd>
                  </div>
                </dl>
                {item.sponsorship?.notes ? (
                  <p className="owner-plan-card__note">{item.sponsorship.notes}</p>
                ) : (
                  <p className="owner-plan-card__note">Keep engagement high by refreshing creatives monthly.</p>
                )}
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            message={sponsorshipGymFilter === 'all'
              ? 'Launch a sponsorship to feature your gym across FitSync.'
              : 'No sponsorship found for this gym.'}
          />
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
