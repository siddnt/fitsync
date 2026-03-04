import { useMemo, useState } from 'react';
import DashboardSection from '../components/DashboardSection.jsx';
import GrowthLineChart from '../components/GrowthLineChart.jsx';
import DistributionPieChart from '../components/DistributionPieChart.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import EmptyState from '../components/EmptyState.jsx';
import {
  useGetAdminRevenueQuery,
  useGetAdminOverviewQuery,
  useGetAdminMarketplaceQuery,
  useGetAdminSubscriptionsQuery,
} from '../../../services/dashboardApi.js';
import { formatCurrency, formatNumber, formatStatus } from '../../../utils/format.js';
import '../Dashboard.css';

const STREAM_COLORS = {
  Listing: '#845ef7',
  Sponsorship: '#4dabf7',
  Marketplace: '#51cf66',
};

const AdminRevenuePage = () => {
  const [granularity, setGranularity] = useState('monthly');
  const [visibleStreams, setVisibleStreams] = useState({
    listing: true,
    sponsorship: true,
    marketplace: true,
  });

  const { data: revenueResponse, isLoading, isError, refetch } = useGetAdminRevenueQuery();
  const { data: overviewResponse } = useGetAdminOverviewQuery();
  const { data: marketplaceResponse } = useGetAdminMarketplaceQuery();
  const { data: subscriptionsResponse } = useGetAdminSubscriptionsQuery();

  const rawTrend = revenueResponse?.data?.trend;
  const rawMarketplaceDistribution = revenueResponse?.data?.marketplaceDistribution;
  const overview = overviewResponse?.data;
  const allOrders = marketplaceResponse?.data?.orders ?? [];
  const subscriptionData = subscriptionsResponse?.data ?? {};
  const allListings = subscriptionData.listings ?? [];
  const allSponsorships = subscriptionData.sponsorships ?? [];

  // Aggregate data based on granularity
  const trend = useMemo(() => {
    if (!rawTrend) return [];
    return Array.isArray(rawTrend[granularity]) ? rawTrend[granularity] : [];
  }, [rawTrend, granularity]);

  const marketplaceCategoryData = useMemo(() => {
    if (!rawMarketplaceDistribution) return [];
    return Array.isArray(rawMarketplaceDistribution[granularity])
      ? rawMarketplaceDistribution[granularity]
      : [];
  }, [rawMarketplaceDistribution, granularity]);

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

  const hasActiveStreams = useMemo(
    () => Object.values(visibleStreams).some(Boolean),
    [visibleStreams],
  );

  const marketplacePieData = useMemo(
    () =>
      marketplaceCategoryData
        .map((entry) => ({
          name: formatStatus(entry.name),
          value: Number(entry.value) || 0,
        }))
        .filter((entry) => entry.value > 0),
    [marketplaceCategoryData],
  );

  const topMarketplaceCategory = useMemo(
    () =>
      marketplacePieData.reduce((best, entry) => {
        if (!best || entry.value > best.value) {
          return entry;
        }
        return best;
      }, null),
    [marketplacePieData],
  );

  const revenueStreamDistribution = useMemo(
    () =>
      [
        { name: 'Listing', value: Number(totals.listing) || 0 },
        { name: 'Sponsorship', value: Number(totals.sponsorship) || 0 },
        { name: 'Marketplace', value: Number(totals.marketplace) || 0 },
      ].filter((entry) => entry.value > 0),
    [totals.listing, totals.sponsorship, totals.marketplace],
  );

  const totalRevenueValue = totals.listing + totals.sponsorship + totals.marketplace;

  /* ── Top Contributors (computed client-side) ── */

  const topSellers = useMemo(() => {
    const sellerMap = {};
    allOrders.forEach((order) => {
      const seller = order.seller;
      if (!seller?.name) return;
      const key = seller.id || seller.name;
      if (!sellerMap[key]) sellerMap[key] = { name: seller.name, email: seller.email, orders: 0, revenue: 0 };
      sellerMap[key].orders += 1;
      const amount = typeof order.total === 'object' ? (order.total?.amount ?? 0) : (Number(String(order.total).replace(/[^\d.]/g, '')) || 0);
      sellerMap[key].revenue += amount;
    });
    return Object.values(sellerMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [allOrders]);

  const topBuyers = useMemo(() => {
    const buyerMap = {};
    allOrders.forEach((order) => {
      const user = order.user;
      if (!user?.name) return;
      const key = user.id || user.name;
      if (!buyerMap[key]) buyerMap[key] = { name: user.name, email: user.email, orders: 0, spent: 0 };
      buyerMap[key].orders += 1;
      const amount = typeof order.total === 'object' ? (order.total?.amount ?? 0) : (Number(String(order.total).replace(/[^\d.]/g, '')) || 0);
      buyerMap[key].spent += amount;
    });
    return Object.values(buyerMap).sort((a, b) => b.spent - a.spent).slice(0, 5);
  }, [allOrders]);

  const topGyms = useMemo(() => {
    const gymMap = {};
    const addToGym = (gymName, ownerName, amount, stream) => {
      if (!gymName) return;
      if (!gymMap[gymName]) gymMap[gymName] = { name: gymName, owner: ownerName, listing: 0, sponsorship: 0, total: 0 };
      gymMap[gymName][stream] += amount;
      gymMap[gymName].total += amount;
    };
    allListings.forEach((sub) => {
      const amount = Number(sub.amount) || 0;
      addToGym(sub.gym?.name, sub.owner?.name, amount, 'listing');
    });
    allSponsorships.forEach((sub) => {
      const amount = Number(sub.amount) || 0;
      addToGym(sub.gym?.name, sub.owner?.name, amount, 'sponsorship');
    });
    return Object.values(gymMap).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [allListings, allSponsorships]);

  if (isLoading) {
    return (
      <div className="dashboard-grid dashboard-grid--admin">
        {['Revenue summary', 'Revenue trend', 'Recent months'].map((section) => (
          <DashboardSection key={section} title={section} className="dashboard-section--span-12">
            <SkeletonPanel lines={8} />
          </DashboardSection>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="dashboard-grid dashboard-grid--admin">
        <DashboardSection
          title="Revenue analytics"
          className="dashboard-section--span-12"
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
    <div className="dashboard-grid dashboard-grid--admin">
      <div className="admin-page-header">
        <h1>Revenue Analytics</h1>
        <p>Track revenue across listing plans, sponsorships, and marketplace commissions.</p>
      </div>

      {/* Row 1: Overview */}
      <DashboardSection
        title="Revenue Overview"
        className="dashboard-section--span-12"
      >
        <div className="stat-grid">
          <div className="stat-card stat-card--green">
            <small>Total revenue</small>
            <strong>{formatCurrency({ amount: totals.listing + totals.sponsorship + totals.marketplace })}</strong>
            <small>Listing {formatCurrency({ amount: totals.listing })}</small>
          </div>
          <div className="stat-card stat-card--purple">
            <small>Sponsorship</small>
            <strong>{formatCurrency({ amount: totals.sponsorship })}</strong>
            <small>{formatNumber(overview?.gyms?.sponsored ?? 0)} sponsored gyms</small>
          </div>
          <div className="stat-card stat-card--cyan">
            <small>Marketplace</small>
            <strong>{formatCurrency({ amount: totals.marketplace })}</strong>
            <small>{formatNumber(overview?.marketplace?.totalOrders ?? 0)} total orders</small>
          </div>
        </div>
      </DashboardSection>

      {/* Row 2: Trend Chart */}
      <DashboardSection
        title="Revenue Trend"
        className="dashboard-section--span-12"
        action={(
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
        )}
      >
        {hasActiveStreams && summarySeries.length ? (
          <GrowthLineChart
            role="admin"
            data={summarySeries}
            series={[
              visibleStreams.listing && { dataKey: 'listing', stroke: '#fcc419', label: 'Listing' },
              visibleStreams.sponsorship && { dataKey: 'sponsorship', stroke: '#51cf66', label: 'Sponsorship' },
              visibleStreams.marketplace && { dataKey: 'marketplace', stroke: '#22b8cf', label: 'Marketplace' },
            ].filter(Boolean)}
          />
        ) : (
          <EmptyState message="Enable at least one revenue stream to display the trend chart." />
        )}
      </DashboardSection>

      {/* Row 3: Pie charts */}
      <DashboardSection
        title="Marketplace categories"
        className="dashboard-section--span-6"
        action={<span className="dashboard-timeframe-label">Commission captured by item type</span>}
      >
        {marketplacePieData.length ? (
          <div className="pie-card">
            <DistributionPieChart
              role="admin"
              data={marketplacePieData}
              interactive
              valueFormatter={(amount) => formatCurrency(amount)}
              centerLabel="Marketplace"
              useSampleFallback={false}
              showLegend={false}
            />
            <div className="pie-card__meta">
              <div className="pie-card__stat">
                <span>Top category</span>
                <strong>{topMarketplaceCategory?.name ?? '—'}</strong>
                <small>{formatCurrency(topMarketplaceCategory?.value ?? 0)}</small>
              </div>
              <div className="pie-card__stat">
                <span>Categories tracked</span>
                <strong>{marketplacePieData.length}</strong>
                <small>Active during selected period</small>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState message="No marketplace revenue recorded for this period." />
        )}
      </DashboardSection>

      <DashboardSection
        title="Revenue distribution"
        className="dashboard-section--span-6"
        action={<span className="dashboard-timeframe-label">Share of total platform revenue</span>}
      >
        {revenueStreamDistribution.length ? (
          <div className="pie-card">
            <DistributionPieChart
              role="admin"
              data={revenueStreamDistribution}
              interactive={false}
              valueFormatter={(amount) => formatCurrency(amount)}
              centerLabel="Total revenue"
              useSampleFallback={false}
              showLegend={false}
            />
            <div className="pie-card__meta">
              <div className="pie-card__stat">
                <span>Combined revenue</span>
                <strong>{formatCurrency(totalRevenueValue)}</strong>
                <small>Listing + Sponsorship + Marketplace</small>
              </div>
              <div className="pie-card__legend">
                {revenueStreamDistribution.map((stream) => (
                  <div key={stream.name} className="pie-card__legend-item">
                    <span
                      className="pie-card__dot"
                      style={{ backgroundColor: STREAM_COLORS[stream.name] || '#868e96' }}
                    />
                    <div>
                      <strong>{stream.name}</strong>
                      <small>{formatCurrency(stream.value)}</small>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <EmptyState message="Revenue data not available for this window." />
        )}
      </DashboardSection>

      {/* Row 4: Top Contributors */}
      <DashboardSection
        title="Top Sellers"
        className="dashboard-section--span-12"
        collapsible
      >
        {topSellers.length ? (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Seller</th>
                <th>Orders</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {topSellers.map((s, i) => (
                <tr key={s.name}>
                  <td><strong>{i + 1}</strong></td>
                  <td>
                    <strong>{s.name}</strong>
                    <div><small>{s.email}</small></div>
                  </td>
                  <td>{s.orders}</td>
                  <td>{formatCurrency(s.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="No seller data available." />
        )}
      </DashboardSection>

      <DashboardSection
        title="Top Buyers"
        className="dashboard-section--span-6"
        collapsible
      >
        {topBuyers.length ? (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Buyer</th>
                <th>Orders</th>
                <th>Spent</th>
              </tr>
            </thead>
            <tbody>
              {topBuyers.map((b, i) => (
                <tr key={b.name}>
                  <td><strong>{i + 1}</strong></td>
                  <td>
                    <strong>{b.name}</strong>
                    <div><small>{b.email}</small></div>
                  </td>
                  <td>{b.orders}</td>
                  <td>{formatCurrency(b.spent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="No buyer data available." />
        )}
      </DashboardSection>

      <DashboardSection
        title="Top Gyms by Subscription Revenue"
        className="dashboard-section--span-6"
        collapsible
      >
        {topGyms.length ? (
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Gym</th>
                <th>Owner</th>
                <th>Listing</th>
                <th>Sponsorship</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {topGyms.map((g, i) => (
                <tr key={g.name}>
                  <td><strong>{i + 1}</strong></td>
                  <td><strong>{g.name}</strong></td>
                  <td>{g.owner ?? '—'}</td>
                  <td>{formatCurrency(g.listing)}</td>
                  <td>{formatCurrency(g.sponsorship)}</td>
                  <td><strong>{formatCurrency(g.total)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="No subscription data available." />
        )}
      </DashboardSection>

    </div>
  );
};

export default AdminRevenuePage;
