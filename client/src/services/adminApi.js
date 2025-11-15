import { apiSlice } from './apiSlice.js';

export const adminApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getAdminToggles: builder.query({
      query: () => '/admin/settings/toggles',
      providesTags: ['AdminSettings'],
      transformResponse: (response) => response?.data?.adminToggles ?? {},
    }),
    deleteUser: builder.mutation({
      query: (userId) => ({
        url: `/admin/users/${userId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Dashboard', 'User'],
    }),
    updateUserStatus: builder.mutation({
      query: ({ userId, status }) => ({
        url: `/admin/users/${userId}/status`,
        method: 'PATCH',
        body: { status },
      }),
      invalidatesTags: ['Dashboard', 'User'],
    }),
    deleteGym: builder.mutation({
      query: (gymId) => ({
        url: `/admin/gyms/${gymId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Dashboard', 'Gym'],
    }),
    updateAdminToggles: builder.mutation({
      query: (toggles) => ({
        url: '/admin/settings/toggles',
        method: 'PATCH',
        body: { toggles },
      }),
      invalidatesTags: ['Dashboard', 'Analytics', 'AdminSettings'],
    }),
  }),
});

export const {
  useGetAdminTogglesQuery,
  useDeleteUserMutation,
  useDeleteGymMutation,
  useUpdateAdminTogglesMutation,
  useUpdateUserStatusMutation,
} = adminApi;
