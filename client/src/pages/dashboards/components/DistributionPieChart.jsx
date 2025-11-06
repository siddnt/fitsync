import PropTypes from 'prop-types';
import { ResponsiveContainer, PieChart, Pie, Cell, Legend, Tooltip } from 'recharts';

const COLORS = ['#ff6b6b', '#4dabf7', '#20c997', '#845ef7'];

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

const DistributionPieChart = ({ role, data, valueKey, nameKey }) => {
  const fallbackData = sampleDistribution[role] ?? sampleDistribution['gym-owner'];
  const resolvedData = data?.length ? data : fallbackData;
  const resolvedValueKey = valueKey || 'value';
  const resolvedNameKey = nameKey || 'name';

  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={resolvedData}
            dataKey={resolvedValueKey}
            nameKey={resolvedNameKey}
            innerRadius={60}
            outerRadius={90}
            paddingAngle={6}
          >
            {resolvedData.map((entry, index) => (
              <Cell key={entry[resolvedNameKey]} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ background: 'rgba(18,18,18,0.95)', border: 'none' }} />
          <Legend wrapperStyle={{ color: '#fff' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

DistributionPieChart.propTypes = {
  role: PropTypes.string,
  data: PropTypes.arrayOf(PropTypes.object),
  valueKey: PropTypes.string,
  nameKey: PropTypes.string,
};

DistributionPieChart.defaultProps = {
  role: 'gym-owner',
  data: null,
  valueKey: null,
  nameKey: null,
};

export default DistributionPieChart;
