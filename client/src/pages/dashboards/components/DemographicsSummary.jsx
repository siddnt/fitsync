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
        <DistributionPieChart role="admin" data={gender} valueKey="value" nameKey="label" />
      </div>

      <div className="demographics-card">
        <h4>Age distribution</h4>
        {ageHasData ? (
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={ageBuckets}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.08)" />
                <XAxis dataKey="label" stroke="rgba(255, 255, 255, 0.65)" tickLine={false} axisLine={false} />
                <YAxis stroke="rgba(255, 255, 255, 0.65)" tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: 'rgba(18,18,18,0.95)', border: 'none' }} />
                <Bar dataKey="value" fill="#845ef7" radius={[6, 6, 0, 0]} />
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
