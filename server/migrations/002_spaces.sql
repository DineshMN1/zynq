-- ===========================================
-- SPACES
-- ===========================================
CREATE TABLE spaces (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  description TEXT,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===========================================
-- SPACE MEMBERS
-- role: viewer | contributor | admin
-- ===========================================
CREATE TABLE space_members (
  space_id UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role     TEXT NOT NULL DEFAULT 'contributor',
  added_by UUID REFERENCES users(id) ON DELETE SET NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (space_id, user_id)
);

-- ===========================================
-- SPACE ACTIVITY (audit log)
-- action: upload|delete|rename|move|member_added|member_role_changed|member_removed
-- ===========================================
CREATE TABLE space_activity (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  space_id   UUID NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  action     TEXT NOT NULL,
  file_id    UUID,          -- nullable (member events have no file)
  file_name  TEXT,          -- denormalized: survives file deletion
  details    JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===========================================
-- Add space_id to files (NULL = personal file)
-- ===========================================
ALTER TABLE files ADD COLUMN space_id UUID REFERENCES spaces(id) ON DELETE CASCADE;

-- ===========================================
-- INDEXES
-- ===========================================
CREATE INDEX idx_files_space_id         ON files(space_id) WHERE space_id IS NOT NULL;
CREATE INDEX idx_space_members_user_id  ON space_members(user_id);
CREATE INDEX idx_space_activity_space   ON space_activity(space_id, created_at DESC);
CREATE INDEX idx_space_activity_user    ON space_activity(user_id);
