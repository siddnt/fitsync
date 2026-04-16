import { apiSlice } from './apiSlice.js';

export const bookingApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getBookableSlots: builder.query({
      query: (params = {}) => ({
        url: '/bookings/slots',
        params,
      }),
      providesTags: ['Booking', 'Dashboard'],
    }),
    getMyBookings: builder.query({
      query: (params = {}) => ({
        url: '/bookings/me',
        params,
      }),
      providesTags: ['Booking', 'Dashboard'],
    }),
    createBooking: builder.mutation({
      query: (body) => ({
        url: '/bookings',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Booking', 'Dashboard', 'Trainer'],
    }),
    updateBookingStatus: builder.mutation({
      query: ({ bookingId, ...body }) => ({
        url: `/bookings/${bookingId}/status`,
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['Booking', 'Dashboard', 'Trainer'],
    }),
  }),
});

export const {
  useGetBookableSlotsQuery,
  useGetMyBookingsQuery,
  useCreateBookingMutation,
  useUpdateBookingStatusMutation,
} = bookingApi;
