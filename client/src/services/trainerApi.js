import { apiSlice } from './apiSlice.js';

export const trainerApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    logAttendance: builder.mutation({
      query: ({ traineeId, ...body }) => ({
        url: `/trainer/trainees/${traineeId}/attendance`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Dashboard', 'Trainer'],
    }),
    recordProgress: builder.mutation({
      query: ({ traineeId, ...body }) => ({
        url: `/trainer/trainees/${traineeId}/progress`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Dashboard', 'Trainer'],
    }),
    assignDiet: builder.mutation({
      query: ({ traineeId, ...body }) => ({
        url: `/trainer/trainees/${traineeId}/diet`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Dashboard', 'Trainer'],
    }),
    shareFeedback: builder.mutation({
      query: ({ traineeId, ...body }) => ({
        url: `/trainer/trainees/${traineeId}/feedback`,
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Dashboard', 'Trainer'],
    }),
    reviewFeedback: builder.mutation({
      query: ({ feedbackId }) => ({
        url: `/trainer/feedback/${feedbackId}/review`,
        method: 'PATCH',
      }),
      invalidatesTags: ['Dashboard', 'Trainer'],
    }),
  }),
});

export const {
  useLogAttendanceMutation,
  useRecordProgressMutation,
  useAssignDietMutation,
  useShareFeedbackMutation,
  useReviewFeedbackMutation,
} = trainerApi;
