import { useState, useMemo, useEffect } from 'react';
import DashboardSection from '../components/DashboardSection.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SkeletonPanel from '../../../ui/SkeletonPanel.jsx';
import { useGetTrainerTraineesQuery } from '../../../services/dashboardApi.js';
import {
  useLogAttendanceMutation,
  useRecordProgressMutation,
  useAssignDietMutation,
  useShareFeedbackMutation,
} from '../../../services/trainerApi.js';
import { formatDate } from '../../../utils/format.js';
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

const TrainerUpdatesPage = () => {
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

  const [selectedTraineeId, setSelectedTraineeId] = useState('');
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

  const selectedTrainee = useMemo(
    () => trainees.find((t) => t.internalId === selectedTraineeId),
    [trainees, selectedTraineeId]
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
        <p>Manage attendance, progress, diet, and feedback for your assigned trainees.</p>
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
          <button onClick={resetNotices} className="close-notification">×</button>
        </div>
      )}

      {selectedTrainee ? (
        <div className="forms-grid">
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
