-- ============================================================
-- Migration 0015: Fix RLS infinite recursion on user_profiles
-- Runs AFTER 0014_ai_requests.sql
-- ============================================================
--
-- ROOT CAUSE
-- ──────────
-- Every policy on user_profiles (and most policies on other tables)
-- contains a subquery of the form:
--
--   (SELECT org_id FROM user_profiles WHERE id = auth.uid())
--   (SELECT role  FROM user_profiles WHERE id = auth.uid())
--
-- When PostgreSQL evaluates a policy on user_profiles it must first
-- execute the USING/WITH CHECK expression.  That expression queries
-- user_profiles — the SAME table currently under RLS evaluation.
-- PostgreSQL sees the re-entrant access and raises:
--
--   ERROR: infinite recursion detected in policy for relation "user_profiles"
--
-- This happens because RLS policies are enforced even for the inner
-- subquery, creating an unbounded call stack:
--
--   SELECT from user_profiles
--     → enforce profiles_select_same_org
--       → SELECT org_id FROM user_profiles   ← same table, RLS re-applied
--         → enforce profiles_select_same_org
--           → SELECT org_id FROM user_profiles …  (infinite)
--
-- AFFECTED POLICIES (full inventory)
-- ───────────────────────────────────
-- Table              Policy                            Recursive subquery
-- ─────────────────  ────────────────────────────────  ─────────────────────────────────────
-- user_profiles      profiles_select_same_org          SELECT org_id FROM user_profiles
-- user_profiles      profiles_update_own               SELECT role  FROM user_profiles
-- user_profiles      profiles_insert_admin             SELECT role  FROM user_profiles
-- organizations      org_select_own                    SELECT org_id FROM user_profiles
-- roles              roles_select_org_members          SELECT org_id FROM user_profiles
-- permissions        permissions_select_org_members    SELECT org_id FROM user_profiles
-- user_roles         user_roles_select_admin           SELECT role  FROM user_profiles
--                                                      SELECT org_id FROM user_profiles
-- documents          documents_select_org_members      SELECT org_id FROM user_profiles
-- documents          documents_insert_authorized       SELECT org_id / role FROM user_profiles
-- documents          documents_update_authorized       SELECT org_id / role FROM user_profiles
-- documents          documents_delete_admin            SELECT role  FROM user_profiles
-- workflows          workflows_select_org_members      SELECT org_id FROM user_profiles
-- workflows          workflows_insert_authorized       SELECT org_id / role FROM user_profiles
-- reports            reports_select_org_members        SELECT org_id FROM user_profiles
-- violations         violations_select_org_members     SELECT org_id FROM user_profiles
-- audit_logs         audit_logs_select_privileged      SELECT org_id / role FROM user_profiles
-- security_events    security_events_select_privileged SELECT org_id / role FROM user_profiles
-- ai_requests        ai_requests_select_privileged     SELECT org_id / role FROM user_profiles
--
-- FIX STRATEGY: SECURITY DEFINER helper functions
-- ─────────────────────────────────────────────────
-- Create two SECURITY DEFINER functions that bypass RLS and read
-- user_profiles directly.  All policies are rewritten to call these
-- functions instead of embedding raw subqueries.
--
-- A SECURITY DEFINER function executes with the privileges of its
-- owner (the postgres superuser), NOT the calling role.  PostgreSQL
-- does NOT apply RLS when a superuser queries a table, so the
-- re-entrant access never occurs.
--
-- Security properties preserved:
--   ✓ Multi-tenant isolation (org_id check intact on every policy)
--   ✓ RBAC (role check intact on every policy)
--   ✓ RLS is NOT disabled on any table
--   ✓ Functions are not callable by anonymous users in a meaningful way
--     (they return NULL when auth.uid() is NULL)
-- ============================================================

-- ============================================================
-- STEP 1: SECURITY DEFINER helper functions
-- ============================================================

