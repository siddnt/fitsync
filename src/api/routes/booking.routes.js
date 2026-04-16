import { Router } from 'express';
import { verifyJWT, authorizeRoles } from '../../middlewares/auth.middleware.js';
import {
  createBooking,
  getAvailableBookingSlots,
  getMyBookings,
  updateBookingStatus,
} from '../controllers/booking.controller.js';

const router = Router();

router.use(verifyJWT);

router.get(
  '/slots',
  authorizeRoles('trainee', 'member'),
  getAvailableBookingSlots,
);
router.get(
  '/me',
  authorizeRoles('trainee', 'member', 'trainer'),
  getMyBookings,
);
router.post(
  '/',
  authorizeRoles('trainee', 'member'),
  createBooking,
);
router.patch(
  '/:bookingId/status',
  authorizeRoles('trainee', 'member', 'trainer'),
  updateBookingStatus,
);

export default router;
