import { getPool } from '../config/database.js';

export class DocumentModel {
  static async getDefaultNotebookId(client, userId) {
    const { rows } = await client.query(
      `INSERT INTO notebooks (user_id, name)
       VALUES ($1, 'My Notebook')
       ON CONFLICT (user_id, name) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [userId]
    );
    return rows[0].id;
  }

  static _mapRow(row) {
    if (!row) return null;
    const count = Number(row.chunkCount ?? row.chunk_count ?? row.chunks ?? 0);
    return {
      ...row,
      chunkCount: count,
      chunks: count,
      chunk_count: count,
    };
  }

  static async findAllByUser(userId) {
    const db = getPool();
    const { rows } = await db.query(
      `SELECT id, name, collection_name as "collectionName",
              uploaded_at as "uploadedAt", chunk_count as "chunkCount",
              version, storage_key as "storageKey",
              storage_provider as "storageProvider", mime_type as "mimeType",
              size_bytes as "sizeBytes", status,
              error_message as "errorMessage", retry_count as "retryCount"
       FROM documents
       WHERE user_id = $1
       ORDER BY uploaded_at DESC`,
      [userId]
    );
    return rows.map((r) => this._mapRow(r));
  }

  static async findById(userId, documentId) {
    const db = getPool();
    const { rows } = await db.query(
      `SELECT id, name, collection_name as "collectionName",
              uploaded_at as "uploadedAt", chunk_count as "chunkCount",
              version, storage_key as "storageKey",
              storage_provider as "storageProvider", mime_type as "mimeType",
              size_bytes as "sizeBytes", status,
              error_message as "errorMessage", retry_count as "retryCount",
              content_hash as "contentHash"
       FROM documents
       WHERE user_id = $1 AND id = $2`,
      [userId, documentId]
    );
    return this._mapRow(rows[0]);
  }

  static async findByCollection(userId, collectionName) {
    const db = getPool();
    const { rows } = await db.query(
      `SELECT id, name, collection_name as "collectionName",
              uploaded_at as "uploadedAt", chunk_count as "chunkCount",
              version, storage_key as "storageKey",
              storage_provider as "storageProvider", mime_type as "mimeType",
              size_bytes as "sizeBytes", status,
              error_message as "errorMessage", retry_count as "retryCount",
              content_hash as "contentHash"
       FROM documents
       WHERE user_id = $1 AND collection_name = $2`,
      [userId, collectionName]
    );
    return this._mapRow(rows[0]);
  }

  static async findByHash(userId, contentHash) {
    if (!contentHash) return null;
    const db = getPool();
    const { rows } = await db.query(
      `SELECT id, name, collection_name as "collectionName",
              uploaded_at as "uploadedAt", chunk_count as "chunkCount",
              version, storage_key as "storageKey",
              storage_provider as "storageProvider", mime_type as "mimeType",
              size_bytes as "sizeBytes", status,
              error_message as "errorMessage", retry_count as "retryCount",
              content_hash as "contentHash"
       FROM documents
       WHERE user_id = $1 AND content_hash = $2
       LIMIT 1`,
      [userId, contentHash]
    );
    return this._mapRow(rows[0]);
  }

  static async create(userId, doc) {
    const db = getPool();
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const notebookId = await this.getDefaultNotebookId(client, userId);
      const { rows } = await client.query(
        `INSERT INTO documents (
           id, user_id, notebook_id, name, collection_name, uploaded_at,
           chunk_count, content_hash, version, storage_key, storage_provider,
           mime_type, size_bytes, status
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, $9, $10, $11, $12, $13)
         ON CONFLICT (collection_name) DO UPDATE SET
           name = EXCLUDED.name,
           uploaded_at = EXCLUDED.uploaded_at,
           chunk_count = EXCLUDED.chunk_count,
           content_hash = EXCLUDED.content_hash,
           version = documents.version + 1,
           storage_key = EXCLUDED.storage_key,
           storage_provider = EXCLUDED.storage_provider,
           mime_type = EXCLUDED.mime_type,
           size_bytes = EXCLUDED.size_bytes,
           status = EXCLUDED.status
         RETURNING id, name, collection_name as "collectionName",
                   uploaded_at as "uploadedAt", chunk_count as "chunkCount",
                   version, storage_key as "storageKey",
                   storage_provider as "storageProvider", mime_type as "mimeType",
                   size_bytes as "sizeBytes", status`,
        [
          doc.id,
          userId,
          notebookId,
          doc.name,
          doc.collectionName,
          doc.uploadedAt,
          doc.chunkCount ?? 0,
          doc.contentHash || null,
          doc.storageKey || null,
          doc.storageProvider || 'local',
          doc.mimeType || 'application/pdf',
          doc.sizeBytes || 0,
          doc.status || 'indexed',
        ]
      );
      await client.query('COMMIT');
      return this._mapRow(rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  static async updateStatus(id, { status, chunkCount, errorMessage = null, retryCount = 0 }) {
    const db = getPool();
    const { rows } = await db.query(
      `UPDATE documents
       SET status = $1,
           chunk_count = COALESCE($2, chunk_count),
           error_message = $3,
           retry_count = $4
       WHERE id = $5
       RETURNING id, status, chunk_count as "chunkCount", error_message as "errorMessage"`,
      [status, chunkCount ?? null, errorMessage, retryCount, id]
    );
    return this._mapRow(rows[0]);
  }

  static async delete(userId, documentId) {
    const db = getPool();
    const { rows } = await db.query(
      'DELETE FROM documents WHERE user_id = $1 AND id = $2 RETURNING id, storage_key as "storageKey", collection_name as "collectionName"',
      [userId, documentId]
    );
    return rows[0] || null;
  }
}
