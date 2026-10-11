-- Safe, additive PostgreSQL indexes for the current per-user/per-document model.
-- Run during a maintenance window for large tables; CREATE INDEX CONCURRENTLY
-- cannot run inside a transaction. This file is intentionally not auto-run by app boot.
CREATE INDEX CONCURRENTLY IF NOT EXISTS documents_user_collection_idx
  ON documents(user_id, collection_name);
CREATE INDEX CONCURRENTLY IF NOT EXISTS documents_user_id_id_idx
  ON documents(user_id, id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS document_chunks_user_document_idx
  ON document_chunks(user_id, document_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS document_chunks_collection_idx
  ON document_chunks(collection_name);
