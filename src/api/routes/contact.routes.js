import { Router } from 'express';
import {
    submitContactForm,
    getContactMessages,
    updateMessageStatus,
    assignMessage,
    replyToMessage,
} from '../controllers/contact.controller.js';
import { verifyJWT, authorizeRoles } from '../../middlewares/auth.middleware.js';
import { upload } from '../../middlewares/multer.middleware.js';

const router = Router();

router.route('/').post(upload.array('attachments', 3), submitContactForm);

router.route('/').get(verifyJWT, authorizeRoles('admin', 'manager'), getContactMessages);
router.route('/:id/status').patch(verifyJWT, authorizeRoles('admin', 'manager'), updateMessageStatus);
router.route('/:id/assign').patch(verifyJWT, authorizeRoles('admin', 'manager'), assignMessage);
router.route('/:id/reply').post(verifyJWT, authorizeRoles('admin', 'manager'), replyToMessage);

export default router;
