import { useMemo, useState } from 'react';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import { useGetTraineeProgressQuery } from '../../../services/dashboardApi.js';
import { formatDate, formatStatus } from '../../../utils/format.js';
import GrowthLineChart from '../components/GrowthLineChart.jsx';
import '../Dashboard.css';

const deriveBodyMetricsFromHistory = (metrics = []) => {
  if (!Array.isArray(metrics) || !metrics.length) {
    return [];
  }

  const seriesMap = new Map();

  metrics.forEach((metric) => {
    const label = metric?.metric?.toLowerCase?.();
    if (!label) return;

    let fieldName = null;
    if (label.includes('weight')) {
      fieldName = 'weightKg';
    } else if (label.includes('height')) {
      fieldName = 'heightCm';
    } else if (label.includes('bmi')) {
      fieldName = 'bmi';
    }

    if (!fieldName) {
      return;
    }

    const history = Array.isArray(metric.history) && metric.history.length ? metric.history : [metric];

    history.forEach((entry) => {
      const recordedAt = entry?.recordedAt;
      if (!recordedAt) {
        return;
      }
      const timestamp = new Date(recordedAt);
      if (Number.isNaN(timestamp.getTime())) {
        return;
      }
      const isoKey = timestamp.toISOString();

      if (!seriesMap.has(isoKey)) {
        seriesMap.set(isoKey, { recordedAt: timestamp.toISOString() });
      }

      const value = entry?.value ?? entry?.latestValue;
      if (value === undefined || value === null) {
        return;
      }
      seriesMap.get(isoKey)[fieldName] = Number(value);
    });
  });

  return Array.from(seriesMap.values()).sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));
};

const TraineeProgressPage = () => {
  const { data, isLoading, isError, refetch } = useGetTraineeProgressQuery();
  const progress = data?.data;
  const metrics = progress?.metrics ?? [];
  const bodyMetrics = progress?.bodyMetrics ?? [];
  const [timeframe, setTimeframe] = useState('weekly');

  const normalizedBodyMetrics = useMemo(() => {
    if (Array.isArray(bodyMetrics) && bodyMetrics.length) {
      return bodyMetrics;
    }
    return deriveBodyMetricsFromHistory(metrics);
  }, [bodyMetrics, metrics]);

  const bodyMetricEntries = useMemo(() => {
    if (!Array.isArray(normalizedBodyMetrics) || !normalizedBodyMetrics.length) {
      return [];
    }

    const sorted = [...normalizedBodyMetrics].sort((a, b) => new Date(a.recordedAt) - new Date(b.recordedAt));
    const now = new Date();
    const windowStart = new Date(now);
    if (timeframe === 'weekly') {
      windowStart.setDate(now.getDate() - 7 * 8);
    } else {
      windowStart.setMonth(now.getMonth() - 6);
    }

    const filtered = sorted.filter((entry) => {
      const entryDate = new Date(entry.recordedAt);
      return !Number.isNaN(entryDate.getTime()) && entryDate >= windowStart;
    });

    const dataset = filtered.length ? filtered : sorted.slice(-Math.min(sorted.length, 8));

    const formatLabel = (date) => (timeframe === 'weekly'
      ? date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
      : date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }));

    return dataset.map((entry) => {
      const entryDate = new Date(entry.recordedAt);
      return {
        label: formatLabel(entryDate),
        recordedAt: entry.recordedAt,
        weight: entry.weightKg ?? null,
        height: entry.heightCm ?? null,
        bmi: entry.bmi ?? null,
      };
    });
  }, [normalizedBodyMetrics, timeframe]);

  const metricCharts = useMemo(() => {
    const configs = [
      { key: 'weight', label: 'Weight', unit: 'kg', color: '#4dabf7' },
      { key: 'height', label: 'Height', unit: 'cm', color: '#94d82d' },
      { key: 'bmi', label: 'BMI', unit: '', color: '#f06595' },
    ];

    return configs.map((config) => {
      const data = bodyMetricEntries
        .filter((entry) => entry[config.key] !== undefined && entry[config.key] !== null)
        .map((entry) => ({
          label: entry.label,
          value: entry[config.key],
          recordedAt: entry.recordedAt,
        }));

      return { ...config, data };
    });
  }, [bodyMetricEntries]);

  const groupedFeedback = useMemo(() => {
    if (!Array.isArray(progress?.feedback) || !progress.feedback.length) {
      return [];
    }

    const map = new Map();
    progress.feedback.forEach((entry) => {
      const key = entry?.category ?? 'general';
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key).push(entry);
    });

    return Array.from(map.entries()).map(([category, entries]) => ({
      category,
      entries,
    }));
  }, [progress?.feedback]);

  if (isLoading) {
    return (
      <div className="dashboard-grid">
        {['Attendance insights', 'Performance metrics', 'Trainer feedback'].map((title) => (
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
          title="Unable to load progress"
          action={(
            <button type="button" onClick={() => refetch()}>
              Retry
            </button>
          )}
        >
          <EmptyState message="We ran into a problem fetching your progress data." />
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="dashboard-grid">
      <DashboardSection
        title="Body metrics"
        action={(
          <div className="body-metrics-toggle" role="group" aria-label="Select timeframe">
            {['weekly', 'monthly'].map((option) => (
              <button
                key={option}
                type="button"
                className={`body-metrics-toggle__option${timeframe === option ? ' body-metrics-toggle__option--active' : ''}`}
                onClick={() => setTimeframe(option)}
              >
                {option === 'weekly' ? 'Weekly' : 'Monthly'}
              </button>
            ))}
          </div>
        )}
      >
        <div className="body-metric-grid">
          {metricCharts.map((chart) => {
            const latestValue = chart.data.length ? chart.data[chart.data.length - 1].value : null;
            return (
              <div key={chart.key} className="body-metric-card">
                <div className="body-metric-card__header">
                  <div>
                    <small>Metric</small>
                    <strong>{chart.label}</strong>
                  </div>
                  <div className="body-metric-card__value">
                    {latestValue !== null ? (
                      <>
                        {latestValue}
                        {chart.unit ? ` ${chart.unit}` : ''}
                      </>
                    ) : (
                      '—'
                    )}
                  </div>
                </div>
                {chart.data.length ? (
                  <GrowthLineChart
                    role="trainee"
                    data={chart.data}
                    series={[{ dataKey: 'value', stroke: chart.color, label: `${chart.label}${chart.unit ? ` (${chart.unit})` : ''}` }]}
                  />
                ) : (
                  <div className="body-metric-card__empty">
                    <p>No entries logged yet.</p>
                    <small>Once your trainer records {chart.label.toLowerCase()}, it will appear here.</small>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DashboardSection>

      <DashboardSection title="Trainer feedback">
        {groupedFeedback.length ? (
          <div className="feedback-groups">
            {groupedFeedback.map((group) => (
              <article key={group.category} className="feedback-card">
                <header>
                  <span className="feedback-card__category">{formatStatus(group.category)}</span>
                  <small>{group.entries.length} update{group.entries.length > 1 ? 's' : ''}</small>
                </header>
                <ul>
                  {group.entries.map((entry, index) => (
                    <li key={`${group.category}-${index}`}>
                      <p>{entry.message}</p>
                      <small>{formatDate(entry.createdAt)}</small>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState message="Your trainer has not left fresh feedback yet." />
        )}
      </DashboardSection>


    </div>
  );
};

export default TraineeProgressPage;
