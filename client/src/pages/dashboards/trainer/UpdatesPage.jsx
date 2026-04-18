import { useState, useMemo, useEffect } from 'react';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import {
  useGetTrainerTraineesQuery,
  useGetTrainerUpdatesQuery,
} from '../../../services/dashboardApi.js';
import {
  useLogAttendanceMutation,
  useRecordProgressMutation,
  useAssignDietMutation,
  useShareFeedbackMutation,
  useGetMyAvailabilityQuery,
  useUpdateAvailabilityMutation,
} from '../../../services/trainerApi.js';
import {
  useGetMyBookingsQuery,
  useUpdateBookingStatusMutation,
} from '../../../services/bookingApi.js';
import { formatDate, formatStatus } from '../../../utils/format.js';
import '../Dashboard.css';

const MEAL_SLOTS = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'snack', label: 'Snack' },
  { key: 'dinner', label: 'Dinner' },
];

const defaultAttendance = () => ({
  date: new Date().toISOString().slice(0, 10),
  status: 'present',
  notes: '',
});

const defaultProgress = () => ({
  weight: '',
  height: '',
  recordedAt: new Date().toISOString().slice(0, 10),
});

const defaultDietMeals = () =>
  MEAL_SLOTS.reduce((acc, slot) => {
    acc[slot.key] = { item: '', calories: '', protein: '', fat: '' };
    return acc;
  }, {});

const defaultDiet = () => ({
  weekOf: '',
  meals: defaultDietMeals(),
  notes: '',
});

const defaultFeedback = () => ({
  message: '',
  category: 'general',
});

const defaultAvailabilitySlot = () => ({
  dayOfWeek: '1',
  startTime: '07:00',
  endTime: '08:00',
  capacity: '1',
  sessionType: 'personal-training',
  locationLabel: '',
});

