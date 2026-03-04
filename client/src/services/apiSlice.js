import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { authActions } from '../features/auth/authSlice.js';

const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api';

const rawBaseQuery = fetchBaseQuery({
  baseUrl,
  credentials: 'include',
  prepareHeaders: (headers, { getState }) => {
    const token = getState()?.auth?.accessToken;
    if (token) {
      headers.set('authorization', `Bearer ${token}`);
    }
    return headers;
  },
});

/**
 * Wraps the base query to detect 403 "suspended" responses.
 * When a suspended response is detected, updates the auth user's status
 * so the frontend can immediately show the suspension overlay.
 */
const baseQueryWithSuspensionCheck = async (args, api, extraOptions) => {
  const result = await rawBaseQuery(args, api, extraOptions);

  if (
    result.error?.status === 403 &&
    typeof result.error.data?.message === 'string' &&
    result.error.data.message.toLowerCase().includes('deactivated')
  ) {
    const currentUser = api.getState()?.auth?.user;
    if (currentUser && currentUser.status !== 'suspended') {
      api.dispatch(authActions.updateProfile({ status: 'suspended' }));
    }
  }

  return result;
};

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithSuspensionCheck,
  tagTypes: [
    'Auth',
    'User',
    'Gym',
    'GymList',
    'GymMembership',
    'GymGallery',
    'GymReview',
    'Subscription',
    'Trainer',
    'Marketplace',
    'Analytics',
    'Notification',
    'Dashboard',
    'AdminSettings',
    'TrainerRequest',
    'Contact',
  ],
  endpoints: () => ({}),
});
