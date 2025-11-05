import { useMemo, useState } from 'react';
import DashboardSection from '../components/DashboardSection.jsx';
import RevenueSummaryChart from '../components/RevenueSummaryChart.jsx';
import GrowthLineChart from '../components/GrowthLineChart.jsx';
import DistributionPieChart from '../components/DistributionPieChart.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useGetAdminRevenueQuery, useGetAdminOverviewQuery } from '../../../services/dashboardApi.js';
import { formatCurrency, formatNumber, formatStatus } from '../../../utils/format.js';
import '../Dashboard.css';

const AdminRevenuePage = () => {
  const [granularity, setGranularity] = useState('monthly'); // 'weekly' or 'monthly'
  const [visibleStreams, setVisibleStreams] = useState({
    listing: true,
    sponsorship: true,
    marketplace: true,
  });

  const { data: revenueResponse, isLoading, isError, refetch } = useGetAdminRevenueQuery();
  const { data: overviewResponse } = useGetAdminOverviewQuery();
  const rawTrend = revenueResponse?.data?.trend;
  const overview = overviewResponse?.data;

  // Aggregate data based on granularity
  const trend = useMemo(() => {
    const sourceTrend = Array.isArray(rawTrend) ? rawTrend : [];

    if (granularity === 'monthly' || sourceTrend.length === 0) {
      return sourceTrend;
    }

    // For weekly granularity, split monthly data into ~4 weeks
    const weeklyData = [];
    sourceTrend.forEach((monthEntry) => {
      const weeksInMonth = 4;
      const weeklyListing = (Number(monthEntry.listing) || 0) / weeksInMonth;
      const weeklySponsorship = (Number(monthEntry.sponsorship) || 0) / weeksInMonth;
      const weeklyMarketplace = (Number(monthEntry.marketplace) || 0) / weeksInMonth;

      for (let week = 1; week <= weeksInMonth; week++) {
        weeklyData.push({
          label: `${monthEntry.label} W${week}`,
          listing: Math.round(weeklyListing),
          sponsorship: Math.round(weeklySponsorship),
          marketplace: Math.round(weeklyMarketplace),
        });
      }
    });

    return weeklyData;
  }, [rawTrend, granularity]);

  const toggleStream = (stream) => {
    setVisibleStreams((prev) => ({ ...prev, [stream]: !prev[stream] }));
  };

  const totals = useMemo(() => {
    const accumulator = { listing: 0, sponsorship: 0, marketplace: 0 };
    trend.forEach((entry) => {
      accumulator.listing += Number(entry.listing) || 0;
      accumulator.sponsorship += Number(entry.sponsorship) || 0;
      accumulator.marketplace += Number(entry.marketplace) || 0;
    });
    return accumulator;
  }, [trend]);

  const summarySeries = useMemo(
    () =>
      trend.map((entry) => ({
        ...entry,
        total: ['listing', 'sponsorship', 'marketplace'].reduce(
          (sum, key) => sum + (Number(entry[key]) || 0),
          0,
        ),
      })),
    [trend],
  );

  const distribution = useMemo(
    () =>
      ['listing', 'sponsorship', 'marketplace']
        .map((key) => ({ key, value: totals[key] }))
        .filter((item) => item.value > 0)
        .map((item) => ({ name: formatStatus(item.key), value: item.value })),
    [totals],
  );

  const recentMonths = [...trend]
    .slice(-6)
    .reverse()
    .map((entry) => ({
      label: entry.label,
      listing: formatCurrency({ amount: entry.listing }),
      sponsorship: formatCurrency({ amount: entry.sponsorship }),
      marketplace: formatCurrency({ amount: entry.marketplace }),
      total: formatCurrency({ amount: ['listing', 'sponsorship', 'marketplace'].reduce((sum, key) => sum + (Number(entry[key]) || 0), 0) }),
    }));

  const filteredSeries = useMemo(
    () =>
      summarySeries.filter((entry) =>
        (visibleStreams.listing && entry.listing > 0) ||
        (visibleStreams.sponsorship && entry.sponsorship > 0) ||
        (visibleStreams.marketplace && entry.marketplace > 0),
      ),
    [summarySeries, visibleStreams],
  );

  if (isLoading) {
    return (
      <div className="dashboard-grid">
        {['Revenue summary', 'Revenue trend', 'Income distribution', 'Recent months'].map((section) => (
          <DashboardSection key={section} title={section}>
            <SkeletonPanel lines={8} />
          </DashboardSection>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="dashboard-grid">
        <DashboardSection
          title="Revenue analytics"
          action={(
            <button type="button" onClick={() => refetch()}>
              Retry
            </button>
          )}
        >
          <EmptyState message="We could not fetch the revenue report." />
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="dashboard-grid">
      {/* Analytics Controls */}
      <DashboardSection 
        title="Revenue Analytics" 
        action={
          <div className="dashboard-controls">
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
            <div className="dashboard-controls__filters">
              {['listing', 'sponsorship', 'marketplace'].map((stream) => (
                <label key={stream} className="stream-filter">
                  <input
                    type="checkbox"
                    checked={visibleStreams[stream]}
                    onChange={() => toggleStream(stream)}
                  />
                  <span>{formatStatus(stream)}</span>
                </label>
              ))}
            </div>
          </div>
        }
      >
        <p className="dashboard-section__hint">
          Showing {granularity} revenue breakdown. Toggle streams to compare specific income sources.
        </p>
      </DashboardSection>

      <DashboardSection title="Revenue summary">
        <div className="stat-grid">
          <div className="stat-card">
            <small>Total revenue</small>
            <strong>{formatCurrency({ amount: totals.listing + totals.sponsorship + totals.marketplace })}</strong>
            <small>Listing {formatCurrency({ amount: totals.listing })}</small>
          </div>
          <div className="stat-card">
            <small>Sponsorship</small>
            <strong>{formatCurrency({ amount: totals.sponsorship })}</strong>
            <small>{formatNumber(overview?.gyms?.sponsored ?? 0)} sponsored gyms</small>
          </div>
          <div className="stat-card">
            <small>Marketplace</small>
            <strong>{formatCurrency({ amount: totals.marketplace })}</strong>
            <small>{formatNumber(overview?.marketplace?.totalOrders ?? 0)} total orders</small>
          </div>
        </div>
        {summarySeries.length ? (
          <RevenueSummaryChart role="admin" data={summarySeries} valueKey="total" labelKey="label" />
        ) : (
          <EmptyState message="No revenue recorded yet." />
        )}
      </DashboardSection>

      <DashboardSection title="Revenue trend">
        {filteredSeries.length ? (
          <GrowthLineChart
            role="admin"
            data={filteredSeries}
            series={[
              visibleStreams.listing && { dataKey: 'listing', stroke: '#ff6b6b', label: 'Listing' },
              visibleStreams.sponsorship && { dataKey: 'sponsorship', stroke: '#845ef7', label: 'Sponsorship' },
              visibleStreams.marketplace && { dataKey: 'marketplace', stroke: '#51cf66', label: 'Marketplace' },
            ].filter(Boolean)}
          />
        ) : (
          <EmptyState message="Select at least one revenue stream to display the trend chart." />
        )}
      </DashboardSection>

      <DashboardSection title="Income distribution">
        {distribution.length ? (
          <DistributionPieChart role="admin" data={distribution} valueKey="value" nameKey="name" />
        ) : (
          <EmptyState message="Revenue distribution will appear here." />
        )}
      </DashboardSection>

      <DashboardSection title="Recent months">
        {recentMonths.length ? (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Listing</th>
                <th>Sponsorship</th>
                <th>Marketplace</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {recentMonths.map((month) => (
                <tr key={month.label}>
                  <td>{month.label}</td>
                  <td>{month.listing}</td>
                  <td>{month.sponsorship}</td>
                  <td>{month.marketplace}</td>
                  <td>{month.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="Once revenue is recorded, we will list month-on-month details here." />
        )}
      </DashboardSection>
    </div>
  );
};

export default AdminRevenuePage;
