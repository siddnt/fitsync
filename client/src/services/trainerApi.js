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
    getMyAvailability: builder.query({
      query: () => '/trainer/availability/me',
      providesTags: ['Trainer'],
    }),
    getTrainerAvailability: builder.query({
      query: ({ trainerId, gymId } = {}) => ({
        url: `/trainer/${trainerId}/availability`,
        params: gymId ? { gymId } : undefined,
      }),
      providesTags: ['Trainer'],
    }),
    updateAvailability: builder.mutation({
      query: (body) => ({
        url: '/trainer/availability',
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Dashboard', 'Trainer', 'Notification'],
    }),
  }),
});

export const {
  useLogAttendanceMutation,
  useRecordProgressMutation,
  useAssignDietMutation,
  useShareFeedbackMutation,
  useReviewFeedbackMutation,
  useGetMyAvailabilityQuery,
  useGetTrainerAvailabilityQuery,
  useUpdateAvailabilityMutation,
} = trainerApi;
