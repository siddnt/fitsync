import PropTypes from 'prop-types';
import './DashboardSection.css';

const DashboardSection = ({ title, action, children }) => (
  <section className="dashboard-section">
    <header>
      <h2>{title}</h2>
      {action}
    </header>
    <div className="dashboard-section__body">{children}</div>
  </section>
);

DashboardSection.propTypes = {
  title: PropTypes.string.isRequired,
  action: PropTypes.node,
  children: PropTypes.node,
};

DashboardSection.defaultProps = {
  action: null,
  children: null,
};

export default DashboardSection;
