import { Router } from 'express';
import { login, register, refreshToken, logout } from '../controllers/auth.controller.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refreshToken);
router.post('/logout', logout);

export default router;
