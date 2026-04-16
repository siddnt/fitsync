import { useMemo, useState } from 'react';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import DistributionPieChart from '../components/DistributionPieChart.jsx';
import GrowthLineChart from '../components/GrowthLineChart.jsx';
import RevenueSummaryChart from '../components/RevenueSummaryChart.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import { useAppSelector } from '../../../app/hooks.js';
import { useGetGymOwnerAnalyticsQuery } from '../../../services/dashboardApi.js';
import { downloadReport } from '../../../utils/reportDownload.js';
import { formatCurrency, formatNumber, formatPercentage } from '../../../utils/format.js';
import '../Dashboard.css';

const TIMEFRAME_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const buildTrendArray = (trendSource) => {
  if (Array.isArray(trendSource)) {
    return trendSource;
  }
  if (trendSource?.weekly && Array.isArray(trendSource.weekly)) {
    return trendSource.weekly;
  }
  if (trendSource?.monthly && Array.isArray(trendSource.monthly)) {
    return trendSource.monthly;
  }
  return [];
};

const toCumulativeTrend = (trend, valueAccessor, valueKey) => {
  if (!Array.isArray(trend)) {
    return [];
  }
  let runningTotal = 0;
  return trend.map((entry) => {
    const value = Number(valueAccessor(entry)) || 0;
    runningTotal += value;
    return {
      label: entry.label ?? entry.fullLabel ?? entry.date ?? entry.week ?? '',
      [valueKey]: runningTotal,
    };
  });
};

