import PropTypes from 'prop-types';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

const sampleData = {
  trainee: [
    { label: 'Week 1', payments: 4200, orders: 3 },
    { label: 'Week 2', payments: 3800, orders: 4 },
    { label: 'Week 3', payments: 5200, orders: 5 },
    { label: 'Week 4', payments: 6100, orders: 4 },
  ],
  'gym-owner': [
    { label: 'Jan', subscriptions: 12000, earnings: 36000 },
    { label: 'Feb', subscriptions: 14000, earnings: 42000 },
    { label: 'Mar', subscriptions: 16000, earnings: 47000 },
    { label: 'Apr', subscriptions: 15000, earnings: 45000 },
  ],
  admin: [
    { label: 'Week 1', listing: 5400, sponsorship: 2400, marketplace: 3200 },
    { label: 'Week 2', listing: 6000, sponsorship: 2800, marketplace: 3500 },
    { label: 'Week 3', listing: 5800, sponsorship: 2600, marketplace: 3300 },
    { label: 'Week 4', listing: 6400, sponsorship: 3000, marketplace: 3900 },
  ],
};

const RevenueSummaryChart = ({ role, data, valueKey, labelKey }) => {
  const fallbackData = sampleData[role] ?? sampleData.trainee;
  const resolvedData = data?.length ? data : fallbackData;
  const resolvedValueKey = valueKey || (role === 'gym-owner' ? 'earnings' : 'listing');
  const resolvedLabelKey = labelKey || 'label';

  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={resolvedData} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
          <defs>
            <linearGradient id="a" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--primary-color)" stopOpacity={0.8} />
              <stop offset="95%" stopColor="var(--primary-color)" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.12)" />
          <XAxis dataKey={resolvedLabelKey} stroke="rgba(255,255,255,0.55)" />
          <YAxis stroke="rgba(255,255,255,0.55)" />
          <Tooltip contentStyle={{ background: 'rgba(18,18,18,0.95)', border: 'none' }} />
          <Area type="monotone" dataKey={resolvedValueKey} stroke="var(--primary-color)" fill="url(#a)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

RevenueSummaryChart.propTypes = {
  role: PropTypes.string,
  data: PropTypes.arrayOf(PropTypes.object),
  valueKey: PropTypes.string,
  labelKey: PropTypes.string,
};

RevenueSummaryChart.defaultProps = {
  role: 'gym-owner',
  data: null,
  valueKey: null,
  labelKey: null,
};

export default RevenueSummaryChart;
