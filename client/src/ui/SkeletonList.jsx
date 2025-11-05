import PropTypes from 'prop-types';
import './Skeleton.css';

const SkeletonList = ({ rows }) => (
  <div className="skeleton-list">
    {Array.from({ length: rows }).map((_, index) => (
      <div key={index} className="skeleton skeleton--line" />
    ))}
  </div>
);

SkeletonList.propTypes = {
  rows: PropTypes.number,
};

SkeletonList.defaultProps = {
  rows: 5,
};

export default SkeletonList;
