import { apiSlice } from './apiSlice.js';

export const ownerApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getMonetisationOptions: builder.query({
      query: () => '/owner/monetisation/options',
      providesTags: ['Subscription'],
    }),
    checkoutListingSubscription: builder.mutation({
      query: (payload) => ({
        url: '/owner/subscriptions/checkout',
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: ['Subscription', 'Dashboard', 'Analytics'],
    }),
    purchaseSponsorship: builder.mutation({
      query: (payload) => ({
        url: '/owner/sponsorships/purchase',
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: ['Dashboard', 'Analytics'],
    }),
  }),
});

export const {
  useGetMonetisationOptionsQuery,
  useCheckoutListingSubscriptionMutation,
  usePurchaseSponsorshipMutation,
} = ownerApi;
