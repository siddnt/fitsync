import PropTypes from 'prop-types';
import './Skeleton.css';

const SkeletonPanel = ({ lines }) => (
  <div className="skeleton-panel">
    {Array.from({ length: lines }).map((_, index) => (
      <div key={index} className="skeleton skeleton--line" />
    ))}
  </div>
);

SkeletonPanel.propTypes = {
  lines: PropTypes.number,
};

SkeletonPanel.defaultProps = {
  lines: 8,
};

export default SkeletonPanel;
