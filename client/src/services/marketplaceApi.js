import { apiSlice } from './apiSlice.js';

export const marketplaceApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getMarketplaceCatalog: builder.query({
      query: () => '/marketplace/products',
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
  }),
});

export const {
  useGetMarketplaceCatalogQuery,
  useCreateMarketplaceOrderMutation,
} = marketplaceApi;
