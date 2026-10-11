import { getPool } from '../config/database.js';

export class ChunkModel {
  static async storeChunks(userId, documentId, collectionName, chunks) {
    if (!Array.isArray(chunks) || chunks.length === 0) return;
    const db = getPool();
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM document_chunks WHERE user_id = $1 AND document_id = $2', [userId, documentId]);

      const insertText = `
        INSERT INTO document_chunks (chunk_id, document_id, user_id, collection_name, content, metadata)
        VALUES ($1, $2, $3, $4, $5, $6)
      `;

      for (let i = 0; i < chunks.length; i++) {
        const c = chunks[i];
        const chunkId = c.metadata?.chunkId || `${documentId}:${i}`;
        const content = String(c.pageContent ?? '');
        const meta = { ...(c.metadata || {}), chunkId };
        await client.query(insertText, [chunkId, documentId, userId, collectionName, content, JSON.stringify(meta)]);
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  static async loadAllChunksForDocument(userId, documentId) {
    const db = getPool();
    const { rows } = await db.query(
      `SELECT chunk_id as "chunkId", document_id as "documentId",
              collection_name as "collectionName", content, metadata
       FROM document_chunks
       WHERE user_id = $1 AND document_id = $2
       ORDER BY created_at ASC`,
      [userId, documentId]
    );
    return rows;
  }

  static async searchChunksByKeyword(userId, documentId, query, limit = 30) {
    const db = getPool();
    const { rows } = await db.query(
      `SELECT chunk_id as "chunkId", content, metadata,
              ts_rank_cd(to_tsvector('english', content), plainto_tsquery('english', $1)) as rank
       FROM document_chunks
       WHERE user_id = $2 AND document_id = $3
         AND to_tsvector('english', content) @@ plainto_tsquery('english', $1)
       ORDER BY rank DESC
       LIMIT $4`,
      [query, userId, documentId, limit]
    );
    return rows;
  }
}
