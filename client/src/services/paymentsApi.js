import { apiSlice } from './apiSlice.js';

export const paymentsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getPaymentCheckoutSessionResult: builder.query({
      query: (sessionId) => `/payments/checkout/${sessionId}`,
    }),
  }),
});

export const {
  useGetPaymentCheckoutSessionResultQuery,
} = paymentsApi;
