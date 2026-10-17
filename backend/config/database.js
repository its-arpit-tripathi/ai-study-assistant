import pg from 'pg';

const { Pool } = pg;
let pool;

export function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required. Configure PostgreSQL before starting the app.');
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === 'disable' ? false : { rejectUnauthorized: false },
      max: Number(process.env.PG_POOL_MAX || 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
    pool.on('error', (err) => console.error('Unexpected PostgreSQL pool error:', err.message));
  }
  return pool;
}

export async function initDatabase() {
  const db = getPool();
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS notebooks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL DEFAULT 'My Notebook',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(user_id, name)
    );
    CREATE TABLE IF NOT EXISTS documents (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      notebook_id UUID NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      collection_name TEXT NOT NULL UNIQUE,
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      chunk_count INTEGER NOT NULL DEFAULT 0 CHECK (chunk_count >= 0),
      content_hash TEXT,
      version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1)
    );
    CREATE INDEX IF NOT EXISTS documents_user_notebook_idx ON documents(user_id, notebook_id);
    CREATE TABLE IF NOT EXISTS document_chunks (
      chunk_id TEXT PRIMARY KEY,
      document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      collection_name TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS document_chunks_document_idx ON document_chunks(user_id, document_id);
    CREATE INDEX IF NOT EXISTS document_chunks_fts_idx ON document_chunks USING GIN (to_tsvector('english', content));
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      sources JSONB DEFAULT '[]'::jsonb,
      verification JSONB DEFAULT NULL,
      model TEXT DEFAULT NULL,
      usage JSONB DEFAULT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS usage JSONB DEFAULT NULL;
    CREATE INDEX IF NOT EXISTS chat_messages_user_doc_idx ON chat_messages(user_id, document_id, created_at ASC);
  `);
  return db;
}