-- Returns the org_id of the currently authenticated user.
-- Returns NULL if the user is not authenticated or has no profile.
CREATE OR REPLACE FUNCTION auth_user_org_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT org_id
  FROM user_profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

-- Returns the role of the currently authenticated user.
-- Returns NULL if the user is not authenticated or has no profile.
CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS user_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM user_profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

-- ============================================================
-- STEP 2: user_profiles policies
-- Drop all three recursive policies and recreate them.
-- ============================================================

DROP POLICY IF EXISTS "profiles_select_same_org" ON user_profiles;
DROP POLICY IF EXISTS "profiles_update_own"       ON user_profiles;
DROP POLICY IF EXISTS "profiles_insert_admin"     ON user_profiles;

-- Read: all profiles within the caller's org
CREATE POLICY "profiles_select_same_org"
  ON user_profiles FOR SELECT
  USING (
    org_id = auth_user_org_id()
  );

-- Update: own row only; role column must not change
CREATE POLICY "profiles_update_own"
  ON user_profiles FOR UPDATE
  USING  (id = auth.uid())
  WITH CHECK (
    id   = auth.uid()
    AND role = auth_user_role()
  );

-- Insert: service_role only (seed / Edge Functions)
-- auth.uid() IS NULL when the request is made with the service_role key.
CREATE POLICY "profiles_insert_admin"
  ON user_profiles FOR INSERT
  WITH CHECK (
    auth_user_role() = 'super_admin'
    OR auth.uid() IS NULL
  );

-- ============================================================
-- STEP 3: organizations policy
-- ============================================================

DROP POLICY IF EXISTS "org_select_own" ON organizations;

CREATE POLICY "org_select_own"
  ON organizations FOR SELECT
  USING (
    id = auth_user_org_id()
  );

-- ============================================================
-- STEP 4: roles policies
-- ============================================================

DROP POLICY IF EXISTS "roles_select_org_members" ON roles;

CREATE POLICY "roles_select_org_members"
  ON roles FOR SELECT
  USING (
    org_id = auth_user_org_id()
  );

-- ============================================================
-- STEP 5: permissions policies
-- ============================================================

DROP POLICY IF EXISTS "permissions_select_org_members" ON permissions;

CREATE POLICY "permissions_select_org_members"
  ON permissions FOR SELECT
  USING (
    role_id IN (
      SELECT id FROM roles
      WHERE org_id = auth_user_org_id()
    )
  );

-- ============================================================
-- STEP 6: user_roles policies
-- ============================================================

DROP POLICY IF EXISTS "user_roles_select_own"   ON user_roles;
DROP POLICY IF EXISTS "user_roles_select_admin"  ON user_roles;

-- Own assignments: always readable
CREATE POLICY "user_roles_select_own"
  ON user_roles FOR SELECT
  USING (user_id = auth.uid());

-- Admin view: super_admin and compliance_officer see all org assignments
CREATE POLICY "user_roles_select_admin"
  ON user_roles FOR SELECT
  USING (
    auth_user_role() IN ('super_admin', 'compliance_officer')
    AND role_id IN (
      SELECT id FROM roles WHERE org_id = auth_user_org_id()
    )
  );

-- ============================================================
-- STEP 7: documents policies
-- ============================================================

DROP POLICY IF EXISTS "documents_select_org_members"  ON documents;
DROP POLICY IF EXISTS "documents_insert_authorized"   ON documents;
DROP POLICY IF EXISTS "documents_update_authorized"   ON documents;
DROP POLICY IF EXISTS "documents_delete_admin"        ON documents;

CREATE POLICY "documents_select_org_members"
  ON documents FOR SELECT
  USING (
    org_id = auth_user_org_id()
    AND status != 'deleted'
  );

CREATE POLICY "documents_insert_authorized"
  ON documents FOR INSERT
  WITH CHECK (
    org_id = auth_user_org_id()
    AND auth_user_role() IN ('super_admin', 'compliance_officer')
  );

