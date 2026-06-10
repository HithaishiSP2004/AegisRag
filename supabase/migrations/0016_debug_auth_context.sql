-- ============================================================
-- Migration 0016: debug_auth_context — temporary diagnostic
-- Purpose: Prove exactly what auth.uid(), auth_user_org_id(),
--          and auth_user_role() return inside the authenticated
--          Postgres session that performs the documents INSERT.
--
-- Called from service.ts registerDocument() via:
--   supabase.rpc('debug_auth_context')
-- using the SAME user-JWT createClient() that will run the INSERT.
--
-- REMOVE this migration once the RLS investigation is complete.
-- Drop with:  DROP FUNCTION IF EXISTS public.debug_auth_context();
-- ============================================================

CREATE OR REPLACE FUNCTION public.debug_auth_context()
RETURNS TABLE (
  auth_uid  uuid,
  org_id    uuid,
  role      user_role
)
LANGUAGE sql
-- NOT SECURITY DEFINER — we want to see the actual caller's context,
-- not the superuser's context. Running as the caller is the whole point.
STABLE
SET search_path = public
AS $$
  SELECT
    auth.uid()           AS auth_uid,
    auth_user_org_id()   AS org_id,
    auth_user_role()     AS role;
$$;

-- Grant execute to the anon and authenticated roles so the user-JWT
-- client can call it via supabase.rpc().
GRANT EXECUTE ON FUNCTION public.debug_auth_context() TO anon, authenticated;

-- ── Verification ──────────────────────────────────────────────────────────────
-- Run in SQL Editor as an authenticated user (sign in first) to confirm
-- the function exists and is callable:
--
--   SELECT * FROM debug_auth_context();
--
-- Expected output when called via SQL Editor (service_role context):
--   auth_uid | org_id | role
--   NULL     | NULL   | NULL
--
-- Expected output when called via the app with a signed-in user:
--   auth_uid = <the user's UUID>
--   org_id   = <the org's UUID>
--   role     = 'super_admin' (or 'compliance_officer')
--
-- If auth_uid is NULL when called from the app, the JWT is not reaching
-- the Postgres session — confirming the root cause of the RLS failure.
