import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../app/hooks.js';
import { authActions } from '../../features/auth/authSlice.js';
import { useLogoutMutation } from '../../services/authApi.js';
import {
  useGetMyNotificationsQuery,
  useMarkNotificationsReadMutation,
} from '../../services/userApi.js';
import { formatDateTime, formatStatus } from '../../utils/format.js';
import logo from '../../assets/logo.png';
import './AppHeader.css';

const AppHeader = () => {
  const { user } = useAppSelector((state) => state.auth);
  const cartItemCount = useAppSelector((state) =>
    state.cart.items.reduce((total, item) => total + (item.quantity || 0), 0),
  );
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [logout, { isLoading: isLoggingOut }] = useLogoutMutation();
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const notificationRef = useRef(null);
  const {
    data: notificationsResponse,
    refetch: refetchNotifications,
  } = useGetMyNotificationsQuery(
    { limit: 8, unreadOnly: false },
    { skip: !user },
  );
  const [markNotificationsRead, { isLoading: isMarkingRead }] = useMarkNotificationsReadMutation();

  const notifications = notificationsResponse?.data?.notifications ?? [];
  const unreadNotifications = useMemo(
    () => notifications.filter((notification) => !notification.readAt),
    [notifications],
  );

  const handleLogout = useCallback(async () => {
    try {
      await logout().unwrap();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to logout via API:', error);
    } finally {
      dispatch(authActions.signOut());
      navigate('/', { replace: true });
    }
  }, [dispatch, navigate, logout]);

  useEffect(() => {
    if (!isNotificationOpen) {
      return undefined;
    }

    const handleClickOutside = (event) => {
      if (!notificationRef.current?.contains(event.target)) {
        setIsNotificationOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isNotificationOpen]);

  const handleToggleNotifications = async () => {
    const nextOpen = !isNotificationOpen;
    setIsNotificationOpen(nextOpen);

    if (nextOpen) {
      refetchNotifications();
      if (unreadNotifications.length) {
        try {
          await markNotificationsRead(unreadNotifications.map((notification) => notification.id)).unwrap();
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Failed to mark notifications read:', error);
        }
      }
    }
  };

  return (
    <>
      <header className="app-header">
      <div className="app-header__brand">
        <Link to="/">
          <img src={logo} alt="FitSync" className="app-logo" />
          <span>FitSync</span>
        </Link>
      </div>
      <nav className="app-header__nav">
        <NavLink to="/gyms">Gyms</NavLink>
        <NavLink to="/about">About Us</NavLink>
        <NavLink to="/marketplace">Marketplace</NavLink>
        <NavLink
          to="/cart"
          className={({ isActive }) => `app-header__cart${isActive ? ' active' : ''}`}
        >
          Cart
          {cartItemCount > 0 ? (
            <span className="app-header__cart-count">{cartItemCount}</span>
          ) : null}
        </NavLink>
        {user?.role === 'gym-owner' && (
          <NavLink to="/dashboard/gym-owner">Owner Console</NavLink>
        )}
        {user?.role === 'trainee' && (
          <NavLink to="/dashboard/trainee">My Dashboard</NavLink>
        )}
        {user?.role === 'seller' && (
          <NavLink to="/dashboard/seller">Seller Console</NavLink>
        )}
        {user?.role === 'trainer' && (
          <NavLink to="/dashboard/trainer">Trainer Console</NavLink>
        )}
        {user?.role === 'manager' && (
          <NavLink to="/dashboard/manager">Manager Console</NavLink>
        )}
        {user?.role === 'admin' && (
          <NavLink to="/dashboard/admin">Admin</NavLink>
        )}
      </nav>
      <div className="app-header__cta">
        {user ? (
          <>
            <div className="app-header__notifications" ref={notificationRef}>
              <button
                type="button"
                className={`app-header__notification-button${isNotificationOpen ? ' app-header__notification-button--open' : ''}`}
                onClick={handleToggleNotifications}
                aria-label="Open notifications"
              >
                <span className="app-header__notification-icon" aria-hidden="true">🔔</span>
                {unreadNotifications.length ? (
                  <span className="app-header__notification-count">
                    {unreadNotifications.length > 9 ? '9+' : unreadNotifications.length}
                  </span>
                ) : null}
              </button>

              {isNotificationOpen ? (
                <div className="app-header__notification-panel">
                  <div className="app-header__notification-panel-header">
                    <strong>Notifications</strong>
                    <small>{unreadNotifications.length} unread</small>
                  </div>
                  {notifications.length ? (
                    <ul className="app-header__notification-list">
                      {notifications.map((notification) => (
                        <li
                          key={notification.id}
                          className={`app-header__notification-item${notification.readAt ? '' : ' app-header__notification-item--unread'}`}
                        >
                          <div className="app-header__notification-item-meta">
                            <span className="app-header__notification-type">{formatStatus(notification.type)}</span>
                            <small>{formatDateTime(notification.createdAt)}</small>
                          </div>
                          <p>{notification.message}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="app-header__notification-empty">
                      No notifications yet.
                    </div>
                  )}
                  <div className="app-header__notification-panel-footer">
                    <button
                      type="button"
                      className="app-header__notification-refresh"
                      onClick={() => refetchNotifications()}
                      disabled={isMarkingRead}
                    >
                      Refresh
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
            <NavLink to="/profile" className="app-header__link">
              {user.firstName ?? user.email}
            </NavLink>
            <button
              type="button"
              className="app-header__logout"
              onClick={handleLogout}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? 'Signing out…' : 'Logout'}
            </button>
          </>
        ) : (
          <NavLink to="/auth/login" className="app-header__button">
            Sign In
          </NavLink>
        )}
      </div>
    </header>
    </>
  );
};

export default AppHeader;
