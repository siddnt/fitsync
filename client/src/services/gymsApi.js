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
      providesTags: (result) =>
        result?.gyms
          ? [
              ...result.gyms.map(({ id }) => ({ type: 'Gym', id })),
              { type: 'GymList', id: 'LIST' },
            ]
          : [{ type: 'GymList', id: 'LIST' }],
    }),
    getGymById: builder.query({
      query: (id) => `/gyms/${id}`,
      providesTags: (_result, _error, id) => [{ type: 'Gym', id }],
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
  useRecordImpressionMutation,
  useUpdateGymMutation,
} = gymsApi;