const TrainerUpdatesPage = () => {
  const { data, isLoading, isError, refetch } = useGetTrainerTraineesQuery();
  const { data: trainerUpdatesResponse } = useGetTrainerUpdatesQuery();
  const rawAssignments = data?.data?.assignments;
  const trainerUpdates = Array.isArray(trainerUpdatesResponse?.data?.updates) ? trainerUpdatesResponse.data.updates : [];

  const assignments = useMemo(
    () => (Array.isArray(rawAssignments) ? rawAssignments : []),
    [rawAssignments],
  );

  const trainees = useMemo(
    () =>
      assignments.flatMap((assignment) =>
        (assignment.trainees || []).map((trainee, index) => {
          const resolvedId = trainee.id ?? trainee._id ?? `${assignment.id}-trainee-${index}`;
          return {
            ...trainee,
            assignmentId: assignment.id,
            gym: assignment.gym,
            internalId: String(resolvedId),
          };
        }),
      ),
    [assignments],
  );

  const [selectedTraineeId, setSelectedTraineeId] = useState('');
  const [attendanceForm, setAttendanceForm] = useState(defaultAttendance());
  const [progressForm, setProgressForm] = useState(defaultProgress());
  const [dietForm, setDietForm] = useState(defaultDiet());
  const [feedbackForm, setFeedbackForm] = useState(defaultFeedback());
  const [availabilityForm, setAvailabilityForm] = useState({
    gymId: '',
    timezone: 'Asia/Calcutta',
    notes: '',
    slot: defaultAvailabilitySlot(),
  });
  const [notice, setNotice] = useState(null);
  const [errorNotice, setErrorNotice] = useState(null);

  const [logAttendance, { isLoading: isLoggingAttendance }] = useLogAttendanceMutation();
  const [recordProgress, { isLoading: isRecordingProgress }] = useRecordProgressMutation();
  const [assignDiet, { isLoading: isAssigningDiet }] = useAssignDietMutation();
  const [shareFeedback, { isLoading: isSharingFeedback }] = useShareFeedbackMutation();
  const { data: availabilityResponse } = useGetMyAvailabilityQuery();
  const [updateAvailability, { isLoading: isUpdatingAvailability }] = useUpdateAvailabilityMutation();
  const {
    data: trainerBookingsResponse,
    isLoading: isTrainerBookingsLoading,
    refetch: refetchTrainerBookings,
  } = useGetMyBookingsQuery({ limit: 100 });
  const [updateBookingStatus, { isLoading: isUpdatingBookingStatus }] = useUpdateBookingStatusMutation();

  const selectedTrainee = useMemo(
    () => trainees.find((t) => t.internalId === selectedTraineeId),
    [trainees, selectedTraineeId]
  );

  const trainerGyms = useMemo(() => {
    const unique = new Map();
    assignments.forEach((assignment) => {
      const gym = assignment.gym;
      if (gym?.id && !unique.has(gym.id)) {
        unique.set(gym.id, gym);
      }
    });
    return Array.from(unique.values());
  }, [assignments]);

  const availabilityEntries = availabilityResponse?.data?.availability ?? [];
  const trainerBookings = useMemo(
    () => (Array.isArray(trainerBookingsResponse?.data?.bookings) ? trainerBookingsResponse.data.bookings : []),
    [trainerBookingsResponse?.data?.bookings],
  );
  const bookingSummary = trainerBookingsResponse?.data?.summary ?? {};
  const trainerUpdatesByTraineeId = useMemo(
    () => trainerUpdates.reduce((acc, update) => {
      const traineeId = String(update?.trainee?._id ?? update?.trainee?.id ?? '');
      if (traineeId) {
        acc[traineeId] = update;
      }
      return acc;
    }, {}),
    [trainerUpdates],
  );

  const selectedAvailabilityEntry = useMemo(
    () => availabilityEntries.find((entry) => entry.gym?._id === availabilityForm.gymId || entry.gym?.id === availabilityForm.gymId),
    [availabilityEntries, availabilityForm.gymId],
  );
  const pendingBookings = useMemo(
    () => trainerBookings.filter((booking) => booking.status === 'pending'),
    [trainerBookings],
  );
  const confirmedBookings = useMemo(
    () => trainerBookings.filter((booking) => booking.status === 'confirmed'),
    [trainerBookings],
  );
  const recentBookingHistory = useMemo(
    () => trainerBookings.filter((booking) => ['completed', 'cancelled'].includes(booking.status)).slice(0, 6),
    [trainerBookings],
  );
  const todaysTrainerBookings = useMemo(() => {
    const todayKey = new Date().toISOString().slice(0, 10);
    return trainerBookings.filter((booking) => {
      if (!booking.bookingDate) {
        return false;
      }
      return new Date(booking.bookingDate).toISOString().slice(0, 10) === todayKey;
    });
  }, [trainerBookings]);
  const availabilitySlotCount = useMemo(
    () => availabilityEntries.reduce((sum, entry) => sum + ((entry.slots ?? []).length), 0),
    [availabilityEntries],
  );
  const traineesWithPendingFeedback = useMemo(
    () => trainerUpdates.filter((update) => (update.pendingFeedback?.length ?? 0) > 0),
    [trainerUpdates],
  );
  const selectedTraineeUpdate = useMemo(
    () => trainerUpdatesByTraineeId[String(selectedTrainee?.id ?? selectedTrainee?._id ?? '')] ?? null,
    [selectedTrainee, trainerUpdatesByTraineeId],
  );

  const bmiPreview = useMemo(() => {
    const weight = Number(progressForm.weight);
    const height = Number(progressForm.height);
    if (!weight || !height) {
      return null;
    }
    const heightMeters = height / 100;
    if (!Number.isFinite(heightMeters) || heightMeters <= 0) {
      return null;
    }
    const bmiValue = weight / (heightMeters * heightMeters);
    if (!Number.isFinite(bmiValue) || bmiValue <= 0) {
      return null;
    }
    return bmiValue.toFixed(1);
  }, [progressForm.height, progressForm.weight]);

  useEffect(() => {
    if (trainees.length && !selectedTraineeId) {
      // Optional: Auto-select first trainee or leave empty to force choice
      // setSelectedTraineeId(trainees[0].internalId);
    }
  }, [trainees, selectedTraineeId]);

  useEffect(() => {
    if (!availabilityForm.gymId && trainerGyms.length) {
      setAvailabilityForm((prev) => ({
        ...prev,
        gymId: trainerGyms[0].id,
      }));
    }
  }, [availabilityForm.gymId, trainerGyms]);

  useEffect(() => {
    if (!selectedAvailabilityEntry) {
      return;
    }

    setAvailabilityForm((prev) => ({
      ...prev,
      timezone: selectedAvailabilityEntry.timezone || prev.timezone,
      notes: selectedAvailabilityEntry.notes || '',
    }));
  }, [selectedAvailabilityEntry]);

  const resetNotices = () => {
    setNotice(null);
    setErrorNotice(null);
  };

  const handleMealChange = (mealKey, field, value) => {
    setDietForm((prev) => ({
      ...prev,
      meals: {
        ...prev.meals,
        [mealKey]: {
          ...prev.meals[mealKey],
          [field]: value,
        },
      },
    }));
  };

  const handleAttendanceSubmit = async (event) => {
    event.preventDefault();
    if (!selectedTrainee) return;
    resetNotices();
    try {
      await logAttendance({ traineeId: selectedTrainee.id, ...attendanceForm }).unwrap();
      setNotice('Attendance recorded successfully.');
      setAttendanceForm(defaultAttendance());
    } catch (err) {
      setErrorNotice(err?.data?.message ?? 'Failed to log attendance.');
    }
  };

  const handleProgressSubmit = async (event) => {
    event.preventDefault();
    if (!selectedTrainee) return;
    resetNotices();
    const weightValue = Number(progressForm.weight);
    const heightValue = Number(progressForm.height);

    if (!Number.isFinite(weightValue) || weightValue <= 0) {
      setErrorNotice('Please enter a valid weight in kilograms.');
      return;
    }

    if (!Number.isFinite(heightValue) || heightValue <= 0) {
      setErrorNotice('Please enter a valid height in centimetres.');
      return;
    }

    try {
      await recordProgress({
        traineeId: selectedTrainee.id,
        weightKg: weightValue,
        heightCm: heightValue,
        recordedAt: progressForm.recordedAt,
      }).unwrap();
      setNotice('Body metrics saved.');
      setProgressForm(defaultProgress());
    } catch (err) {
      setErrorNotice(err?.data?.message ?? 'Failed to record progress.');
    }
  };

  const handleDietSubmit = async (event) => {
    event.preventDefault();
    if (!selectedTrainee) return;
    resetNotices();
    try {
      const mealsPayload = MEAL_SLOTS.reduce((acc, slot) => {
        const entry = dietForm.meals[slot.key];
        acc[slot.key] = {
          item: entry?.item ?? '',
          calories: entry?.calories ?? '',
          protein: entry?.protein ?? '',
          fat: entry?.fat ?? '',
        };
        return acc;
      }, {});

      await assignDiet({
        traineeId: selectedTrainee.id,
        weekOf: dietForm.weekOf,
        notes: dietForm.notes,
        meals: mealsPayload,
      }).unwrap();
      setNotice('Diet plan assigned.');
      setDietForm(defaultDiet());
    } catch (err) {
      setErrorNotice(err?.data?.message ?? 'Failed to assign diet plan.');
    }
  };

  const handleFeedbackSubmit = async (event) => {
    event.preventDefault();
    if (!selectedTrainee) return;
    resetNotices();
    try {
      await shareFeedback({
        traineeId: selectedTrainee.id,
        message: feedbackForm.message,
        category: feedbackForm.category,
      }).unwrap();
      setNotice('Feedback sent to trainee.');
      setFeedbackForm(defaultFeedback());
    } catch (err) {
      setErrorNotice(err?.data?.message ?? 'Failed to send feedback.');
    }
  };

  const handleAvailabilitySlotChange = (field, value) => {
    setAvailabilityForm((prev) => ({
      ...prev,
      slot: {
        ...prev.slot,
        [field]: value,
      },
    }));
  };

  const handleAvailabilitySubmit = async (event) => {
    event.preventDefault();
    if (!availabilityForm.gymId) {
      setErrorNotice('Select a gym before saving availability.');
      return;
    }

    resetNotices();

    const existingSlots = selectedAvailabilityEntry?.slots ?? [];
    const nextSlot = {
      dayOfWeek: Number(availabilityForm.slot.dayOfWeek),
      startTime: availabilityForm.slot.startTime,
      endTime: availabilityForm.slot.endTime,
      capacity: Number(availabilityForm.slot.capacity) || 1,
      sessionType: availabilityForm.slot.sessionType,
      locationLabel: availabilityForm.slot.locationLabel,
    };

    const slots = [...existingSlots, nextSlot];

    try {
      await updateAvailability({
        gymId: availabilityForm.gymId,
        timezone: availabilityForm.timezone,
        notes: availabilityForm.notes,
        slots,
      }).unwrap();
      setNotice('Availability slot saved.');
      setAvailabilityForm((prev) => ({
        ...prev,
        slot: defaultAvailabilitySlot(),
      }));
    } catch (err) {
      setErrorNotice(err?.data?.message ?? 'Failed to save availability.');
    }
  };

  const handleBookingStatusChange = async ({ bookingId, status, cancellationReason }) => {
    resetNotices();

    try {
      await updateBookingStatus({
        bookingId,
        status,
        cancellationReason,
      }).unwrap();
      setNotice(`Booking ${formatStatus(status).toLowerCase()}.`);
      await refetchTrainerBookings();
    } catch (err) {
      setErrorNotice(err?.data?.message ?? 'Failed to update booking status.');
    }
  };

  if (isLoading) {
    return (
      <div className="dashboard-grid">
        <DashboardSection title="Loading records...">
          <SkeletonPanel lines={8} />
        </DashboardSection>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="dashboard-grid">
        <DashboardSection title="Error">
          <EmptyState message="Could not load trainees. Please try again." />
          <button onClick={() => refetch()} className="retry-btn">Retry</button>
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="update-records-page">
      <header className="update-records-header">
        <h2>Update Trainee Records</h2>
        <p>Manage attendance, progress, diet, feedback, and session approvals for your assigned trainees.</p>
      </header>

      <div className="trainee-selector-section">
        <label htmlFor="trainee-select" className="selector-label">Select Trainee</label>
        <div className="selector-wrapper">
          <select
            id="trainee-select"
            value={selectedTraineeId}
            onChange={(e) => setSelectedTraineeId(e.target.value)}
            className="premium-select"
          >
            <option value="" disabled>Choose a trainee...</option>
            {trainees.map((t) => (
              <option key={t.internalId} value={t.internalId}>
                {t.name} ({t.gym?.name ?? 'No Gym'})
              </option>
            ))}
          </select>
        </div>
        {selectedTrainee && (
          <div className="selected-trainee-info">
            <span className="info-badge">{selectedTrainee.email}</span>
            <span className="info-badge">Assigned: {formatDate(selectedTrainee.assignedAt)}</span>
          </div>
        )}
      </div>

      {(notice || errorNotice) && (
        <div className={`notification-banner ${errorNotice ? 'error' : 'success'}`}>
          {errorNotice || notice}
          <button type="button" onClick={resetNotices} className="close-notification">x</button>
        </div>
      )}

      {selectedTrainee || trainerGyms.length ? (
        <div className="forms-grid">
          <section className="record-form-card record-form-card--full">
            <div className="card-header">
              <h3>Operations snapshot</h3>
              <p>Use today's queue, availability coverage, and pending feedback to stay ahead of trainee updates.</p>
            </div>
            <div className="stat-grid">
              <div className="stat-card">
                <small>Today's bookings</small>
                <strong>{todaysTrainerBookings.length}</strong>
                <small>{todaysTrainerBookings.length ? 'Sessions currently on your calendar today' : 'No sessions booked for today'}</small>
              </div>
              <div className="stat-card">
                <small>Pending requests</small>
                <strong>{bookingSummary.pending ?? pendingBookings.length}</strong>
                <small>Waiting for trainer confirmation</small>
              </div>
              <div className="stat-card">
                <small>Saved availability slots</small>
                <strong>{availabilitySlotCount}</strong>
                <small>Across {availabilityEntries.length} gym schedule{availabilityEntries.length === 1 ? '' : 's'}</small>
              </div>
              <div className="stat-card">
                <small>Feedback follow-up</small>
                <strong>{traineesWithPendingFeedback.length}</strong>
                <small>Trainees with pending feedback review items</small>
              </div>
            </div>
            {todaysTrainerBookings.length ? (
              <div className="dashboard-list">
                {todaysTrainerBookings.map((booking) => (
                  <div key={`${booking.id}-today`} className="dashboard-list__item">
                    <div>
                      <small>{booking.startTime} - {booking.endTime}</small>
                      <strong>{booking.trainee?.name ?? 'Trainee'}</strong>
                      <span>{booking.gym?.name ?? 'Gym'} | {formatStatus(booking.sessionType ?? 'personal-training')}</span>
                    </div>
                    <div className="dashboard-list__meta">
                      <strong>{formatStatus(booking.status)}</strong>
                      <small>{booking.notes || 'No trainer notes added yet'}</small>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          {selectedTrainee ? (
            <section className="record-form-card record-form-card--full">
              <div className="card-header">
                <h3>Selected trainee pulse</h3>
                <p>Review the latest attendance, progress metrics, and pending feedback before you log the next update.</p>
              </div>
              <div className="stat-grid">
                <div className="stat-card">
                  <small>Last attendance</small>
                  <strong>{selectedTraineeUpdate?.attendance?.[0] ? formatStatus(selectedTraineeUpdate.attendance[0].status) : '--'}</strong>
                  <small>{selectedTraineeUpdate?.attendance?.[0] ? formatDate(selectedTraineeUpdate.attendance[0].date) : 'No attendance logged yet'}</small>
                </div>
                <div className="stat-card">
                  <small>Latest metric</small>
                  <strong>
                    {selectedTraineeUpdate?.metrics?.[0]
                      ? `${formatStatus(selectedTraineeUpdate.metrics[0].metric)}`
                      : '--'}
                  </strong>
                  <small>
                    {selectedTraineeUpdate?.metrics?.[0]
                      ? `${selectedTraineeUpdate.metrics[0].latestValue}${selectedTraineeUpdate.metrics[0].unit ? ` ${selectedTraineeUpdate.metrics[0].unit}` : ''}`
                      : 'No performance metrics yet'}
                  </small>
                </div>
                <div className="stat-card">
                  <small>Pending feedback review</small>
                  <strong>{selectedTraineeUpdate?.pendingFeedback?.length ?? 0}</strong>
                  <small>{selectedTraineeUpdate?.pendingFeedback?.length ? 'Entries still awaiting review' : 'Nothing waiting for review'}</small>
                </div>
                <div className="stat-card">
                  <small>Recent records</small>
                  <strong>{selectedTraineeUpdate?.metrics?.length ?? 0}</strong>
                  <small>{selectedTraineeUpdate?.attendance?.length ?? 0} recent attendance records</small>
                </div>
              </div>
            </section>
          ) : null}

          <section className="record-form-card record-form-card--full">
            <div className="card-header">
              <h3>Session bookings</h3>
              <p>Confirm trainee requests and close out completed sessions.</p>
            </div>

            {isTrainerBookingsLoading ? (
              <SkeletonPanel lines={6} />
            ) : trainerBookings.length ? (
              <>
                <div className="stat-grid">
                  <div className="stat-card">
                    <small>Pending requests</small>
                    <strong>{bookingSummary.pending ?? pendingBookings.length}</strong>
                    <small>Waiting for trainer confirmation</small>
                  </div>
                  <div className="stat-card">
                    <small>Confirmed sessions</small>
                    <strong>{bookingSummary.confirmed ?? confirmedBookings.length}</strong>
                    <small>Upcoming sessions on your calendar</small>
                  </div>
                  <div className="stat-card">
                    <small>Completed sessions</small>
                    <strong>{bookingSummary.completed ?? 0}</strong>
                    <small>Recorded as delivered</small>
                  </div>
                </div>

                <div className="trainer-booking-table-wrap">
                  <table className="dashboard-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Trainee</th>
                        <th>Gym</th>
                        <th>Status</th>
                        <th>Notes</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trainerBookings.map((booking) => (
                        <tr key={booking.id}>
                          <td>{formatDate(booking.bookingDate)}</td>
                          <td>{booking.startTime} - {booking.endTime}</td>
                          <td>{booking.trainee?.name ?? 'Trainee'}</td>
                          <td>{booking.gym?.name ?? 'Gym'}</td>
                          <td>{formatStatus(booking.status)}</td>
                          <td>{booking.notes || '-'}</td>
                          <td>
                            <div className="trainer-booking-actions">
                              {booking.status === 'pending' ? (
                                <>
                                  <button
                                    type="button"
                                    disabled={isUpdatingBookingStatus}
                                    onClick={() => handleBookingStatusChange({ bookingId: booking.id, status: 'confirmed' })}
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isUpdatingBookingStatus}
                                    onClick={() => handleBookingStatusChange({
                                      bookingId: booking.id,
                                      status: 'cancelled',
                                      cancellationReason: 'Cancelled by trainer',
                                    })}
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : null}

                              {booking.status === 'confirmed' ? (
                                <>
                                  <button
                                    type="button"
                                    disabled={isUpdatingBookingStatus}
                                    onClick={() => handleBookingStatusChange({ bookingId: booking.id, status: 'completed' })}
                                  >
                                    Complete
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isUpdatingBookingStatus}
                                    onClick={() => handleBookingStatusChange({
                                      bookingId: booking.id,
                                      status: 'cancelled',
                                      cancellationReason: 'Cancelled by trainer',
                                    })}
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : null}

                              {!['pending', 'confirmed'].includes(booking.status) ? (
                                <span className="dashboard-table__meta">
                                  {booking.cancellationReason || 'Finalized'}
                                </span>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {recentBookingHistory.length ? (
                  <p className="trainer-booking-note">
                    Recent history: {recentBookingHistory.length} finalized booking
                    {recentBookingHistory.length === 1 ? '' : 's'}.
                  </p>
                ) : null}
              </>
            ) : (
              <EmptyState message="Booking requests will appear here after members start using your availability." />
            )}
          </section>

          <section className="record-form-card">
            <div className="card-header">
              <h3>Availability</h3>
              <p>Publish weekly slots for your active gyms.</p>
            </div>
            <form onSubmit={handleAvailabilitySubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Gym</label>
                  <select
                    value={availabilityForm.gymId}
                    onChange={(e) => setAvailabilityForm((prev) => ({ ...prev, gymId: e.target.value }))}
                    className="premium-select"
                  >
                    <option value="" disabled>Select gym</option>
                    {trainerGyms.map((gym) => (
                      <option key={gym.id} value={gym.id}>
                        {gym.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Timezone</label>
                  <input
                    type="text"
                    value={availabilityForm.timezone}
                    onChange={(e) => setAvailabilityForm((prev) => ({ ...prev, timezone: e.target.value }))}
                    className="premium-input"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Day of Week</label>
                  <select
                    value={availabilityForm.slot.dayOfWeek}
                    onChange={(e) => handleAvailabilitySlotChange('dayOfWeek', e.target.value)}
                    className="premium-select"
                  >
                    <option value="0">Sunday</option>
                    <option value="1">Monday</option>
                    <option value="2">Tuesday</option>
                    <option value="3">Wednesday</option>
                    <option value="4">Thursday</option>
                    <option value="5">Friday</option>
                    <option value="6">Saturday</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Start</label>
                  <input
                    type="time"
                    value={availabilityForm.slot.startTime}
                    onChange={(e) => handleAvailabilitySlotChange('startTime', e.target.value)}
                    className="premium-input"
                  />
                </div>
                <div className="form-group">
                  <label>End</label>
                  <input
                    type="time"
                    value={availabilityForm.slot.endTime}
                    onChange={(e) => handleAvailabilitySlotChange('endTime', e.target.value)}
                    className="premium-input"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Capacity</label>
                  <input
                    type="number"
                    min="1"
                    value={availabilityForm.slot.capacity}
                    onChange={(e) => handleAvailabilitySlotChange('capacity', e.target.value)}
                    className="premium-input"
                  />
                </div>
                <div className="form-group">
                  <label>Session Type</label>
                  <input
                    type="text"
                    value={availabilityForm.slot.sessionType}
                    onChange={(e) => handleAvailabilitySlotChange('sessionType', e.target.value)}
                    className="premium-input"
                  />
                </div>
                <div className="form-group">
                  <label>Location Label</label>
                  <input
                    type="text"
                    value={availabilityForm.slot.locationLabel}
                    onChange={(e) => handleAvailabilitySlotChange('locationLabel', e.target.value)}
                    className="premium-input"
                  />
                </div>
              </div>

              <div className="form-group full-width">
                <label>Availability Notes</label>
                <textarea
                  value={availabilityForm.notes}
                  onChange={(e) => setAvailabilityForm((prev) => ({ ...prev, notes: e.target.value }))}
                  className="premium-textarea"
                  placeholder="Optional notes for members"
                />
              </div>

              <div className="trainer-availability-list">
                <strong>Saved slots for selected gym</strong>
                {selectedAvailabilityEntry?.slots?.length ? (
                  <ul>
                    {selectedAvailabilityEntry.slots.map((slot, index) => (
                      <li key={`${slot.dayOfWeek}-${slot.startTime}-${index}`}>
                        <span>
                          Day {slot.dayOfWeek} • {slot.startTime} - {slot.endTime}
                        </span>
                        <small>{slot.sessionType || 'personal-training'} • cap {slot.capacity || 1}</small>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">No saved slots yet for this gym.</p>
                )}
              </div>

              <div className="form-actions">
                <button type="submit" disabled={isUpdatingAvailability} className="premium-btn">
                  {isUpdatingAvailability ? 'Saving...' : 'Add availability slot'}
                </button>
              </div>
            </form>
          </section>

          {selectedTrainee ? (
            <>
          {/* Attendance Form */}
          <section className="record-form-card">
            <div className="card-header">
              <h3>Log Attendance</h3>
              <p>Mark today's check-in status.</p>
            </div>
            <form onSubmit={handleAttendanceSubmit}>
              <div className="form-group">
                <label>Date</label>
                <input
                  type="date"
                  value={attendanceForm.date}
                  onChange={(e) => setAttendanceForm({ ...attendanceForm, date: e.target.value })}
                  required
                  className="premium-input"
                />
              </div>
              <div className="form-group">
                <label>Status</label>
                <select
                  value={attendanceForm.status}
                  onChange={(e) => setAttendanceForm({ ...attendanceForm, status: e.target.value })}
                  className="premium-select"
                >
                  <option value="present">Present</option>
                  <option value="late">Late</option>
                  <option value="absent">Absent</option>
                </select>
              </div>
              <div className="form-group full-width">
                <label>Notes</label>
                <textarea
                  placeholder="Optional notes..."
                  value={attendanceForm.notes}
                  onChange={(e) => setAttendanceForm({ ...attendanceForm, notes: e.target.value })}
                  className="premium-textarea"
                />
              </div>
              <div className="form-actions">
                <button type="submit" disabled={isLoggingAttendance} className="premium-btn">
                  {isLoggingAttendance ? 'Saving...' : 'Log Attendance'}
                </button>
              </div>
            </form>
          </section>

          {/* Progress Form */}
          <section className="record-form-card">
            <div className="card-header">
              <h3>Body Metrics</h3>
              <p>Log weight and height to keep BMI up to date.</p>
            </div>
            <form onSubmit={handleProgressSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Weight (kg)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="e.g. 68.5"
                    value={progressForm.weight}
                    onChange={(e) => setProgressForm({ ...progressForm, weight: e.target.value })}
                    required
                    className="premium-input"
                  />
                </div>
                <div className="form-group">
                  <label>Height (cm)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="e.g. 172"
                    value={progressForm.height}
                    onChange={(e) => setProgressForm({ ...progressForm, height: e.target.value })}
                    required
                    className="premium-input"
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Recorded on</label>
                  <input
                    type="date"
                    value={progressForm.recordedAt}
                    onChange={(e) => setProgressForm({ ...progressForm, recordedAt: e.target.value })}
                    required
                    className="premium-input"
                  />
                </div>
                <div className="form-group metric-preview">
                  <label>Calculated BMI</label>
                  <div className="metric-preview__value">{bmiPreview ?? '—'}</div>
                  <small className="metric-preview__hint">Automatically calculated</small>
                </div>
              </div>
              <div className="form-actions">
                <button type="submit" disabled={isRecordingProgress} className="premium-btn">
                  {isRecordingProgress ? 'Saving...' : 'Save body metrics'}
                </button>
              </div>
            </form>
          </section>

          {/* Diet Form */}
          <section className="record-form-card">
            <div className="card-header">
              <h3>Diet Plan</h3>
              <p>Assign meals for the week.</p>
            </div>
            <form onSubmit={handleDietSubmit}>
              <div className="form-group">
                <label>Week Starting</label>
                <input
                  type="date"
                  value={dietForm.weekOf}
                  onChange={(e) => setDietForm({ ...dietForm, weekOf: e.target.value })}
                  required
                  className="premium-input"
                />
              </div>
              <div className="meal-matrix">
                <div className="meal-matrix__header">
                  <span>Meal</span>
                  <span>Item</span>
                  <span>Calories</span>
                  <span>Protein (g)</span>
                  <span>Fat (g)</span>
                </div>
                {MEAL_SLOTS.map((slot) => {
                  const mealEntry = dietForm.meals[slot.key];
                  return (
                    <div key={slot.key} className="meal-matrix__row">
                      <label>{slot.label}</label>
                      <input
                        type="text"
                        placeholder="e.g. Oats with berries"
                        value={mealEntry.item}
                        onChange={(e) => handleMealChange(slot.key, 'item', e.target.value)}
                        className="premium-input"
                      />
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="kcal"
                        value={mealEntry.calories}
                        onChange={(e) => handleMealChange(slot.key, 'calories', e.target.value)}
                        className="premium-input"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        placeholder="g"
                        value={mealEntry.protein}
                        onChange={(e) => handleMealChange(slot.key, 'protein', e.target.value)}
                        className="premium-input"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        placeholder="g"
                        value={mealEntry.fat}
                        onChange={(e) => handleMealChange(slot.key, 'fat', e.target.value)}
                        className="premium-input"
                      />
                    </div>
                  );
                })}
              </div>
              <div className="form-group full-width">
                <label>Notes</label>
                <textarea
                  placeholder="Additional instructions..."
                  value={dietForm.notes}
                  onChange={(e) => setDietForm({ ...dietForm, notes: e.target.value })}
                  className="premium-textarea"
                />
              </div>
              <div className="form-actions">
                <button type="submit" disabled={isAssigningDiet} className="premium-btn">
                  {isAssigningDiet ? 'Saving...' : 'Save Diet Plan'}
                </button>
              </div>
            </form>
          </section>

          {/* Feedback Form */}
          <section className="record-form-card">
            <div className="card-header">
              <h3>Send Feedback</h3>
              <p>Message the trainee directly.</p>
            </div>
            <form onSubmit={handleFeedbackSubmit}>
              <div className="form-group">
                <label>Category</label>
                <select
                  value={feedbackForm.category}
                  onChange={(e) => setFeedbackForm({ ...feedbackForm, category: e.target.value })}
                  className="premium-select"
                >
                  <option value="general">General</option>
                  <option value="progress">Progress</option>
                  <option value="nutrition">Nutrition</option>
                  <option value="attendance">Attendance</option>
                </select>
              </div>
              <div className="form-group full-width">
                <label>Message</label>
                <textarea
                  placeholder="Write your feedback here..."
                  value={feedbackForm.message}
                  onChange={(e) => setFeedbackForm({ ...feedbackForm, message: e.target.value })}
                  required
                  className="premium-textarea large"
                />
              </div>
              <div className="form-actions">
                <button type="submit" disabled={isSharingFeedback} className="premium-btn">
                  {isSharingFeedback ? 'Sending...' : 'Send Feedback'}
                </button>
              </div>
            </form>
          </section>
            </>
          ) : null}
        </div>
      ) : (
        <div className="empty-selection-state">
          <p>Choose a trainee from the dropdown above to start updating their records.</p>
        </div>
      )}
    </div>
  );
};

export default TrainerUpdatesPage;

