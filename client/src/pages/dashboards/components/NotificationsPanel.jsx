import { useState } from 'react';
import PropTypes from 'prop-types';
import EmptyState from './EmptyState.jsx';
import { formatCurrency, formatDateTime, formatStatus } from '../../../utils/format.js';
import PaginationBar from '../../../ui/PaginationBar.jsx';

const PAGE_SIZE = 10;

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
  const [page, setPage] = useState(1);

  if (!Array.isArray(notifications) || !notifications.length) {
    return <EmptyState message="We will surface monetisation events here." />;
  }

  const totalItems = notifications.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const startIndex = (page - 1) * PAGE_SIZE;
  const endIndex = Math.min(page * PAGE_SIZE, totalItems);
  const pageSlice = notifications.slice(startIndex, endIndex);

  return (
    <>
      <ul className="notification-feed">
        {pageSlice.map((notification) => (
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
      <PaginationBar
        page={page}
        totalPages={totalPages}
        totalItems={totalItems}
        startIndex={startIndex + 1}
        endIndex={endIndex}
        onPage={setPage}
      />
    </>
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
