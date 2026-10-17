import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { getPool, initDatabase } from '../config/database.js';
import { chatHistory, getChatKey } from '../lib/chatHistory.js';
import { pingRedis, closeRedis } from '../lib/redis.js';

describe('Redis & Multi-Tier Persistent Chat System', () => {
  let db;
  const testUserId1 = '00000000-0000-0000-0000-000000000001';
  const testUserId2 = '00000000-0000-0000-0000-000000000002';
  const testDocId1 = '11111111-1111-1111-1111-111111111111';
  const testDocId2 = '22222222-2222-2222-2222-222222222222';
  let hasPostgres = false;

  before(async () => {
    try {
      await initDatabase();
      db = getPool();
      hasPostgres = true;

      // Seed dummy users and notebooks/documents for foreign key constraints if db connected
      await db.query(`
        INSERT INTO users (id, email, password_hash)
        VALUES ('${testUserId1}', 'redis-user1@test.com', 'dummyhash'),
               ('${testUserId2}', 'redis-user2@test.com', 'dummyhash')
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO notebooks (id, user_id, name)
        VALUES ('33333333-3333-3333-3333-333333333333', '${testUserId1}', 'Redis Notebook 1'),
               ('44444444-4444-4444-4444-444444444444', '${testUserId2}', 'Redis Notebook 2')
        ON CONFLICT (id) DO NOTHING;

        INSERT INTO documents (id, user_id, notebook_id, name, collection_name)
        VALUES ('${testDocId1}', '${testUserId1}', '33333333-3333-3333-3333-333333333333', 'doc1.pdf', 'col_redis_doc1'),
               ('${testDocId2}', '${testUserId2}', '44444444-4444-4444-4444-444444444444', 'doc2.pdf', 'col_redis_doc2')
        ON CONFLICT (id) DO NOTHING;
      `);
    } catch {
      hasPostgres = false;
    }
  });

  after(async () => {
    if (hasPostgres && db) {
      try {
        await db.query(`DELETE FROM chat_messages WHERE user_id IN ('${testUserId1}', '${testUserId2}')`);
        await db.query(`DELETE FROM documents WHERE id IN ('${testDocId1}', '${testDocId2}')`);
        await db.query(`DELETE FROM notebooks WHERE id IN ('33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444')`);
        await db.query(`DELETE FROM users WHERE id IN ('${testUserId1}', '${testUserId2}')`);
        await db.end();
      } catch {}
    }
    await closeRedis();
  });

  test('1. Redis Key Generation: Generates isolated scoped keys per user and document', () => {
    const key1 = getChatKey(testUserId1, testDocId1);
    const key2 = getChatKey(testUserId2, testDocId1);
    const key3 = getChatKey(testUserId1, testDocId2);

    assert.equal(key1, `notebook:chat:${testUserId1}:${testDocId1}`);
    assert.notEqual(key1, key2, 'Keys must be isolated by userId');
    assert.notEqual(key1, key3, 'Keys must be isolated by documentId');
  });

  test('2. Redis Health Telemetry: pingRedis returns status object without throwing', async () => {
    const health = await pingRedis();
    assert.ok(typeof health === 'object');
    assert.ok('ok' in health);
    assert.ok('status' in health);
  });

  test('3. Save and Retrieve User & Assistant Messages: Persists full grounded turn', async () => {
    await chatHistory.clearHistory(testUserId1, testDocId1);

    // Save user question
    const userMsg = await chatHistory.saveMessage(testUserId1, testDocId1, {
      role: 'user',
      content: 'What is the attention mechanism in Transformers?',
    });

    assert.ok(userMsg);
    assert.equal(userMsg.role, 'user');
    assert.equal(userMsg.content, 'What is the attention mechanism in Transformers?');
    assert.ok(userMsg.id.startsWith('u-'));

    // Save assistant response
    const assistantMsg = await chatHistory.saveMessage(testUserId1, testDocId1, {
      role: 'assistant',
      content: 'The attention mechanism computes compatibility scores between query and key vectors.',
      sources: [{ source: 'doc1.pdf', page: 4, chunkId: 'chk_1' }],
      verification: { status: 'verified', counts: { supported: 1, uncertain: 0, unsupported: 0 } },
      model: 'qwen/qwen3.8-27b',
    });

    assert.ok(assistantMsg);
    assert.equal(assistantMsg.role, 'assistant');
    assert.equal(assistantMsg.sources.length, 1);
    assert.equal(assistantMsg.sources[0].source, 'doc1.pdf');
    assert.equal(assistantMsg.verification?.status, 'verified');

    // Retrieve full persistent history
    const history = await chatHistory.getHistory(testUserId1, testDocId1);
    assert.equal(history.length, 2);
    assert.equal(history[0].role, 'user');
    assert.equal(history[0].content, 'What is the attention mechanism in Transformers?');
    assert.equal(history[1].role, 'assistant');
    assert.equal(history[1].content, assistantMsg.content);
    assert.deepEqual(history[1].sources, assistantMsg.sources);
  });

  test('4. Conversational Turns Extraction: Returns formatted turns for Groq prompt context', async () => {
    const turns = await chatHistory.getRecentTurns(testUserId1, testDocId1, 6);
    assert.equal(turns.length, 2);
    assert.deepEqual(turns[0], {
      role: 'user',
      content: 'What is the attention mechanism in Transformers?',
    });
    assert.equal(turns[1].role, 'assistant');
  });

  test('5. Multi-User and Multi-Document Strict Isolation', async () => {
    // User 1 on Doc 1 has 2 messages. User 2 on Doc 1 should have 0 messages.
    const user2History = await chatHistory.getHistory(testUserId2, testDocId1);
    assert.equal(user2History.length, 0, 'User 2 must not see User 1 chat history');

    // User 1 on Doc 2 should have 0 messages
    const user1Doc2History = await chatHistory.getHistory(testUserId1, testDocId2);
    assert.equal(user1Doc2History.length, 0, 'Doc 2 must not contain Doc 1 chat history');
  });

  test('6. Clear History: Wipes messages for specific document without affecting others', async () => {
    // Seed message on Doc 2
    await chatHistory.saveMessage(testUserId1, testDocId2, {
      role: 'user',
      content: 'Independent query on document 2',
    });

    // Clear history on Doc 1
    const cleared = await chatHistory.clearHistory(testUserId1, testDocId1);
    assert.equal(cleared, true);

    const doc1AfterClear = await chatHistory.getHistory(testUserId1, testDocId1);
    assert.equal(doc1AfterClear.length, 0);

    // Doc 2 must still remain intact
    const doc2History = await chatHistory.getHistory(testUserId1, testDocId2);
    assert.equal(doc2History.length, 1);
    assert.equal(doc2History[0].content, 'Independent query on document 2');

    // Clean up Doc 2
    await chatHistory.clearHistory(testUserId1, testDocId2);
  });
});
