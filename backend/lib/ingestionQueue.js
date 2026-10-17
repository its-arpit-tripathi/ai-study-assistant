import { getPool } from '../config/database.js';

export const ingestionQueue = {
  /**
   * Enqueue an ingestion job in PostgreSQL.
   * If an uncompleted job with the same idempotency key already exists, returns it.
   */
  async enqueueJob({ documentId, userId, idempotencyKey, maxRetries = 3 }) {
    const db = getPool();

    // Check if job with this idempotency key already exists
    const existing = await db.query(
      `SELECT id, document_id as "documentId", user_id as "userId",
              idempotency_key as "idempotencyKey", status,
              retry_count as "retryCount", max_retries as "maxRetries",
              error_message as "errorMessage", scheduled_at as "scheduledAt"
       FROM ingestion_jobs
       WHERE idempotency_key = $1`,
      [idempotencyKey]
    );

    if (existing.rows.length > 0) {
      const job = existing.rows[0];
      if (job.status === 'completed' || job.status === 'processing' || job.status === 'queued') {
        return { job, isDuplicate: true };
      }
      // If previously failed, re-open for retry
      const reopened = await db.query(
        `UPDATE ingestion_jobs
         SET status = 'queued',
             retry_count = 0,
             error_message = NULL,
             scheduled_at = NOW(),
             updated_at = NOW()
         WHERE id = $1
         RETURNING id, document_id as "documentId", user_id as "userId",
                   idempotency_key as "idempotencyKey", status,
                   retry_count as "retryCount", max_retries as "maxRetries",
                   error_message as "errorMessage", scheduled_at as "scheduledAt"`,
        [job.id]
      );
      return { job: reopened.rows[0], isDuplicate: false };
    }

    const { rows } = await db.query(
      `INSERT INTO ingestion_jobs (document_id, user_id, idempotency_key, status, max_retries, scheduled_at)
       VALUES ($1, $2, $3, 'queued', $4, NOW())
       RETURNING id, document_id as "documentId", user_id as "userId",
                 idempotency_key as "idempotencyKey", status,
                 retry_count as "retryCount", max_retries as "maxRetries",
                 error_message as "errorMessage", scheduled_at as "scheduledAt"`,
      [documentId, userId, idempotencyKey, maxRetries]
    );

    return { job: rows[0], isDuplicate: false };
  },

  /**
   * Atomically claim the next available job using SELECT ... FOR UPDATE SKIP LOCKED.
   * Also re-claims stalled jobs locked more than lockTimeoutMinutes ago (default 5m).
   */
  async claimNextJob(workerId, { lockTimeoutMinutes = 5, skipTestJobs = false } = {}) {
    const db = getPool();
    const intervalStr = `${Math.max(1, Number(lockTimeoutMinutes) || 5)} minutes`;

    const { rows } = await db.query(
      `WITH candidate AS (
         SELECT id
         FROM ingestion_jobs
         WHERE (
           (status = 'queued' AND scheduled_at <= NOW())
           OR (status = 'processing' AND locked_at < NOW() - ($2::interval))
         )
         AND ($3::boolean IS FALSE OR idempotency_key NOT LIKE '%:test:%')
         ORDER BY scheduled_at ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED
       )
       UPDATE ingestion_jobs j
       SET status = 'processing',
           locked_at = NOW(),
           locked_by = $1,
           updated_at = NOW()
       FROM candidate
       WHERE j.id = candidate.id
       RETURNING j.id, j.document_id as "documentId", j.user_id as "userId",
                 j.idempotency_key as "idempotencyKey", j.status,
                 j.retry_count as "retryCount", j.max_retries as "maxRetries",
                 j.error_message as "errorMessage", j.locked_at as "lockedAt",
                 j.locked_by as "lockedBy", j.scheduled_at as "scheduledAt"`,
      [workerId, intervalStr, Boolean(skipTestJobs)]
    );

    return rows[0] || null;
  },

  /**
   * Mark job as successfully completed.
   */
  async completeJob(jobId, { chunkCount = 0 } = {}) {
    const db = getPool();
    const { rows } = await db.query(
      `UPDATE ingestion_jobs
       SET status = 'completed',
           locked_at = NULL,
           locked_by = NULL,
           updated_at = NOW(),
           error_message = NULL
       WHERE id = $1
       RETURNING id, status, document_id as "documentId"`,
      [jobId]
    );

    return rows[0] || null;
  },

  /**
   * Handle job failure with exponential backoff retry.
   * If retries exhausted or permanent is true, marks as failed.
   */
  async failJob(jobId, errorMessage, { permanent = false } = {}) {
    const db = getPool();

    // Fetch job details
    const { rows: jobRows } = await db.query(
      `SELECT id, document_id, retry_count, max_retries FROM ingestion_jobs WHERE id = $1`,
      [jobId]
    );
    if (!jobRows[0]) return null;

    const job = jobRows[0];
    const newRetryCount = job.retry_count + 1;
    const canRetry = !permanent && newRetryCount < job.max_retries;

    if (canRetry) {
      // Exponential backoff: 2s, 4s, 8s...
      const backoffSec = Math.pow(2, newRetryCount) * 2;
      const intervalStr = `${backoffSec} seconds`;

      const { rows } = await db.query(
        `UPDATE ingestion_jobs
         SET status = 'queued',
             retry_count = $1,
             error_message = $2,
             locked_at = NULL,
             locked_by = NULL,
             scheduled_at = NOW() + ($3::interval),
             updated_at = NOW()
         WHERE id = $4
         RETURNING id, status, retry_count as "retryCount", scheduled_at as "scheduledAt"`,
        [newRetryCount, errorMessage, intervalStr, jobId]
      );

      // Reflect in documents table
      await db.query(
        `UPDATE documents
         SET retry_count = $1,
             error_message = $2
         WHERE id = $3`,
        [newRetryCount, errorMessage, job.document_id]
      );

      return { retrying: true, retryCount: newRetryCount, job: rows[0] };
    }

    // Retries exhausted -> mark permanently failed
    const { rows } = await db.query(
      `UPDATE ingestion_jobs
       SET status = 'failed',
           retry_count = $1,
           error_message = $2,
           locked_at = NULL,
           locked_by = NULL,
           updated_at = NOW()
       WHERE id = $3
       RETURNING id, status, retry_count as "retryCount", error_message as "errorMessage"`,
      [newRetryCount, errorMessage, jobId]
    );

    // Reflect permanently failed status in documents table
    await db.query(
      `UPDATE documents
       SET status = 'failed',
           retry_count = $1,
           error_message = $2
       WHERE id = $3`,
      [newRetryCount, errorMessage, job.document_id]
    );

    return { retrying: false, retryCount: newRetryCount, job: rows[0] };
  },

  /**
   * Reset a failed document/job to queued for manual retry.
   */
  async retryJobForDocument(userId, documentId) {
    const db = getPool();

    // Check document ownership
    const { rows: docRows } = await db.query(
      `SELECT id, status FROM documents WHERE id = $1 AND user_id = $2`,
      [documentId, userId]
    );
    if (!docRows[0]) return null;

    // Reset document
    await db.query(
      `UPDATE documents
       SET status = 'queued',
           retry_count = 0,
           error_message = NULL
       WHERE id = $1`,
      [documentId]
    );

    // Reset or enqueue job
    const { rows: jobRows } = await db.query(
      `UPDATE ingestion_jobs
       SET status = 'queued',
           retry_count = 0,
           error_message = NULL,
           locked_at = NULL,
           locked_by = NULL,
           scheduled_at = NOW(),
           updated_at = NOW()
       WHERE document_id = $1
       RETURNING id, status, retry_count as "retryCount"`,
      [documentId]
    );

    return { success: true, job: jobRows[0] || null };
  },

  /**
   * Get latest job for a document.
   */
  async getJobByDocumentId(documentId) {
    const db = getPool();
    const { rows } = await db.query(
      `SELECT id, document_id as "documentId", user_id as "userId",
              idempotency_key as "idempotencyKey", status,
              retry_count as "retryCount", max_retries as "maxRetries",
              error_message as "errorMessage", scheduled_at as "scheduledAt",
              locked_at as "lockedAt", locked_by as "lockedBy",
              created_at as "createdAt", updated_at as "updatedAt"
       FROM ingestion_jobs
       WHERE document_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [documentId]
    );
    return rows[0] || null;
  },

  /**
   * Recover all stalled jobs locked longer than timeoutMinutes.
   */
  async recoverStalledJobs(timeoutMinutes = 5) {
    const db = getPool();
    const intervalStr = `${Math.max(1, Number(timeoutMinutes) || 5)} minutes`;
    const { rowCount } = await db.query(
      `UPDATE ingestion_jobs
       SET status = 'queued',
           locked_at = NULL,
           locked_by = NULL,
           updated_at = NOW()
       WHERE status = 'processing'
         AND locked_at < NOW() - ($1::interval)`,
      [intervalStr]
    );
    return rowCount;
  },

  /**
   * Helper to wait for a job to complete or fail, with timeout.
   */
  async waitForJob(jobId, { timeoutMs = 15000, pollIntervalMs = 250 } = {}) {
    const start = Date.now();
    const db = getPool();

    while (Date.now() - start < timeoutMs) {
      const { rows } = await db.query(
        `SELECT id, status, error_message as "errorMessage", retry_count as "retryCount"
         FROM ingestion_jobs
         WHERE id = $1`,
        [jobId]
      );

      if (!rows[0]) return null;
      if (rows[0].status === 'completed' || rows[0].status === 'failed') {
        return rows[0];
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    return { status: 'timeout' };
  },
};
