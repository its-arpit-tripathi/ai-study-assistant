import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { getPool, initDatabase } from '../config/database.js';
import {
  answerCache,
  answerCacheKey,
  distributedRateLimiter,
  Semaphore,
} from '../lib/productionControls.js';
import { metrics } from '../lib/metrics.js';

describe('SSE Streaming, Shared Controls & Metrics', () => {
  let db;

  before(async () => {
    await initDatabase();
    db = getPool();
  });

  after(async () => {
    await db?.end?.().catch(() => {});
  });

  test('1. Multi-Replica Shared Cache: Persists and syncs across replicas via PostgreSQL', async () => {
    const testKey = `shared_test_${Date.now()}`;
    const payload = {
      answer: 'Shared cache answer accessible by any replica.',
      sources: [{ source: 'doc.pdf', page: 2 }],
      verification: { status: 'verified', counts: { supported: 1, uncertain: 0, unsupported: 0 } },
      model: 'qwen/qwen3.8-27b',
    };

    // Set in shared cache
    await answerCache.set(testKey, payload, 10_000);

    // Retrieve via shared cache
    const retrieved = await answerCache.get(testKey);
    assert.deepEqual(retrieved, payload);

    // Check directly in PostgreSQL shared_cache table
    const { rows } = await db.query(`SELECT value FROM shared_cache WHERE key = $1`, [testKey]);
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0].value, payload);

    // Clean up
    await answerCache.delete(testKey);
    const afterDel = await answerCache.get(testKey);
    assert.equal(afterDel, undefined);
  });

  test('2. Distributed Multi-Replica Rate Limiting: Blocks bursts across replicas', async () => {
    const rateKey = `rate_test_${Date.now()}`;

    // Limit to 3 requests per 10 seconds
    const r1 = await distributedRateLimiter.checkLimit(rateKey, { limit: 3, windowSec: 10 });
    assert.equal(r1.allowed, true);
    assert.equal(r1.points, 1);

    const r2 = await distributedRateLimiter.checkLimit(rateKey, { limit: 3, windowSec: 10 });
    assert.equal(r2.allowed, true);
    assert.equal(r2.points, 2);

    const r3 = await distributedRateLimiter.checkLimit(rateKey, { limit: 3, windowSec: 10 });
    assert.equal(r3.allowed, true);
    assert.equal(r3.points, 3);

    // 4th request must be rejected
    const r4 = await distributedRateLimiter.checkLimit(rateKey, { limit: 3, windowSec: 10 });
    assert.equal(r4.allowed, false);
    assert.ok(r4.retryAfterSec > 0);

    // Clean up
    await db.query(`DELETE FROM shared_rate_limits WHERE key = $1`, [rateKey]);
  });

  test('3. Semaphore Cancellation: Disconnected client releases concurrency permit immediately', async () => {
    const sem = new Semaphore(1, 10);
    const controller = new AbortController();

    // Acquire the only slot
    let slotReleased = false;
    const taskPromise = sem.run(async () => {
      await new Promise((r) => setTimeout(r, 80));
      slotReleased = true;
    });

    // Second task enters with abort controller
    const queuedTask = sem.run(async () => {}, { signal: controller.signal });
    
    // Abort queued task
    controller.abort();

    await assert.rejects(queuedTask, { status: 499 });
    await taskPromise;
    assert.equal(slotReleased, true);
    assert.equal(sem.snapshot().active, 0);
  });

  test('4. Metrics & Provider Telemetry: Accurately records latencies and failures', () => {
    metrics.reset();

    metrics.recordRequest({ stream: true });
    metrics.recordStreamStart();
    metrics.recordProviderCall();
    metrics.recordProviderSuccess({
      promptTokens: 100,
      completionTokens: 50,
      ttftMs: 320,
      totalMs: 1200,
    });
    metrics.recordVerification({ durationMs: 450, status: 'verified' });
    metrics.recordStreamEnd();

    const snapshot = metrics.getSnapshot();
    assert.equal(snapshot.requests.streaming, 1);
    assert.equal(snapshot.streams.completed, 1);
    assert.equal(snapshot.provider.totalCalls, 1);
    assert.equal(snapshot.provider.successes, 1);
    assert.equal(snapshot.tokens.estimatedTotalTokens, 150);
    assert.equal(snapshot.latencies.timeToFirstTokenMs.avg, 320);
    assert.equal(snapshot.latencies.totalStreamMs.avg, 1200);
    assert.equal(snapshot.latencies.verificationMs.avg, 450);
  });
});
