import { useMemo, useState } from 'react';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import DistributionPieChart from '../components/DistributionPieChart.jsx';
import GrowthLineChart from '../components/GrowthLineChart.jsx';
import RevenueSummaryChart from '../components/RevenueSummaryChart.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import { useGetGymOwnerAnalyticsQuery } from '../../../services/dashboardApi.js';
import { formatCurrency, formatNumber } from '../../../utils/format.js';
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
      value: gym.impressions ?? 0,
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
          <span className="dashboard-timeframe-label">
            {timeframe === 'weekly' ? 'Weekly view' : 'Monthly view'}
          </span>
        )}
        className="dashboard-section--span-12"
      >
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

      <DashboardSection title="Gym performance" className="dashboard-section--span-12">
        {analytics?.gyms?.length ? (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Gym</th>
                <th>Impressions</th>
                <th>Memberships</th>
                <th>Trainers</th>
              </tr>
            </thead>
            <tbody>
              {analytics.gyms.map((gym) => (
                <tr key={gym.id}>
                  <td>{gym.name}</td>
                  <td>{formatNumber(gym.impressions ?? 0)}</td>
                  <td>{formatNumber(gym.memberships ?? 0)}</td>
                  <td>{formatNumber(gym.trainers ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="Your gyms will appear here once analytics are collected." />
        )}
      </DashboardSection>

      <DashboardSection title="Impression share" className="dashboard-section--span-6">
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
