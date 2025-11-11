import { apiSlice } from './apiSlice.js';

export const sellerApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getSellerProducts: builder.query({
      query: () => '/marketplace/seller/products',
      providesTags: (result) =>
        result?.data?.products
          ? [
              ...result.data.products.map(({ id }) => ({ type: 'Marketplace', id })),
              { type: 'Marketplace', id: 'SELLER_PRODUCTS' },
              { type: 'Marketplace', id: 'CATALOG' },
            ]
          : [
              { type: 'Marketplace', id: 'SELLER_PRODUCTS' },
              { type: 'Marketplace', id: 'CATALOG' },
            ],
    }),
    createSellerProduct: builder.mutation({
      query: (payload) => ({
        url: '/marketplace/seller/products',
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: [
        { type: 'Marketplace', id: 'SELLER_PRODUCTS' },
        { type: 'Marketplace', id: 'CATALOG' },
        'Dashboard',
        'Marketplace',
      ],
    }),
    updateSellerProduct: builder.mutation({
      query: ({ id, body }) => ({
        url: `/marketplace/seller/products/${id}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Marketplace', id },
        { type: 'Marketplace', id: 'SELLER_PRODUCTS' },
        { type: 'Marketplace', id: 'CATALOG' },
        'Dashboard',
        'Marketplace',
      ],
    }),
    deleteSellerProduct: builder.mutation({
      query: (id) => ({
        url: `/marketplace/seller/products/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Marketplace', id },
        { type: 'Marketplace', id: 'SELLER_PRODUCTS' },
        { type: 'Marketplace', id: 'CATALOG' },
        'Dashboard',
        'Marketplace',
      ],
    }),
    getSellerOrders: builder.query({
      query: () => '/marketplace/seller/orders',
      providesTags: [{ type: 'Marketplace', id: 'SELLER_ORDERS' }],
    }),
    updateSellerOrderStatus: builder.mutation({
      query: ({ orderId, itemId, status, note }) => ({
        url: `/marketplace/seller/orders/${orderId}/items/${itemId}/status`,
        method: 'PATCH',
        body: { status, note },
      }),
      invalidatesTags: [{ type: 'Marketplace', id: 'SELLER_ORDERS' }, 'Dashboard', 'Marketplace'],
    }),
  }),
});

export const {
  useGetSellerProductsQuery,
  useCreateSellerProductMutation,
  useUpdateSellerProductMutation,
  useDeleteSellerProductMutation,
  useGetSellerOrdersQuery,
  useUpdateSellerOrderStatusMutation,
} = sellerApi;