const GymOwnerAnalyticsPage = () => {
  const [timeframe, setTimeframe] = useState('monthly');
  const [reportFormat, setReportFormat] = useState('csv');
  const [isExportingMemberships, setIsExportingMemberships] = useState(false);
  const [reportNotice, setReportNotice] = useState(null);
  const [reportError, setReportError] = useState(null);
  const accessToken = useAppSelector((state) => state.auth.accessToken);
  const { data, isLoading, isError, refetch } = useGetGymOwnerAnalyticsQuery();
  const analytics = data?.data;

  const revenueTrend = useMemo(() => {
    const trendSource = analytics?.revenueTrend;
    const preferredTrend = trendSource?.[timeframe];
    const rawTrend = buildTrendArray(preferredTrend ?? trendSource);
    let cumulativeEarnings = 0;
    let cumulativeExpenses = 0;
    return rawTrend.map((entry) => {
      const earningsDelta = Number(entry.revenue ?? entry.profit ?? entry.value ?? entry.amount ?? 0);
      const expensesDelta = Number(entry.expenses ?? entry.spend ?? entry.cost ?? 0);
      cumulativeEarnings += earningsDelta;
      cumulativeExpenses += expensesDelta;
      return {
        label: entry.label ?? entry.fullLabel ?? entry.date ?? entry.week ?? '',
        earnings: cumulativeEarnings,
        expenses: cumulativeExpenses,
      };
    });
  }, [analytics, timeframe]);

  const membershipTrend = useMemo(() => {
    const trendSource = analytics?.membershipTrend;
    const preferredTrend = trendSource?.[timeframe];
    const rawTrend = buildTrendArray(preferredTrend ?? trendSource);
    return toCumulativeTrend(
      rawTrend,
      (entry) => entry.value ?? entry.count ?? entry.memberships ?? entry.total,
      'memberships',
    );
  }, [analytics, timeframe]);

  const revenueSummary = useMemo(() => {
    const summarySource = analytics?.revenueSummary?.[timeframe]
      ?? analytics?.revenueSummary;

    const baseSummary = summarySource
      ? {
          netProfit: summarySource.totalProfit ?? summarySource.netProfit ?? 0,
          revenue: summarySource.totalRevenue ?? summarySource.revenue ?? 0,
          marketplaceSpend: summarySource.totalExpenses ?? summarySource.expenses ?? 0,
        }
      : null;

    if (baseSummary) {
      return baseSummary;
    }

    if (!revenueTrend?.length) {
      return null;
    }

    const lastPoint = revenueTrend[revenueTrend.length - 1];
    return {
      netProfit: (lastPoint.earnings ?? 0) - (lastPoint.expenses ?? 0),
      revenue: lastPoint.earnings ?? 0,
      marketplaceSpend: lastPoint.expenses ?? 0,
    };
  }, [analytics, timeframe, revenueTrend]);

  const impressionsSplit = useMemo(
    () => analytics?.gyms?.map((gym) => ({
      name: gym.name,
      value: gym.impressions30d ?? 0,
    })),
    [analytics?.gyms],
  );

  const expenseBreakdown = useMemo(() => {
    const breakdown = analytics?.expenseBreakdown;
    if (!Array.isArray(breakdown)) {
      return [];
    }
    return breakdown.map((entry) => ({
      name: entry.label,
      value: entry.value,
    }));
  }, [analytics]);

  const funnelSteps = analytics?.conversionFunnel?.steps ?? [];
  const funnelTotals = analytics?.conversionFunnel?.totals ?? {};

  const handleExportMemberships = async () => {
    setReportNotice(null);
    setReportError(null);
    setIsExportingMemberships(true);

    try {
      await downloadReport({
        path: '/dashboards/gym-owner/memberships/export',
        token: accessToken,
        format: reportFormat,
        fallbackFilename: `gym-owner-memberships-report.${reportFormat}`,
      });
      setReportNotice(`Membership report exported as ${reportFormat.toUpperCase()}.`);
    } catch (error) {
      setReportError(error.message || 'Unable to export memberships report.');
    } finally {
      setIsExportingMemberships(false);
    }
  };

  if (isLoading) {
    return (
      <div className="dashboard-grid dashboard-grid--owner">
        {['Revenue performance', 'Membership trend', 'Gym performance'].map((title) => (
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
          title="Analytics unavailable"
          action={(
            <button type="button" onClick={() => refetch()}>
              Retry
            </button>
          )}
        >
          <EmptyState message="We could not fetch analytics right now." />
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="dashboard-grid dashboard-grid--owner">
      <DashboardSection
        title="Revenue performance"
        className="dashboard-section--span-12"
        action={(
          <div className="owner-revenue-chart__toggle" role="group" aria-label="Select timeframe">
            {TIMEFRAME_OPTIONS.map((option) => {
              const isActive = option.value === timeframe;
              return (
                <button
                  key={option.value}
                  type="button"
                  className={`owner-revenue-chart__toggle-button${isActive ? ' owner-revenue-chart__toggle-button--active' : ''}`}
                  onClick={() => {
                    if (!isActive) {
                      setTimeframe(option.value);
                    }
                  }}
                  aria-pressed={isActive}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        )}
      >
        {revenueSummary ? (
          <div className="owner-revenue-chart__meta">
            <div className="owner-revenue-chart__metrics">
              <div className="owner-revenue-chart__metric">
                <span>Net profit</span>
                <strong
                  className={`owner-revenue-chart__value ${
                    revenueSummary.netProfit > 0
                      ? 'owner-revenue-chart__value--positive'
                      : revenueSummary.netProfit < 0
                        ? 'owner-revenue-chart__value--negative'
                        : 'owner-revenue-chart__value--neutral'
                  }`}
                >
                  {formatCurrency(revenueSummary.netProfit)}
                </strong>
              </div>

              <div className="owner-revenue-chart__metric">
                <span>Revenue</span>
                <strong className="owner-revenue-chart__value owner-revenue-chart__value--positive">
                  {formatCurrency(revenueSummary.revenue)}
                </strong>
              </div>

              <div className="owner-revenue-chart__metric">
                <span>Marketplace spend</span>
                <strong className="owner-revenue-chart__value owner-revenue-chart__value--negative">
                  {formatCurrency(revenueSummary.marketplaceSpend ?? revenueSummary.expenses)}
                </strong>
              </div>
            </div>
          </div>
        ) : null}

        {revenueTrend?.length ? (
          <RevenueSummaryChart
            role="gym-owner"
            data={revenueTrend}
            labelKey="label"
            series={[
              { dataKey: 'earnings', stroke: '#22c55e', name: 'Earnings', fillOpacity: 0.2 },
              { dataKey: 'expenses', stroke: '#f87171', name: 'Expenses', fillOpacity: 0.15 },
            ]}
          />
        ) : (
          <EmptyState message="We need a bit more transaction activity before plotting revenue." />
        )}
      </DashboardSection>

      <DashboardSection
        title="Membership trend"
        action={(
          <div className="dashboard-controls">
            <span className="dashboard-timeframe-label">
              {timeframe === 'weekly' ? 'Weekly view' : 'Monthly view'}
            </span>
            <select
              className="dashboard-select"
              value={reportFormat}
              onChange={(event) => setReportFormat(event.target.value)}
              aria-label="Membership report format"
            >
              <option value="csv">CSV</option>
              <option value="pdf">PDF</option>
            </select>
            <button
              type="button"
              className="users-toolbar__refresh"
              disabled={isExportingMemberships}
              onClick={handleExportMemberships}
            >
              {isExportingMemberships ? 'Exporting...' : 'Export memberships'}
            </button>
          </div>
        )}
        className="dashboard-section--span-12"
      >
        {reportNotice ? <p className="dashboard-message dashboard-message--success">{reportNotice}</p> : null}
        {reportError ? <p className="dashboard-message dashboard-message--error">{reportError}</p> : null}
        {membershipTrend?.length ? (
          <GrowthLineChart
            role="gym-owner"
            data={membershipTrend}
            series={[
              { dataKey: 'memberships', stroke: '#4dabf7', label: 'Active memberships' },
            ]}
          />
        ) : (
          <EmptyState message="We need membership activity to plot this chart." />
        )}
      </DashboardSection>

      <DashboardSection title="30-day conversion funnel" className="dashboard-section--span-12">
        {funnelSteps.length ? (
          <div className="conversion-funnel">
            <div className="conversion-funnel__steps">
              {funnelSteps.map((step) => (
                <article key={step.id} className="conversion-funnel__step">
                  <small>{step.label}</small>
                  <strong>{formatNumber(step.value ?? 0)}</strong>
                  <span>
                    {step.conversionFromPrevious === null
                      ? 'Top of funnel'
                      : `${formatPercentage(step.conversionFromPrevious)} from previous step`}
                  </span>
                </article>
              ))}
            </div>
            <div className="conversion-funnel__meta">
              <div className="conversion-funnel__metric">
                <span>Listing spend</span>
                <strong>{formatCurrency(funnelTotals.listingSpend ?? 0)}</strong>
              </div>
              <div className="conversion-funnel__metric">
                <span>Sponsorship spend</span>
                <strong>{formatCurrency(funnelTotals.sponsorshipSpend ?? 0)}</strong>
              </div>
              <div className="conversion-funnel__metric">
                <span>Cost per join</span>
                <strong>{formatCurrency(funnelTotals.costPerJoin ?? 0)}</strong>
              </div>
              <div className="conversion-funnel__metric">
                <span>Cost per renewal</span>
                <strong>{formatCurrency(funnelTotals.costPerRenewal ?? 0)}</strong>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState message="We need traffic and membership activity before a funnel can be shown." />
        )}
      </DashboardSection>

      <DashboardSection title="Gym performance" className="dashboard-section--span-12">
        {analytics?.gyms?.length ? (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Gym</th>
                <th>City</th>
                <th>Impressions (30d)</th>
                <th>Opens (30d)</th>
                <th>Joins (30d)</th>
                <th>Renewals (30d)</th>
                <th>Open to Join</th>
              </tr>
            </thead>
            <tbody>
              {analytics.gyms.map((gym) => (
                <tr key={gym.id}>
                  <td>{gym.name}</td>
                  <td>{gym.city || '-'}</td>
                  <td>{formatNumber(gym.impressions30d ?? 0)}</td>
                  <td>{formatNumber(gym.opens30d ?? 0)}</td>
                  <td>{formatNumber(gym.joins30d ?? 0)}</td>
                  <td>{formatNumber(gym.renewals30d ?? 0)}</td>
                  <td>{formatPercentage(gym.joinConversionRate30d ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="Your gyms will appear here once analytics are collected." />
        )}
      </DashboardSection>

      <DashboardSection title="30-day impression share" className="dashboard-section--span-6">
        {impressionsSplit?.length ? (
          <DistributionPieChart
            role="gym-owner"
            data={impressionsSplit}
            interactive
            valueFormatter={(value) => formatNumber(value)}
            centerLabel="Impressions"
          />
        ) : (
          <EmptyState message="No impressions tracked yet." />
        )}
      </DashboardSection>

      <DashboardSection title="Marketplace spend" className="dashboard-section--span-6">
        {expenseBreakdown?.length ? (
          <DistributionPieChart
            role="gym-owner"
            data={expenseBreakdown}
            valueKey="value"
            nameKey="name"
            interactive
            valueFormatter={(value) => formatCurrency({ amount: value })}
            centerLabel="Spend"
          />
        ) : (
          <EmptyState message="No listing or sponsorship spend recorded yet." />
        )}
      </DashboardSection>
    </div>
  );
};

export default GymOwnerAnalyticsPage;
