import { Router } from 'express';
import authRoutes from './auth.routes';
import assetRoutes from './asset.routes';

const router = Router();

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    },
  });
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/assets', assetRoutes);

export default router;
