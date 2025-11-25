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
    getTrainerRequests: builder.query({
      query: () => '/owner/trainers/requests',
      providesTags: ['TrainerRequest', 'Dashboard'],
    }),
    approveTrainerRequest: builder.mutation({
      query: ({ assignmentId }) => ({
        url: `/owner/trainers/requests/${assignmentId}/approve`,
        method: 'POST',
      }),
      invalidatesTags: ['TrainerRequest', 'Dashboard', 'Gym'],
    }),
    declineTrainerRequest: builder.mutation({
      query: ({ assignmentId }) => ({
        url: `/owner/trainers/requests/${assignmentId}/decline`,
        method: 'POST',
      }),
      invalidatesTags: ['TrainerRequest', 'Dashboard', 'Gym'],
    }),
    removeTrainerFromGym: builder.mutation({
      query: ({ assignmentId }) => ({
        url: `/owner/trainers/${assignmentId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['TrainerRequest', 'Dashboard', 'Gym', 'Analytics'],
    }),
    removeGymMember: builder.mutation({
      query: ({ membershipId }) => ({
        url: `/owner/memberships/${membershipId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Dashboard', 'Gym', 'Analytics'],
    }),
  }),
});

export const {
  useGetMonetisationOptionsQuery,
  useCheckoutListingSubscriptionMutation,
  usePurchaseSponsorshipMutation,
  useGetTrainerRequestsQuery,
  useApproveTrainerRequestMutation,
  useDeclineTrainerRequestMutation,
  useRemoveTrainerFromGymMutation,
  useRemoveGymMemberMutation,
} = ownerApi;
