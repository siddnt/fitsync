import PropTypes from 'prop-types';
import './DashboardSection.css';

const DashboardSection = ({ title, action, children, className }) => {
  const sectionClassName = className ? `dashboard-section ${className}` : 'dashboard-section';

  return (
    <section className={sectionClassName}>
      <header>
        <h2>{title}</h2>
        {action}
      </header>
      <div className="dashboard-section__body">{children}</div>
    </section>
  );
};

DashboardSection.propTypes = {
  title: PropTypes.string.isRequired,
  action: PropTypes.node,
  children: PropTypes.node,
  className: PropTypes.string,
};

DashboardSection.defaultProps = {
  action: null,
  children: null,
  className: '',
};

export default DashboardSection;
