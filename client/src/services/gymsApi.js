import { apiSlice } from './apiSlice.js';

export const gymsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getGyms: builder.query({
      query: ({ search = '', city = '', amenities = [] } = {}) => {
        const params = new URLSearchParams();
        if (search) params.append('search', search);
        if (city) params.append('city', city);
        amenities.forEach((amenity) => params.append('amenities', amenity));

        const queryString = params.toString();
        const suffix = queryString ? `?${queryString}` : '';
        return `/gyms${suffix}`;
      },
      providesTags: (result) => {
        const gyms = Array.isArray(result?.data?.gyms) ? result.data.gyms : [];

        if (!gyms.length) {
          return [{ type: 'GymList', id: 'LIST' }];
        }

        return [
          ...gyms.map(({ id }) => ({ type: 'Gym', id })),
          { type: 'GymList', id: 'LIST' },
        ];
      },
    }),
    getGymById: builder.query({
      query: (id) => `/gyms/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Gym', id }],
    }),
    getGymReviews: builder.query({
      query: (id) => `/gyms/${id}/reviews`,
      providesTags: (_result, _error, id) => [{ type: 'GymReview', id }],
    }),
    createGym: builder.mutation({
      query: (payload) => ({
        url: '/gyms',
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: [{ type: 'GymList', id: 'LIST' }, 'Dashboard', 'Analytics'],
    }),
    getMyGymMembership: builder.query({
      query: (gymId) => `/gyms/${gymId}/memberships/me`,
      providesTags: (_result, _error, gymId) => [{ type: 'GymMembership', id: gymId }],
    }),
    getGymTrainers: builder.query({
      query: (gymId) => `/gyms/${gymId}/trainers`,
      providesTags: (_result, _error, gymId) => [{ type: 'Gym', id: `${gymId}-trainers` }],
    }),
    joinGym: builder.mutation({
      query: ({ gymId, ...payload }) => ({
        url: `/gyms/${gymId}/memberships`,
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: (_result, _error, { gymId }) => [
        { type: 'GymMembership', id: gymId },
        { type: 'Gym', id: gymId },
        { type: 'GymList', id: 'LIST' },
        'Dashboard',
      ],
    }),
    leaveGym: builder.mutation({
      query: ({ gymId, membershipId }) => ({
        url: `/gyms/${gymId}/memberships/${membershipId}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { gymId }) => [
        { type: 'GymMembership', id: gymId },
        { type: 'Gym', id: gymId },
        { type: 'GymList', id: 'LIST' },
        'Dashboard',
      ],
    }),
    submitGymReview: builder.mutation({
      query: ({ gymId, ...payload }) => ({
        url: `/gyms/${gymId}/reviews`,
        method: 'POST',
        body: payload,
      }),
      invalidatesTags: (_result, _error, { gymId }) => [
        { type: 'Gym', id: gymId },
        { type: 'GymReview', id: gymId },
        { type: 'GymList', id: 'LIST' },
      ],
    }),
    recordImpression: builder.mutation({
      query: (id) => ({
        url: `/gyms/${id}/impressions`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Gym', id },
        { type: 'Analytics', id: 'GYM_IMPRESSIONS' },
      ],
    }),
    updateGym: builder.mutation({
      query: ({ id, ...payload }) => ({
        url: `/gyms/${id}`,
        method: 'PUT',
        body: payload,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Gym', id },
        { type: 'GymList', id: 'LIST' },
        'Dashboard',
        'Analytics',
      ],
    }),
  }),
});

export const {
  useGetGymsQuery,
  useGetGymByIdQuery,
  useCreateGymMutation,
  useGetMyGymMembershipQuery,
  useGetGymTrainersQuery,
  useJoinGymMutation,
  useLeaveGymMutation,
  useGetGymReviewsQuery,
  useSubmitGymReviewMutation,
  useRecordImpressionMutation,
  useUpdateGymMutation,
} = gymsApi;
