import { Router } from 'express';
import { chatController } from '../controllers/chatController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';

const router = Router();

router.post('/chat', requireAuth, chatController.handleChat);

export default router;
