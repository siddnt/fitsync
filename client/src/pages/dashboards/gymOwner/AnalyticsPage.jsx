import { useMemo, useState } from 'react';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import DistributionPieChart from '../components/DistributionPieChart.jsx';
import GrowthLineChart from '../components/GrowthLineChart.jsx';
import GymOwnerRevenueChart from '../components/GymOwnerRevenueChart.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import { useGetGymOwnerAnalyticsQuery } from '../../../services/dashboardApi.js';
import { formatCurrency, formatNumber } from '../../../utils/format.js';
import '../Dashboard.css';

const GymOwnerAnalyticsPage = () => {
  const [timeframe, setTimeframe] = useState('monthly');
  const { data, isLoading, isError, refetch } = useGetGymOwnerAnalyticsQuery();
  const analytics = data?.data;

  const revenueTrend = useMemo(() => {
    const trend = analytics?.revenueTrend?.[timeframe];
    return Array.isArray(trend) ? trend : [];
  }, [analytics, timeframe]);

  const revenueSummary = useMemo(
    () => analytics?.revenueSummary?.[timeframe] ?? null,
    [analytics, timeframe],
  );

  const membershipTrend = useMemo(() => {
    const trend = analytics?.membershipTrend?.[timeframe];
    if (!Array.isArray(trend)) {
      return [];
    }
    return trend.map((entry) => ({
      label: entry.label,
      memberships: entry.value,
      fullLabel: entry.fullLabel,
    }));
  }, [analytics, timeframe]);

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
      <DashboardSection title="Revenue performance" className="dashboard-section--span-8">
        {revenueTrend?.length ? (
          <GymOwnerRevenueChart
            data={revenueTrend}
            timeframe={timeframe}
            onTimeframeChange={setTimeframe}
            summary={revenueSummary}
          />
        ) : (
          <EmptyState message="You will see revenue once transactions are recorded." />
        )}
      </DashboardSection>

      <DashboardSection
        title="Membership trend"
        action={(
          <span className="dashboard-timeframe-label">
            {timeframe === 'weekly' ? 'Weekly view' : 'Monthly view'}
          </span>
        )}
        className="dashboard-section--span-4"
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
          />
        ) : (
          <EmptyState message="No listing or sponsorship spend recorded yet." />
        )}
      </DashboardSection>
    </div>
  );
};

export default GymOwnerAnalyticsPage;
