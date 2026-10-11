import { createHash } from 'node:crypto';
import { getPool } from '../config/database.js';

/**
 * In-memory L1 LRU TTL cache.
 */
export class TTLCache {
  #items = new Map();
  constructor({ maxEntries = 500, ttlMs = 30_000 } = {}) {
    this.maxEntries = Math.max(1, Number(maxEntries) || 500);
    this.ttlMs = Math.max(0, Number(ttlMs) || 0);
  }
  get(key) {
    const item = this.#items.get(key);
    if (!item) return undefined;
    if (item.expiresAt <= Date.now()) {
      this.#items.delete(key);
      return undefined;
    }
    // Refresh insertion order for LRU eviction
    this.#items.delete(key);
    this.#items.set(key, item);
    return structuredClone(item.value);
  }
  set(key, value, ttlMs = this.ttlMs) {
    if (ttlMs <= 0) return;
    this.#items.delete(key);
    this.#items.set(key, { value: structuredClone(value), expiresAt: Date.now() + ttlMs });
    while (this.#items.size > this.maxEntries) {
      this.#items.delete(this.#items.keys().next().value);
    }
  }
  delete(key) {
    this.#items.delete(key);
  }
  clear() {
    this.#items.clear();
  }
  get size() {
    return this.#items.size;
  }
}

/**
 * Shared Multi-Replica Two-Tier Answer Cache:
 * - Tier 1: In-process LRU (instant latency)
 * - Tier 2: PostgreSQL shared_cache / Redis (synchronized across all replicas)
 */
export class SharedAnswerCache {
  constructor({ maxEntries = 300, ttlMs = 30_000 } = {}) {
    this.l1 = new TTLCache({ maxEntries, ttlMs });
    this.ttlMs = Math.max(0, Number(ttlMs) || 0);
  }

  async get(key) {
    // 1. Check L1 in-memory
    const local = this.l1.get(key);
    if (local !== undefined) return local;

    // 2. Check L2 PostgreSQL shared cache for multi-replica coordination
    try {
      const db = getPool();
      const { rows } = await db.query(
        `SELECT value FROM shared_cache WHERE key = $1 AND expires_at > NOW()`,
        [key]
      );
      if (rows.length > 0 && rows[0].value) {
        const val = rows[0].value;
        // Warm local L1 cache
        this.l1.set(key, val, this.ttlMs);
        return structuredClone(val);
      }
    } catch {
      // In standalone tests or when database pool is not connected
    }

    return undefined;
  }

  async set(key, value, ttlMs = this.ttlMs) {
    if (ttlMs <= 0) return;
    // 1. Set L1
    this.l1.set(key, value, ttlMs);

    // 2. Persist to L2 shared cache
    try {
      const db = getPool();
      const ttlSec = Math.max(1, Math.round(ttlMs / 1000));
      const intervalStr = `${ttlSec} seconds`;

      await db.query(
        `INSERT INTO shared_cache (key, value, expires_at)
         VALUES ($1, $2::jsonb, NOW() + ($3::interval))
         ON CONFLICT (key) DO UPDATE
           SET value = EXCLUDED.value,
               expires_at = EXCLUDED.expires_at`,
        [key, JSON.stringify(value), intervalStr]
      );
    } catch {
      // Standalone mode / DB pool unavailable
    }
  }

  async delete(key) {
    this.l1.delete(key);
    try {
      const db = getPool();
      await db.query(`DELETE FROM shared_cache WHERE key = $1`, [key]);
    } catch {}
  }

  async clear() {
    this.l1.clear();
    try {
      const db = getPool();
      await db.query(`DELETE FROM shared_cache`);
    } catch {}
  }

  get size() {
    return this.l1.size;
  }
}

/**
 * Coordinated Multi-Replica Distributed Rate Limiter
 * Synchronizes request limits across all server replicas via PostgreSQL shared_rate_limits.
 */
export class DistributedRateLimiter {
  #memoryBuckets = new Map();

