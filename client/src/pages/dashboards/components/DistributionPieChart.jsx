import PropTypes from 'prop-types';
import { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Legend, Tooltip } from 'recharts';

const COLORS = ['#845ef7', '#4dabf7', '#ff6b6b', '#ffd43b', '#20c997', '#94d82d', '#5c7cfa', '#ff922b'];

const sampleDistribution = {
  'gym-owner': [
    { name: 'Male', value: 62 },
    { name: 'Female', value: 35 },
    { name: 'Non-binary', value: 3 },
  ],
  admin: [
    { name: 'Listing', value: 45 },
    { name: 'Sponsorship', value: 22 },
    { name: 'Marketplace', value: 33 },
  ],
};

const numberFormatter = new Intl.NumberFormat('en-IN');
const defaultFormatter = (value) => numberFormatter.format(Number(value) || 0);

const slugify = (value) => {
  if (!value) {
    return 'segment';
  }
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
};

const DistributionPieChart = ({ role, data, valueKey, nameKey, interactive, valueFormatter, centerLabel }) => {
  const fallbackData = sampleDistribution[role] ?? sampleDistribution['gym-owner'];
  const resolvedData = data?.length ? data : fallbackData;
  const resolvedValueKey = valueKey || 'value';
  const resolvedNameKey = nameKey || 'name';
  const formatter = valueFormatter || defaultFormatter;

  const decoratedData = useMemo(
    () =>
      resolvedData.map((entry, index) => {
        const name = entry?.[resolvedNameKey] ?? `Segment ${index + 1}`;
        const id = entry?.id ?? (slugify(name) || `segment-${index}`);
        const value = Number(entry?.[resolvedValueKey]) || 0;
        return {
          ...entry,
          id,
          name,
          value,
          color: entry?.color || COLORS[index % COLORS.length],
        };
      }),
    [resolvedData, resolvedNameKey, resolvedValueKey],
  );

  const [hiddenKeys, setHiddenKeys] = useState([]);

  useEffect(() => {
    setHiddenKeys((prev) => prev.filter((key) => decoratedData.some((entry) => entry.id === key)));
  }, [decoratedData]);

  const activeData = interactive
    ? decoratedData.filter((entry) => !hiddenKeys.includes(entry.id))
    : decoratedData;

  const totalVisible = activeData.reduce((sum, entry) => sum + entry.value, 0);
  const hasData = decoratedData.length > 0;

  const toggleKey = (key) => {
    setHiddenKeys((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]));
  };

  const topEntry = activeData.reduce((best, entry) => {
    if (!best || entry.value > best.value) {
      return entry;
    }
    return best;
  }, null);

  const legendContent = interactive && hasData ? (
    <ul className="pie-legend">
      {decoratedData.map((entry) => {
        const isMuted = hiddenKeys.includes(entry.id);
        const share = totalVisible ? ((entry.value / totalVisible) * 100).toFixed(1) : 0;
        return (
          <li key={entry.id}>
            <button
              type="button"
              className={`pie-legend__button${isMuted ? ' pie-legend__button--muted' : ''}`}
              onClick={() => toggleKey(entry.id)}
            >
              <span
                className="pie-legend__marker"
                style={{ backgroundColor: entry.color, opacity: isMuted ? 0.4 : 1 }}
              />
              <span className="pie-legend__label">
                <strong>{entry.name}</strong>
                <small>
                  {formatter(entry.value)}
                  {totalVisible ? ` · ${share}%` : ''}
                </small>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  ) : null;

  const displayData = activeData.length ? activeData : [];
  const emptyMessage = hasData
    ? 'No segments selected. Use the legend below to toggle categories.'
    : 'No data available yet.';

  const shouldShowLegend = Boolean(legendContent);

  return (
    <div className={`chart-container chart-container--donut${interactive ? ' chart-container--interactive' : ''}`}>
      {displayData.length ? (
        <div className={`pie-layout${shouldShowLegend ? ' pie-layout--with-legend' : ''}`}>
          <div className="pie-layout__chart">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={displayData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={84}
                  outerRadius={106}
                  paddingAngle={1.5}
                  cornerRadius={16}
                  stroke="rgba(6,6,6,0.6)"
                  strokeWidth={1}
                >
                  {displayData.map((entry) => (
                    <Cell
                      key={entry.id}
                      fill={entry.color}
                      fillOpacity={hiddenKeys.includes(entry.id) ? 0.35 : 1}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'rgba(18,18,18,0.95)', border: 'none' }}
                  formatter={(value, name, payload) => [formatter(value), payload?.payload?.name ?? name]}
                />
                {interactive ? null : <Legend wrapperStyle={{ color: '#fff' }} />}
              </PieChart>
            </ResponsiveContainer>
            <div className="pie-center">
              <span>{centerLabel}</span>
              <strong>{formatter(totalVisible)}</strong>
              {topEntry ? <small>Top: {topEntry.name}</small> : null}
            </div>
          </div>
          {shouldShowLegend ? <div className="pie-layout__legend">{legendContent}</div> : null}
        </div>
      ) : (
        <p className="empty-state">{emptyMessage}</p>
      )}
    </div>
  );
};

DistributionPieChart.propTypes = {
  role: PropTypes.string,
  data: PropTypes.arrayOf(PropTypes.object),
  valueKey: PropTypes.string,
  nameKey: PropTypes.string,
  interactive: PropTypes.bool,
  valueFormatter: PropTypes.func,
  centerLabel: PropTypes.string,
};

DistributionPieChart.defaultProps = {
  role: 'gym-owner',
  data: null,
  valueKey: null,
  nameKey: null,
  interactive: false,
  valueFormatter: null,
  centerLabel: 'Total',
};

export default DistributionPieChart;
