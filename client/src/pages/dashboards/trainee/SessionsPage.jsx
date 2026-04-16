import { useEffect, useMemo, useState } from 'react';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import {
  useCreateBookingMutation,
  useGetBookableSlotsQuery,
  useGetMyBookingsQuery,
  useUpdateBookingStatusMutation,
} from '../../../services/bookingApi.js';
import { formatDate, formatStatus } from '../../../utils/format.js';
import '../Dashboard.css';
import './SessionsPage.css';

const TraineeSessionsPage = () => {
  const {
    data: slotsResponse,
    isLoading: isSlotsLoading,
    isError: isSlotsError,
    refetch: refetchSlots,
  } = useGetBookableSlotsQuery();
  const {
    data: bookingsResponse,
    isLoading: isBookingsLoading,
    isError: isBookingsError,
    refetch: refetchBookings,
  } = useGetMyBookingsQuery({ limit: 100 });

  const [createBooking, { isLoading: isCreatingBooking }] = useCreateBookingMutation();
  const [updateBookingStatus, { isLoading: isUpdatingBooking }] = useUpdateBookingStatusMutation();

  const [selectedSlotKey, setSelectedSlotKey] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [notice, setNotice] = useState(null);
  const [errorNotice, setErrorNotice] = useState(null);

  const membership = slotsResponse?.data?.membership ?? null;
  const availabilityNotes = slotsResponse?.data?.notes ?? '';
  const timezone = slotsResponse?.data?.timezone ?? 'Asia/Calcutta';
  const slots = Array.isArray(slotsResponse?.data?.slots) ? slotsResponse.data.slots : [];
  const bookings = Array.isArray(bookingsResponse?.data?.bookings) ? bookingsResponse.data.bookings : [];

  const groupedSlots = useMemo(() => {
    const groups = new Map();
    slots.forEach((slot) => {
      const dateKey = slot.date;
      if (!groups.has(dateKey)) {
        groups.set(dateKey, []);
      }
      groups.get(dateKey).push(slot);
    });
    return Array.from(groups.entries()).map(([date, entries]) => ({
      date,
      entries,
    }));
  }, [slots]);

  const selectedSlot = useMemo(
    () => slots.find((slot) => slot.availabilitySlotKey === selectedSlotKey && slot.date === selectedDate) ?? null,
    [slots, selectedDate, selectedSlotKey],
  );

  const upcomingBookings = useMemo(
    () => bookings.filter((booking) => ['pending', 'confirmed'].includes(booking.status)),
    [bookings],
  );

  const pastBookings = useMemo(
    () => bookings.filter((booking) => ['completed', 'cancelled'].includes(booking.status)),
    [bookings],
  );

  useEffect(() => {
    const currentSelectionIsValid = slots.some(
      (slot) => slot.availabilitySlotKey === selectedSlotKey && slot.date === selectedDate,
    );

    if (currentSelectionIsValid) {
      return;
    }

    const firstOpenSlot = slots.find((slot) => !slot.isSoldOut && !slot.myBooking);
    if (!firstOpenSlot) {
      if (selectedSlotKey || selectedDate) {
        setSelectedSlotKey('');
        setSelectedDate('');
      }
      return;
    }

    setSelectedSlotKey(firstOpenSlot.availabilitySlotKey);
    setSelectedDate(firstOpenSlot.date);
  }, [selectedDate, selectedSlotKey, slots]);

  const handleRefresh = () => {
    setNotice(null);
    setErrorNotice(null);
    refetchSlots();
    refetchBookings();
  };

  const resetMessages = () => {
    setNotice(null);
    setErrorNotice(null);
  };

  const handleBook = async (event) => {
    event.preventDefault();
    if (!membership?.gym?.id || !membership?.trainer?.id || !selectedSlot) {
      return;
    }

    resetMessages();

    try {
      await createBooking({
        gymId: membership.gym.id,
        trainerId: membership.trainer.id,
        bookingDate: selectedSlot.date,
        availabilitySlotKey: selectedSlot.availabilitySlotKey,
        notes,
      }).unwrap();
      setNotice('Session request sent to your trainer.');
      setNotes('');
      await Promise.all([refetchSlots(), refetchBookings()]);
    } catch (error) {
      setErrorNotice(error?.data?.message ?? 'Could not create the booking request.');
    }
  };

  const handleCancelBooking = async (bookingId) => {
    resetMessages();

    try {
      await updateBookingStatus({
        bookingId,
        status: 'cancelled',
        cancellationReason: 'Cancelled by trainee',
      }).unwrap();
      setNotice('Booking cancelled.');
      await Promise.all([refetchSlots(), refetchBookings()]);
    } catch (error) {
      setErrorNotice(error?.data?.message ?? 'Could not cancel the booking.');
    }
  };

  if (isSlotsLoading || isBookingsLoading) {
    return (
      <div className="dashboard-grid dashboard-grid--trainee">
        {['Membership and trainer', 'Upcoming availability', 'My bookings'].map((title) => (
          <DashboardSection key={title} title={title} className="dashboard-section--span-12">
            <SkeletonPanel lines={8} />
          </DashboardSection>
        ))}
      </div>
    );
  }

  if (isSlotsError || isBookingsError) {
    return (
      <div className="dashboard-grid dashboard-grid--trainee">
        <DashboardSection
          title="Sessions unavailable"
          className="dashboard-section--span-12"
          action={<button type="button" onClick={handleRefresh}>Retry</button>}
        >
          <EmptyState message="We could not load your session calendar right now." />
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="dashboard-grid dashboard-grid--trainee">
      <DashboardSection title="Membership and trainer" className="dashboard-section--span-12">
        {membership ? (
          <div className="session-membership-card">
            <div>
              <small>Gym</small>
              <strong>{membership.gym?.name ?? 'Active gym'}</strong>
              <p>{membership.gym?.address ?? membership.gym?.city ?? 'Location pending'}</p>
            </div>
            <div>
              <small>Trainer</small>
              <strong>{membership.trainer?.name ?? 'Assigned trainer'}</strong>
              <p>{membership.status ? `Membership ${formatStatus(membership.status).toLowerCase()}` : 'Membership active'}</p>
            </div>
            <div>
              <small>Timezone</small>
              <strong>{timezone}</strong>
              <p>{availabilityNotes || 'Your trainer publishes weekly session windows here.'}</p>
            </div>
          </div>
        ) : (
          <EmptyState message="Join a gym and select a trainer before booking sessions." />
        )}
      </DashboardSection>

      <DashboardSection title="Upcoming availability" className="dashboard-section--span-8">
        {membership ? (
          groupedSlots.length ? (
            <div className="session-slot-groups">
              {groupedSlots.map((group) => (
                <section key={group.date} className="session-slot-group">
                  <header>
                    <h3>{formatDate(group.date)}</h3>
                    <small>{group.entries.length} slot{group.entries.length === 1 ? '' : 's'}</small>
                  </header>
                  <div className="session-slot-list">
                    {group.entries.map((slot) => {
                      const isSelected = selectedSlotKey === slot.availabilitySlotKey && selectedDate === slot.date;
                      const isDisabled = slot.isSoldOut || Boolean(slot.myBooking);

                      return (
                        <button
                          key={`${group.date}-${slot.availabilitySlotKey}`}
                          type="button"
                          className={`session-slot-card${isSelected ? ' is-selected' : ''}${isDisabled ? ' is-disabled' : ''}`}
                          onClick={() => {
                            setSelectedSlotKey(slot.availabilitySlotKey);
                            setSelectedDate(slot.date);
                          }}
                          disabled={isDisabled}
                        >
                          <strong>{slot.startTime} - {slot.endTime}</strong>
                          <span>{formatStatus(slot.sessionType)}</span>
                          <small>{slot.locationLabel || 'Gym floor'}</small>
                          <small>
                            {slot.myBooking
                              ? `Already ${formatStatus(slot.myBooking.status).toLowerCase()}`
                              : `${slot.remainingCapacity}/${slot.capacity} seats left`}
                          </small>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <EmptyState message="No bookable trainer slots are published yet." />
          )
        ) : (
          <EmptyState message="A current membership is required before sessions can be booked." />
        )}
      </DashboardSection>

      <DashboardSection title="Create booking request" className="dashboard-section--span-4">
        {selectedSlot && membership ? (
          <form className="session-booking-form" onSubmit={handleBook}>
            <div>
              <small>Selected slot</small>
              <strong>{formatDate(selectedSlot.date)}</strong>
              <p>{selectedSlot.startTime} - {selectedSlot.endTime} | {formatStatus(selectedSlot.sessionType)}</p>
            </div>
            <label htmlFor="session-notes">Notes for your trainer</label>
            <textarea
              id="session-notes"
              rows={6}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional goals or topics to cover in this session"
            />
            <button type="submit" disabled={isCreatingBooking || selectedSlot.isSoldOut || Boolean(selectedSlot.myBooking)}>
              {isCreatingBooking ? 'Requesting...' : 'Request session'}
            </button>
          </form>
        ) : (
          <EmptyState message="Select an open slot to request a session." />
        )}
        {notice ? <p className="session-notice session-notice--success">{notice}</p> : null}
        {errorNotice ? <p className="session-notice session-notice--error">{errorNotice}</p> : null}
      </DashboardSection>

      <DashboardSection title="My bookings" className="dashboard-section--span-12">
        {upcomingBookings.length ? (
          <div className="session-booking-table-wrap">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Gym</th>
                  <th>Trainer</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {upcomingBookings.map((booking) => (
                  <tr key={booking.id}>
                    <td>{formatDate(booking.bookingDate)}</td>
                    <td>{booking.startTime} - {booking.endTime}</td>
                    <td>{booking.gym?.name ?? 'Gym'}</td>
                    <td>{booking.trainer?.name ?? 'Trainer'}</td>
                    <td>{formatStatus(booking.status)}</td>
                    <td>{booking.notes || '-'}</td>
                    <td>
                      {['pending', 'confirmed'].includes(booking.status) ? (
                        <button
                          type="button"
                          className="session-inline-action"
                          disabled={isUpdatingBooking}
                          onClick={() => handleCancelBooking(booking.id)}
                        >
                          Cancel
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState message="You do not have any upcoming session requests." />
        )}
      </DashboardSection>

      <DashboardSection title="Session history" className="dashboard-section--span-12">
        {pastBookings.length ? (
          <ul className="session-history-list">
            {pastBookings.map((booking) => (
              <li key={booking.id}>
                <strong>{formatDate(booking.bookingDate)} | {booking.startTime} - {booking.endTime}</strong>
                <span>{booking.gym?.name ?? 'Gym'} with {booking.trainer?.name ?? 'Trainer'}</span>
                <small>{formatStatus(booking.status)}{booking.cancellationReason ? ` | ${booking.cancellationReason}` : ''}</small>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState message="Completed or cancelled sessions will appear here." />
        )}
      </DashboardSection>
    </div>
  );
};

export default TraineeSessionsPage;
