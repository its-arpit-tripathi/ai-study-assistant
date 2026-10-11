import { randomUUID } from 'node:crypto';
import { getPool } from '../config/database.js';

async function getDefaultNotebook(db, userId) {
  const result = await db.query(
    `INSERT INTO notebooks(user_id,name) VALUES($1,'My Notebook')
     ON CONFLICT(user_id,name) DO UPDATE SET name=EXCLUDED.name
     RETURNING id`, [userId]
  );
  return result.rows[0].id;
}

export async function loadRegistry(userId) {
  const result = await getPool().query(
    `SELECT id, name, collection_name AS "collectionName", uploaded_at AS "uploadedAt", chunk_count AS "chunkCount", notebook_id AS "notebookId", version
     FROM documents WHERE user_id=$1 ORDER BY uploaded_at ASC`, [userId]
  );
  return result.rows.map((row) => ({ ...row, chunkCount: Number(row.chunkCount), version: Number(row.version) }));
}

export async function addDocument(userId, docEntry) {
  const db = getPool();
  const notebookId = await getDefaultNotebook(db, userId);
  const id = docEntry.id || randomUUID();
  const result = await db.query(
    `INSERT INTO documents(id,user_id,notebook_id,name,collection_name,uploaded_at,chunk_count,content_hash,version)
     VALUES($1,$2,$3,$4,$5,COALESCE($6::timestamptz,NOW()),$7,$8,1)
     RETURNING id,name,collection_name AS "collectionName",uploaded_at AS "uploadedAt",chunk_count AS "chunkCount",notebook_id AS "notebookId",version`,
    [id, userId, notebookId, docEntry.name, docEntry.collectionName, docEntry.uploadedAt || null, docEntry.chunkCount || 0, docEntry.contentHash || null]
  );
  const row = result.rows[0];
  return { ...row, chunkCount: Number(row.chunkCount), version: Number(row.version) };
}

export async function removeDocument(userId, docId) {
  const result = await getPool().query('DELETE FROM documents WHERE user_id=$1 AND id=$2 RETURNING id', [userId, docId]);
  return result.rowCount > 0;
}

export async function findDocument(userId, docId) {
  const result = await getPool().query(
    'SELECT id,name,collection_name AS "collectionName",uploaded_at AS "uploadedAt",chunk_count AS "chunkCount",notebook_id AS "notebookId",version FROM documents WHERE user_id=$1 AND id=$2',
    [userId, docId]
  );
  return result.rows[0] || null;
}
