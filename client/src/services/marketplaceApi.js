import { apiSlice } from './apiSlice.js';

export const marketplaceApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getMarketplaceCatalog: builder.query({
      query: (params = {}) => ({
        url: '/marketplace/products',
        params,
      }),
      providesTags: (result) => {
        const products = result?.data?.products ?? [];
        if (!products.length) {
          return [{ type: 'Marketplace', id: 'CATALOG' }];
        }

        return [
          ...products.map(({ id }) => ({ type: 'Marketplace', id })),
          { type: 'Marketplace', id: 'CATALOG' },
        ];
      },
    }),
    getMarketplaceProduct: builder.query({
      query: (productId) => `/marketplace/products/${productId}`,
      providesTags: (_result, _error, productId) => [
        { type: 'Marketplace', id: productId },
        { type: 'Marketplace', id: 'CATALOG' },
      ],
    }),
    createMarketplaceOrder: builder.mutation({
      query: (payload) => ({
        url: '/marketplace/orders',
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: [
        { type: 'Marketplace', id: 'CATALOG' },
        'Marketplace',
        'Dashboard',
      ],
    }),
    submitProductReview: builder.mutation({
      query: ({ productId, ...payload }) => ({
        url: `/marketplace/products/${productId}/reviews`,
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: (_result, _error, { productId }) => [
        { type: 'Marketplace', id: productId },
        { type: 'Marketplace', id: 'CATALOG' },
        'Marketplace',
        'Dashboard',
      ],
    }),
    requestOrderItemReturn: builder.mutation({
      query: ({ orderId, itemId, reason }) => ({
        url: `/marketplace/orders/${orderId}/items/${itemId}/return`,
        method: 'POST',
        body: { reason },
      }),
      invalidatesTags: ['Marketplace', 'Dashboard', 'Notification'],
    }),
  }),
});

export const {
  useGetMarketplaceCatalogQuery,
  useGetMarketplaceProductQuery,
  useCreateMarketplaceOrderMutation,
  useSubmitProductReviewMutation,
  useRequestOrderItemReturnMutation,
} = marketplaceApi;
