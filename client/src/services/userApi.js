import { apiSlice } from './apiSlice.js';

export const userApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getProfile: builder.query({
      query: () => '/users/profile',
      providesTags: ['User'],
    }),
    updateProfile: builder.mutation({
      query: (body) => ({
        url: '/users/profile',
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['User'],
    }),
    getMyNotifications: builder.query({
      query: ({ limit = 12, unreadOnly = false } = {}) => ({
        url: '/users/notifications',
        params: { limit, unreadOnly },
      }),
      providesTags: ['Notification'],
    }),
    markNotificationsRead: builder.mutation({
      query: (ids = []) => ({
        url: '/users/notifications/read',
        method: 'PATCH',
        body: { ids },
      }),
      invalidatesTags: ['Notification'],
    }),
    getMyRecommendations: builder.query({
      query: () => '/users/recommendations',
      providesTags: ['User', 'Gym', 'Marketplace'],
    }),
  }),
});

export const {
  useGetProfileQuery,
  useUpdateProfileMutation,
  useGetMyNotificationsQuery,
  useMarkNotificationsReadMutation,
  useGetMyRecommendationsQuery,
} = userApi;
