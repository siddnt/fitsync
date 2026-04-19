import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
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

const NotificationsPanel = ({
  notifications = [],
  emptyMessage = 'We will surface monetisation events here.',
}) => {
  if (!Array.isArray(notifications) || !notifications.length) {
    return <EmptyState message={emptyMessage} />;
  }

  return (
    <ul className="notification-feed">
      {notifications.map((notification) => {
        const content = (
          <>
            <div className="notification-feed__meta">
              <span className={resolveBadgeClass(notification.type)}>
                {formatStatus(notification.type)}
              </span>
              <span className="notification-feed__time">{formatDateTime(notification.createdAt)}</span>
            </div>
            {notification.title ? (
              <p className="notification-feed__title">{notification.title}</p>
            ) : null}
            <p className="notification-feed__message">{notification.message}</p>
            {notification.amount ? (
              <p className="notification-feed__amount">{formatCurrency({ amount: notification.amount, currency: notification.currency })}</p>
            ) : null}
          </>
        );

        return (
          <li key={notification.id} className="notification-feed__item">
            {notification.link ? (
              <Link to={notification.link} className="notification-feed__link">
                {content}
              </Link>
            ) : content}
          </li>
        );
      })}
    </ul>
  );
};

NotificationsPanel.propTypes = {
  notifications: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      type: PropTypes.string,
      amount: PropTypes.oneOfType([
        PropTypes.number,
        PropTypes.shape({
          amount: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
          currency: PropTypes.string,
        }),
      ]),
      currency: PropTypes.string,
      title: PropTypes.string,
      link: PropTypes.string,
      message: PropTypes.string,
      createdAt: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
    }),
  ),
  emptyMessage: PropTypes.string,
};

export default NotificationsPanel;
