import { useState } from 'react';
import PropTypes from 'prop-types';
import './DashboardSection.css';

const DashboardSection = ({ title, action, children, className, collapsible }) => {
  const [collapsed, setCollapsed] = useState(false);
  const sectionClassName = [
    'dashboard-section',
    className,
    collapsible ? 'dashboard-section--collapsible' : '',
    collapsed ? 'dashboard-section--collapsed' : '',
  ].filter(Boolean).join(' ');

  return (
    <section className={sectionClassName}>
      <header
        onClick={collapsible ? () => setCollapsed((c) => !c) : undefined}
        style={collapsible ? { cursor: 'pointer', userSelect: 'none' } : undefined}
      >
        <h2>
          {collapsible && <span className="dashboard-section__chevron">{collapsed ? '›' : '‹'}</span>}
          {title}
        </h2>
        {action}
      </header>
      {!collapsed && <div className="dashboard-section__body">{children}</div>}
    </section>
  );
};

DashboardSection.propTypes = {
  title: PropTypes.string.isRequired,
  action: PropTypes.node,
  children: PropTypes.node,
  className: PropTypes.string,
  collapsible: PropTypes.bool,
};

DashboardSection.defaultProps = {
  action: null,
  children: null,
  className: '',
  collapsible: false,
};

export default DashboardSection;
