import { Router } from 'express';
import { documentController } from '../controllers/documentController.js';
import { requireAuth } from '../middlewares/authMiddleware.js';
import { uploadMiddleware } from '../middlewares/uploadMiddleware.js';

const router = Router();

// Upload document
router.post('/upload', requireAuth, uploadMiddleware.single('document'), documentController.uploadDocument);

// Document management & status tracking
router.get('/documents', requireAuth, documentController.listDocuments);
router.get('/documents/:id/status', requireAuth, documentController.getDocumentStatus);
router.post('/documents/:id/retry', requireAuth, documentController.retryIngestion);
router.post('/documents/:id/warm', requireAuth, documentController.warmDocument);
router.delete('/documents/:id', requireAuth, documentController.deleteDocument);
router.get('/documents/:id/file', requireAuth, documentController.streamPdfFile);

export default router;
