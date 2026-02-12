import { Router } from 'express';
import { verifyJWT, authorizeRoles } from '../../middlewares/auth.middleware.js';
import {
  requireActiveTrainer,
  validateAttendancePayload,
  validateDietPayload,
  validateFeedbackIdParam,
  validateFeedbackPayload,
  validateObjectIdParam,
  validateProgressPayload,
} from '../../middlewares/trainer.middleware.js';
import {
  logTraineeAttendance,
  recordProgressMetric,
  upsertDietPlan,
  addTraineeFeedback,
  markFeedbackReviewed,
} from '../controllers/trainer.controller.js';

const router = Router();
const validateTraineeIdParam = validateObjectIdParam('traineeId', 'Trainee id');

router.use(verifyJWT, authorizeRoles('trainer'), requireActiveTrainer);

router.post('/trainees/:traineeId/attendance', validateTraineeIdParam, validateAttendancePayload, logTraineeAttendance);
router.post('/trainees/:traineeId/progress', validateTraineeIdParam, validateProgressPayload, recordProgressMetric);
router.put('/trainees/:traineeId/diet', validateTraineeIdParam, validateDietPayload, upsertDietPlan);
router.post('/trainees/:traineeId/feedback', validateTraineeIdParam, validateFeedbackPayload, addTraineeFeedback);
router.patch('/feedback/:feedbackId/review', validateFeedbackIdParam, markFeedbackReviewed);

export default router;