CREATE POLICY "documents_update_authorized"
  ON documents FOR UPDATE
  USING (
    org_id = auth_user_org_id()
    AND (
      uploaded_by = auth.uid()
      OR auth_user_role() = 'super_admin'
    )
  );

CREATE POLICY "documents_delete_admin"
  ON documents FOR DELETE
  USING (
    auth_user_role() = 'super_admin'
    AND org_id = auth_user_org_id()
  );

-- ============================================================
-- STEP 8: workflows policies
-- ============================================================

DROP POLICY IF EXISTS "workflows_select_org_members" ON workflows;
DROP POLICY IF EXISTS "workflows_insert_authorized"  ON workflows;

CREATE POLICY "workflows_select_org_members"
  ON workflows FOR SELECT
  USING (
    org_id = auth_user_org_id()
  );

CREATE POLICY "workflows_insert_authorized"
  ON workflows FOR INSERT
  WITH CHECK (
    org_id = auth_user_org_id()
    AND auth_user_role() IN ('super_admin', 'compliance_officer')
  );

-- ============================================================
-- STEP 9: reports policies
-- ============================================================

DROP POLICY IF EXISTS "reports_select_org_members" ON reports;

CREATE POLICY "reports_select_org_members"
  ON reports FOR SELECT
  USING (
    org_id = auth_user_org_id()
  );

-- ============================================================
-- STEP 10: violations policies
-- ============================================================

DROP POLICY IF EXISTS "violations_select_org_members" ON violations;

CREATE POLICY "violations_select_org_members"
  ON violations FOR SELECT
  USING (
    org_id = auth_user_org_id()
  );

-- ============================================================
-- STEP 11: audit_logs policies
-- ============================================================

DROP POLICY IF EXISTS "audit_logs_select_privileged" ON audit_logs;

CREATE POLICY "audit_logs_select_privileged"
  ON audit_logs FOR SELECT
  USING (
    org_id = auth_user_org_id()
    AND auth_user_role() IN ('super_admin', 'compliance_officer', 'auditor')
  );

-- ============================================================
-- STEP 12: security_events policies
-- ============================================================

DROP POLICY IF EXISTS "security_events_select_privileged" ON security_events;

CREATE POLICY "security_events_select_privileged"
  ON security_events FOR SELECT
  USING (
    org_id = auth_user_org_id()
    AND auth_user_role() IN ('super_admin', 'security_analyst', 'compliance_officer', 'auditor')
  );

-- ============================================================
-- STEP 13: ai_requests policies
-- ============================================================

DROP POLICY IF EXISTS "ai_requests_select_privileged" ON ai_requests;

CREATE POLICY "ai_requests_select_privileged"
  ON ai_requests FOR SELECT
  USING (
    org_id = auth_user_org_id()
    AND auth_user_role() IN ('super_admin', 'compliance_officer')
  );

-- ============================================================
-- VERIFICATION QUERIES
-- Run each SELECT; all should return the stated result.
-- ============================================================

-- 1. Both helper functions exist as SECURITY DEFINER
-- Expected: 2 rows
SELECT proname, prosecdef
FROM pg_proc
WHERE proname IN ('auth_user_org_id', 'auth_user_role')
  AND prosecdef = true;

-- 2. No policy on any table still uses a raw subquery against user_profiles
--    (should return 0 rows after this migration)
SELECT schemaname, tablename, policyname, qual, with_check
FROM pg_policies
WHERE
  (qual       LIKE '%FROM user_profiles%' OR qual       LIKE '%user_profiles%')
  OR
  (with_check LIKE '%FROM user_profiles%' OR with_check LIKE '%user_profiles%');

-- 3. All expected policies still exist
-- Expected: at minimum 18 rows (one per policy recreated above)
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 4. Smoke-test: query user_profiles as an authenticated user
--    (run AFTER signing in via Supabase Auth — should return your own profile)
-- SELECT id, org_id, role FROM user_profiles LIMIT 1;
