import PropTypes from 'prop-types';
import '../Dashboard.css';

const EmptyState = ({ message }) => <p className="empty-state">{message}</p>;

EmptyState.propTypes = {
  message: PropTypes.string.isRequired,
};

export default EmptyState;
