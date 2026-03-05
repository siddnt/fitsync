import { useEffect } from 'react';
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

  const { register, handleSubmit } = useForm({
    defaultValues: {
      rememberMe: true,
    },
  });

  useEffect(() => {
    if (user) {
      navigate(`/dashboard/${user.role ?? 'trainee'}`, { replace: true });
    }
  }, [user, navigate]);

  const onSubmit = async (values) => {
    try {
      dispatch(authActions.authPending());
      const apiResponse = await login({
        ...values,
        role,
        rememberMe: Boolean(values?.rememberMe),
      }).unwrap();
      const authPayload = apiResponse?.data ?? apiResponse;

      dispatch(authActions.authSuccess(authPayload));
      navigate(`/dashboard/${authPayload?.user?.role ?? 'trainee'}`);
    } catch (err) {
      const resolvedMessage = (
        err?.data?.message
        || (typeof err?.data === 'string' ? err.data : '')
        || err?.error
        || ''
      ).trim();

      if (/failed to fetch|networkerror|network request failed/i.test(resolvedMessage)) {
        dispatch(authActions.authFailure('Unable to reach server. Start backend and verify API/CORS config.'));
        return;
      }

      dispatch(authActions.authFailure(resolvedMessage || 'Login failed'));
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
              <input type="password" {...register('password')} placeholder="********" autoComplete="current-password" />
            </label>

            <label className="auth-checkbox">
              <input type="checkbox" {...register('rememberMe')} />
              <span>Remember me for 30 days</span>
            </label>
          </div>

          {status === 'failed' && <p className="form-error">{error}</p>}

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
