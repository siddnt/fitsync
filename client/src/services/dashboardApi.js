import { apiSlice } from './apiSlice.js';

export const dashboardApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getTraineeOverview: builder.query({
      query: () => '/dashboards/trainee/overview',
      providesTags: ['Dashboard'],
    }),
    getTraineeProgress: builder.query({
      query: () => '/dashboards/trainee/progress',
      providesTags: ['Dashboard'],
    }),
    getTraineeDiet: builder.query({
      query: () => '/dashboards/trainee/diet',
      providesTags: ['Dashboard'],
    }),
    getTraineeOrders: builder.query({
      query: () => '/dashboards/trainee/orders',
      providesTags: ['Dashboard', 'Marketplace'],
    }),
    submitTrainerFeedback: builder.mutation({
      query: (payload) => ({
        url: '/dashboards/trainee/feedback',
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: ['Dashboard', 'Trainer'],
    }),
    getGymOwnerOverview: builder.query({
      query: () => '/dashboards/gym-owner/overview',
      providesTags: ['Dashboard', 'Analytics', 'Subscription'],
    }),
    getGymOwnerRoster: builder.query({
      query: () => '/dashboards/gym-owner/roster',
      providesTags: ['Dashboard', 'Gym'],
    }),
    getGymOwnerGyms: builder.query({
      query: () => '/dashboards/gym-owner/gyms',
      providesTags: ['Dashboard', 'Gym'],
    }),
    getGymOwnerSubscriptions: builder.query({
      query: () => '/dashboards/gym-owner/subscriptions',
      providesTags: ['Dashboard', 'Subscription'],
    }),
    getGymOwnerSponsorships: builder.query({
      query: () => '/dashboards/gym-owner/sponsorships',
      providesTags: ['Dashboard'],
    }),
    getGymOwnerAnalytics: builder.query({
      query: () => '/dashboards/gym-owner/analytics',
      providesTags: ['Dashboard', 'Analytics'],
    }),
    getTrainerOverview: builder.query({
      query: () => '/dashboards/trainer/overview',
      providesTags: ['Dashboard', 'Trainer'],
    }),
    getTrainerTrainees: builder.query({
      query: () => '/dashboards/trainer/trainees',
      providesTags: ['Dashboard', 'Trainer'],
    }),
    getTrainerUpdates: builder.query({
      query: () => '/dashboards/trainer/updates',
      providesTags: ['Dashboard', 'Trainer'],
    }),
    getTrainerFeedback: builder.query({
      query: () => '/dashboards/trainer/feedback',
      providesTags: ['Dashboard', 'Trainer'],
    }),
    getAdminOverview: builder.query({
      query: () => '/dashboards/admin/overview',
      providesTags: ['Dashboard', 'Analytics'],
    }),
    getAdminUsers: builder.query({
      query: () => '/dashboards/admin/users',
      providesTags: ['Dashboard', 'User'],
    }),
    getAdminGyms: builder.query({
      query: () => '/dashboards/admin/gyms',
      providesTags: ['Dashboard', 'Gym'],
    }),
    getAdminRevenue: builder.query({
      query: () => '/dashboards/admin/revenue',
      providesTags: ['Dashboard', 'Analytics'],
    }),
    getAdminMarketplace: builder.query({
      query: () => '/dashboards/admin/marketplace',
      providesTags: ['Dashboard', 'Marketplace'],
    }),
    getAdminInsights: builder.query({
      query: () => '/dashboards/admin/insights',
      providesTags: ['Dashboard', 'Analytics', 'Notification'],
    }),
  }),
});

export const {
  useGetTraineeOverviewQuery,
  useGetTraineeProgressQuery,
  useGetTraineeDietQuery,
  useGetTraineeOrdersQuery,
  useSubmitTrainerFeedbackMutation,
  useGetGymOwnerOverviewQuery,
  useGetGymOwnerRosterQuery,
  useGetGymOwnerGymsQuery,
  useGetGymOwnerSubscriptionsQuery,
  useGetGymOwnerSponsorshipsQuery,
  useGetGymOwnerAnalyticsQuery,
  useGetTrainerOverviewQuery,
  useGetTrainerTraineesQuery,
  useGetTrainerUpdatesQuery,
  useGetTrainerFeedbackQuery,
  useGetAdminOverviewQuery,
  useGetAdminUsersQuery,
  useGetAdminGymsQuery,
  useGetAdminRevenueQuery,
  useGetAdminMarketplaceQuery,
  useGetAdminInsightsQuery,
} = dashboardApi;
