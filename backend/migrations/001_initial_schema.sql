-- ===========================================
-- Enable UUID extension
-- ===========================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================
-- USERS
-- ===========================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  storage_used BIGINT DEFAULT 0,
  storage_limit BIGINT DEFAULT 10737418240, -- 10 GB
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===========================================
-- INVITATIONS (✅ updated: added updated_at)
-- ===========================================
CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  token UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
  role TEXT DEFAULT 'user',
  inviter_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),   -- ✅ required by backend
  expires_at TIMESTAMPTZ NOT NULL
);

-- ===========================================
-- FILES
-- ===========================================
CREATE TABLE files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  mime_type TEXT,
  size BIGINT DEFAULT 0,
  storage_path TEXT,
  parent_id UUID REFERENCES files(id) ON DELETE CASCADE,
  is_folder BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===========================================
-- SHARES (✅ includes public sharing support)
-- ===========================================
CREATE TABLE shares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_id UUID REFERENCES files(id) ON DELETE CASCADE NOT NULL,
  grantee_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  grantee_email TEXT,
  permission TEXT DEFAULT 'read',
  created_by UUID REFERENCES users(id) ON DELETE CASCADE,
  is_public BOOLEAN DEFAULT false,             -- ✅ public share flag
  share_token TEXT UNIQUE,                     -- ✅ unique public link token
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===========================================
-- SETTINGS
-- ===========================================
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===========================================
-- INDEXES
-- ===========================================
CREATE INDEX idx_files_owner_id ON files(owner_id);
CREATE INDEX idx_files_parent_id ON files(parent_id);
CREATE INDEX idx_files_deleted_at ON files(deleted_at);
CREATE INDEX idx_shares_file_id ON shares(file_id);
CREATE INDEX idx_shares_grantee_user_id ON shares(grantee_user_id);
CREATE INDEX idx_shares_share_token ON shares(share_token);
CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_status ON invitations(status);
CREATE INDEX idx_settings_user_id_key ON settings(user_id, key);

-- ===========================================
-- DEFAULT OWNER ACCOUNT
-- ===========================================
INSERT INTO users (name, email, password_hash, role)
VALUES (
  'Dinesh MN',
  'dinesh@zynq.in',
  '$2b$12$M9GlAluCxbrfvYGlVqLzw.metE4/uM5x/6HCnQhd..SEA2CPWMPui', -- bcrypt("supersecret")
  'owner'
);
