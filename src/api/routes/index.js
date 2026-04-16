import { Router } from 'express';
import { getCacheStatus } from '../../services/cache.service.js';
import { buildPrometheusMetrics, getObservabilitySnapshot } from '../../services/observability.service.js';
import { getSearchStatus } from '../../services/search.service.js';
import authRoutes from './auth.routes.js';
import gymRoutes from './gym.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import trainerRoutes from './trainer.routes.js';
import bookingRoutes from './booking.routes.js';
import adminRoutes from './admin.routes.js';
import ownerRoutes from './owner.routes.js';
import marketplaceRoutes from './marketplace.routes.js';
import userRoutes from './user.routes.js';
import contactRoutes from './contact.routes.js';
import internalConversationRoutes from './internalConversation.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/gyms', gymRoutes);
router.use('/dashboards', dashboardRoutes);
router.use('/trainer', trainerRoutes);
router.use('/bookings', bookingRoutes);
router.use('/admin', adminRoutes);
router.use('/owner', ownerRoutes);
router.use('/marketplace', marketplaceRoutes);
router.use('/users', userRoutes);
router.use('/contact', contactRoutes);
router.use('/communications', internalConversationRoutes);

router.get('/system/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: Date.now(), cache: getCacheStatus(), search: getSearchStatus() });
});

router.get('/system/metrics', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: Date.now(),
    cache: getCacheStatus(),
    search: getSearchStatus(),
    metrics: getObservabilitySnapshot(),
  });
});

router.get('/system/metrics/prometheus', (_req, res) => {
  const cache = getCacheStatus();
  const search = getSearchStatus();

  res
    .status(200)
    .set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
    .send(buildPrometheusMetrics({ cacheStatus: cache, searchStatus: search }));
});

export default router;
