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
    getMarketplaceSearchSuggestions: builder.query({
      query: ({ query, limit = 8 } = {}) => ({
        url: '/marketplace/products/suggestions',
        params: { query, limit },
      }),
      transformResponse: (response) => response?.data?.suggestions ?? [],
      providesTags: [{ type: 'Marketplace', id: 'SUGGESTIONS' }],
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
    confirmMarketplaceCodOrder: builder.mutation({
      query: (orderId) => ({
        url: `/marketplace/orders/${orderId}/cod-confirm`,
        method: 'POST',
      }),
      invalidatesTags: [
        { type: 'Marketplace', id: 'CATALOG' },
        'Marketplace',
        'Dashboard',
      ],
    }),
    createMarketplacePaymentIntent: builder.mutation({
      query: (payload) => ({
        url: '/payments/marketplace/payment-intent',
        method: 'POST',
        body: payload,
      }),
    }),
    createMarketplaceStripeCheckoutSession: builder.mutation({
      query: (payload) => ({
        url: '/payments/marketplace/checkout-session',
        method: 'POST',
        body: payload,
      }),
    }),
    createMarketplaceUpiSession: builder.mutation({
      query: (payload) => ({
        url: '/payments/marketplace/upi/session',
        method: 'POST',
        body: payload,
      }),
    }),
    confirmMarketplaceUpiPayment: builder.mutation({
      query: (payload) => ({
        url: '/payments/marketplace/upi/confirm',
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: [
        { type: 'Marketplace', id: 'CATALOG' },
        'Marketplace',
        'Dashboard',
      ],
    }),
    confirmMarketplacePaymentSession: builder.mutation({
      query: (payload) => ({
        url: '/payments/confirm',
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
  }),
});

export const {
  useGetMarketplaceCatalogQuery,
  useGetMarketplaceSearchSuggestionsQuery,
  useGetMarketplaceProductQuery,
  useCreateMarketplaceOrderMutation,
  useConfirmMarketplaceCodOrderMutation,
  useCreateMarketplacePaymentIntentMutation,
  useCreateMarketplaceStripeCheckoutSessionMutation,
  useCreateMarketplaceUpiSessionMutation,
  useConfirmMarketplaceUpiPaymentMutation,
  useConfirmMarketplacePaymentSessionMutation,
  useSubmitProductReviewMutation,
} = marketplaceApi;
