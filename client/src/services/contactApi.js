import { apiSlice } from './apiSlice';

export const contactApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        submitContactForm: builder.mutation({
            query: (data) => ({
                url: '/contact',
                method: 'POST',
                body: data,
            }),
        }),
        getContactMessages: builder.query({
            query: (params) => ({
                url: '/contact',
                params,
            }),
            providesTags: ['Contact'],
        }),
        updateMessageStatus: builder.mutation({
            query: ({ id, status }) => ({
                url: `/contact/${id}/status`,
                method: 'PATCH',
                body: { status },
            }),
            invalidatesTags: ['Contact'],
        }),
    }),
});

export const {
    useSubmitContactFormMutation,
    useGetContactMessagesQuery,
    useUpdateMessageStatusMutation,
} = contactApi;
