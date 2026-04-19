import { apiSlice } from './apiSlice';

export const contactApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        submitContactForm: builder.mutation({
            query: (data) => ({
                url: '/contact',
                method: 'POST',
                body: data,
            }),
            invalidatesTags: ['Contact'],
        }),
        getMyContactMessages: builder.query({
            query: () => ({
                url: '/contact/mine',
            }),
            providesTags: ['Contact'],
        }),
        getContactMessages: builder.query({
            query: (params) => ({
                url: '/contact',
                params,
            }),
            providesTags: ['Contact'],
        }),
        updateMessageStatus: builder.mutation({
            query: ({ id, status, priority, internalNotes }) => ({
                url: `/contact/${id}/status`,
                method: 'PATCH',
                body: { status, priority, internalNotes },
            }),
            invalidatesTags: ['Contact'],
        }),
        assignMessage: builder.mutation({
            query: ({ id, assignedTo, status, gymId, autoAssignManager }) => ({
                url: `/contact/${id}/assign`,
                method: 'PATCH',
                body: { assignedTo, status, gymId, autoAssignManager },
            }),
            invalidatesTags: ['Contact', 'Notification'],
        }),
        replyToMessage: builder.mutation({
            query: ({ id, message, closeAfterReply }) => ({
                url: `/contact/${id}/reply`,
                method: 'POST',
                body: { message, closeAfterReply },
            }),
            invalidatesTags: ['Contact'],
        }),
    }),
});

export const {
    useSubmitContactFormMutation,
    useGetMyContactMessagesQuery,
    useGetContactMessagesQuery,
    useUpdateMessageStatusMutation,
    useAssignMessageMutation,
    useReplyToMessageMutation,
} = contactApi;
