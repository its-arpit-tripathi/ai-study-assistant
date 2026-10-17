import multer from 'multer';
import { QdrantUnavailableError } from '../lib/qdrant.js';

export function statusFor(error) {
  if (error instanceof QdrantUnavailableError) return 503;
  if (error?.status === 429) return 429;
  if (Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599) return error.status;
  return 500;
}

export function errorHandler(err, req, res, next) {
  if (err?.safetyBlocked) {
    return res.status(err.status || 400).json({
      error: err.message,
      safetyBlocked: true,
      category: err.category,
      violations: err.violations || [],
    });
  }

  if (err instanceof multer.MulterError) {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(status).json({ error: `Upload error: ${err.message}` });
  }

  if (err.message === 'Only PDF and TXT files are supported.') {
    return res.status(400).json({ error: err.message });
  }

  console.error('Unhandled request error:', err);
  const status = statusFor(err);
  return res.status(status).json({ error: err.message || 'Internal server error.' });
}
