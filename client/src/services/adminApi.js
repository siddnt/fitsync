import { apiSlice } from './apiSlice.js';

export const adminApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getAdminToggles: builder.query({
      query: () => '/admin/settings/toggles',
      providesTags: ['AdminSettings'],
      transformResponse: (response) => ({
        toggles: response?.data?.adminToggles ?? {},
        updatedAt: response?.data?.updatedAt ?? null,
        updatedBy: response?.data?.updatedBy ?? null,
      }),
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
    getAuditLogs: builder.query({
      query: (params = {}) => ({
        url: '/admin/audit-logs',
        params,
      }),
      providesTags: ['AdminAudit'],
    }),
  }),
});

export const {
  useGetAdminTogglesQuery,
  useGetAuditLogsQuery,
  useDeleteUserMutation,
  useDeleteGymMutation,
  useUpdateAdminTogglesMutation,
  useUpdateUserStatusMutation,
} = adminApi;
