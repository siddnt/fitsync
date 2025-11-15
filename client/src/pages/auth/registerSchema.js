import * as yup from 'yup';

export const registerRoles = ['trainee', 'trainer', 'gym-owner', 'seller'];

const passwordComplexity =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;

export const registerSchema = yup
  .object({
    firstName: yup
      .string()
      .trim()
      .required('First name is required'),
    lastName: yup
      .string()
      .trim()
      .required('Last name is required'),
    email: yup
      .string()
      .trim()
      .email('Provide a valid email')
      .required('Email is required'),
    password: yup
      .string()
      .trim()
      .min(8, 'Password must have at least 8 characters')
      .matches(passwordComplexity, 'Password must include uppercase, lowercase, and a number')
      .required('Password is required'),
    confirmPassword: yup
      .string()
      .oneOf([yup.ref('password'), null], 'Passwords must match')
      .required('Confirm your password'),
    role: yup
      .string()
      .oneOf(registerRoles)
      .required('Select a role'),
  })
  .noUnknown();

