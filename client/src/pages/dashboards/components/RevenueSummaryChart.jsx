import PropTypes from 'prop-types';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';

const sampleData = {
  trainee: [
    { label: 'Week 1', payments: 4200, orders: 3 },
    { label: 'Week 2', payments: 3800, orders: 4 },
    { label: 'Week 3', payments: 5200, orders: 5 },
    { label: 'Week 4', payments: 6100, orders: 4 },
  ],
  'gym-owner': [
    { label: 'Jan', subscriptions: 12000, earnings: 36000, expenses: 9000 },
    { label: 'Feb', subscriptions: 14000, earnings: 42000, expenses: 12000 },
    { label: 'Mar', subscriptions: 16000, earnings: 47000, expenses: 15000 },
    { label: 'Apr', subscriptions: 15000, earnings: 45000, expenses: 18000 },
  ],
  admin: [
    { label: 'Week 1', listing: 5400, sponsorship: 2400, marketplace: 3200 },
    { label: 'Week 2', listing: 6000, sponsorship: 2800, marketplace: 3500 },
    { label: 'Week 3', listing: 5800, sponsorship: 2600, marketplace: 3300 },
    { label: 'Week 4', listing: 6400, sponsorship: 3000, marketplace: 3900 },
  ],
};


const formatAxisTick = (value) => {
  if (!Number.isFinite(value)) {
    return value;
  }

  const abs = Math.abs(value);
  const trim = (num) => num.replace(/\.0+$/, '');

  if (abs >= 100000) {
    return `${trim((value / 100000).toFixed(abs >= 1000000 ? 1 : 2))}L`;
  }

  if (abs >= 1000) {
    return `${trim((value / 1000).toFixed(abs >= 10000 ? 0 : 1))}k`;
  }

  return value.toString();
};

const RevenueSummaryChart = ({ role, data, valueKey, labelKey, series }) => {
  const fallbackData = sampleData[role] ?? sampleData.trainee;
  const resolvedData = data?.length ? data : fallbackData;
  const resolvedValueKey = valueKey || (role === 'gym-owner' ? 'earnings' : 'listing');
  const resolvedLabelKey = labelKey || 'label';
  const hasCustomSeries = Array.isArray(series) && series.length > 0;

  const defaultSeries = [{
    dataKey: resolvedValueKey,
    stroke: 'var(--primary-color)',
    fill: 'url(#revenueGradient)',
    fillOpacity: 1,
    type: 'monotone',
  }];

  const resolvedSeries = hasCustomSeries
    ? series.map((item, index) => ({
        dataKey: item.dataKey,
        stroke: item.stroke || ['#22c55e', '#f87171', '#38bdf8'][index % 3],
        fill: item.fill,
        fillOpacity: item.fillOpacity ?? 0.18,
        type: item.type || 'monotone',
        name: item.name,
      }))
    : defaultSeries;

  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={resolvedData} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
          {!hasCustomSeries && (
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--primary-color)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--primary-color)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
          )}
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.12)" />
          <XAxis dataKey={resolvedLabelKey} stroke="rgba(255,255,255,0.55)" />
          <YAxis stroke="rgba(255,255,255,0.55)" tickFormatter={formatAxisTick} width={60} />
          <Tooltip contentStyle={{ background: 'rgba(18,18,18,0.95)', border: 'none' }} />
          {hasCustomSeries && <Legend verticalAlign="top" height={26} iconType="circle" />}
          {resolvedSeries.map((serie) => (
            <Area
              key={serie.dataKey}
              type={serie.type}
              dataKey={serie.dataKey}
              stroke={serie.stroke}
              fill={serie.fill || `${serie.stroke}33`}
              fillOpacity={serie.fillOpacity}
              name={serie.name}
              dot={false}
              activeDot={{ r: 3 }}
            />
          ))}
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
  series: PropTypes.arrayOf(PropTypes.shape({
    dataKey: PropTypes.string.isRequired,
    stroke: PropTypes.string,
    fill: PropTypes.string,
    fillOpacity: PropTypes.number,
    type: PropTypes.string,
    name: PropTypes.string,
  })),
};

RevenueSummaryChart.defaultProps = {
  role: 'gym-owner',
  data: null,
  valueKey: null,
  labelKey: null,
  series: null,
};

export default RevenueSummaryChart;
