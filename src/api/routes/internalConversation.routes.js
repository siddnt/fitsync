import { Router } from 'express';
import { verifyJWT, authorizeRoles } from '../../middlewares/auth.middleware.js';
import {
  createInternalConversation,
  getCommunicationRecipients,
  listInternalConversations,
  replyInternalConversation,
  updateInternalConversationState,
} from '../controllers/internalConversation.controller.js';

const router = Router();

router.use(verifyJWT, authorizeRoles('gym-owner', 'manager', 'admin'));

router.get('/recipients', getCommunicationRecipients);
router.get('/', listInternalConversations);
router.post('/', createInternalConversation);
router.post('/:id/reply', replyInternalConversation);
router.patch('/:id/state', updateInternalConversationState);

export default router;
