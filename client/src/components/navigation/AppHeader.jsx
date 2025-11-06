import { useCallback } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../app/hooks.js';
import { authActions } from '../../features/auth/authSlice.js';
import { useLogoutMutation } from '../../services/authApi.js';
import './AppHeader.css';

const AppHeader = () => {
  const { user } = useAppSelector((state) => state.auth);
  const cartItemCount = useAppSelector((state) =>
    state.cart.items.reduce((total, item) => total + (item.quantity || 0), 0),
  );
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [logout, { isLoading: isLoggingOut }] = useLogoutMutation();

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

  return (
    <header className="app-header">
      <div className="app-header__brand">
        <Link to="/">FitSync</Link>
      </div>
      <nav className="app-header__nav">
        <NavLink to="/gyms">Gyms</NavLink>
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
        {user?.role === 'admin' && (
          <NavLink to="/dashboard/admin">Admin</NavLink>
        )}
      </nav>
      <div className="app-header__cta">
        {user ? (
          <>
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
  );
};

export default AppHeader;
