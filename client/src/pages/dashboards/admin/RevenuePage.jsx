import { useMemo, useState } from 'react';
import DashboardSection from '../components/DashboardSection.jsx';
import GrowthLineChart from '../components/GrowthLineChart.jsx';
import DistributionPieChart from '../components/DistributionPieChart.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useAppSelector } from '../../../app/hooks.js';
import { useGetAdminRevenueQuery, useGetAdminOverviewQuery } from '../../../services/dashboardApi.js';
import { downloadReport } from '../../../utils/reportDownload.js';
import { formatCurrency, formatNumber, formatPercentage, formatStatus } from '../../../utils/format.js';
import '../Dashboard.css';

const STREAM_COLORS = {
  Listing: '#845ef7',
  Sponsorship: '#4dabf7',
  Marketplace: '#51cf66',
};

const AdminRevenuePage = () => {
  const [granularity, setGranularity] = useState('monthly'); // 'weekly' or 'monthly'
  const [visibleStreams, setVisibleStreams] = useState({
    listing: true,
    sponsorship: true,
    marketplace: true,
  });
  const [reportFormat, setReportFormat] = useState('csv');
  const [isExporting, setIsExporting] = useState(false);
  const [reportNotice, setReportNotice] = useState(null);
  const [reportError, setReportError] = useState(null);
  const accessToken = useAppSelector((state) => state.auth.accessToken);

  const { data: revenueResponse, isLoading, isError, refetch } = useGetAdminRevenueQuery();
  const { data: overviewResponse } = useGetAdminOverviewQuery();
  const rawTrend = revenueResponse?.data?.trend;
  const rawMarketplaceDistribution = revenueResponse?.data?.marketplaceDistribution;
  const overview = overviewResponse?.data;

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

  const periodComparison = useMemo(() => {
    if (summarySeries.length < 2) {
      return null;
    }

    const current = summarySeries[summarySeries.length - 1];
    const previous = summarySeries[summarySeries.length - 2];
    const currentTotal = Number(current?.total) || 0;
    const previousTotal = Number(previous?.total) || 0;
    const delta = currentTotal - previousTotal;
    const change = previousTotal > 0
      ? Number(((delta / previousTotal) * 100).toFixed(1))
      : currentTotal > 0
        ? 100
        : 0;

    return {
      currentLabel: current?.fullLabel ?? current?.label ?? 'Current period',
      previousLabel: previous?.fullLabel ?? previous?.label ?? 'Previous period',
      currentTotal,
      previousTotal,
      delta,
      change,
    };
  }, [summarySeries]);

  const revenueDrivers = useMemo(() => {
    if (!totalRevenueValue) {
      return [];
    }

    return revenueStreamDistribution
      .map((entry) => ({
        ...entry,
        share: Number(((entry.value / totalRevenueValue) * 100).toFixed(1)),
      }))
      .sort((left, right) => right.value - left.value);
  }, [revenueStreamDistribution, totalRevenueValue]);

  const topRevenueDriver = revenueDrivers[0] ?? null;
  const exportState = isExporting
    ? `Generating ${reportFormat.toUpperCase()}`
    : reportError
      ? 'Retry export'
      : reportNotice
        ? 'Last export complete'
        : 'Ready to download';

  const handleExportRevenue = async () => {
    setReportNotice(null);
    setReportError(null);
    setIsExporting(true);

    try {
      await downloadReport({
        path: '/dashboards/admin/revenue/export',
        token: accessToken,
        format: reportFormat,
        fallbackFilename: `admin-revenue-report.${reportFormat}`,
      });
      setReportNotice(`Revenue report exported as ${reportFormat.toUpperCase()}.`);
    } catch (error) {
      setReportError(error.message || 'Unable to export revenue report.');
    } finally {
      setIsExporting(false);
    }
  };

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
      {/* Row 1: Overview */}
      <DashboardSection 
        title="Revenue Overview" 
        className="dashboard-section--span-12"
      >
        {reportNotice ? <p className="dashboard-message dashboard-message--success">{reportNotice}</p> : null}
        {reportError ? <p className="dashboard-message dashboard-message--error">{reportError}</p> : null}
        <div className="stat-grid">
          <div className="stat-card">
            <small>Total revenue</small>
            <strong>{formatCurrency({ amount: totals.listing + totals.sponsorship + totals.marketplace })}</strong>
            <small>{granularity === 'weekly' ? 'Weekly buckets selected' : 'Monthly buckets selected'}</small>
          </div>
          <div className="stat-card">
            <small>Period over period</small>
            <strong className={
              periodComparison
                ? (periodComparison.delta >= 0 ? 'dashboard-metric--positive' : 'dashboard-metric--negative')
                : undefined
            }>
              {periodComparison ? `${periodComparison.delta >= 0 ? '+' : ''}${formatPercentage(periodComparison.change)}` : '-'}
            </strong>
            <small>
              {periodComparison
                ? `${periodComparison.currentLabel} vs ${periodComparison.previousLabel}`
                : 'Need at least two periods to compare'}
            </small>
          </div>
          <div className="stat-card">
            <small>Top revenue driver</small>
            <strong>{topRevenueDriver?.name ?? '-'}</strong>
            <small>
              {topRevenueDriver
                ? `${formatCurrency(topRevenueDriver.value)} · ${formatPercentage(topRevenueDriver.share)} of total`
                : 'No revenue captured in this window'}
            </small>
          </div>
          <div className="stat-card">
            <small>Top marketplace category</small>
            <strong>{topMarketplaceCategory?.name ?? '-'}</strong>
            <small>
              {topMarketplaceCategory
                ? `${formatCurrency(topMarketplaceCategory.value)} in commissions`
                : 'No delivered marketplace revenue yet'}
            </small>
          </div>
          <div className="stat-card">
            <small>Download state</small>
            <strong>{exportState}</strong>
            <small>{reportFormat.toUpperCase()} export · {formatNumber(overview?.marketplace?.totalOrders ?? 0)} tracked orders</small>
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
            <select
              className="dashboard-select"
              value={reportFormat}
              onChange={(event) => setReportFormat(event.target.value)}
              aria-label="Revenue report format"
            >
              <option value="csv">CSV</option>
              <option value="pdf">PDF</option>
            </select>
            <button
              type="button"
              className="users-toolbar__refresh"
              disabled={isExporting}
              onClick={handleExportRevenue}
            >
              {isExporting ? 'Exporting...' : 'Export report'}
            </button>
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

      <DashboardSection
        title="Top revenue drivers"
        className="dashboard-section--span-12"
        action={<span className="dashboard-timeframe-label">Share of revenue during the selected window</span>}
      >
        {revenueDrivers.length ? (
          <div className="dashboard-list">
            {revenueDrivers.map((driver, index) => (
              <div key={driver.name} className="dashboard-list__item">
                <div>
                  <small>{`#${index + 1}`}</small>
                  <strong>{driver.name}</strong>
                </div>
                <div className="dashboard-list__meta">
                  <strong>{formatCurrency(driver.value)}</strong>
                  <small>{formatPercentage(driver.share)} of total</small>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState message="Revenue drivers will appear once transactions land in the selected window." />
        )}
      </DashboardSection>

    </div>
  );
};

export default AdminRevenuePage;
