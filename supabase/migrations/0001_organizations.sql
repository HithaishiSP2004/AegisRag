-- ============================================================
-- Migration 0001: organizations
-- Run FIRST — foundational table all others FK into
-- ============================================================
-- ✅ SELF-CONTAINED: No references to any other application table.
--    The RLS policy for organizations is defined in 0002_user_profiles.sql
--    (after user_profiles exists) to avoid forward-reference parse errors.
-- ============================================================

-- Shared trigger function (used by all tables with updated_at)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Organization plan ENUM
CREATE TYPE org_plan AS ENUM ('free', 'pro', 'enterprise');

CREATE TABLE IF NOT EXISTS organizations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL CHECK (char_length(name) BETWEEN 2 AND 200),
  slug        TEXT        NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$'),
  plan        org_plan    NOT NULL DEFAULT 'enterprise',
  settings    JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Index: slug lookups
CREATE INDEX idx_organizations_slug ON organizations(slug);

-- ── Row Level Security ───────────────────────────────────────
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- ⚠️  NOTE: The SELECT policy "org_select_own" is intentionally NOT created here.
--     It references user_profiles (created in 0002), so it is defined in
--     0002_user_profiles.sql after that table exists.
--
-- Until 0002 runs, only service_role (superuser) can read organizations.
-- This is correct — no end-user queries run between migrations.