  async checkLimit(key, { limit = 30, windowSec = 60 } = {}) {
    const now = Date.now();

    try {
      const db = getPool();
      const intervalStr = `${Math.max(1, Number(windowSec) || 60)} seconds`;

      const { rows } = await db.query(
        `INSERT INTO shared_rate_limits (key, points, reset_at)
         VALUES ($1, 1, NOW() + ($2::interval))
         ON CONFLICT (key) DO UPDATE
           SET points = CASE
             WHEN shared_rate_limits.reset_at <= NOW() THEN 1
             ELSE shared_rate_limits.points + 1
           END,
           reset_at = CASE
             WHEN shared_rate_limits.reset_at <= NOW() THEN NOW() + ($2::interval)
             ELSE shared_rate_limits.reset_at
           END
         RETURNING points, reset_at`,
        [key, intervalStr]
      );

      if (rows[0]) {
        const points = rows[0].points;
        const resetAt = new Date(rows[0].reset_at).getTime();
        const retryAfterSec = Math.max(1, Math.ceil((resetAt - now) / 1000));

        if (points > limit) {
          return { allowed: false, points, limit, retryAfterSec };
        }
        return { allowed: true, points, limit, retryAfterSec: 0 };
      }
    } catch {
      // Fallback to local memory rate limiter if database is unreachable
    }

    // Local fallback
    const bucket = this.#memoryBuckets.get(key) || { count: 0, resetAt: now + windowSec * 1000 };
    if (bucket.resetAt <= now) {
      bucket.count = 1;
      bucket.resetAt = now + windowSec * 1000;
    } else {
      bucket.count++;
    }
    this.#memoryBuckets.set(key, bucket);

    if (bucket.count > limit) {
      const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      return { allowed: false, points: bucket.count, limit, retryAfterSec };
    }
    return { allowed: true, points: bucket.count, limit, retryAfterSec: 0 };
  }
}

export class Semaphore {
  #active = 0;
  #waiters = [];
  constructor(limit = 8, maxQueue = 100) {
    this.limit = Math.max(1, Number(limit) || 8);
    this.maxQueue = Math.max(0, Number(maxQueue) || 0);
  }
  async run(fn, { signal } = {}) {
    if (signal?.aborted) {
      throw Object.assign(new Error('Request cancelled by client'), { status: 499 });
    }
    if (this.#active >= this.limit) {
      if (this.#waiters.length >= this.maxQueue) {
        throw Object.assign(new Error('The answer-generation queue is currently busy. Please retry shortly.'), { status: 503 });
      }
      await new Promise((resolve, reject) => {
        const waiter = { resolve, reject, signal, onAbort: null };
        waiter.onAbort = () => {
          const index = this.#waiters.indexOf(waiter);
          if (index >= 0) this.#waiters.splice(index, 1);
          reject(Object.assign(new Error('Request cancelled by client'), { status: 499 }));
        };
        signal?.addEventListener('abort', waiter.onAbort, { once: true });
        this.#waiters.push(waiter);
      });
    }
    this.#active++;
    try {
      return await fn();
    } finally {
      this.#active--;
      const next = this.#waiters.shift();
      if (next) {
        next.signal?.removeEventListener('abort', next.onAbort);
        next.resolve();
      }
    }
  }
  snapshot() {
    return { active: this.#active, queued: this.#waiters.length, limit: this.limit, maxQueue: this.maxQueue };
  }
}

export function answerCacheKey({ userId, documentId, documentVersion, query, model, promptVersion = 'v1' }) {
  if (!userId || !documentId || !query) {
    throw new Error('Scoped cache keys require userId, documentId, and query.');
  }
  const canonical = JSON.stringify({
    userId,
    documentId,
    documentVersion: documentVersion ?? 1,
    query: String(query).trim().replace(/\s+/g, ' ').toLowerCase(),
    model: model || 'default',
    promptVersion,
  });
  return createHash('sha256').update(canonical).digest('hex');
}

export const answerCache = new SharedAnswerCache({
  maxEntries: Number(process.env.ANSWER_CACHE_MAX_ENTRIES || 300),
  ttlMs: Number(process.env.ANSWER_CACHE_TTL_MS || 30_000),
});

export const distributedRateLimiter = new DistributedRateLimiter();

export const llmSemaphore = new Semaphore(
  Number(process.env.LLM_MAX_CONCURRENCY || 8),
  Number(process.env.LLM_MAX_QUEUE || 100),
);
