-- Migration 002: Explicit Workspace & Notebook Collaboration Memberships
-- Adds role-based tenant access control (owner, editor, viewer) for shared notebooks.

CREATE TABLE IF NOT EXISTS notebook_members (
  notebook_id UUID NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'editor', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (notebook_id, user_id)
);

CREATE INDEX IF NOT EXISTS notebook_members_user_idx ON notebook_members(user_id);
CREATE INDEX IF NOT EXISTS notebook_members_notebook_idx ON notebook_members(notebook_id);

-- Backfill existing notebook creators as 'owner'
INSERT INTO notebook_members (notebook_id, user_id, role)
SELECT id, user_id, 'owner'
FROM notebooks
ON CONFLICT (notebook_id, user_id) DO NOTHING;
