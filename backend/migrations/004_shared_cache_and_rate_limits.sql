-- Migration 004: Shared Cache and Multi-Replica Rate Limiting Coordination
-- Enables multi-replica shared answer caching and coordinated rate limiting across nodes.

CREATE TABLE IF NOT EXISTS shared_cache (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS shared_cache_expires_idx ON shared_cache(expires_at);

CREATE TABLE IF NOT EXISTS shared_rate_limits (
  key TEXT PRIMARY KEY,
  points INTEGER NOT NULL DEFAULT 1,
  reset_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS shared_rate_limits_reset_idx ON shared_rate_limits(reset_at);
