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
import { formatDate, formatDateTime, formatStatus } from '../../../utils/format.js';
import '../Dashboard.css';
import './SessionsPage.css';

const BOOKING_STATUS_STEPS = ['pending', 'confirmed', 'completed', 'cancelled'];

const buildIcsTimestamp = (dateValue, timeValue = '00:00') => {
  const baseDate = dateValue instanceof Date ? dateValue : new Date(dateValue);
  const [hours, minutes] = String(timeValue || '00:00').split(':').map(Number);
  const year = baseDate.getFullYear();
  const month = String(baseDate.getMonth() + 1).padStart(2, '0');
  const day = String(baseDate.getDate()).padStart(2, '0');
  const hour = String(Number.isFinite(hours) ? hours : 0).padStart(2, '0');
  const minute = String(Number.isFinite(minutes) ? minutes : 0).padStart(2, '0');
  return `${year}${month}${day}T${hour}${minute}00`;
};

const getDateKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};

const getBookingStartDateTime = (booking) => {
  const [hours, minutes] = String(booking?.startTime || '00:00').split(':').map(Number);
  const date = new Date(booking?.bookingDate);
  date.setHours(Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  return date;
};

const buildBookingStatusTimeline = (status) => {
  const normalizedStatus = BOOKING_STATUS_STEPS.includes(status) ? status : 'pending';
  return BOOKING_STATUS_STEPS.map((step) => {
    if (normalizedStatus === 'cancelled') {
      return {
        key: step,
        label: formatStatus(step),
        state: step === 'cancelled' ? 'current' : 'muted',
      };
    }

    const activeIndex = BOOKING_STATUS_STEPS.indexOf(normalizedStatus);
    const stepIndex = BOOKING_STATUS_STEPS.indexOf(step);
    return {
      key: step,
      label: formatStatus(step),
      state: step === normalizedStatus ? 'current' : stepIndex < activeIndex ? 'complete' : 'upcoming',
    };
  });
};

const downloadCalendarInvite = (booking) => {
  if (typeof window === 'undefined') {
    return;
  }

  const startStamp = buildIcsTimestamp(booking.bookingDate, booking.startTime);
  const endStamp = buildIcsTimestamp(booking.bookingDate, booking.endTime);
  const generatedAt = buildIcsTimestamp(new Date());
  const title = `${booking.gym?.name ?? 'FitSync'} session`;
  const description = [
    `Trainer: ${booking.trainer?.name ?? 'Assigned trainer'}`,
    `Session type: ${formatStatus(booking.sessionType)}`,
    booking.notes ? `Notes: ${booking.notes}` : null,
  ].filter(Boolean).join('\\n');
  const location = booking.locationLabel || booking.gym?.name || 'Gym session';

  const content = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FitSync//Session Booking//EN',
    'BEGIN:VEVENT',
    `UID:${booking.id}@fitsync`,
    `DTSTAMP:${generatedAt}`,
    `DTSTART:${startStamp}`,
    `DTEND:${endStamp}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = `${booking.gym?.name ?? 'session'}-${getDateKey(booking.bookingDate)}.ics`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
};

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
  const [activeDate, setActiveDate] = useState('');
  const [reschedulingBooking, setReschedulingBooking] = useState(null);
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

  const visibleGroup = useMemo(
    () => groupedSlots.find((group) => group.date === activeDate) ?? groupedSlots[0] ?? null,
    [activeDate, groupedSlots],
  );

  const selectedSlot = useMemo(
    () => slots.find((slot) => slot.availabilitySlotKey === selectedSlotKey && slot.date === selectedDate) ?? null,
    [slots, selectedDate, selectedSlotKey],
  );

  const upcomingBookings = useMemo(
    () => bookings
      .filter((booking) => ['pending', 'confirmed'].includes(booking.status))
      .sort((left, right) => getBookingStartDateTime(left).getTime() - getBookingStartDateTime(right).getTime()),
    [bookings],
  );

  const nextUpcomingBooking = useMemo(() => {
    if (!upcomingBookings.length) {
      return null;
    }

    return [...upcomingBookings].sort(
      (left, right) => getBookingStartDateTime(left).getTime() - getBookingStartDateTime(right).getTime(),
    )[0];
  }, [upcomingBookings]);

  const pastBookings = useMemo(
    () => bookings
      .filter((booking) => ['completed', 'cancelled'].includes(booking.status))
      .sort((left, right) => getBookingStartDateTime(right).getTime() - getBookingStartDateTime(left).getTime()),
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

  useEffect(() => {
    if (!groupedSlots.length) {
      setActiveDate('');
      return;
    }

    const matchingDate = groupedSlots.some((group) => group.date === activeDate);
    if (!matchingDate) {
      setActiveDate(groupedSlots[0].date);
    }
  }, [activeDate, groupedSlots]);

  useEffect(() => {
    if (selectedDate) {
      setActiveDate(selectedDate);
    }
  }, [selectedDate]);

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
      if (reschedulingBooking) {
        await createBooking({
          gymId: membership.gym.id,
          trainerId: membership.trainer.id,
          bookingDate: selectedSlot.date,
          availabilitySlotKey: selectedSlot.availabilitySlotKey,
          notes,
        }).unwrap();

        await updateBookingStatus({
          bookingId: reschedulingBooking.id,
          status: 'cancelled',
          cancellationReason: 'Rescheduled by trainee',
        }).unwrap();

        setNotice('Session rescheduled successfully.');
        setReschedulingBooking(null);
      } else {
        await createBooking({
          gymId: membership.gym.id,
          trainerId: membership.trainer.id,
          bookingDate: selectedSlot.date,
          availabilitySlotKey: selectedSlot.availabilitySlotKey,
          notes,
        }).unwrap();
        setNotice('Session request sent to your trainer.');
      }

      setNotes('');
      await Promise.all([refetchSlots(), refetchBookings()]);
    } catch (error) {
      setErrorNotice(error?.data?.message ?? 'Could not update the booking request.');
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
      if (reschedulingBooking?.id === bookingId) {
        setReschedulingBooking(null);
      }
      await Promise.all([refetchSlots(), refetchBookings()]);
    } catch (error) {
      setErrorNotice(error?.data?.message ?? 'Could not cancel the booking.');
    }
  };

  const handleStartReschedule = (booking) => {
    resetMessages();
    setReschedulingBooking(booking);
    setNotes(booking.notes ?? '');

    const firstAvailable = slots.find(
      (slot) => !slot.isSoldOut && !slot.myBooking && slot.date !== getDateKey(booking.bookingDate),
    ) ?? slots.find((slot) => !slot.isSoldOut && !slot.myBooking);

    if (firstAvailable) {
      setSelectedDate(firstAvailable.date);
      setSelectedSlotKey(firstAvailable.availabilitySlotKey);
      setActiveDate(firstAvailable.date);
    }
  };

  const handleClearReschedule = () => {
    setReschedulingBooking(null);
    setNotes('');
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
      <DashboardSection title="Membership and trainer" className="dashboard-section--span-8">
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

      <DashboardSection title="Rules and reminders" className="dashboard-section--span-4">
        <div className="session-guidance-card">
          {nextUpcomingBooking ? (
            <div className="session-guidance-card__block">
              <small>Next session reminder</small>
              <strong>{formatDate(nextUpcomingBooking.bookingDate)}</strong>
              <p>
                {nextUpcomingBooking.startTime} - {nextUpcomingBooking.endTime}
                {' | '}
                {nextUpcomingBooking.trainer?.name ?? 'Assigned trainer'}
              </p>
              <button
                type="button"
                className="session-inline-action session-inline-action--secondary"
                onClick={() => downloadCalendarInvite(nextUpcomingBooking)}
              >
                Add reminder to calendar
              </button>
            </div>
          ) : (
            <div className="session-guidance-card__block">
              <small>Next session reminder</small>
              <strong>No upcoming session</strong>
              <p>Book a slot to create a calendar reminder and keep your trainer in sync.</p>
            </div>
          )}

          <div className="session-guidance-card__block">
            <small>Booking rules</small>
            <strong>Trainer confirmation required</strong>
            <p>New requests stay pending until your trainer confirms them. Reschedule or cancel only future pending or confirmed sessions.</p>
          </div>

          <div className="session-guidance-card__block">
            <small>Trainer notes and prep</small>
            <strong>{membership?.trainer?.name ?? 'Assigned trainer'}</strong>
            <p>{availabilityNotes || 'Your trainer has not published extra prep notes yet. Add goals in your booking note to shape the session.'}</p>
          </div>
        </div>
      </DashboardSection>

      <DashboardSection title="Availability calendar" className="dashboard-section--span-8">
        {membership ? (
          groupedSlots.length ? (
            <div className="session-calendar">
              <div className="session-calendar__dates">
                {groupedSlots.map((group) => (
                  <button
                    key={group.date}
                    type="button"
                    className={`session-date-pill${activeDate === group.date ? ' is-active' : ''}`}
                    onClick={() => setActiveDate(group.date)}
                  >
                    <strong>{formatDate(group.date)}</strong>
                    <small>{group.entries.length} slot{group.entries.length === 1 ? '' : 's'}</small>
                  </button>
                ))}
              </div>

              {visibleGroup ? (
                <section className="session-slot-group">
                  <header>
                    <h3>{formatDate(visibleGroup.date)}</h3>
                    <small>{visibleGroup.entries.length} slot{visibleGroup.entries.length === 1 ? '' : 's'}</small>
                  </header>
                  <div className="session-slot-list">
                    {visibleGroup.entries.map((slot) => {
                      const isSelected = selectedSlotKey === slot.availabilitySlotKey && selectedDate === slot.date;
                      const isDisabled = slot.isSoldOut || Boolean(slot.myBooking);

                      return (
                        <button
                          key={`${visibleGroup.date}-${slot.availabilitySlotKey}`}
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
              ) : null}
            </div>
          ) : (
            <EmptyState message="No bookable trainer slots are published yet." />
          )
        ) : (
          <EmptyState message="A current membership is required before sessions can be booked." />
        )}
      </DashboardSection>

      <DashboardSection title={reschedulingBooking ? 'Reschedule session' : 'Create booking request'} className="dashboard-section--span-4">
        {reschedulingBooking ? (
          <div className="session-reschedule-banner">
            <small>Replacing booking</small>
            <strong>{formatDate(reschedulingBooking.bookingDate)} | {reschedulingBooking.startTime} - {reschedulingBooking.endTime}</strong>
            <button type="button" className="session-inline-action session-inline-action--secondary" onClick={handleClearReschedule}>
              Keep current booking
            </button>
          </div>
        ) : null}

        {selectedSlot && membership ? (
          <form className="session-booking-form" onSubmit={handleBook}>
            <div className="session-booking-preview">
              <small>Selected slot</small>
              <strong>{formatDate(selectedSlot.date)}</strong>
              <p>{selectedSlot.startTime} - {selectedSlot.endTime} | {formatStatus(selectedSlot.sessionType)}</p>
              <small>{selectedSlot.locationLabel || 'Gym floor'} | {selectedSlot.remainingCapacity}/{selectedSlot.capacity} seats left</small>
            </div>
            <label htmlFor="session-notes">Notes for your trainer</label>
            <textarea
              id="session-notes"
              rows={6}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional goals or topics to cover in this session"
            />
            <button type="submit" disabled={isCreatingBooking || isUpdatingBooking || selectedSlot.isSoldOut || Boolean(selectedSlot.myBooking)}>
              {isCreatingBooking || isUpdatingBooking
                ? 'Saving...'
                : reschedulingBooking
                  ? 'Confirm reschedule'
                  : 'Request session'}
            </button>
          </form>
        ) : (
          <EmptyState message="Select an open slot to request a session." />
        )}
        {notice ? <p className="session-notice session-notice--success">{notice}</p> : null}
        {errorNotice ? <p className="session-notice session-notice--error">{errorNotice}</p> : null}
      </DashboardSection>

      <DashboardSection title="Upcoming bookings" className="dashboard-section--span-12">
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
                  <th>Details</th>
                  <th>Actions</th>
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
                    <td>
                      <div className="session-booking-detail">
                        <strong>{formatStatus(booking.sessionType)}</strong>
                        <small>{booking.locationLabel || 'Gym floor'}</small>
                        <small>{booking.notes || 'No extra notes'}</small>
                        <small>
                          {booking.status === 'pending'
                            ? 'Awaiting trainer confirmation'
                            : 'Bring this booking to the floor or your calendar reminder'}
                        </small>
                        <div className="session-status-timeline">
                          {buildBookingStatusTimeline(booking.status).map((step) => (
                            <span
                              key={`${booking.id}-${step.key}`}
                              className={`session-status-timeline__pill session-status-timeline__pill--${step.state}`}
                            >
                              {step.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="session-action-group">
                        <button
                          type="button"
                          className="session-inline-action session-inline-action--secondary"
                          onClick={() => downloadCalendarInvite(booking)}
                        >
                          Add to calendar
                        </button>
                        {['pending', 'confirmed'].includes(booking.status) ? (
                          <button
                            type="button"
                            className="session-inline-action"
                            disabled={isCreatingBooking || isUpdatingBooking}
                            onClick={() => handleStartReschedule(booking)}
                          >
                            Reschedule
                          </button>
                        ) : null}
                        {['pending', 'confirmed'].includes(booking.status) ? (
                          <button
                            type="button"
                            className="session-inline-action session-inline-action--danger"
                            disabled={isUpdatingBooking}
                            onClick={() => handleCancelBooking(booking.id)}
                          >
                            Cancel
                          </button>
                        ) : null}
                      </div>
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
                <small>Updated {formatDateTime(booking.updatedAt)}</small>
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
