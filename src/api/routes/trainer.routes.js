import { Router } from 'express';
import { verifyJWT, authorizeRoles } from '../../middlewares/auth.middleware.js';
import {
  logTraineeAttendance,
  recordProgressMetric,
  upsertDietPlan,
  addTraineeFeedback,
  markFeedbackReviewed,
  upsertAvailability,
  getMyAvailability,
  getTrainerAvailability,
} from '../controllers/trainer.controller.js';

const router = Router();

router.get('/:trainerId/availability', getTrainerAvailability);

router.use(verifyJWT, authorizeRoles('trainer'));

router.get('/availability/me', getMyAvailability);
router.put('/availability', upsertAvailability);
router.post('/trainees/:traineeId/attendance', logTraineeAttendance);
router.post('/trainees/:traineeId/progress', recordProgressMetric);
router.put('/trainees/:traineeId/diet', upsertDietPlan);
router.post('/trainees/:traineeId/feedback', addTraineeFeedback);
router.patch('/feedback/:feedbackId/review', markFeedbackReviewed);

export default router;
