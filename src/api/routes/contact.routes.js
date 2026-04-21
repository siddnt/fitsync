import { Router } from 'express';
import {
    submitContactForm,
    getContactMessages,
    updateMessageStatus,
} from '../controllers/contact.controller.js';
import { verifyJWT, authorizeRoles } from '../../middlewares/auth.middleware.js';
import { cacheMiddleware } from '../../middlewares/cache.middleware.js';

const router = Router();

// Public: submit form — no cache, it's a mutation
router.route('/').post(submitContactForm);

// Admin/Manager: list messages — cache 60s (messages arrive frequently, but paginated)
// URL includes ?page=N&status=X so each filter+page combo is a separate cache entry
router.route('/').get(
    verifyJWT,
    authorizeRoles('admin', 'manager'),
    cacheMiddleware('contact-messages', 60),
    getContactMessages,
);

// Status update — mutation, no cache
router.route('/:id/status').patch(
    verifyJWT,
    authorizeRoles('admin', 'manager'),
    updateMessageStatus,
);

export default router;
