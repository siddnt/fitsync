import { Router } from 'express';
import {
    submitContactForm,
    getContactMessages,
    updateMessageStatus,
} from '../controllers/contact.controller.js';
import { verifyJWT, authorizeRoles } from '../../middlewares/auth.middleware.js';

const router = Router();

router.route('/').post(submitContactForm);

router.route('/').get(verifyJWT, authorizeRoles('admin'), getContactMessages);
router.route('/:id/status').patch(verifyJWT, authorizeRoles('admin'), updateMessageStatus);

export default router;
