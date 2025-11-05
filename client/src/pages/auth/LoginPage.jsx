import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../app/hooks.js';
import { authActions } from '../../features/auth/authSlice.js';
import { useLoginMutation } from '../../services/authApi.js';
import './AuthPage.css';

const schema = yup.object({
  email: yup.string().email('Enter a valid email').required('Email is required'),
  password: yup.string().min(6, 'Password must have at least 6 characters').required('Password is required'),
});

const LoginPage = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const role = searchParams.get('role');
  const { status, error, user } = useAppSelector((state) => state.auth);
  const [login, { isLoading }] = useLoginMutation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ resolver: yupResolver(schema) });

  useEffect(() => {
    if (user) {
      navigate(`/dashboard/${user.role ?? 'trainee'}`, { replace: true });
    }
  }, [user, navigate]);

  const onSubmit = async (values) => {
    try {
      dispatch(authActions.authPending());
      const apiResponse = await login({ ...values, role }).unwrap();
      const authPayload = apiResponse?.data ?? apiResponse;

      dispatch(authActions.authSuccess(authPayload));
      navigate(`/dashboard/${authPayload?.user?.role ?? 'trainee'}`);
    } catch (err) {
      dispatch(authActions.authFailure(err?.data?.message ?? 'Login failed'));
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit(onSubmit)}>
        <h1>Welcome back</h1>
        <p className="auth-card__subtitle">Sign in to manage your fitness journey.</p>

        <label>
          <span>Email</span>
          <input type="email" {...register('email')} placeholder="you@example.com" autoComplete="email" />
          {errors.email && <p className="input-error">{errors.email.message}</p>}
        </label>

        <label>
          <span>Password</span>
          <input type="password" {...register('password')} placeholder="••••••••" autoComplete="current-password" />
          {errors.password && <p className="input-error">{errors.password.message}</p>}
        </label>

        {status === 'failed' && <p className="form-error">{error}</p>}

        <button type="submit" className="primary-button" disabled={isLoading}>
          {isLoading ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="auth-card__switch">
          New here? <a href="/auth/register">Create an account</a>
        </p>
      </form>
    </div>
  );
};

export default LoginPage;
