import PropTypes from 'prop-types';
import EmptyState from './EmptyState.jsx';
import { formatCurrency, formatDateTime, formatStatus } from '../../../utils/format.js';

const resolveBadgeClass = (type) => {
  switch (type) {
    case 'listing':
    case 'sponsorship':
      return 'status-pill status-pill--info';
    case 'marketplace':
    case 'seller':
      return 'status-pill status-pill--success';
    case 'alert':
    case 'warning':
      return 'status-pill status-pill--warning';
    default:
      return 'status-pill';
  }
};

const NotificationsPanel = ({ notifications }) => {
  if (!Array.isArray(notifications) || !notifications.length) {
    return <EmptyState message="We will surface monetisation events here." />;
  }

  return (
    <ul className="notification-feed">
      {notifications.map((notification) => (
        <li key={notification.id} className="notification-feed__item">
          <div className="notification-feed__meta">
            <span className={resolveBadgeClass(notification.type)}>
              {formatStatus(notification.type)}
            </span>
            <span className="notification-feed__time">{formatDateTime(notification.createdAt)}</span>
          </div>
          <p className="notification-feed__message">{notification.message}</p>
          {notification.amount ? (
            <p className="notification-feed__amount">{formatCurrency({ amount: notification.amount })}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
};

NotificationsPanel.propTypes = {
  notifications: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      type: PropTypes.string,
      amount: PropTypes.number,
      message: PropTypes.string,
      createdAt: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
    }),
  ),
};

NotificationsPanel.defaultProps = {
  notifications: [],
};

export default NotificationsPanel;
