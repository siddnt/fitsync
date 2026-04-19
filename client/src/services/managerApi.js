import { apiSlice } from './apiSlice.js';

export const managerApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getManagerPending: builder.query({
      query: () => '/manager/pending',
      providesTags: ['Dashboard', 'User'],
    }),
    approveUser: builder.mutation({
      query: (userId) => ({
        url: `/manager/users/${userId}/approve`,
        method: 'PATCH',
      }),
      invalidatesTags: ['Dashboard', 'User'],
    }),
    rejectUser: builder.mutation({
      query: (userId) => ({
        url: `/manager/users/${userId}/reject`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Dashboard', 'User'],
    }),
    getManagerSellers: builder.query({
      query: () => '/manager/sellers',
      providesTags: ['Dashboard', 'User'],
    }),
    updateSellerStatus: builder.mutation({
      query: ({ userId, status }) => ({
        url: `/manager/sellers/${userId}/status`,
        method: 'PATCH',
        body: { status },
      }),
      invalidatesTags: ['Dashboard', 'User'],
    }),
    deleteSellerByManager: builder.mutation({
      query: (userId) => ({
        url: `/manager/sellers/${userId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Dashboard', 'User'],
    }),
    getManagerGymOwners: builder.query({
      query: () => '/manager/gym-owners',
      providesTags: ['Dashboard', 'User'],
    }),
    updateGymOwnerStatus: builder.mutation({
      query: ({ userId, status }) => ({
        url: `/manager/gym-owners/${userId}/status`,
        method: 'PATCH',
        body: { status },
      }),
      invalidatesTags: ['Dashboard', 'User', 'Gym'],
    }),
    deleteGymOwnerByManager: builder.mutation({
      query: (userId) => ({
        url: `/manager/gym-owners/${userId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Dashboard', 'User', 'Gym'],
    }),
    getManagerGyms: builder.query({
      query: () => '/manager/gyms',
      providesTags: ['Dashboard', 'Gym'],
    }),
    getManagerGymDetail: builder.query({
      query: (gymId) => `/manager/gyms/${gymId}`,
      providesTags: (_result, _error, gymId) => [{ type: 'Gym', id: gymId }],
    }),
    deleteGymByManager: builder.mutation({
      query: (gymId) => ({
        url: `/manager/gyms/${gymId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Dashboard', 'Gym'],
    }),
    getManagerMarketplace: builder.query({
      query: () => '/manager/marketplace',
      providesTags: ['Dashboard', 'Marketplace'],
    }),
    getManagerProducts: builder.query({
      query: () => '/manager/products',
      providesTags: ['Dashboard', 'Marketplace'],
    }),
    getManagerProductBuyers: builder.query({
      query: (productId) => `/manager/products/${productId}`,
      providesTags: (_result, _error, productId) => [{ type: 'Marketplace', id: productId }],
    }),
    getManagerUserDetail: builder.query({
      query: (userId) => `/manager/users/${userId}`,
      providesTags: (_result, _error, userId) => [{ type: 'User', id: userId }],
    }),
    deleteManagerProduct: builder.mutation({
      query: (productId) => ({
        url: `/manager/products/${productId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Dashboard', 'Marketplace'],
    }),
  }),
});

export const {
  useGetManagerPendingQuery,
  useApproveUserMutation,
  useRejectUserMutation,
  useGetManagerSellersQuery,
  useUpdateSellerStatusMutation,
  useDeleteSellerByManagerMutation,
  useGetManagerGymOwnersQuery,
  useUpdateGymOwnerStatusMutation,
  useDeleteGymOwnerByManagerMutation,
  useGetManagerGymsQuery,
  useGetManagerGymDetailQuery,
  useDeleteGymByManagerMutation,
  useGetManagerMarketplaceQuery,
  useGetManagerProductsQuery,
  useGetManagerProductBuyersQuery,
  useGetManagerUserDetailQuery,
  useDeleteManagerProductMutation,
} = managerApi;
