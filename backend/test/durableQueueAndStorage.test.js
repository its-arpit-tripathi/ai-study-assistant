import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { getPool, initDatabase } from '../config/database.js';
import { storage } from '../lib/storage.js';
import { DocumentModel } from '../models/DocumentModel.js';
import { ingestionQueue } from '../lib/ingestionQueue.js';
import { ingestionWorker } from '../lib/ingestionWorker.js';

describe('Durable Object Storage & Queue System', () => {
  let db;
  let testUserId;
  let testNotebookId;

  before(async () => {
    await initDatabase();
    db = getPool();
    // Create or find a test user
    const { rows: userRows } = await db.query(
      `INSERT INTO users (email, password_hash)
       VALUES ($1, 'dummy_hash')
       ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
       RETURNING id`,
      [`storage_test_${Date.now()}@example.com`]
    );
    testUserId = userRows[0].id;

    // Create or find a notebook
    const { rows: notebookRows } = await db.query(
      `INSERT INTO notebooks (user_id, name)
       VALUES ($1, 'Test Storage Notebook')
       ON CONFLICT (user_id, name) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [testUserId]
    );
    testNotebookId = notebookRows[0].id;
  });

  after(async () => {
    const db = getPool();
    if (testUserId) {
      await db.query(`DELETE FROM users WHERE id = $1`, [testUserId]).catch(() => {});
    }
    await db.end().catch(() => {});
  });

  test('1. Durable Object Storage: Put, Get, Head, and Delete object binary', async () => {
    const key = `test_objects/${testUserId}/sample.txt`;
    const payload = Buffer.from('Hello, durable object storage with PostgreSQL and S3 compatibility!');
    
    // Put object
    const putRes = await storage.putObject({
      key,
      userId: testUserId,
      buffer: payload,
      contentType: 'text/plain',
    });
    assert.equal(putRes.key, key);
    assert.equal(putRes.sizeBytes, payload.length);

    // Head object
    const headRes = await storage.headObject({ key });
    assert.equal(headRes.exists, true);
    assert.equal(headRes.size, payload.length);

    // Get object
    const retrieved = await storage.getObject({ key });
    assert.deepEqual(retrieved, payload);

    // Delete object
    await storage.deleteObject({ key });
    const afterDelete = await storage.headObject({ key });
    assert.equal(afterDelete.exists, false);
  });

  test('2. PostgreSQL Document Metadata: Stores storage keys, providers, and status', async () => {
    const docId = randomUUID();
    const collectionName = `doc_${docId.replaceAll('-', '')}`;
    const storageKey = `docs/${testUserId}/${docId}/test.pdf`;
    const content = Buffer.from('%PDF-1.4 Mock document test for PostgreSQL registry');
    const contentHash = createHash('sha256').update(content).digest('hex');

    const created = await DocumentModel.create(testUserId, {
      id: docId,
      name: 'test.pdf',
      collectionName,
      uploadedAt: new Date().toISOString(),
      chunkCount: 0,
      contentHash,
      storageKey,
      storageProvider: storage.getProviderName(),
      mimeType: 'application/pdf',
      sizeBytes: content.length,
      status: 'queued',
    });

    assert.equal(created.id, docId);
    assert.equal(created.status, 'queued');
    assert.equal(created.storageKey, storageKey);
    assert.equal(created.storageProvider, storage.getProviderName());

    // Query back from PostgreSQL
    const fetched = await DocumentModel.findById(testUserId, docId);
    assert.equal(fetched.id, docId);
    assert.equal(fetched.contentHash, contentHash);
    assert.equal(fetched.sizeBytes, String(content.length));

    // Update status to processing and indexed
    await DocumentModel.updateStatus(docId, { status: 'processing' });
    const processingDoc = await DocumentModel.findById(testUserId, docId);
    assert.equal(processingDoc.status, 'processing');

    await DocumentModel.updateStatus(docId, { status: 'indexed', chunkCount: 5 });
    const indexedDoc = await DocumentModel.findById(testUserId, docId);
    assert.equal(indexedDoc.status, 'indexed');
    assert.equal(indexedDoc.chunkCount, 5);

    // Clean up
    await DocumentModel.delete(testUserId, docId);
  });

  test('3. Ingestion Idempotency: Duplicate submissions do not re-enqueue duplicate jobs', async () => {
    const docId = randomUUID();
    const contentHash = 'hash_idempotency_12345';
    const idempotencyKey = `${docId}:${contentHash}:v1`;

    // Create document record
    await DocumentModel.create(testUserId, {
      id: docId,
      name: 'idempotent_test.pdf',
      collectionName: `doc_${docId.replaceAll('-', '')}`,
      uploadedAt: new Date().toISOString(),
      contentHash,
      status: 'queued',
    });

    // Enqueue first time
    const res1 = await ingestionQueue.enqueueJob({
      documentId: docId,
      userId: testUserId,
      idempotencyKey,
    });
    assert.equal(res1.isDuplicate, false);
    assert.equal(res1.job.status, 'queued');

    // Enqueue duplicate with identical idempotency key
    const res2 = await ingestionQueue.enqueueJob({
      documentId: docId,
      userId: testUserId,
      idempotencyKey,
    });
    assert.equal(res2.isDuplicate, true);
    assert.equal(res2.job.id, res1.job.id);

    // Bump version: v2 should be allowed as a new version
    const res3 = await ingestionQueue.enqueueJob({
      documentId: docId,
      userId: testUserId,
      idempotencyKey: `${docId}:${contentHash}:v2`,
    });
    assert.equal(res3.isDuplicate, false);
    assert.notEqual(res3.job.id, res1.job.id);

    // Clean up
    await DocumentModel.delete(testUserId, docId);
  });

  test('4. Atomic Concurrency & Multi-Replica Claiming: SKIP LOCKED ensures zero duplicate execution', async () => {
    const docIds = [randomUUID(), randomUUID(), randomUUID()];
    const jobs = [];

    for (let i = 0; i < docIds.length; i++) {
      const docId = docIds[i];
      await DocumentModel.create(testUserId, {
        id: docId,
        name: `concurrent_${i}.pdf`,
        collectionName: `doc_${docId.replaceAll('-', '')}`,
        uploadedAt: new Date().toISOString(),
        contentHash: `hash_concurrent_${i}`,
        status: 'queued',
      });

      const { job } = await ingestionQueue.enqueueJob({
        documentId: docId,
        userId: testUserId,
        idempotencyKey: `${docId}:test:hash_${i}:v1`,
      });
      jobs.push(job);
    }

    // 3 parallel worker replicas simultaneously calling claimNextJob
    const [claimed1, claimed2, claimed3] = await Promise.all([
      ingestionQueue.claimNextJob('worker_replica_A'),
      ingestionQueue.claimNextJob('worker_replica_B'),
      ingestionQueue.claimNextJob('worker_replica_C'),
    ]);

    const claimedIds = [claimed1?.id, claimed2?.id, claimed3?.id].filter(Boolean);
    const uniqueIds = new Set(claimedIds);

    // Assert all 3 jobs were claimed without any collision or duplicate assignment
    assert.equal(claimedIds.length, 3);
    assert.equal(uniqueIds.size, 3);

    // Attempting a 4th claim finds nothing ready
    const claimed4 = await ingestionQueue.claimNextJob('worker_replica_D');
    assert.equal(claimed4, null);

    // Clean up
    for (const docId of docIds) {
      await DocumentModel.delete(testUserId, docId);
    }
  });

  test('5. Retries & Exponential Backoff: Transient failures retry until max_retries', async () => {
    const docId = randomUUID();
    await DocumentModel.create(testUserId, {
      id: docId,
      name: 'retry_test.pdf',
      collectionName: `doc_${docId.replaceAll('-', '')}`,
      uploadedAt: new Date().toISOString(),
      contentHash: 'hash_retry_test',
      status: 'queued',
    });

    const { job } = await ingestionQueue.enqueueJob({
      documentId: docId,
      userId: testUserId,
      idempotencyKey: `${docId}:test:retry:v1`,
      maxRetries: 2,
    });

    // Simulate failure 1 -> should schedule retry
    const fail1 = await ingestionQueue.failJob(job.id, 'Connection timeout');
    assert.equal(fail1.retrying, true);
    assert.equal(fail1.retryCount, 1);

    // Check document status reflects retry count
    const docAfterFail1 = await DocumentModel.findById(testUserId, docId);
    assert.equal(docAfterFail1.retryCount, 1);
    assert.equal(docAfterFail1.errorMessage, 'Connection timeout');

    // Simulate failure 2 (exhausts maxRetries = 2) -> permanently failed
    const fail2 = await ingestionQueue.failJob(job.id, 'Connection timeout 2');
    assert.equal(fail2.retrying, false);
    assert.equal(fail2.retryCount, 2);

    const docAfterFail2 = await DocumentModel.findById(testUserId, docId);
    assert.equal(docAfterFail2.status, 'failed');
    assert.equal(docAfterFail2.retryCount, 2);

    // Test manual recovery: retryJobForDocument
    const recovery = await ingestionQueue.retryJobForDocument(testUserId, docId);
    assert.equal(recovery.success, true);
    assert.equal(recovery.job.status, 'queued');
    assert.equal(recovery.job.retryCount, 0);

    const docRecovered = await DocumentModel.findById(testUserId, docId);
    assert.equal(docRecovered.status, 'queued');
    assert.equal(docRecovered.retryCount, 0);

    // Clean up
    await DocumentModel.delete(testUserId, docId);
  });

  test('6. Stalled Job Recovery: Jobs locked by crashed workers are automatically reclaimed', async () => {
    const docId = randomUUID();
    await DocumentModel.create(testUserId, {
      id: docId,
      name: 'crash_test.pdf',
      collectionName: `doc_${docId.replaceAll('-', '')}`,
      uploadedAt: new Date().toISOString(),
      contentHash: 'hash_crash_test',
      status: 'queued',
    });

    const { job } = await ingestionQueue.enqueueJob({
      documentId: docId,
      userId: testUserId,
      idempotencyKey: `${docId}:test:crash:v1`,
    });

    // Worker 1 claims job
    const claimed = await ingestionQueue.claimNextJob('crashed_worker_1');
    assert.equal(claimed.id, job.id);

    // Simulate worker 1 dying by artificially setting locked_at to 10 minutes in the past
    const db = getPool();
    await db.query(
      `UPDATE ingestion_jobs
       SET locked_at = NOW() - INTERVAL '10 minutes'
       WHERE id = $1`,
      [job.id]
    );

    // Worker 2 comes along and claims the next job -> automatically recovers the stalled job!
    const recovered = await ingestionQueue.claimNextJob('healthy_worker_2', { lockTimeoutMinutes: 5 });
    assert.notEqual(recovered, null);
    assert.equal(recovered.id, job.id);
    assert.equal(recovered.lockedBy, 'healthy_worker_2');

    // Worker 2 marks complete
    await ingestionQueue.completeJob(recovered.id);
    const finalJob = await ingestionQueue.getJobByDocumentId(docId);
    assert.equal(finalJob.status, 'completed');

    // Clean up
    await DocumentModel.delete(testUserId, docId);
  });
});
