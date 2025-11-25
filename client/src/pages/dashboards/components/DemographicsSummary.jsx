import PropTypes from 'prop-types';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import DistributionPieChart from './DistributionPieChart.jsx';
import EmptyState from './EmptyState.jsx';

const DemographicsSummary = ({ gender, ageBuckets }) => {
  const genderHasData = Array.isArray(gender) && gender.some((entry) => entry.value > 0);
  const ageHasData = Array.isArray(ageBuckets) && ageBuckets.some((entry) => entry.value > 0);

  if (!genderHasData && !ageHasData) {
    return <EmptyState message="Demographic data will appear once users complete their profiles." />;
  }

  return (
    <div className="demographics-grid">
      <div className="demographics-card">
        <h4>Gender breakdown</h4>
        <DistributionPieChart
          role="admin"
          data={gender}
          valueKey="value"
          nameKey="label"
          interactive
          centerLabel="Users"
        />
      </div>

      <div className="demographics-card">
        <h4>Age distribution</h4>
        {ageHasData ? (
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={ageBuckets} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.08)" vertical={false} />
                <XAxis
                  dataKey="label"
                  stroke="rgba(255, 255, 255, 0.45)"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12 }}
                  dy={10}
                />
                <YAxis
                  stroke="rgba(255, 255, 255, 0.45)"
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  contentStyle={{ background: 'rgba(18,18,18,0.95)', border: 'none', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}
                />
                <Bar dataKey="value" fill="#845ef7" radius={[4, 4, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState message="Age distribution will show up once more users add their birth year." />
        )}
      </div>
    </div>
  );
};

DemographicsSummary.propTypes = {
  gender: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string,
      value: PropTypes.number,
    }),
  ),
  ageBuckets: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string,
      value: PropTypes.number,
    }),
  ),
};

DemographicsSummary.defaultProps = {
  gender: [],
  ageBuckets: [],
};

export default DemographicsSummary;

