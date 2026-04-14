CREATE TABLE IF NOT EXISTS audit_logs (
    id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id      UUID,
    user_name    TEXT        NOT NULL DEFAULT '',
    user_email   TEXT        NOT NULL DEFAULT '',
    action       TEXT        NOT NULL,
    resource_type TEXT       NOT NULL DEFAULT '',
    resource_name TEXT       NOT NULL DEFAULT '',
    resource_id   TEXT       NOT NULL DEFAULT '',
    ip_address    TEXT       NOT NULL DEFAULT '',
    metadata      JSONB
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at  ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id     ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action      ON audit_logs (action);
