import path from 'node:path';
import fs from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import { DocumentModel } from '../models/DocumentModel.js';
import { ChunkModel } from '../models/ChunkModel.js';
import { processDocument } from '../lib/documentProcessor.js';
import { indexDocument, deleteCollection } from '../lib/vectorStore.js';
import { preloadKeywordChunks, evictKeywordCache } from '../lib/hybridSearch.js';
import { uploadsDir } from '../middlewares/uploadMiddleware.js';
import { storage } from '../lib/storage.js';
import { ingestionQueue } from '../lib/ingestionQueue.js';
import { ingestionWorker } from '../lib/ingestionWorker.js';

export const documentController = {
  async uploadDocument(req, res, next) {
    let filePath;

    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded.' });
      }

      const { originalname, mimetype, size } = req.file;
      filePath = req.file.path;
      const ext = path.extname(originalname).toLowerCase();
      const mimeMatchesExtension =
        (ext === '.pdf' && ['application/pdf', 'application/octet-stream'].includes(mimetype)) ||
        (ext === '.txt' && ['text/plain', 'application/octet-stream'].includes(mimetype));

      if (!mimeMatchesExtension) {
        return res.status(400).json({ error: 'Only valid PDF and TXT files are supported.' });
      }

      if (ext === '.pdf') {
        const handle = await fs.open(filePath, 'r');
        const header = Buffer.alloc(5);
        await handle.read(header, 0, 5, 0);
        await handle.close();
        if (header.toString('ascii') !== '%PDF-') {
          return res.status(400).json({ error: 'The uploaded PDF file is invalid.' });
        }
      }

      if (size > 20 * 1024 * 1024) {
        return res.status(413).json({ error: 'File exceeds the 20MB limit.' });
      }

      // Read file buffer & compute SHA-256 hash
      const fileBuffer = await fs.readFile(filePath);
      const contentHash = createHash('sha256').update(fileBuffer).digest('hex');

      // 1. Idempotency check: if user already has an indexed document with the exact same content hash
      const existingDoc = await DocumentModel.findByHash(req.user.id, contentHash);
      if (existingDoc && existingDoc.status === 'indexed') {
        return res.json({
          success: true,
          document: existingDoc,
          message: `"${originalname}" is already indexed.`,
          idempotent: true,
        });
      }

      // Enforce per-user document storage limit
      const maxDocsPerUser = Math.max(1, Number(process.env.MAX_DOCUMENTS_PER_USER || 50));
      const existingDocs = await DocumentModel.findAllByUser(req.user.id);
      if (existingDocs.length >= maxDocsPerUser) {
        return res.status(403).json({
          error: `Document quota exceeded (maximum ${maxDocsPerUser} documents allowed per user). Please delete an existing document first.`,
        });
      }

      const id = randomUUID();
      const collectionName = `doc_${id.replaceAll('-', '')}`;
      const storageKey = `docs/${req.user.id}/${id}/${path.basename(originalname)}`;

      // 2. Put file into durable storage (S3-compatible, NeonDB PostgreSQL fallback, or local disk)
      const storageResult = await storage.putObject({
        key: storageKey,
        userId: req.user.id,
        buffer: fileBuffer,
        contentType: mimetype,
      });

      // 3. Persist document metadata in PostgreSQL with 'queued' status
      const docEntry = await DocumentModel.create(req.user.id, {
        id,
        name: path.basename(originalname).slice(0, 240),
        collectionName,
        uploadedAt: new Date().toISOString(),
        chunkCount: 0,
        contentHash,
        storageKey,
        storageProvider: storageResult.provider,
        mimeType: mimetype,
        sizeBytes: size,
        status: 'queued',
      });

      // 4. Enqueue into durable PostgreSQL job queue
      const idempotencyKey = `${id}:${contentHash}:v1`;
      const { job } = await ingestionQueue.enqueueJob({
        documentId: id,
        userId: req.user.id,
        idempotencyKey,
      });

      // Trigger background worker
      ingestionWorker.trigger();

      // Check if client explicitly requests asynchronous processing
      const isExplicitAsync =
        req.query.async === 'true' ||
        req.headers['x-async'] === 'true' ||
        process.env.ASYNC_INGESTION === 'true';

      if (isExplicitAsync) {
        return res.json({
          success: true,
          document: docEntry,
          jobId: job.id,
          message: `"${originalname}" uploaded and queued for processing.`,
          status: 'queued',
        });
      }

      // Default: wait up to 15 seconds for job completion so existing UI gets instant indexing confirmation
      const jobResult = await ingestionQueue.waitForJob(job.id, { timeoutMs: 15000 });
      if (jobResult && jobResult.status === 'completed') {
        const updatedDoc = await DocumentModel.findById(req.user.id, id);
        return res.json({
          success: true,
          document: updatedDoc || docEntry,
          message: `"${originalname}" processed successfully: ${updatedDoc?.chunkCount || 0} chunks indexed.`,
        });
      }

      if (jobResult && jobResult.status === 'failed') {
        return res.status(500).json({
          error: `Ingestion failed: ${jobResult.errorMessage || 'Unknown processing error'}`,
          document: docEntry,
        });
      }

      // Ingestion taking longer than timeout -> return queued status
      return res.json({
        success: true,
        document: docEntry,
        jobId: job.id,
        message: `"${originalname}" uploaded and currently processing in background.`,
        status: 'processing',
      });
    } catch (error) {
      next(error);
    } finally {
      if (filePath) {
        await fs.unlink(filePath).catch(() => {});
      }
    }
  },

  async listDocuments(req, res, next) {
    try {
      const documents = await DocumentModel.findAllByUser(req.user.id);
      return res.json(documents);
    } catch (error) {
      next(error);
    }
  },

  async getDocumentStatus(req, res, next) {
    try {
      const doc = await DocumentModel.findById(req.user.id, req.params.id);
      if (!doc) {
        return res.status(404).json({ error: 'Document not found.' });
      }

      const job = await ingestionQueue.getJobByDocumentId(doc.id);
      return res.json({
        id: doc.id,
        name: doc.name,
        status: doc.status,
        chunkCount: doc.chunkCount,
        errorMessage: doc.errorMessage,
        retryCount: doc.retryCount,
        storageKey: doc.storageKey,
        storageProvider: doc.storageProvider,
        job: job
          ? {
              id: job.id,
              status: job.status,
              retryCount: job.retryCount,
              maxRetries: job.maxRetries,
              errorMessage: job.errorMessage,
              scheduledAt: job.scheduledAt,
              lockedAt: job.lockedAt,
            }
          : null,
      });
    } catch (error) {
      next(error);
    }
  },

  async retryIngestion(req, res, next) {
    try {
      const doc = await DocumentModel.findById(req.user.id, req.params.id);
      if (!doc) {
        return res.status(404).json({ error: 'Document not found.' });
      }

      const retryResult = await ingestionQueue.retryJobForDocument(req.user.id, doc.id);
      if (!retryResult) {
        return res.status(400).json({ error: 'Could not retry ingestion for this document.' });
      }

      ingestionWorker.trigger();

      return res.json({
        success: true,
        message: 'Ingestion retry queued successfully.',
        job: retryResult.job,
      });
    } catch (error) {
      next(error);
    }
  },

  async warmDocument(req, res) {
    try {
      const doc = await DocumentModel.findById(req.user.id, req.params.id);
      if (doc) {
        preloadKeywordChunks(req.user.id, doc.id).catch(() => {});
      }
      return res.json({ ok: true });
    } catch {
      return res.json({ ok: false });
    }
  },

  async deleteDocument(req, res, next) {
    try {
      const { id } = req.params;
      const doc = await DocumentModel.findById(req.user.id, id);
      if (!doc) {
        return res.status(404).json({ error: 'Document not found.' });
      }

      // 1. Delete vector embeddings in Qdrant
      await deleteCollection(doc.collectionName).catch(() => {});

      // 2. Delete Postgres document record (cascading deletes document_chunks and ingestion_jobs)
      await DocumentModel.delete(req.user.id, id);

      // 3. Evict keyword and in-memory caches
      evictKeywordCache(id);

      // 4. Delete object from durable storage (S3, NeonDB, or local)
      if (doc.storageKey) {
        await storage.deleteObject({ key: doc.storageKey }).catch(() => {});
      }

      // Also clean up any legacy local uploads
      const docExt = path.extname(doc.name).toLowerCase();
      await fs.unlink(path.join(uploadsDir, `${doc.id}${docExt}`)).catch(() => {});
      if (docExt !== '.pdf') {
        await fs.unlink(path.join(uploadsDir, `${doc.id}.pdf`)).catch(() => {});
      }
      if (docExt !== '.txt') {
        await fs.unlink(path.join(uploadsDir, `${doc.id}.txt`)).catch(() => {});
      }

      return res.json({ success: true, message: 'Document deleted.' });
    } catch (error) {
      next(error);
    }
  },

  async streamPdfFile(req, res, next) {
    try {
      const doc = await DocumentModel.findById(req.user.id, req.params.id);
      if (!doc) {
        return res.status(404).json({ error: 'Document not found.' });
      }

      if (path.extname(doc.name).toLowerCase() !== '.pdf') {
        return res.status(415).json({ error: 'Only PDF documents can be opened in the viewer.' });
      }

      // Retrieve binary data from durable storage (S3, NeonDB, or local)
      let buffer;
      try {
        if (doc.storageKey) {
          buffer = await storage.getObject({ key: doc.storageKey });
        } else {
          buffer = await fs.readFile(path.join(uploadsDir, `${doc.id}.pdf`));
        }
      } catch (err) {
        return res.status(404).json({ error: 'PDF file not found in storage. Please upload again.' });
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      return res.send(buffer);
    } catch (error) {
      next(error);
    }
  },
};
