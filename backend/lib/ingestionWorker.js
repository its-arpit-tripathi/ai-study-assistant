import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { DocumentModel } from '../models/DocumentModel.js';
import { ChunkModel } from '../models/ChunkModel.js';
import { storage } from './storage.js';
import { processDocument } from './documentProcessor.js';
import { indexDocument } from './vectorStore.js';
import { ingestionQueue } from './ingestionQueue.js';
import { uploadsDir } from '../middlewares/uploadMiddleware.js';

let isRunning = false;
let loopPromise = null;
let wakeUpResolver = null;

export const ingestionWorker = {
  getWorkerId() {
    return `worker_${os.hostname()}_${process.pid}_${randomUUID().slice(0, 8)}`;
  },

  /**
   * Process a single claimed job.
   */
  async processJob(job, workerId = 'inline_worker') {
    if (!job) return null;

    try {
      // 1. Fetch document from PostgreSQL
      const doc = await DocumentModel.findById(job.userId, job.documentId);
      if (!doc) {
        // Document was deleted while queued
        await ingestionQueue.completeJob(job.id);
        return { success: true, skipped: true, reason: 'Document deleted' };
      }

      // 2. Idempotency check: if document is already indexed with chunks, skip duplicate processing
      if (doc.status === 'indexed' && doc.chunkCount > 0) {
        await ingestionQueue.completeJob(job.id, { chunkCount: doc.chunkCount });
        return { success: true, skipped: true, reason: 'Already indexed' };
      }

      // 3. Mark document as processing
      await DocumentModel.updateStatus(doc.id, {
        status: 'processing',
        retryCount: job.retryCount,
      });

      // 4. Retrieve binary data from durable storage (S3, NeonDB, or local)
      const buffer = await storage.getObject({ key: doc.storageKey });
      if (!buffer || buffer.length === 0) {
        throw new Error(`Failed to read document bytes from durable storage for key: ${doc.storageKey}`);
      }

      // 5. Write to temporary working file for parser
      const ext = path.extname(doc.name) || (doc.mimeType === 'text/plain' ? '.txt' : '.pdf');
      const tempPath = path.join(uploadsDir, `work_${doc.id}_${Date.now()}${ext}`);
      await fs.writeFile(tempPath, buffer);

      let chunks = [];
      try {
        // 6. Extract text & chunk
        chunks = await processDocument(tempPath, doc.name, doc.id);
      } finally {
        await fs.unlink(tempPath).catch(() => {});
      }

      if (!chunks || chunks.length === 0) {
        throw new Error('The document contains no extractable text.');
      }

      // 7. Index in Qdrant vector store
      await indexDocument(chunks, doc.collectionName);

      // 8. Store keyword chunks in PostgreSQL for hybrid retrieval & exact citations
      await ChunkModel.storeChunks(job.userId, doc.id, doc.collectionName, chunks);

      // 9. Update document status to indexed
      await DocumentModel.updateStatus(doc.id, {
        status: 'indexed',
        chunkCount: chunks.length,
        errorMessage: null,
        retryCount: job.retryCount,
      });

      // 10. Mark queue job as completed
      await ingestionQueue.completeJob(job.id, { chunkCount: chunks.length });

      return {
        success: true,
        documentId: doc.id,
        chunksIndexed: chunks.length,
      };
    } catch (err) {
      console.error(`[Worker ${workerId}] Ingestion failed for job ${job.id} (doc ${job.documentId}):`, err.message);
      // Mark job as failed or re-queue with exponential backoff
      await ingestionQueue.failJob(job.id, err.message);
      return { success: false, error: err.message };
    }
  },

  /**
   * Run one iteration of claim & process.
   */
  async runOnce(workerId = this.getWorkerId(), { skipTestJobs = true } = {}) {
    const job = await ingestionQueue.claimNextJob(workerId, { skipTestJobs });
    if (!job) return null;
    return await this.processJob(job, workerId);
  },

  /**
   * Start background worker loop.
   */
  startWorker({ pollIntervalMs = 2000, workerId = this.getWorkerId() } = {}) {
    if (isRunning) return;
    isRunning = true;

    loopPromise = (async () => {
      while (isRunning) {
        try {
          const result = await this.runOnce(workerId);
          // If a job was processed, immediately poll for another without sleeping
          if (result) continue;
        } catch (err) {
          console.error(`[Worker ${workerId}] Loop error:`, err.message);
        }

        // Sleep for poll interval or until woken up
        if (isRunning) {
          await new Promise((resolve) => {
            wakeUpResolver = resolve;
            setTimeout(resolve, pollIntervalMs);
          });
          wakeUpResolver = null;
        }
      }
    })();
  },

  /**
   * Immediately trigger an idle worker.
   */
  trigger() {
    if (wakeUpResolver) {
      wakeUpResolver();
      wakeUpResolver = null;
    }
  },

  /**
   * Stop background worker loop gracefully.
   */
  async stopWorker() {
    isRunning = false;
    this.trigger();
    if (loopPromise) {
      await loopPromise;
      loopPromise = null;
    }
  },

  isWorkerRunning() {
    return isRunning;
  },
};
