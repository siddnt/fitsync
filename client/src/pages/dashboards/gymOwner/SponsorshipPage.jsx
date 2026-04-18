import { useMemo, useState } from 'react';
import { SubmissionError, reset as resetForm } from 'redux-form';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../app/hooks.js';
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
import { downloadReport } from '../../../utils/reportDownload.js';
import { formatCurrency, formatDate, formatNumber, formatStatus } from '../../../utils/format.js';
import '../Dashboard.css';

const GymOwnerSponsorshipPage = () => {
  const dispatch = useDispatch();
  const accessToken = useAppSelector((state) => state.auth.accessToken);

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

  const sponsorships = useMemo(
    () => sponsorshipResponse?.data?.sponsorships ?? [],
    [sponsorshipResponse?.data?.sponsorships],
  );
  const gymOptions = useMemo(
    () => gymsResponse?.data?.gyms ?? [],
    [gymsResponse?.data?.gyms],
  );
  const packages = useMemo(
    () => monetisationResponse?.data?.sponsorshipPackages ?? [],
    [monetisationResponse?.data?.sponsorshipPackages],
  );

  const [sponsorshipGymFilter, setSponsorshipGymFilter] = useState('all');
  const [reportFormat, setReportFormat] = useState('csv');
  const [isExporting, setIsExporting] = useState(false);
  const [reportNotice, setReportNotice] = useState(null);
  const [reportError, setReportError] = useState(null);
  const [sponsorshipDraft, setSponsorshipDraft] = useState(null);

  const sponsorshipGymOptions = useMemo(() => {
    const visibleGyms = gymOptions.map((gym) => ({ value: gym.id, label: gym.name ?? 'Unnamed gym' }));
    return [{ value: 'all', label: 'All gyms' }, ...visibleGyms];
  }, [gymOptions]);

  const filteredSponsorships = useMemo(() => {
    if (sponsorshipGymFilter === 'all') {
      return sponsorships;
    }
    return sponsorships.filter((item) => item.id === sponsorshipGymFilter);
  }, [sponsorshipGymFilter, sponsorships]);

  const initialValues = useMemo(() => ({
    gymId: sponsorshipDraft?.gymId ?? (gymOptions.length === 1 ? gymOptions[0].id : ''),
    tier: sponsorshipDraft?.tier ?? (packages[0]?.tier ?? ''),
  }), [gymOptions, packages, sponsorshipDraft]);

  const packageComparison = useMemo(
    () => packages.map((pkg) => {
      const activeGymCount = sponsorships.filter((item) => item.sponsorship?.tier === pkg.tier).length;
      return {
        ...pkg,
        activeGymCount,
      };
    }),
    [packages, sponsorships],
  );

  const sponsorshipSummary = useMemo(() => {
    const totalImpressions = filteredSponsorships.reduce((sum, item) => sum + Number(item.impressions30d ?? 0), 0);
    const totalOpens = filteredSponsorships.reduce((sum, item) => sum + Number(item.opens30d ?? 0), 0);
    const totalJoins = filteredSponsorships.reduce((sum, item) => sum + Number(item.joins30d ?? 0), 0);
    const averageReachUtilization = filteredSponsorships.length
      ? Math.round(filteredSponsorships.reduce((sum, item) => sum + Number(item.reachUtilization30d ?? 0), 0) / filteredSponsorships.length)
      : 0;

    return {
      activeCount: filteredSponsorships.length,
      totalImpressions,
      totalOpens,
      totalJoins,
      averageReachUtilization,
    };
  }, [filteredSponsorships]);

  const handlePurchase = async (values) => {
    try {
      const payload = {
        gymId: values.gymId,
        tier: values.tier,
      };

      const response = await purchaseSponsorship(payload).unwrap();

      const paymentReference =
        response?.data?.sponsorship?.paymentReference ||
        `${payload.tier}-${payload.gymId}`;

      dispatch(setLastReceipt(paymentReference));
      dispatch(selectSponsorshipTier(null));
      dispatch(selectGym(null));

      await Promise.all([refetchSponsorships(), refetchGyms()]);
      dispatch(resetForm('sponsorshipPurchase'));
      setSponsorshipDraft(null);
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

  const handleExportSponsorships = async () => {
    setReportNotice(null);
    setReportError(null);
    setIsExporting(true);

    try {
      await downloadReport({
        path: '/dashboards/gym-owner/sponsorships/export',
        token: accessToken,
        format: reportFormat,
        params: sponsorshipGymFilter === 'all' ? {} : { gymId: sponsorshipGymFilter },
        fallbackFilename: `gym-owner-sponsorships-report.${reportFormat}`,
      });
      setReportNotice(`Sponsorship report exported as ${reportFormat.toUpperCase()}.`);
    } catch (error) {
      setReportError(error.message || 'Unable to export sponsorship report.');
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrepareSponsorship = (gymId, tier) => {
    setSponsorshipDraft({ gymId, tier });
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const isLoading = isSponsorshipLoading || isGymsLoading || isPackagesLoading;
  const isError = isSponsorshipError || isGymsError || isPackagesError;

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
          <>
            {sponsorshipDraft ? (
              <div className="dashboard-controls" style={{ marginBottom: '1rem' }}>
                <span className="dashboard-timeframe-label">
                  Sponsorship preset ready for {gymOptions.find((gym) => gym.id === sponsorshipDraft.gymId)?.name ?? 'selected gym'}
                  {' | '}
                  {formatStatus(sponsorshipDraft.tier)}
                </span>
                <button type="button" className="ghost-button" onClick={() => setSponsorshipDraft(null)}>
                  Clear preset
                </button>
              </div>
            ) : null}
            <SponsorshipForm
              onSubmit={handlePurchase}
              gymOptions={gymOptions}
              packages={packages}
              initialValues={initialValues}
            />
          </>
        ) : (
          <EmptyState message="Add a gym and ensure packages are available to launch sponsorships." />
        )}
      </DashboardSection>

      <DashboardSection title="Package comparisons" className="dashboard-section--span-12">
        {packageComparison.length ? (
          <div className="owner-plan-grid">
            {packageComparison.map((pkg) => (
              <article key={pkg.tier} className="owner-plan-card owner-plan-card--sponsorship">
                <header className="owner-plan-card__header">
                  <div>
                    <p className="owner-plan-card__eyebrow">Tier comparison</p>
                    <h4>{pkg.label}</h4>
                    <small>{formatStatus(pkg.tier)}</small>
                  </div>
                  <span className="owner-plan-card__status">
                    {formatCurrency({ amount: pkg.amount })}
                  </span>
                </header>
                <dl className="owner-plan-card__metrics">
                  <div>
                    <dt>Monthly budget</dt>
                    <dd>{formatCurrency({ amount: pkg.monthlyBudget })}</dd>
                  </div>
                  <div>
                    <dt>Estimated reach</dt>
                    <dd>{formatNumber(pkg.reach)}</dd>
                  </div>
                  <div>
                    <dt>Active gyms</dt>
                    <dd>{pkg.activeGymCount}</dd>
                  </div>
                </dl>
                <p className="owner-plan-card__note">
                  Use this tier when you need clearer paid reach without relying only on organic gym discovery.
                </p>
                <div className="dashboard-card-link-row">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => handlePrepareSponsorship(gymOptions[0]?.id ?? '', pkg.tier)}
                    disabled={!gymOptions.length}
                  >
                    Use this package
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState message="Sponsorship package options are unavailable right now." />
        )}
      </DashboardSection>

      <DashboardSection
        title="Active sponsorships"
        className="dashboard-section--span-6"
        action={(
          <div className="dashboard-controls">
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
            <select
              className="dashboard-select"
              value={reportFormat}
              onChange={(event) => setReportFormat(event.target.value)}
              aria-label="Sponsorship report format"
            >
              <option value="csv">CSV</option>
              <option value="pdf">PDF</option>
            </select>
            <button
              type="button"
              className="users-toolbar__refresh"
              disabled={isExporting}
              onClick={handleExportSponsorships}
            >
              {isExporting ? 'Exporting...' : 'Export report'}
            </button>
          </div>
        )}
      >
        {reportNotice ? <p className="dashboard-message dashboard-message--success">{reportNotice}</p> : null}
        {reportError ? <p className="dashboard-message dashboard-message--error">{reportError}</p> : null}
        <div className="stat-grid" style={{ marginBottom: '1rem' }}>
          <div className="stat-card">
            <small>Active campaigns</small>
            <strong>{sponsorshipSummary.activeCount}</strong>
            <small>Visible in the current sponsorship filter</small>
          </div>
          <div className="stat-card">
            <small>30-day impressions</small>
            <strong>{formatNumber(sponsorshipSummary.totalImpressions)}</strong>
            <small>{formatNumber(sponsorshipSummary.totalOpens)} gym opens</small>
          </div>
          <div className="stat-card">
            <small>30-day joins</small>
            <strong>{formatNumber(sponsorshipSummary.totalJoins)}</strong>
            <small>Attributed to sponsored gyms in the last 30 days</small>
          </div>
          <div className="stat-card">
            <small>Reach utilization</small>
            <strong>{sponsorshipSummary.averageReachUtilization}%</strong>
            <small>Average 30-day package reach utilization</small>
          </div>
        </div>
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
                    {formatCurrency({ amount: item.sponsorship?.monthlyBudget ?? item.sponsorship?.amount ?? 0 })}
                  </span>
                </header>
                <dl className="owner-plan-card__metrics">
                  <div>
                    <dt>Impressions (30d)</dt>
                    <dd>{formatNumber(item.impressions30d ?? 0)}</dd>
                  </div>
                  <div>
                    <dt>Opens (30d)</dt>
                    <dd>{formatNumber(item.opens30d ?? 0)}</dd>
                  </div>
                  <div>
                    <dt>Joins (30d)</dt>
                    <dd>{formatNumber(item.joins30d ?? 0)}</dd>
                  </div>
                  <div>
                    <dt>Cost / join</dt>
                    <dd>{item.spendPerJoin ? formatCurrency({ amount: item.spendPerJoin }) : '--'}</dd>
                  </div>
                </dl>
                <p className="owner-plan-card__note">
                  {formatStatus(item.sponsorship?.tier)} tier drove {item.openToJoinRate30d ?? 0}% open-to-join conversion and used {item.reachUtilization30d ?? 0}% of the package reach in the last 30 days.
                </p>
                <details className="owner-plan-card__details">
                  <summary>Spend outcomes</summary>
                  <p>Started {formatDate(item.sponsorship?.startDate)} | Status {formatStatus(item.sponsorship?.status ?? item.sponsorship?.tier)}</p>
                  <p>Cost per open: {item.spendPerOpen ? formatCurrency({ amount: item.spendPerOpen }) : '--'}</p>
                  <p>Package reach: {formatNumber(item.sponsorship?.reach ?? 0)} | Reach utilization: {item.reachUtilization30d ?? 0}%</p>
                </details>
                <div className="dashboard-card-link-row">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => handlePrepareSponsorship(item.id, item.sponsorship?.tier ?? packages[0]?.tier ?? '')}
                  >
                    Adjust package
                  </button>
                </div>
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
                  <li key={`${gym.id}-active`}>
                    {gym.name} is currently {formatStatus(active.sponsorship?.tier)}. Recent performance: {formatNumber(active.impressions30d ?? 0)} impressions, {formatNumber(active.opens30d ?? 0)} opens, {formatNumber(active.joins30d ?? 0)} joins.
                  </li>
                );
              }

              const recommendedTier = packages.find((pkg) => pkg.tier === 'gold') ?? packages[0];
              return (
                <li key={`${gym.id}-recommendation`}>
                  Upgrade {gym.name} with the {recommendedTier?.label ?? 'recommended'} package to convert {formatNumber(gym.analytics?.impressions30d ?? gym.analytics?.impressions ?? 0)} recent impressions into more gym opens.
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
