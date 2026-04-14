-- ===========================================
-- NOTIFICATION CHANNELS
-- ===========================================
CREATE TABLE IF NOT EXISTS notification_channels (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  name       TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('email', 'teams', 'resend')),
  config     JSONB NOT NULL DEFAULT '{}',
  actions    TEXT NOT NULL DEFAULT '[]',
  enabled    BOOLEAN NOT NULL DEFAULT true
);
