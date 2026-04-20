import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../app/hooks.js';
import { authActions } from '../../features/auth/authSlice.js';
import { useLoginMutation } from '../../services/authApi.js';
import './AuthPage.css';

const LoginPage = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const role = searchParams.get('role');
  const { status, error, user } = useAppSelector((state) => state.auth);
  const [login, { isLoading }] = useLoginMutation();
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit } = useForm();

  useEffect(() => {
    if (user && user.status !== 'suspended') {
      navigate(`/dashboard/${user.role ?? 'trainee'}`, { replace: true });
    }
  }, [user, navigate]);

  const onSubmit = async (values) => {
    try {
      dispatch(authActions.authPending());
      const apiResponse = await login({ ...values, role }).unwrap();
      const authPayload = apiResponse?.data ?? apiResponse;

      dispatch(authActions.authSuccess(authPayload));

      if (authPayload?.user?.status === 'suspended') {
        // Don't navigate — show deactivation notice on this page
        return;
      }

      navigate(`/dashboard/${authPayload?.user?.role ?? 'trainee'}`);
    } catch (err) {
      dispatch(authActions.authFailure(err?.data?.message ?? 'Login failed'));
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-layout">
        <aside className="auth-hero">
          <p className="auth-hero__kicker">Welcome Back</p>
          <h1>Your Fitness Command Center</h1>
          <p className="auth-hero__lede">Log in to manage your workouts, clients, or facility from one powerful dashboard.</p>
          <div className="auth-hero__pill-row">
            <span className="auth-pill">Trainees</span>
            <span className="auth-pill">Trainers</span>
            <span className="auth-pill">Gym Owners</span>
          </div>
          <ul className="auth-hero__points">
            <li><strong>Trainees:</strong> Check your schedule and stats.</li>
            <li><strong>Trainers:</strong> Review client progress and bookings.</li>
            <li><strong>Owners:</strong> Monitor gym performance and revenue.</li>
          </ul>
        </aside>

        <form className="auth-card" onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="auth-card__header">
            <h2>Welcome back</h2>
            <p className="auth-card__subtitle">Sign in to manage your fitness journey.</p>
          </div>

          <div className="auth-card__fields">
            <label>
              <span>Email</span>
              <input type="email" {...register('email')} placeholder="you@example.com" autoComplete="email" />
            </label>

            <label>
              <span>Password</span>
              <div className="password-input-wrapper">
                <input
                  type={showPassword ? 'text' : 'password'}
                  {...register('password')}
                  placeholder="********"
                  autoComplete="current-password"
                  style={{ paddingRight: '40px' }}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </label>
          </div>

          {status === 'failed' && <p className="form-error">{error}</p>}

          {user?.status === 'suspended' && (
            <div className="form-error" style={{ background: 'rgba(255,107,107,0.1)', border: '1px solid var(--danger-color, #ff6b6b)', borderRadius: '8px', padding: '1rem', textAlign: 'center' }}>
              <strong>Account Deactivated</strong>
              <p style={{ margin: '0.5rem 0 0' }}>Your account has been deactivated by an administrator. You cannot access your dashboard until it is reactivated. Please contact support for assistance.</p>
            </div>
          )}

          <button type="submit" className="primary-button" disabled={isLoading}>
            {isLoading ? 'Signing in...' : 'Sign in'}
          </button>

          <p className="auth-card__switch">
            New here? <a href="/auth/register">Create an account</a>
          </p>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
