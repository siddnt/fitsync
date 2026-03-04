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

const getUrl = (args) => (typeof args === 'string' ? args : args?.url || '');

const isAuthRoute = (url = '') =>
  url.includes('/auth/login') ||
  url.includes('/auth/register') ||
  url.includes('/auth/logout') ||
  url.includes('/auth/refresh');

let refreshPromise = null;

const refreshAccessToken = (api, extraOptions) => {
  if (!refreshPromise) {
    refreshPromise = rawBaseQuery(
      { url: '/auth/refresh', method: 'POST' },
      api,
      extraOptions,
    ).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
};

const baseQueryWithReauth = async (args, api, extraOptions) => {
  let result = await rawBaseQuery(args, api, extraOptions);

  const url = getUrl(args);
  const isUnauthorized = result?.error?.status === 401;

  if (isUnauthorized && !isAuthRoute(url)) {
    const refreshResult = await refreshAccessToken(api, extraOptions);
    const refreshedToken =
      refreshResult?.data?.data?.accessToken ??
      refreshResult?.data?.accessToken ??
      null;

    if (refreshedToken) {
      api.dispatch(authActions.setAccessToken(refreshedToken));
      result = await rawBaseQuery(args, api, extraOptions);
    } else {
      api.dispatch(authActions.signOut());
    }
  }

  return result;
};

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    'Auth',
    'User',
    'Gym',
    'GymList',
    'GymMembership',
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
