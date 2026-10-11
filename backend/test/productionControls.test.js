import test from 'node:test';
import assert from 'node:assert/strict';
import { TTLCache, Semaphore, answerCacheKey } from '../lib/productionControls.js';

test('TTLCache clones values and expires entries', async () => {
  const cache = new TTLCache({ maxEntries: 2, ttlMs: 20 });
  const original = { nested: { answer: 'ok' } };
  cache.set('a', original);
  original.nested.answer = 'changed';
  assert.equal(cache.get('a').nested.answer, 'ok');
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(cache.get('a'), undefined);
});

test('TTLCache bounds entry count', () => {
  const cache = new TTLCache({ maxEntries: 2, ttlMs: 1000 });
  cache.set('a', 1); cache.set('b', 2); cache.set('c', 3);
  assert.equal(cache.size, 2);
  assert.equal(cache.get('a'), undefined);
});

test('answer cache keys isolate user, document, version, and prompt', () => {
  const base = { userId: 'u1', documentId: 'd1', documentVersion: 1, query: 'What is RAG?', model: 'm', promptVersion: 'v1' };
  const key = answerCacheKey(base);
  assert.equal(key, answerCacheKey({ ...base, query: '  WHAT is RAG?  ' }));
  assert.notEqual(key, answerCacheKey({ ...base, userId: 'u2' }));
  assert.notEqual(key, answerCacheKey({ ...base, documentId: 'd2' }));
  assert.notEqual(key, answerCacheKey({ ...base, documentVersion: 2 }));
  assert.notEqual(key, answerCacheKey({ ...base, promptVersion: 'v2' }));
});

test('Semaphore enforces concurrency limit and drains queued work', async () => {
  const semaphore = new Semaphore(1, 2);
  let active = 0; let maxActive = 0;
  const task = () => semaphore.run(async () => {
    active++; maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, 15));
    active--;
  });
  await Promise.all([task(), task(), task()]);
  assert.equal(maxActive, 1);
  assert.deepEqual(semaphore.snapshot(), { active: 0, queued: 0, limit: 1, maxQueue: 2 });
});

test('Semaphore rejects overload rather than growing an unbounded queue', async () => {
  const semaphore = new Semaphore(1, 0);
  let release;
  const first = semaphore.run(() => new Promise((resolve) => { release = resolve; }));
  await new Promise((resolve) => setImmediate(resolve));
  await assert.rejects(semaphore.run(async () => {}), { status: 503 });
  release();
  await first;
});
