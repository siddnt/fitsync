import { Router } from 'express';
import authRoutes from './auth.routes.js';
import gymRoutes from './gym.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import trainerRoutes from './trainer.routes.js';
import adminRoutes from './admin.routes.js';
import ownerRoutes from './owner.routes.js';
import marketplaceRoutes from './marketplace.routes.js';
import userRoutes from './user.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/gyms', gymRoutes);
router.use('/dashboards', dashboardRoutes);
router.use('/trainer', trainerRoutes);
router.use('/admin', adminRoutes);
router.use('/owner', ownerRoutes);
router.use('/marketplace', marketplaceRoutes);
router.use('/users', userRoutes);

router.get('/system/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: Date.now() });
});

export default router;
