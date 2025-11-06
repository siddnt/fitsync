import mongoose from 'mongoose';
import TrainerAssignment from '../../models/trainerAssignment.model.js';
import TrainerProgress from '../../models/trainerProgress.model.js';
import GymMembership from '../../models/gymMembership.model.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js';

const toObjectId = (value, name) => {
  if (!value) {
    throw new ApiError(400, `${name} is required.`);
  }
  try {
    return new mongoose.Types.ObjectId(value);
  } catch (_error) {
    throw new ApiError(400, `${name} is invalid.`);
  }
};

const resolveGymId = (assignment, membership) => {
  if (assignment?.gym) {
    return assignment.gym;
  }
  return membership?.gym ?? null;
};

const syncAssignmentForMembership = async ({ trainerId, traineeId, gymId }) => {
  if (!gymId) {
    throw new ApiError(422, 'Gym information is missing for this membership.');
  }

  let assignmentDoc = await TrainerAssignment.findOne({ trainer: trainerId, gym: gymId });

  if (!assignmentDoc) {
    assignmentDoc = new TrainerAssignment({
      trainer: trainerId,
      gym: gymId,
      status: 'active',
      trainees: [],
    });
  }

  const traineeKey = String(traineeId);
  let traineesChanged = false;
  const existingIndex = assignmentDoc.trainees.findIndex(
    (entry) => String(entry.trainee) === traineeKey,
  );

  if (existingIndex === -1) {
    assignmentDoc.trainees.push({
      trainee: traineeId,
      status: 'active',
      assignedAt: new Date(),
      goals: [],
    });
    traineesChanged = true;
  } else {
    assignmentDoc.trainees[existingIndex].status = 'active';
    assignmentDoc.trainees[existingIndex].assignedAt = new Date();
    traineesChanged = true;
  }

  assignmentDoc.status = 'active';
  if (traineesChanged && !assignmentDoc.isNew) {
    assignmentDoc.markModified('trainees');
  }
  await assignmentDoc.save();

  return assignmentDoc.toObject();
};

const findActiveAssignment = async (trainerId, traineeId) => {
  const membership = await GymMembership.findOne({
    trainer: trainerId,
    trainee: traineeId,
    status: { $in: ['active', 'paused'] },
  })
    .select('gym status startDate')
    .lean();

  if (!membership) {
    throw new ApiError(404, 'The trainee is not assigned to you.');
  }

  const assignment = await syncAssignmentForMembership({ trainerId, traineeId, gymId: membership.gym });

  if (!assignment) {
    throw new ApiError(404, 'The trainee is not assigned to you.');
  }

  return { assignment, membership };
};

