import { apiSlice } from './apiSlice.js';

export const userApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getProfile: builder.query({
      query: () => '/users/profile',
      providesTags: ['Profile'],
    }),
    updateProfile: builder.mutation({
      query: (formData) => ({
        url: '/users/profile',
        method: 'PATCH',
        body: formData,
      }),
      invalidatesTags: ['Profile', 'User'],
    }),
  }),
});

export const {
  useGetProfileQuery,
  useUpdateProfileMutation,
} = userApi;
