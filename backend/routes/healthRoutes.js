import { Router } from 'express';
import { healthController } from '../controllers/healthController.js';

const router = Router();

router.get('/health', healthController.getHealth);
router.get('/metrics', healthController.getMetrics);
router.get('/system/health', healthController.getHealth);
router.get('/system/metrics', healthController.getMetrics);

export default router;
