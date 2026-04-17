import PropTypes from 'prop-types';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import EmptyState from './EmptyState.jsx';

const GrowthLineChart = ({ role = 'gym-owner', data = null, series = null }) => {
  const resolvedData = Array.isArray(data) ? data : [];

  const defaultSeries = {
    'gym-owner': [
      { dataKey: 'subscriptions', stroke: '#ff6b6b', label: 'Listing fees' },
      { dataKey: 'earnings', stroke: '#51cf66', label: 'Member earnings' },
    ],
    admin: [
      { dataKey: 'listing', stroke: '#ff6b6b', label: 'Listing' },
      { dataKey: 'sponsorship', stroke: '#845ef7', label: 'Sponsorship' },
      { dataKey: 'marketplace', stroke: '#51cf66', label: 'Marketplace' },
    ],
  };

  const resolvedSeries = Array.isArray(series) && series.length
    ? series
    : defaultSeries[role] ?? [];

  if (!resolvedData.length || !resolvedSeries.length) {
    return <EmptyState message="No chart data available yet." />;
  }

  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height={260} minWidth={0}>
        <LineChart data={resolvedData} margin={{ top: 12, right: 16, bottom: 4, left: -8 }}>
          <XAxis dataKey="label" stroke="rgba(255,255,255,0.55)" />
          <YAxis stroke="rgba(255,255,255,0.55)" />
          <Tooltip contentStyle={{ background: 'rgba(18,18,18,0.95)', border: 'none' }} />
          <Legend wrapperStyle={{ color: '#fff' }} />
          {resolvedSeries.map((line) => (
            <Line
              key={line.dataKey}
              type="monotone"
              dataKey={line.dataKey}
              stroke={line.stroke}
              name={line.label}
              strokeWidth={3}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

GrowthLineChart.propTypes = {
  role: PropTypes.string,
  data: PropTypes.arrayOf(PropTypes.object),
  series: PropTypes.arrayOf(
    PropTypes.shape({
      dataKey: PropTypes.string.isRequired,
      stroke: PropTypes.string,
      label: PropTypes.string,
    }),
  ),
};

export default GrowthLineChart;
