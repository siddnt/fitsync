import { apiSlice as api } from './apiSlice.js';

export const paymentApi = api.injectEndpoints({
  endpoints: (builder) => ({
    verifySession: builder.mutation({
      query: (body) => ({
        url: '/payments/verify-session',
        method: 'POST',
        body,
      }),
    }),
  }),
});

export const { useVerifySessionMutation } = paymentApi;
