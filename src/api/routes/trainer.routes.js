import { Router } from 'express';
import { verifyJWT, authorizeRoles } from '../../middlewares/auth.middleware.js';
import {
  logTraineeAttendance,
  recordProgressMetric,
  upsertDietPlan,
  addTraineeFeedback,
  markFeedbackReviewed,
} from '../controllers/trainer.controller.js';

const router = Router();

router.use(verifyJWT, authorizeRoles('trainer'));

router.post('/trainees/:traineeId/attendance', logTraineeAttendance);
router.post('/trainees/:traineeId/progress', recordProgressMetric);
router.put('/trainees/:traineeId/diet', upsertDietPlan);
router.post('/trainees/:traineeId/feedback', addTraineeFeedback);
router.patch('/feedback/:feedbackId/review', markFeedbackReviewed);

export default router;
