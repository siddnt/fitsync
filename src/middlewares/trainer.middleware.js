import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError.js';

const ATTENDANCE_STATUSES = new Set(['present', 'absent', 'late']);
const FEEDBACK_CATEGORIES = new Set(['progress', 'nutrition', 'attendance', 'general']);
const DIET_MEAL_SLOTS = ['breakfast', 'lunch', 'snack', 'dinner'];

const isValidDateValue = (value) => {
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
};

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

const assertOptionalNonNegativeNumber = (value, label) => {
  if (value === undefined || value === null || value === '') {
    return;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new ApiError(400, `${label} must be a non-negative number.`);
  }
};

export const requireActiveTrainer = (req, _res, next) => {
  if (req.user?.status !== 'active') {
    throw new ApiError(403, 'Trainer account is not active.');
  }

  next();
};

export const validateObjectIdParam = (paramName, label = paramName) => (req, _res, next) => {
  const value = req.params?.[paramName];

  if (!value || !mongoose.Types.ObjectId.isValid(value)) {
    throw new ApiError(400, `${label} is invalid.`);
  }

  next();
};

export const validateFeedbackIdParam = (req, _res, next) => {
  const feedbackId = req.params?.feedbackId;

  if (!isNonEmptyString(feedbackId)) {
    throw new ApiError(400, 'Feedback id is required.');
  }

  next();
};

export const validateAttendancePayload = (req, _res, next) => {
  const { date, status = 'present', notes } = req.body ?? {};

  if (date !== undefined && !isValidDateValue(date)) {
    throw new ApiError(400, 'Attendance date is invalid.');
  }

  if (!ATTENDANCE_STATUSES.has(status)) {
    throw new ApiError(400, 'Attendance status must be present, absent, or late.');
  }

  if (notes !== undefined && typeof notes !== 'string') {
    throw new ApiError(400, 'Attendance notes must be a string.');
  }

  next();
};

export const validateProgressPayload = (req, _res, next) => {
  const { metric, value, unit, recordedAt, weightKg, heightCm } = req.body ?? {};
  const hasBodyMetricsPayload = weightKg !== undefined || heightCm !== undefined;

  if (hasBodyMetricsPayload) {
    if (weightKg === undefined || heightCm === undefined) {
      throw new ApiError(400, 'Weight and height are both required to compute BMI.');
    }

    const normalizedWeight = Number(weightKg);
    const normalizedHeight = Number(heightCm);

    if (!Number.isFinite(normalizedWeight) || normalizedWeight <= 0) {
      throw new ApiError(400, 'Weight must be a positive number.');
    }

    if (!Number.isFinite(normalizedHeight) || normalizedHeight <= 0) {
      throw new ApiError(400, 'Height must be a positive number.');
    }

    if (recordedAt !== undefined && !isValidDateValue(recordedAt)) {
      throw new ApiError(400, 'Recorded date is invalid.');
    }

    return next();
  }

  if (!isNonEmptyString(metric)) {
    throw new ApiError(400, 'Metric name is required.');
  }

  if (value === undefined || value === null || Number.isNaN(Number(value))) {
    throw new ApiError(400, 'Metric value must be a number.');
  }

  if (unit !== undefined && typeof unit !== 'string') {
    throw new ApiError(400, 'Metric unit must be a string.');
  }

  if (recordedAt !== undefined && !isValidDateValue(recordedAt)) {
    throw new ApiError(400, 'Recorded date is invalid.');
  }

  return next();
};

export const validateDietPayload = (req, _res, next) => {
  const { weekOf, meals, notes } = req.body ?? {};

  if (!weekOf || !isValidDateValue(weekOf)) {
    throw new ApiError(400, 'Week start date is invalid.');
  }

  if (!meals || typeof meals !== 'object' || Array.isArray(meals)) {
    throw new ApiError(400, 'Meals payload must be an object.');
  }

  let hasAtLeastOneMeal = false;

  DIET_MEAL_SLOTS.forEach((slot) => {
    const entry = meals[slot];
    if (entry === undefined || entry === null) {
      return;
    }

    if (typeof entry !== 'object' || Array.isArray(entry)) {
      throw new ApiError(400, `${slot} meal entry must be an object.`);
    }

    if (entry.item !== undefined && typeof entry.item !== 'string') {
      throw new ApiError(400, `${slot} meal item must be a string.`);
    }

    if (isNonEmptyString(entry.item)) {
      hasAtLeastOneMeal = true;
    }

    assertOptionalNonNegativeNumber(entry.calories, `${slot} calories`);
    assertOptionalNonNegativeNumber(entry.protein, `${slot} protein`);
    assertOptionalNonNegativeNumber(entry.fat, `${slot} fat`);

    if (entry.notes !== undefined && typeof entry.notes !== 'string') {
      throw new ApiError(400, `${slot} meal notes must be a string.`);
    }
  });

  if (!hasAtLeastOneMeal) {
    throw new ApiError(400, 'Please provide at least one meal entry.');
  }

  if (notes !== undefined && typeof notes !== 'string') {
    throw new ApiError(400, 'Diet notes must be a string.');
  }

  next();
};

export const validateFeedbackPayload = (req, _res, next) => {
  const { message, category = 'general' } = req.body ?? {};

  if (!isNonEmptyString(message)) {
    throw new ApiError(400, 'Feedback message is required.');
  }

  if (!FEEDBACK_CATEGORIES.has(category)) {
    throw new ApiError(400, 'Unsupported feedback category.');
  }

  next();
};
