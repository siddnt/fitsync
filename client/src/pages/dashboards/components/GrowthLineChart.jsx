import PropTypes from 'prop-types';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend } from 'recharts';

const sampleGrowth = {
  'gym-owner': [
    { label: 'Jan', subscriptions: 32, earnings: 44 },
    { label: 'Feb', subscriptions: 35, earnings: 48 },
    { label: 'Mar', subscriptions: 37, earnings: 52 },
    { label: 'Apr', subscriptions: 40, earnings: 55 },
  ],
  admin: [
    { label: 'Week 1', listing: 5400, sponsorship: 2400, marketplace: 3200 },
    { label: 'Week 2', listing: 6000, sponsorship: 2800, marketplace: 3500 },
    { label: 'Week 3', listing: 5800, sponsorship: 2600, marketplace: 3300 },
    { label: 'Week 4', listing: 6400, sponsorship: 3000, marketplace: 3900 },
  ],
};

const GrowthLineChart = ({ role, data, series }) => {
  const fallbackData = sampleGrowth[role] ?? sampleGrowth['gym-owner'];
  const resolvedData = data?.length ? data : fallbackData;

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

  const resolvedSeries = series?.length ? series : defaultSeries[role] ?? defaultSeries['gym-owner'];

  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height={260}>
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

GrowthLineChart.defaultProps = {
  role: 'gym-owner',
  data: null,
  series: null,
};

export default GrowthLineChart;
