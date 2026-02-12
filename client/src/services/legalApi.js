/**
 * LEGAL API SERVICE
 * 
 * Handles all API calls for terms and privacy acceptance
 */

import { apiSlice } from './apiSlice';

const legalApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        // Get current legal document versions
        getLegalVersions: builder.query({
            query: () => '/legal/versions',
            providesTags: ['Legal'],
        }),

        // Check user's legal acceptance status
        checkLegalStatus: builder.query({
            query: () => '/legal/status',
            providesTags: ['Legal'],
            // Always fetch fresh data - don't cache legal status
            refetchOnMountOrArgChange: true,
            refetchOnFocus: true,
            refetchOnReconnect: true,
        }),

        // Accept terms of service
        acceptTerms: builder.mutation({
            query: (payload) => ({
                url: '/legal/terms/accept',
                method: 'POST',
                body: payload,
            }),
            invalidatesTags: ['Legal'],
            // Refetch legal status after accepting terms
            async onQueryStarted(arg, { dispatch, queryFulfilled }) {
                try {
                    await queryFulfilled;
                    // Invalidate and refetch legal status
                    dispatch(legalApi.util.invalidateTags(['Legal']));
                } catch (err) {
                    console.error('Error accepting terms:', err);
                }
            },
        }),

        // Accept privacy policy
        acceptPrivacy: builder.mutation({
            query: (payload) => ({
                url: '/legal/privacy/accept',
                method: 'POST',
                body: payload,
            }),
            invalidatesTags: ['Legal'],
            // Refetch legal status after accepting privacy
            async onQueryStarted(arg, { dispatch, queryFulfilled }) {
                try {
                    await queryFulfilled;
                    // Invalidate and refetch legal status
                    dispatch(legalApi.util.invalidateTags(['Legal']));
                } catch (err) {
                    console.error('Error accepting privacy:', err);
                }
            },
        }),
    }),
});

export const {
    useGetLegalVersionsQuery,
    useCheckLegalStatusQuery,
    useAcceptTermsMutation,
    useAcceptPrivacyMutation,
} = legalApi;

export default legalApi;