const ensureProgressDocument = async (trainerId, traineeId, gymId) => {
  if (!gymId) {
    throw new ApiError(422, 'Gym information could not be determined for this trainee.');
  }
  const progress = await TrainerProgress.findOneAndUpdate(
    { trainer: trainerId, trainee: traineeId },
    {
      $set: { gym: gymId },
      $setOnInsert: {
        trainer: trainerId,
        trainee: traineeId,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  const ensureArray = (doc, field) => {
    if (Array.isArray(doc[field])) {
      return;
    }
    doc[field] = [];
    doc.markModified(field);
  };

  ensureArray(progress, 'feedback');
  ensureArray(progress, 'attendance');
  ensureArray(progress, 'progressMetrics');
  ensureArray(progress, 'dietPlans');

  return progress;
};

export const logTraineeAttendance = asyncHandler(async (req, res) => {
  const trainerId = req.user?._id;
  const traineeId = toObjectId(req.params.traineeId, 'Trainee id');
  const { date, status = 'present', notes } = req.body ?? {};

  if (!['present', 'absent', 'late'].includes(status)) {
    throw new ApiError(400, 'Attendance status must be present, absent, or late.');
  }

  const { assignment, membership } = await findActiveAssignment(trainerId, traineeId);
  const attendanceRecord = {
    date: date ? new Date(date) : new Date(),
    status,
    notes,
  };

  const progress = await ensureProgressDocument(
    trainerId,
    traineeId,
    resolveGymId(assignment, membership),
  );
  progress.attendance.push(attendanceRecord);
  progress.markModified('attendance');
  await progress.save();

  return res
    .status(201)
    .json(new ApiResponse(201, { attendance: attendanceRecord }, 'Attendance logged successfully.'));
});

export const recordProgressMetric = asyncHandler(async (req, res) => {
  const trainerId = req.user?._id;
  const traineeId = toObjectId(req.params.traineeId, 'Trainee id');
  const { metric, value, unit, recordedAt } = req.body ?? {};

  if (!metric) {
    throw new ApiError(400, 'Metric name is required.');
  }

  if (value === undefined || value === null || Number.isNaN(Number(value))) {
    throw new ApiError(400, 'Metric value must be a number.');
  }

  const { assignment, membership } = await findActiveAssignment(trainerId, traineeId);
  const metricEntry = {
    metric: metric.trim(),
    value: Number(value),
    unit: unit?.trim(),
    recordedAt: recordedAt ? new Date(recordedAt) : new Date(),
  };

  const progress = await ensureProgressDocument(
    trainerId,
    traineeId,
    resolveGymId(assignment, membership),
  );
  progress.progressMetrics.push(metricEntry);
  progress.markModified('progressMetrics');
  await progress.save();

  return res
    .status(201)
    .json(new ApiResponse(201, { metric: metricEntry }, 'Progress metric recorded.'));
});

export const upsertDietPlan = asyncHandler(async (req, res) => {
  const trainerId = req.user?._id;
  const traineeId = toObjectId(req.params.traineeId, 'Trainee id');
  const { weekOf, meals, notes } = req.body ?? {};

  if (!weekOf) {
    throw new ApiError(400, 'Week start date is required.');
  }

  const { assignment, membership } = await findActiveAssignment(trainerId, traineeId);
  const planDate = new Date(weekOf);
  if (Number.isNaN(planDate.getTime())) {
    throw new ApiError(400, 'Week start date is invalid.');
  }

  const normalizedMeals = Array.isArray(meals)
    ? meals
        .map((meal) => {
          if (!meal) return null;
          if (typeof meal === 'string') {
            return { name: meal, description: meal };
          }
          return {
            name: meal.name ?? '',
            description: meal.description,
            calories: meal.calories,
            macros: meal.macros,
          };
        })
        .filter(Boolean)
    : [];

  const progress = await ensureProgressDocument(
    trainerId,
    traineeId,
    resolveGymId(assignment, membership),
  );

  progress.dietPlans = (progress.dietPlans || []).filter(
    (plan) => new Date(plan.weekOf).toISOString() !== planDate.toISOString(),
  );
  progress.dietPlans.push({
    weekOf: planDate,
    meals: normalizedMeals,
    notes,
  });
  progress.markModified('dietPlans');
  await progress.save();

  return res
    .status(200)
    .json(new ApiResponse(200, { weekOf: planDate, meals: normalizedMeals, notes }, 'Diet plan updated.'));
});

export const addTraineeFeedback = asyncHandler(async (req, res) => {
  const trainerId = req.user?._id;
  const traineeId = toObjectId(req.params.traineeId, 'Trainee id');
  const { message, category = 'general' } = req.body ?? {};

  if (!message) {
    throw new ApiError(400, 'Feedback message is required.');
  }

  if (!['progress', 'nutrition', 'attendance', 'general'].includes(category)) {
    throw new ApiError(400, 'Unsupported feedback category.');
  }

  const { assignment, membership } = await findActiveAssignment(trainerId, traineeId);
  const feedbackEntry = {
    message: message.trim(),
    category,
    createdAt: new Date(),
  };

  const progress = await ensureProgressDocument(
    trainerId,
    traineeId,
    resolveGymId(assignment, membership),
  );
  progress.feedback.push(feedbackEntry);
  progress.markModified('feedback');
  await progress.save();

  const savedEntry = progress.feedback[progress.feedback.length - 1];

  return res
    .status(201)
    .json(new ApiResponse(201, { feedback: savedEntry }, 'Feedback shared with trainee.'));
});

export const markFeedbackReviewed = asyncHandler(async (req, res) => {
  const trainerId = req.user?._id;
  const feedbackId = req.params.feedbackId;

  if (!feedbackId) {
    throw new ApiError(400, 'Feedback id is required.');
  }

  const feedbackObjectId = mongoose.Types.ObjectId.isValid(feedbackId)
    ? new mongoose.Types.ObjectId(feedbackId)
    : null;

  const matchQuery = feedbackObjectId
    ? { trainer: trainerId, 'feedback._id': feedbackObjectId }
    : { trainer: trainerId, 'feedback._id': feedbackId };

  const update = await TrainerProgress.findOneAndUpdate(
    matchQuery,
    { $set: { 'feedback.$.reviewedAt': new Date() } },
    { new: true },
  );

  if (!update) {
    const fallback = await TrainerProgress.findOne({ trainer: trainerId });
    if (!fallback) {
      throw new ApiError(404, 'Feedback not found for this trainer.');
    }

    const matching = fallback.feedback?.find(
      (entry) => entry._id?.toString() === feedbackId || entry.createdAt?.toISOString() === feedbackId,
    );

    if (!matching) {
      throw new ApiError(404, 'Feedback not found for this trainer.');
    }

    matching.reviewedAt = new Date();
    fallback.markModified('feedback');
    await fallback.save();
    return res
      .status(200)
      .json(new ApiResponse(200, { feedbackId }, 'Feedback marked as reviewed.'));
  }

  return res
    .status(200)
    .json(new ApiResponse(200, { feedbackId }, 'Feedback marked as reviewed.'));
});
