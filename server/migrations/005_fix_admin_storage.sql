-- Fix storage_limit for admin/owner accounts that were incorrectly
-- assigned the 10 GB default due to a GORM zero-value insert bug.
-- Admin and owner roles always have unlimited storage (storage_limit = 0).
UPDATE users SET storage_limit = 0 WHERE role IN ('admin', 'owner') AND storage_limit != 0;

-- Also change the column default to 0 so future migrations start clean.
-- Per-user quotas are set explicitly by the application, not by the DB default.
ALTER TABLE users ALTER COLUMN storage_limit SET DEFAULT 0;
