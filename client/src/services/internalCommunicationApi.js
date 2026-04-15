import { apiSlice } from './apiSlice.js';

export const internalCommunicationApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getCommunicationRecipients: builder.query({
      query: () => '/communications/recipients',
      providesTags: ['InternalCommunication'],
    }),
    getCommunicationThreads: builder.query({
      query: () => '/communications',
      providesTags: ['InternalCommunication'],
    }),
    createCommunicationThread: builder.mutation({
      query: (body) => ({
        url: '/communications',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['InternalCommunication', 'Notification'],
    }),
    replyCommunicationThread: builder.mutation({
      query: ({ id, body }) => ({
        url: `/communications/${id}/reply`,
        method: 'POST',
        body: { body },
      }),
      invalidatesTags: ['InternalCommunication', 'Notification'],
    }),
  }),
});

export const {
  useGetCommunicationRecipientsQuery,
  useGetCommunicationThreadsQuery,
  useCreateCommunicationThreadMutation,
  useReplyCommunicationThreadMutation,
} = internalCommunicationApi;
