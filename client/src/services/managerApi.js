import { apiSlice } from './apiSlice.js';

export const managerApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    /* ── Pending Approvals ── */
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

    /* ── Sellers ── */
    getManagerSellers: builder.query({
      query: ({ page = 1 } = {}) => `/manager/sellers?page=${page}&limit=10`,
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

    /* ── Gym Owners ── */
    getManagerGymOwners: builder.query({
      query: ({ page = 1 } = {}) => `/manager/gym-owners?page=${page}&limit=10`,
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

    /* ── Gyms Oversight ── */
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

    /* ── Marketplace Oversight ── */
    getManagerMarketplace: builder.query({
      query: () => '/manager/marketplace',
      providesTags: ['Dashboard', 'Marketplace'],
    }),

    /* ── Products Listing ── */
    getManagerProducts: builder.query({
      query: () => '/manager/products',
      providesTags: ['Dashboard', 'Marketplace'],
    }),
    getManagerProductBuyers: builder.query({
      query: (productId) => `/manager/products/${productId}`,
      providesTags: (_result, _error, productId) => [{ type: 'Marketplace', id: productId }],
    }),

    /* ── User Detail (deep view) ── */
    getManagerUserDetail: builder.query({
      query: (userId) => `/manager/users/${userId}`,
      providesTags: (_res, _err, userId) => [{ type: 'User', id: userId }],
    }),

    /* ── Product Deletion ── */
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
