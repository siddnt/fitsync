import { useEffect, useMemo, useState } from 'react';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import {
  useGetTrainerTraineesQuery,
} from '../../../services/dashboardApi.js';
import {
  useLogAttendanceMutation,
  useRecordProgressMutation,
  useAssignDietMutation,
  useShareFeedbackMutation,
} from '../../../services/trainerApi.js';
import { formatDate, formatStatus } from '../../../utils/format.js';
import '../Dashboard.css';

const defaultAttendance = () => ({
  date: new Date().toISOString().slice(0, 10),
  status: 'present',
  notes: '',
});

const defaultProgress = () => ({
  metric: '',
  value: '',
  unit: '',
  recordedAt: new Date().toISOString().slice(0, 16),
});

const defaultDiet = () => ({
  weekOf: '',
  mealsText: '',
  notes: '',
});

const defaultFeedback = () => ({
  message: '',
  category: 'general',
});

const TrainerTraineesPage = () => {
  const { data, isLoading, isError, refetch } = useGetTrainerTraineesQuery();
  const rawAssignments = data?.data?.assignments;

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

  const [selectedTraineeId, setSelectedTraineeId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({ gym: 'all', status: 'all' });
  const [attendanceForm, setAttendanceForm] = useState(defaultAttendance());
  const [progressForm, setProgressForm] = useState(defaultProgress());
  const [dietForm, setDietForm] = useState(defaultDiet());
  const [feedbackForm, setFeedbackForm] = useState(defaultFeedback());
  const [notice, setNotice] = useState(null);
  const [errorNotice, setErrorNotice] = useState(null);

  const [logAttendance, { isLoading: isLoggingAttendance }] = useLogAttendanceMutation();
  const [recordProgress, { isLoading: isRecordingProgress }] = useRecordProgressMutation();
  const [assignDiet, { isLoading: isAssigningDiet }] = useAssignDietMutation();
  const [shareFeedback, { isLoading: isSharingFeedback }] = useShareFeedbackMutation();

  useEffect(() => {
    if (!trainees.length) {
      setSelectedTraineeId(null);
      return;
    }
    if (!selectedTraineeId || !trainees.some((trainee) => trainee.internalId === selectedTraineeId)) {
      setSelectedTraineeId(trainees[0].internalId);
    }
  }, [trainees, selectedTraineeId]);

  const selectedTrainee =
    trainees.find((trainee) => trainee.internalId === selectedTraineeId) ?? null;

  const gymOptions = useMemo(() => {
    const uniqueGyms = new Map();
    trainees.forEach((trainee) => {
      const gymId = trainee.gym?._id ?? trainee.gym?.id;
      if (gymId && !uniqueGyms.has(gymId)) {
        uniqueGyms.set(gymId, trainee.gym?.name ?? 'Assigned gym');
      }
    });
    return Array.from(uniqueGyms, ([value, label]) => ({ value, label }));
  }, [trainees]);

  const statusOptions = useMemo(() => {
    const uniqueStatuses = new Set();
    trainees.forEach((trainee) => {
      if (trainee.status) {
        uniqueStatuses.add(trainee.status);
      }
    });
    return Array.from(uniqueStatuses);
  }, [trainees]);

  const filteredTrainees = useMemo(() => {
    const normalizedQuery = searchTerm.trim().toLowerCase();
    return trainees.filter((trainee) => {
      const gymId = trainee.gym?._id ?? trainee.gym?.id;
      const matchesGym = filters.gym === 'all' || gymId === filters.gym;
      const matchesStatus = filters.status === 'all' || trainee.status === filters.status;
      const matchesQuery =
        !normalizedQuery ||
        [trainee.name, trainee.email, trainee.gym?.name]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(normalizedQuery));
      return matchesGym && matchesStatus && matchesQuery;
    });
  }, [trainees, filters, searchTerm]);

  const resetNotices = () => {
    setNotice(null);
    setErrorNotice(null);
  };

  const handleAttendanceSubmit = async (event) => {
    event.preventDefault();
    if (!selectedTrainee) {
      return;
    }
    resetNotices();
    try {
      await logAttendance({ traineeId: selectedTrainee.id, ...attendanceForm }).unwrap();
      setNotice('Attendance recorded for the trainee.');
      setAttendanceForm(defaultAttendance());
      refetch();
    } catch (mutationError) {
      setErrorNotice(mutationError?.data?.message ?? 'Could not log attendance.');
    }
  };

  const handleProgressSubmit = async (event) => {
    event.preventDefault();
    if (!selectedTrainee) {
      return;
    }
    resetNotices();
    try {
      await recordProgress({
        traineeId: selectedTrainee.id,
        metric: progressForm.metric,
        value: Number(progressForm.value),
        unit: progressForm.unit,
        recordedAt: progressForm.recordedAt,
      }).unwrap();
      setNotice('Progress metric saved.');
      setProgressForm(defaultProgress());
      refetch();
    } catch (mutationError) {
      setErrorNotice(mutationError?.data?.message ?? 'Could not record progress.');
    }
  };

  const handleDietSubmit = async (event) => {
    event.preventDefault();
    if (!selectedTrainee) {
      return;
    }
    resetNotices();
    try {
      const meals = dietForm.mealsText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [name, ...rest] = line.split(' - ');
          return {
            name: name?.trim() ?? '',
            description: rest.join(' - ').trim() || undefined,
          };
        });

      await assignDiet({
        traineeId: selectedTrainee.id,
        weekOf: dietForm.weekOf,
        notes: dietForm.notes,
        meals,
      }).unwrap();
      setNotice('Diet plan updated for the selected week.');
      setDietForm(defaultDiet());
      refetch();
    } catch (mutationError) {
      setErrorNotice(mutationError?.data?.message ?? 'Could not assign the diet plan.');
    }
  };

  const handleFeedbackSubmit = async (event) => {
    event.preventDefault();
    if (!selectedTrainee) {
      return;
    }
    resetNotices();
    try {
      await shareFeedback({
        traineeId: selectedTrainee.id,
        message: feedbackForm.message,
        category: feedbackForm.category,
      }).unwrap();
      setNotice('Feedback shared with the trainee.');
      setFeedbackForm(defaultFeedback());
      refetch();
    } catch (mutationError) {
      setErrorNotice(mutationError?.data?.message ?? 'Could not share feedback.');
    }
  };

  if (isLoading) {
    return (
      <div className="dashboard-grid">
        <DashboardSection title="Active trainees">
          <SkeletonPanel lines={8} />
        </DashboardSection>
        <DashboardSection title="Update trainee records">
          <SkeletonPanel lines={10} />
        </DashboardSection>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="dashboard-grid">
        <DashboardSection
          title="Trainer workspace"
          action={(
            <button type="button" onClick={() => refetch()}>
              Retry
            </button>
          )}
        >
          <EmptyState message="We could not load your trainee assignments." />
        </DashboardSection>
      </div>
    );
  }

  return (
    <div className="dashboard-grid">
      <DashboardSection
        title="Active trainees"
        action={(
          <button type="button" onClick={() => refetch()}>
            Refresh
          </button>
        )}
      >
        {trainees.length ? (
          <div className="trainer-trainee-panel">
            <div className="trainer-trainee-panel__filters">
              <label htmlFor="trainee-search">
                <span>Search</span>
                <input
                  id="trainee-search"
                  type="search"
                  placeholder="Name, email, or gym"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </label>
              <label htmlFor="trainee-gym">
                <span>Gym</span>
                <select
                  id="trainee-gym"
                  value={filters.gym}
                  onChange={(event) => setFilters((prev) => ({ ...prev, gym: event.target.value }))}
                >
                  <option value="all">All gyms</option>
                  {gymOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label htmlFor="trainee-status">
                <span>Status</span>
                <select
                  id="trainee-status"
                  value={filters.status}
                  onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
                >
                  <option value="all">All statuses</option>
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {formatStatus(status)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="trainer-trainee-panel__reset"
                onClick={() => {
                  setSearchTerm('');
                  setFilters({ gym: 'all', status: 'all' });
                }}
              >
                Reset
              </button>
            </div>

            {filteredTrainees.length ? (
              <ul className="trainer-trainee-list">
                {filteredTrainees.map((trainee) => {
                  const isSelected = trainee.internalId === selectedTraineeId;
                  const traineeGymId = trainee.gym?._id ?? trainee.gym?.id ?? trainee.assignmentId;
                  const plannedSessions =
                    trainee.sessionsPerWeek ?? trainee.trainingPlan?.sessionsPerWeek ?? '—';
                  return (
                    <li
                      key={`${trainee.internalId}-${traineeGymId}`}
                      className={`trainer-trainee-card${isSelected ? ' trainer-trainee-card--selected' : ''}`}
                      onClick={() => setSelectedTraineeId(trainee.internalId)}
                    >
                      <div className="trainer-trainee-card__header">
                        <div>
                          <strong>{trainee.name ?? 'Unnamed trainee'}</strong>
                          {trainee.email && <span>{trainee.email}</span>}
                        </div>
                        <span className={`status-chip status-chip--${trainee.status ?? 'unknown'}`}>
                          {formatStatus(trainee.status)}
                        </span>
                      </div>
                      <div className="trainer-trainee-card__meta">
                        <div>
                          <small>Gym</small>
                          <span>{trainee.gym?.name ?? '—'}</span>
                        </div>
                        <div>
                          <small>Assigned</small>
                          <span>{formatDate(trainee.assignedAt)}</span>
                        </div>
                        <div>
                          <small>Sessions</small>
                          <span>{plannedSessions}</span>
                        </div>
                      </div>
                      <div className="trainer-trainee-card__tags">
                        {trainee.goals?.length ? (
                          trainee.goals.map((goal) => (
                            <span key={goal} className="trainer-trainee-card__pill">
                              {goal}
                            </span>
                          ))
                        ) : (
                          <span className="trainer-trainee-card__pill trainer-trainee-card__pill--muted">
                            No goals shared yet
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState message="No trainees match your filters yet." />
            )}
          </div>
        ) : (
          <EmptyState message="Assignments will appear once a gym owner pairs trainees with you." />
        )}
      </DashboardSection>

      <DashboardSection title="Update trainee records">
        {trainees.length ? (
          <div className="trainer-records">
            <div className="trainer-records__picker">
              <label htmlFor="trainee-picker">
                <span>Update records for</span>
                <select
                  id="trainee-picker"
                  value={selectedTraineeId ?? ''}
                  onChange={(event) => setSelectedTraineeId(event.target.value || null)}
                >
                  <option value="">Select a trainee</option>
                  {trainees.map((trainee) => (
                    <option key={trainee.internalId} value={trainee.internalId}>
                      {trainee.name ?? 'Unnamed trainee'} · {trainee.gym?.name ?? 'No gym'}
                    </option>
                  ))}
                </select>
              </label>
              <div className="trainer-records__summary">
                {selectedTrainee ? (
                  <>
                    <strong>{selectedTrainee.name}</strong>
                    {selectedTrainee.email && <span>{selectedTrainee.email}</span>}
                    <small>
                      {selectedTrainee.gym?.name ?? 'No gym assigned'} · Assigned {formatDate(selectedTrainee.assignedAt)}
                    </small>
                  </>
                ) : (
                  <>
                    <strong>No trainee selected</strong>
                    <small>Use the dropdown to choose who you are updating.</small>
                  </>
                )}
              </div>
            </div>

            {selectedTrainee ? (
              <div className="trainer-records__forms">
                {(notice || errorNotice) && (
                  <div className={`status-pill ${errorNotice ? 'status-pill--warning' : 'status-pill--success'}`}>
                    {errorNotice || notice}
                  </div>
                )}

                <form onSubmit={handleAttendanceSubmit} className="trainer-records__section">
                  <header>
                    <div>
                      <h4>Log attendance</h4>
                      <p>Mark today’s check-in with optional context.</p>
                    </div>
                  </header>
                  <div className="trainer-records__grid">
                    <label htmlFor="attendance-date">
                      <span>Attendance date</span>
                      <input
                        id="attendance-date"
                        type="date"
                        value={attendanceForm.date}
                        onChange={(event) => setAttendanceForm((prev) => ({ ...prev, date: event.target.value }))}
                        required
                      />
                    </label>
                    <label htmlFor="attendance-status">
                      <span>Status</span>
                      <select
                        id="attendance-status"
                        value={attendanceForm.status}
                        onChange={(event) =>
                          setAttendanceForm((prev) => ({ ...prev, status: event.target.value }))
                        }
                      >
                        <option value="present">Present</option>
                        <option value="late">Late</option>
                        <option value="absent">Absent</option>
                      </select>
                    </label>
                  </div>
                  <label htmlFor="attendance-notes" className="trainer-records__full">
                    <span>Notes</span>
                    <textarea
                      id="attendance-notes"
                      placeholder="Optional check-in notes"
                      value={attendanceForm.notes}
                      onChange={(event) => setAttendanceForm((prev) => ({ ...prev, notes: event.target.value }))}
                    />
                  </label>
                  <div className="trainer-records__actions">
                    <button type="submit" disabled={isLoggingAttendance}>
                      {isLoggingAttendance ? 'Saving…' : 'Log attendance'}
                    </button>
                  </div>
                </form>

                <form onSubmit={handleProgressSubmit} className="trainer-records__section">
                  <header>
                    <div>
                      <h4>Add progress metric</h4>
                      <p>Track composition, lifts, or adherence in one place.</p>
                    </div>
                  </header>
                  <div className="trainer-records__grid trainer-records__grid--four">
                    <label htmlFor="progress-metric">
                      <span>Metric</span>
                      <input
                        id="progress-metric"
                        type="text"
                        placeholder="E.g. Body fat %"
                        value={progressForm.metric}
                        onChange={(event) => setProgressForm((prev) => ({ ...prev, metric: event.target.value }))}
                        required
                      />
                    </label>
                    <label htmlFor="progress-value">
                      <span>Value</span>
                      <input
                        id="progress-value"
                        type="number"
                        step="0.01"
                        placeholder="Enter value"
                        value={progressForm.value}
                        onChange={(event) => setProgressForm((prev) => ({ ...prev, value: event.target.value }))}
                        required
                      />
                    </label>
                    <label htmlFor="progress-unit">
                      <span>Unit</span>
                      <input
                        id="progress-unit"
                        type="text"
                        placeholder="Optional unit"
                        value={progressForm.unit}
                        onChange={(event) => setProgressForm((prev) => ({ ...prev, unit: event.target.value }))}
                      />
                    </label>
                    <label htmlFor="progress-recorded">
                      <span>Recorded at</span>
                      <input
                        id="progress-recorded"
                        type="datetime-local"
                        value={progressForm.recordedAt}
                        onChange={(event) =>
                          setProgressForm((prev) => ({ ...prev, recordedAt: event.target.value }))
                        }
                        required
                      />
                    </label>
                  </div>
                  <div className="trainer-records__actions">
                    <button type="submit" disabled={isRecordingProgress}>
                      {isRecordingProgress ? 'Saving…' : 'Add progress metric'}
                    </button>
                  </div>
                </form>

                <form onSubmit={handleDietSubmit} className="trainer-records__section">
                  <header>
                    <div>
                      <h4>Save diet plan</h4>
                      <p>Outline meals and guardrails for the selected week.</p>
                    </div>
                  </header>
                  <div className="trainer-records__grid">
                    <label htmlFor="diet-week">
                      <span>Week starting</span>
                      <input
                        id="diet-week"
                        type="date"
                        value={dietForm.weekOf}
                        onChange={(event) => setDietForm((prev) => ({ ...prev, weekOf: event.target.value }))}
                        required
                      />
                    </label>
                  </div>
                  <label htmlFor="diet-meals" className="trainer-records__full">
                    <span>Meals (one per line, "Meal - details")</span>
                    <textarea
                      id="diet-meals"
                      placeholder="Breakfast - Oats with berries"
                      value={dietForm.mealsText}
                      onChange={(event) => setDietForm((prev) => ({ ...prev, mealsText: event.target.value }))}
                    />
                  </label>
                  <label htmlFor="diet-notes" className="trainer-records__full">
                    <span>Notes</span>
                    <textarea
                      id="diet-notes"
                      placeholder="Highlight calorie targets or hydration goals"
                      value={dietForm.notes}
                      onChange={(event) => setDietForm((prev) => ({ ...prev, notes: event.target.value }))}
                    />
                  </label>
                  <div className="trainer-records__actions">
                    <button type="submit" disabled={isAssigningDiet}>
                      {isAssigningDiet ? 'Saving…' : 'Save diet plan'}
                    </button>
                  </div>
                </form>

                <form onSubmit={handleFeedbackSubmit} className="trainer-records__section">
                  <header>
                    <div>
                      <h4>Send feedback</h4>
                      <p>Reinforce wins or highlight next actions.</p>
                    </div>
                  </header>
                  <div className="trainer-records__grid">
                    <label htmlFor="feedback-category">
                      <span>Feedback category</span>
                      <select
                        id="feedback-category"
                        value={feedbackForm.category}
                        onChange={(event) =>
                          setFeedbackForm((prev) => ({ ...prev, category: event.target.value }))
                        }
                      >
                        <option value="progress">Progress</option>
                        <option value="nutrition">Nutrition</option>
                        <option value="attendance">Attendance</option>
                        <option value="general">General</option>
                      </select>
                    </label>
                  </div>
                  <label htmlFor="feedback-message" className="trainer-records__full">
                    <span>Message</span>
                    <textarea
                      id="feedback-message"
                      placeholder="Share feedback or next steps with the trainee"
                      value={feedbackForm.message}
                      onChange={(event) => setFeedbackForm((prev) => ({ ...prev, message: event.target.value }))}
                      required
                    />
                  </label>
                  <div className="trainer-records__actions">
                    <button type="submit" disabled={isSharingFeedback}>
                      {isSharingFeedback ? 'Sending…' : 'Send feedback'}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <EmptyState message="Select a trainee above to log attendance, progress, and feedback." />
            )}
          </div>
        ) : (
          <EmptyState message="Assignments will appear once a gym owner pairs trainees with you." />
        )}
      </DashboardSection>
    </div>
  );
};

export default TrainerTraineesPage;
