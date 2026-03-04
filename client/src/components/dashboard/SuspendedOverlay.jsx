import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { authActions } from '../../features/auth/authSlice.js';
import { useLogoutMutation } from '../../services/authApi.js';
import './SuspendedOverlay.css';

const SuspendedOverlay = ({ userName }) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [logout] = useLogoutMutation();

  const handleLogout = async () => {
    try {
      await logout().unwrap();
    } catch {
      /* silent */
    }
    dispatch(authActions.signOut());
    navigate('/');
  };

  return (
    <div className="suspended-overlay">
      <div className="suspended-overlay__card">
        <div className="suspended-overlay__icon">🚫</div>
        <h2 className="suspended-overlay__title">Account Deactivated</h2>
        <p className="suspended-overlay__message">
          Hi{userName ? ` ${userName}` : ''}, your account has been deactivated by an administrator.
          You are currently unable to access your dashboard or perform any actions until your account is reactivated.
        </p>
        <p className="suspended-overlay__detail">
          If you believe this is a mistake or need more information, please reach out to our support team.
        </p>
        <div className="suspended-overlay__actions">
          <button type="button" className="suspended-overlay__btn suspended-overlay__btn--home" onClick={() => navigate('/')}>
            Go to Home
          </button>
          <button type="button" className="suspended-overlay__btn suspended-overlay__btn--contact" onClick={() => navigate('/contact')}>
            Contact Support
          </button>
          <button type="button" className="suspended-overlay__btn suspended-overlay__btn--logout" onClick={handleLogout}>
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
};

export default SuspendedOverlay;
