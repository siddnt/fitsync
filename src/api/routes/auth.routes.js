import { Router } from 'express';
import { login, register, refreshToken, logout, me } from '../controllers/auth.controller.js';
import { verifyJWT } from '../../middlewares/auth.middleware.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refreshToken);
router.post('/logout', logout);
router.get('/me', verifyJWT, me);

export default router;
