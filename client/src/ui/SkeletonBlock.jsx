import PropTypes from 'prop-types';
import './Skeleton.css';

const SkeletonBlock = ({ className }) => (
  <div className={`skeleton ${className}`.trim()} aria-hidden="true" />
);

SkeletonBlock.propTypes = {
  className: PropTypes.string,
};

SkeletonBlock.defaultProps = {
  className: '',
};

export default SkeletonBlock;
