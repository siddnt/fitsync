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
        (assignment.trainees || []).map((trainee) => ({
          ...trainee,
          assignmentId: assignment.id,
          gym: assignment.gym,
        })),
      ),
    [assignments],
  );

  const [selectedTraineeId, setSelectedTraineeId] = useState(null);
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
    if (!selectedTraineeId || !trainees.some((trainee) => trainee.id === selectedTraineeId)) {
      setSelectedTraineeId(trainees[0].id);
    }
  }, [trainees, selectedTraineeId]);

  const selectedTrainee = trainees.find((trainee) => trainee.id === selectedTraineeId) ?? null;

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
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Trainee</th>
                <th>Gym</th>
                <th>Status</th>
                <th>Assigned</th>
                <th>Goals</th>
              </tr>
            </thead>
            <tbody>
              {trainees.map((trainee) => {
                const isSelected = trainee.id === selectedTraineeId;
                return (
                  <tr
                    key={`${trainee.id}-${trainee.assignmentId}`}
                    onClick={() => setSelectedTraineeId(trainee.id)}
                    style={{
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(255,255,255,0.06)' : 'transparent',
                    }}
                  >
                    <td>{trainee.name ?? '—'}</td>
                    <td>{trainee.gym?.name ?? '—'}</td>
                    <td>{formatStatus(trainee.status)}</td>
                    <td>{formatDate(trainee.assignedAt)}</td>
                    <td>{trainee.goals?.join(', ') || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <EmptyState message="Assignments will appear once a gym owner pairs trainees with you." />
        )}
      </DashboardSection>

      <DashboardSection title="Update trainee records">
        {selectedTrainee ? (
          <div className="dashboard-form">
            {(notice || errorNotice) && (
              <div className={`status-pill ${errorNotice ? 'status-pill--warning' : 'status-pill--success'}`}>
                {errorNotice || notice}
              </div>
            )}

            <form onSubmit={handleAttendanceSubmit} className="dashboard-form">
              <div className="form-grid">
                <div>
                  <label htmlFor="attendance-date">Attendance date</label>
                  <input
                    id="attendance-date"
                    type="date"
                    value={attendanceForm.date}
                    onChange={(event) => setAttendanceForm((prev) => ({ ...prev, date: event.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="attendance-status">Status</label>
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
                </div>
              </div>
              <div>
                <label htmlFor="attendance-notes">Notes</label>
                <textarea
                  id="attendance-notes"
                  placeholder="Optional check-in notes"
                  value={attendanceForm.notes}
                  onChange={(event) => setAttendanceForm((prev) => ({ ...prev, notes: event.target.value }))}
                />
              </div>
              <div className="button-row">
                <button type="submit" disabled={isLoggingAttendance}>
                  {isLoggingAttendance ? 'Saving…' : 'Log attendance'}
                </button>
              </div>
            </form>

            <form onSubmit={handleProgressSubmit} className="dashboard-form">
              <div className="form-grid">
                <div>
                  <label htmlFor="progress-metric">Metric</label>
                  <input
                    id="progress-metric"
                    type="text"
                    placeholder="E.g. Body fat %"
                    value={progressForm.metric}
                    onChange={(event) => setProgressForm((prev) => ({ ...prev, metric: event.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="progress-value">Value</label>
                  <input
                    id="progress-value"
                    type="number"
                    step="0.01"
                    placeholder="Enter value"
                    value={progressForm.value}
                    onChange={(event) => setProgressForm((prev) => ({ ...prev, value: event.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="progress-unit">Unit</label>
                  <input
                    id="progress-unit"
                    type="text"
                    placeholder="Optional unit"
                    value={progressForm.unit}
                    onChange={(event) => setProgressForm((prev) => ({ ...prev, unit: event.target.value }))}
                  />
                </div>
                <div>
                  <label htmlFor="progress-recorded">Recorded at</label>
                  <input
                    id="progress-recorded"
                    type="datetime-local"
                    value={progressForm.recordedAt}
                    onChange={(event) =>
                      setProgressForm((prev) => ({ ...prev, recordedAt: event.target.value }))
                    }
                    required
                  />
                </div>
              </div>
              <div className="button-row">
                <button type="submit" disabled={isRecordingProgress}>
                  {isRecordingProgress ? 'Saving…' : 'Add progress metric'}
                </button>
              </div>
            </form>

            <form onSubmit={handleDietSubmit} className="dashboard-form">
              <div className="form-grid">
                <div>
                  <label htmlFor="diet-week">Week starting</label>
                  <input
                    id="diet-week"
                    type="date"
                    value={dietForm.weekOf}
                    onChange={(event) => setDietForm((prev) => ({ ...prev, weekOf: event.target.value }))}
                    required
                  />
                </div>
              </div>
              <div>
                <label htmlFor="diet-meals">Meals (one per line, "Meal - details")</label>
                <textarea
                  id="diet-meals"
                  placeholder="Breakfast - Oats with berries"
                  value={dietForm.mealsText}
                  onChange={(event) => setDietForm((prev) => ({ ...prev, mealsText: event.target.value }))}
                />
              </div>
              <div>
                <label htmlFor="diet-notes">Notes</label>
                <textarea
                  id="diet-notes"
                  placeholder="Highlight calorie targets or hydration goals"
                  value={dietForm.notes}
                  onChange={(event) => setDietForm((prev) => ({ ...prev, notes: event.target.value }))}
                />
              </div>
              <div className="button-row">
                <button type="submit" disabled={isAssigningDiet}>
                  {isAssigningDiet ? 'Saving…' : 'Save diet plan'}
                </button>
              </div>
            </form>

            <form onSubmit={handleFeedbackSubmit} className="dashboard-form">
              <div className="form-grid">
                <div>
                  <label htmlFor="feedback-category">Feedback category</label>
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
                </div>
              </div>
              <div>
                <label htmlFor="feedback-message">Message</label>
                <textarea
                  id="feedback-message"
                  placeholder="Share feedback or next steps with the trainee"
                  value={feedbackForm.message}
                  onChange={(event) => setFeedbackForm((prev) => ({ ...prev, message: event.target.value }))}
                  required
                />
              </div>
              <div className="button-row">
                <button type="submit" disabled={isSharingFeedback}>
                  {isSharingFeedback ? 'Sending…' : 'Send feedback'}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <EmptyState message="Select a trainee to log attendance, progress, and feedback." />
        )}
      </DashboardSection>
    </div>
  );
};

export default TrainerTraineesPage;
