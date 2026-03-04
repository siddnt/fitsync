import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const baseUrl = import.meta.env.VITE_API_BASE_URL || '/api';

export const paymentApi = createApi({
  reducerPath: 'paymentApi',
  baseQuery: fetchBaseQuery({
    baseUrl,
    credentials: 'include',
    prepareHeaders: (headers, { getState }) => {
      const token = getState()?.auth?.accessToken;
      if (token) {
        headers.set('authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ['Payment'],
  endpoints: (builder) => ({
    createCheckoutSession: builder.mutation({
      query: (data) => ({
        url: '/payments/create-checkout-session',
        method: 'POST',
        body: data,
      }),
    }),
    createGymMembershipCheckout: builder.mutation({
      query: (data) => ({
        url: '/payments/gym-membership/checkout',
        method: 'POST',
        body: data,
      }),
    }),
    createGymListingCheckout: builder.mutation({
      query: (data) => ({
        url: '/payments/gym-listing/checkout',
        method: 'POST',
        body: data,
      }),
    }),
    getPaymentSession: builder.query({
      query: (sessionId) => `/payments/session/${sessionId}`,
      providesTags: ['Payment'],
    }),
  }),
});

export const {
  useCreateCheckoutSessionMutation,
  useCreateGymMembershipCheckoutMutation,
  useCreateGymListingCheckoutMutation,
  useGetPaymentSessionQuery,
} = paymentApi;
