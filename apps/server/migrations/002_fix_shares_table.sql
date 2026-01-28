-- ===========================================
-- FIX: Add missing columns to shares table
-- ===========================================
-- This migration adds the missing columns that the Share entity expects.
-- Run this if you already have a database with the old schema.

-- Add updated_at column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shares' AND column_name='updated_at') THEN
        ALTER TABLE shares ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
    END IF;
END $$;

-- Add expires_at column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shares' AND column_name='expires_at') THEN
        ALTER TABLE shares ADD COLUMN expires_at TIMESTAMPTZ;
    END IF;
END $$;

-- Add password column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='shares' AND column_name='password') THEN
        ALTER TABLE shares ADD COLUMN password TEXT;
    END IF;
END $$;

-- ===========================================
-- FIX: Add missing created_at column to settings table
-- ===========================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='settings' AND column_name='created_at') THEN
        ALTER TABLE settings ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();
    END IF;
END $$;
