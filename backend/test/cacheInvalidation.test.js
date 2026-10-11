import test from 'node:test';
import assert from 'node:assert/strict';
import { TTLCache, answerCacheKey } from '../lib/productionControls.js';

test('Cache Correctness: Stores, retrieves, and deep-clones payloads without mutation leak', () => {
  const cache = new TTLCache({ maxEntries: 10, ttlMs: 1000 });
  const payload = {
    answer: 'Convolutional neural networks extract spatial feature hierarchies.',
    sources: [{ source: 'doc.pdf', page: 4 }],
    verification: { status: 'verified', counts: { supported: 1, uncertain: 0, unsupported: 0 } },
    model: 'qwen/qwen3.8-27b',
  };

  cache.set('key-1', payload);

  const retrieved = cache.get('key-1');
  assert.deepEqual(retrieved, payload);

  // Mutation of original payload must NOT affect cache
  payload.answer = 'Mutated!';
  payload.sources.push({ source: 'leaked.pdf', page: 99 });
  const freshRead = cache.get('key-1');
  assert.equal(freshRead.answer, 'Convolutional neural networks extract spatial feature hierarchies.');
  assert.equal(freshRead.sources.length, 1);

  // Mutation of retrieved object must NOT affect internal cache
  freshRead.answer = 'Tampered read!';
  const secondRead = cache.get('key-1');
  assert.equal(secondRead.answer, 'Convolutional neural networks extract spatial feature hierarchies.');
});

test('Query Normalization: Canonicalizes whitespace, casing, and punctuation variations', () => {
  const baseScope = {
    userId: 'user-abc',
    documentId: 'doc-xyz',
    documentVersion: 1,
    model: 'qwen/qwen3.8-27b',
    promptVersion: 'v1',
  };

  const key1 = answerCacheKey({ ...baseScope, query: 'What is deep learning?' });
  const key2 = answerCacheKey({ ...baseScope, query: '  WHAT   is   deep   learning?  ' });
  const key3 = answerCacheKey({ ...baseScope, query: 'what is deep learning?' });

  assert.equal(key1, key2, 'Leading/trailing and duplicate whitespace plus case must produce identical key');
  assert.equal(key1, key3, 'Lowercase query must match mixed-case query');

  const differentQueryKey = answerCacheKey({ ...baseScope, query: 'What is machine learning?' });
  assert.notEqual(key1, differentQueryKey, 'Distinct queries must produce distinct keys');
});

test('Document-Version Invalidation: Re-uploading a document invalidates previous cached answers', () => {
  const cache = new TTLCache({ maxEntries: 10, ttlMs: 60000 });
  const query = 'Summarize key findings';

  const v1Key = answerCacheKey({
    userId: 'user-1',
    documentId: 'doc-1',
    documentVersion: 1,
    query,
  });

  const v2Key = answerCacheKey({
    userId: 'user-1',
    documentId: 'doc-1',
    documentVersion: 2, // Incremented after document re-upload/re-index
    query,
  });

  const v3Key = answerCacheKey({
    userId: 'user-1',
    documentId: 'doc-1',
    documentVersion: 3,
    query,
  });

  assert.notEqual(v1Key, v2Key, 'Version 1 and Version 2 keys must be strictly distinct');
  assert.notEqual(v2Key, v3Key, 'Version 2 and Version 3 keys must be strictly distinct');

  // Cache answer for v1
  cache.set(v1Key, { answer: 'Answer based on original v1 text' });

  // When querying with v2 scope, v1 cache is NOT returned
  assert.equal(cache.get(v2Key), undefined, 'Querying v2 document must miss v1 cache');
  assert.ok(cache.get(v1Key), 'v1 cache remains intact under its own version key');

  // Cache answer for v2
  cache.set(v2Key, { answer: 'Answer based on updated v2 text' });
  assert.equal(cache.get(v2Key).answer, 'Answer based on updated v2 text');
});

test('Cross-Tenant Cache Isolation: Identical questions on separate accounts never share cache', () => {
  const cache = new TTLCache({ maxEntries: 10, ttlMs: 60000 });
  const commonQuery = 'What is the executive summary?';

  const userAKey = answerCacheKey({
    userId: 'tenant-a-id',
    documentId: 'doc-100',
    documentVersion: 1,
    query: commonQuery,
  });

  const userBKey = answerCacheKey({
    userId: 'tenant-b-id',
    documentId: 'doc-100',
    documentVersion: 1,
    query: commonQuery,
  });

  assert.notEqual(userAKey, userBKey, 'User A and User B must never share cache keys');

  cache.set(userAKey, { answer: 'Confidential Tenant A response' });
  assert.equal(cache.get(userBKey), undefined, 'Tenant B must NOT access Tenant A cached answer');
});

test('Cache Expiration: Entries are accurately evicted upon reaching TTL', async () => {
  const shortTtlMs = 40;
  const cache = new TTLCache({ maxEntries: 5, ttlMs: shortTtlMs });

  cache.set('temp-key', { data: 'ephemeral' });

  // Immediate read should hit
  assert.deepEqual(cache.get('temp-key'), { data: 'ephemeral' });

  // Wait for TTL to elapse
  await new Promise((resolve) => setTimeout(resolve, shortTtlMs + 15));

  // Expired read should miss and return undefined
  assert.equal(cache.get('temp-key'), undefined, 'Entry must be evicted after TTL expiration');
  assert.equal(cache.size, 0, 'Internal map size must reflect eviction');
});

test('Model and Prompt-Version Isolation: Changing LLM or prompt invalidates stale answers', () => {
  const base = {
    userId: 'u1',
    documentId: 'd1',
    documentVersion: 1,
    query: 'What is precision?',
  };

  const keyModelQwen = answerCacheKey({ ...base, model: 'qwen/qwen3.8-27b', promptVersion: 'v1' });
  const keyModelGpt = answerCacheKey({ ...base, model: 'openai/gpt-oss-120b', promptVersion: 'v1' });
  const keyPromptV2 = answerCacheKey({ ...base, model: 'qwen/qwen3.8-27b', promptVersion: 'v2' });

  assert.notEqual(keyModelQwen, keyModelGpt, 'Changing model must invalidate cached answer');
  assert.notEqual(keyModelQwen, keyPromptV2, 'Updating prompt version must invalidate cached answer');
});
