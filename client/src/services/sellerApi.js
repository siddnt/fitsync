import { apiSlice } from './apiSlice.js';

export const sellerApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getSellerProducts: builder.query({
      query: (params = {}) => ({
        url: '/marketplace/seller/products',
        params,
      }),
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
    getSellerProduct: builder.query({
      query: (productId) => `/marketplace/seller/products/${productId}`,
      providesTags: (_result, _error, productId) => [
        { type: 'Marketplace', id: productId },
        { type: 'Marketplace', id: 'SELLER_PRODUCTS' },
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
      query: (params = {}) => ({
        url: '/marketplace/seller/orders',
        params,
      }),
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
    updateSellerOrderTracking: builder.mutation({
      query: ({ orderId, itemId, carrier, trackingNumber, trackingUrl, status }) => ({
        url: `/marketplace/seller/orders/${orderId}/items/${itemId}/tracking`,
        method: 'PATCH',
        body: { carrier, trackingNumber, trackingUrl, status },
      }),
      invalidatesTags: [{ type: 'Marketplace', id: 'SELLER_ORDERS' }, 'Dashboard', 'Marketplace', 'Notification'],
    }),
    reviewReturnRequest: builder.mutation({
      query: ({ orderId, itemId, decision, note }) => ({
        url: `/marketplace/seller/orders/${orderId}/items/${itemId}/return`,
        method: 'PATCH',
        body: { decision, note },
      }),
      invalidatesTags: [{ type: 'Marketplace', id: 'SELLER_ORDERS' }, 'Dashboard', 'Marketplace', 'Notification'],
    }),
  }),
});

export const {
  useGetSellerProductsQuery,
  useLazyGetSellerProductsQuery,
  useGetSellerProductQuery,
  useCreateSellerProductMutation,
  useUpdateSellerProductMutation,
  useDeleteSellerProductMutation,
  useGetSellerOrdersQuery,
  useLazyGetSellerOrdersQuery,
  useUpdateSellerOrderStatusMutation,
  useUpdateSellerOrderTrackingMutation,
  useReviewReturnRequestMutation,
} = sellerApi;
