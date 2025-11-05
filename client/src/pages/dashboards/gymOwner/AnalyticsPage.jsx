import { useMemo, useState } from 'react';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import DistributionPieChart from '../components/DistributionPieChart.jsx';
import RevenueSummaryChart from '../components/RevenueSummaryChart.jsx';
import GrowthLineChart from '../components/GrowthLineChart.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import { useGetGymOwnerAnalyticsQuery } from '../../../services/dashboardApi.js';
import { formatNumber } from '../../../utils/format.js';
import '../Dashboard.css';

const GymOwnerAnalyticsPage = () => {
  const [granularity, setGranularity] = useState('monthly'); // 'weekly' or 'monthly'
  const { data, isLoading, isError, refetch } = useGetGymOwnerAnalyticsQuery();
  const analytics = data?.data;

  const rawRevenueTrend = analytics?.revenueTrend;
  const rawMembershipTrend = analytics?.membershipTrend;

  const revenueTrend = useMemo(() => {
    const sourceTrend = Array.isArray(rawRevenueTrend) ? rawRevenueTrend : [];

    if (granularity === 'monthly' || sourceTrend.length === 0) {
      return sourceTrend.map((entry) => ({
        label: entry.label,
        earnings: entry.value,
      }));
    }

    // For weekly granularity
    const weeklyData = [];
    sourceTrend.forEach((monthEntry) => {
      const weeksInMonth = 4;
      const weeklyEarnings = (Number(monthEntry.value) || 0) / weeksInMonth;

      for (let week = 1; week <= weeksInMonth; week++) {
        weeklyData.push({
          label: `${monthEntry.label} W${week}`,
          earnings: Math.round(weeklyEarnings),
        });
      }
    });

    return weeklyData;
  }, [rawRevenueTrend, granularity]);

  const membershipTrend = useMemo(() => {
    const sourceTrend = Array.isArray(rawMembershipTrend) ? rawMembershipTrend : [];

    if (granularity === 'monthly' || sourceTrend.length === 0) {
      return sourceTrend.map((entry) => ({
        label: entry.label,
        memberships: entry.value,
      }));
    }

    // For weekly granularity
    const weeklyData = [];
    sourceTrend.forEach((monthEntry) => {
      const weeksInMonth = 4;
      const weeklyMemberships = (Number(monthEntry.value) || 0) / weeksInMonth;

      for (let week = 1; week <= weeksInMonth; week++) {
        weeklyData.push({
          label: `${monthEntry.label} W${week}`,
          memberships: Math.round(weeklyMemberships),
        });
      }
    });

    return weeklyData;
  }, [rawMembershipTrend, granularity]);

  const impressionsSplit = analytics?.gyms?.map((gym) => ({
    name: gym.name,
    value: gym.impressions ?? 0,
  }));

  if (isLoading) {
    return (
      <div className="dashboard-grid">
        {['Revenue summary', 'Membership trend', 'Gym performance'].map((title) => (
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
    <div className="dashboard-grid">
      {/* Analytics Controls */}
      <DashboardSection 
        title="Analytics View" 
        action={
          <div className="dashboard-controls__toggle">
            <button
              type="button"
              className={`toggle-btn ${granularity === 'weekly' ? 'active' : ''}`}
              onClick={() => setGranularity('weekly')}
            >
              Weekly
            </button>
            <button
              type="button"
              className={`toggle-btn ${granularity === 'monthly' ? 'active' : ''}`}
              onClick={() => setGranularity('monthly')}
            >
              Monthly
            </button>
          </div>
        }
      >
        <p className="dashboard-section__hint">
          Switch between weekly and monthly views to analyze trends at different time scales.
        </p>
      </DashboardSection>

      <DashboardSection title="Revenue summary">
        {revenueTrend?.length ? (
          <RevenueSummaryChart role="gym-owner" data={revenueTrend} valueKey="earnings" />
        ) : (
          <EmptyState message="You will see revenue once transactions are recorded." />
        )}
      </DashboardSection>

      <DashboardSection title="Membership trend">
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

      <DashboardSection title="Gym performance">
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

      <DashboardSection title="Impression share">
        {impressionsSplit?.length ? (
          <DistributionPieChart role="gym-owner" data={impressionsSplit} />
        ) : (
          <EmptyState message="No impressions tracked yet." />
        )}
      </DashboardSection>
    </div>
  );
};

export default GymOwnerAnalyticsPage;
