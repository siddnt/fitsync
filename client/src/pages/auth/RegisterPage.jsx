import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useAppDispatch, useAppSelector } from '../../app/hooks.js';
import { authActions } from '../../features/auth/authSlice.js';
import { useRegisterMutation } from '../../services/authApi.js';
import './AuthPage.css';

const roles = ['trainee', 'trainer', 'gym-owner', 'seller'];

const baseSchema = {
  firstName: yup.string().required('First name is required'),
  lastName: yup.string().required('Last name is required'),
  email: yup.string().email('Provide a valid email').required('Email is required'),
  password: yup.string().min(6, 'Password must have at least 6 characters').required('Password is required'),
  confirmPassword: yup
    .string()
    .oneOf([yup.ref('password'), null], 'Passwords must match')
    .required('Confirm your password'),
  role: yup.string().oneOf(roles).required('Select a role'),
};

const schema = yup.object().shape(baseSchema).noUnknown();

const RegisterPage = () => {
  const dispatch = useAppDispatch();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const preselectedRole = searchParams.get('role');
  const [registerMutation, { isLoading }] = useRegisterMutation();
  const { status, error } = useAppSelector((state) => state.auth);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      role: preselectedRole && roles.includes(preselectedRole) ? preselectedRole : 'trainee',
      amenities: [],
    },
  });

  const onSubmit = async (values) => {
    const payload = { ...values };
    if (payload.confirmPassword) delete payload.confirmPassword;

    try {
      dispatch(authActions.authPending());
      const apiResponse = await registerMutation(payload).unwrap();
      const authPayload = apiResponse?.data ?? apiResponse;

      dispatch(authActions.authSuccess(authPayload));
      navigate(`/dashboard/${authPayload?.user?.role ?? 'trainee'}`);
    } catch (err) {
      dispatch(authActions.authFailure(err?.data?.message ?? 'Registration failed'));
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit(onSubmit)}>
        <h1>Create your account</h1>
        <p className="auth-card__subtitle">Join FitSync and unlock role-specific dashboards.</p>

        <label>
          <span>Role</span>
          <select {...register('role')}>
            {roles.map((option) => (
              <option key={option} value={option}>
                {option.replace('-', ' ')}
              </option>
            ))}
          </select>
          {errors.role && <p className="input-error">{errors.role.message}</p>}
        </label>

        <div className="auth-card__grid">
          <label>
            <span>First name</span>
            <input type="text" {...register('firstName')} placeholder="Alex" autoComplete="given-name" />
            {errors.firstName && <p className="input-error">{errors.firstName.message}</p>}
          </label>
          <label>
            <span>Last name</span>
            <input type="text" {...register('lastName')} placeholder="Morgan" autoComplete="family-name" />
            {errors.lastName && <p className="input-error">{errors.lastName.message}</p>}
          </label>
        </div>

        <label>
          <span>Email</span>
          <input type="email" {...register('email')} placeholder="you@example.com" autoComplete="email" />
          {errors.email && <p className="input-error">{errors.email.message}</p>}
        </label>

        <div className="auth-card__grid">
          <label>
            <span>Password</span>
            <input type="password" {...register('password')} placeholder="••••••••" autoComplete="new-password" />
            {errors.password && <p className="input-error">{errors.password.message}</p>}
          </label>
          <label>
            <span>Confirm password</span>
            <input type="password" {...register('confirmPassword')} placeholder="••••••••" autoComplete="new-password" />
            {errors.confirmPassword && <p className="input-error">{errors.confirmPassword.message}</p>}
          </label>
        </div>


        {status === 'failed' && <p className="form-error">{error}</p>}

        <button type="submit" className="primary-button" disabled={isLoading}>
          {isLoading ? 'Creating account…' : 'Create account'}
        </button>

        <p className="auth-card__switch">
          Already have an account? <a href="/auth/login">Sign in</a>
        </p>
      </form>
    </div>
  );
};

export default RegisterPage;
