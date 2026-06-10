-- ============================================================
-- Migration 0002: user_profiles
-- Extends auth.users. Must run AFTER 0001_organizations.sql
-- ============================================================
-- Also defines the organizations SELECT policy (moved from 0001
-- because it requires user_profiles to exist at parse time).
-- ============================================================

-- User role ENUM
CREATE TYPE user_role AS ENUM (
  'super_admin',
  'compliance_officer',
  'security_analyst',
  'auditor',
  'executive'
);

CREATE TABLE IF NOT EXISTS user_profiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id      UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  full_name   TEXT        CHECK (char_length(full_name) <= 200),
  role        user_role   NOT NULL DEFAULT 'auditor',
  department  TEXT        CHECK (char_length(department) <= 100),
  avatar_url  TEXT        CHECK (char_length(avatar_url) <= 500),
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX idx_user_profiles_org_id    ON user_profiles(org_id);
CREATE INDEX idx_user_profiles_role      ON user_profiles(role);
CREATE INDEX idx_user_profiles_is_active ON user_profiles(is_active) WHERE is_active = true;

-- ── Auto-create profile hook (no-op — actual insert done in seed/signup flow) ─
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- NOTE: If "ERROR: must be owner of table users" occurs, skip this trigger.
-- Supabase restricts DDL on auth.users in some project configurations.
-- The function above will still exist and can be wired via Dashboard → Hooks.
CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

-- ── user_profiles RLS ────────────────────────────────────────
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can read all profiles within their org
CREATE POLICY "profiles_select_same_org"
  ON user_profiles FOR SELECT
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid())
  );

-- Users can update only their own profile (name, avatar — not role)
CREATE POLICY "profiles_update_own"
  ON user_profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = (SELECT role FROM user_profiles WHERE id = auth.uid())
  );

-- Insert handled via service_role only (seed scripts / Edge Functions)
CREATE POLICY "profiles_insert_admin"
  ON user_profiles FOR INSERT
  WITH CHECK (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'super_admin'
    OR auth.uid() IS NULL
  );

-- ── organizations RLS (defined HERE — requires user_profiles to exist) ───────
-- Moved from 0001 because PostgreSQL resolves subquery table references
-- at CREATE POLICY parse time, not at query execution time.
-- user_profiles now exists, so this policy is safe to create.
CREATE POLICY "org_select_own"
  ON organizations FOR SELECT
  USING (
    id IN (
      SELECT org_id FROM user_profiles WHERE id = auth.uid()
    )
  );
