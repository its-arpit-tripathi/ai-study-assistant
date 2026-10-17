import { Router } from 'express';
import { chatController } from '../controllers/chatController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';

const router = Router();

router.post('/chat', requireAuth, chatController.handleChat);
router.get('/chat/history/:documentId', requireAuth, chatController.getHistory);
router.delete('/chat/history/:documentId', requireAuth, chatController.clearHistory);

export default router;
