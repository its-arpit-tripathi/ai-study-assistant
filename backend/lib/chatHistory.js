import { getRedisClient, isRedisAvailable } from './redis.js';
import { getPool } from '../config/database.js';

// In-memory fallback LRU cache for standalone unit tests or when neither Redis nor Postgres is available
class InMemoryChatStore {
  #store = new Map();
  #maxDocs = 200;

  get(key) {
    const item = this.#store.get(key);
    if (!item) return [];
    return structuredClone(item);
  }

  set(key, messages) {
    this.#store.delete(key);
    this.#store.set(key, structuredClone(messages));
    while (this.#store.size > this.#maxDocs) {
      this.#store.delete(this.#store.keys().next().value);
    }
  }

  append(key, message, maxMessages = 100) {
    const list = this.get(key);
    list.push(message);
    const trimmed = list.slice(-maxMessages);
    this.set(key, trimmed);
    return trimmed;
  }

  delete(key) {
    this.#store.delete(key);
  }

  clear() {
    this.#store.clear();
  }
}

const memoryFallback = new InMemoryChatStore();

export function getChatKey(userId, documentId) {
  return `notebook:chat:${userId}:${documentId}`;
}

export const chatHistory = {
  /**
   * Save a single chat message (user or assistant) to Redis and PostgreSQL.
   */
  async saveMessage(userId, documentId, rawMessage) {
    if (!userId || !documentId || !rawMessage) return null;

    const role = rawMessage.role === 'assistant' ? 'assistant' : 'user';
    const content = typeof rawMessage.content === 'string' ? rawMessage.content : String(rawMessage.content || '');
    if (!content.trim() && role === 'user') return null;

    const message = {
      id: rawMessage.id || `${role === 'user' ? 'u' : 'a'}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      role,
      content,
      sources: Array.isArray(rawMessage.sources) ? rawMessage.sources : [],
      verification: rawMessage.verification || null,
      model: rawMessage.model || null,
      timestamp: rawMessage.timestamp || new Date().toISOString(),
    };

    const key = getChatKey(userId, documentId);

    // 1. Update in-memory fallback store
    memoryFallback.append(key, message, 100);

    // 2. Persist to Redis if available
    const redis = getRedisClient();
    if (isRedisAvailable() && redis) {
      try {
        await redis.rpush(key, JSON.stringify(message));
        await redis.ltrim(key, -100, -1);
        await redis.expire(key, 30 * 24 * 3600); // 30 days retention
      } catch (err) {
        // Non-blocking error logging
        console.warn(`[ChatHistory][Redis] Failed to append message to Redis: ${err.message}`);
      }
    }

    // 3. Durable persistence to PostgreSQL
    try {
      const db = getPool();
      await db.query(
        `INSERT INTO chat_messages (id, user_id, document_id, role, content, sources, verification, model, created_at)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9)
         ON CONFLICT (id) DO UPDATE SET
           content = EXCLUDED.content,
           sources = EXCLUDED.sources,
           verification = EXCLUDED.verification,
           model = EXCLUDED.model`,
        [
          message.id,
          userId,
          documentId,
          message.role,
          message.content,
          JSON.stringify(message.sources),
          JSON.stringify(message.verification),
          message.model,
          message.timestamp,
        ]
      );
    } catch {
      // Standalone mode or DB pool unavailable during disconnected tests
    }

    return message;
  },

  /**
   * Retrieve chat history for a given user and document.
   * Checks Redis first for sub-millisecond retrieval, falling back to PostgreSQL if Redis is empty/offline.
   */
  async getHistory(userId, documentId, limit = 50) {
    if (!userId || !documentId) return [];
    const max = Math.max(1, Math.min(200, Number(limit) || 50));
    const key = getChatKey(userId, documentId);

    // 1. Try Redis primary high-speed store
    const redis = getRedisClient();
    if (isRedisAvailable() && redis) {
      try {
        const rawItems = await redis.lrange(key, -max, -1);
        if (Array.isArray(rawItems) && rawItems.length > 0) {
          const parsed = [];
          for (const item of rawItems) {
            try {
              if (item && typeof item === 'object') {
                parsed.push(item);
              } else if (typeof item === 'string') {
                parsed.push(JSON.parse(item));
              }
            } catch {}
          }
          if (parsed.length > 0) {
            return parsed;
          }
        }
      } catch (err) {
        console.warn(`[ChatHistory][Redis] Read failed: ${err.message}. Falling back to PostgreSQL.`);
      }
    }

    // 2. Query PostgreSQL if Redis returned no results or is unavailable
    try {
      const db = getPool();
      const { rows } = await db.query(
        `SELECT id, role, content, sources, verification, model, created_at AS timestamp
         FROM chat_messages
         WHERE user_id = $1 AND document_id = $2
         ORDER BY created_at ASC
         LIMIT $3`,
        [userId, documentId, max]
      );

      if (rows && rows.length > 0) {
        const formatted = rows.map((r) => ({
          id: r.id,
          role: r.role,
          content: r.content,
          sources: r.sources || [],
          verification: r.verification || null,
          model: r.model || null,
          timestamp: r.timestamp instanceof Date ? r.timestamp.toISOString() : r.timestamp,
        }));

        // Backfill Redis cache asynchronously for subsequent fast reads
        if (isRedisAvailable() && redis) {
          (async () => {
            try {
              await redis.del(key);
              for (const m of formatted) {
                await redis.rpush(key, JSON.stringify(m));
              }
              await redis.expire(key, 30 * 24 * 3600);
            } catch {}
          })();
        }

        return formatted;
      }
    } catch {
      // Standalone mode / DB pool unavailable
    }

    // 3. Fallback to memory store (useful in isolated tests)
    const memList = memoryFallback.get(key);
    return memList.slice(-max);
  },

  /**
   * Clear chat history for a specific document and user in both Redis and PostgreSQL.
   */
  async clearHistory(userId, documentId) {
    if (!userId || !documentId) return false;
    const key = getChatKey(userId, documentId);

    // 1. Delete from memory fallback
    memoryFallback.delete(key);

    // 2. Delete from Redis
    const redis = getRedisClient();
    if (isRedisAvailable() && redis) {
      try {
        await redis.del(key);
      } catch (err) {
        console.warn(`[ChatHistory][Redis] Delete key failed: ${err.message}`);
      }
    }

    // 3. Delete from PostgreSQL
    try {
      const db = getPool();
      await db.query(
        `DELETE FROM chat_messages WHERE user_id = $1 AND document_id = $2`,
        [userId, documentId]
      );
    } catch {
      // Standalone mode
    }

    return true;
  },

  /**
   * Retrieve recent conversation turns formatted for LLM prompts.
   */
  async getRecentTurns(userId, documentId, maxTurns = 6) {
    const history = await this.getHistory(userId, documentId, maxTurns);
    return history
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant'))
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));
  },
};
