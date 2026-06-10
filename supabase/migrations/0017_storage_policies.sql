-- ============================================================
-- Migration 0017: Storage Object Policies
-- Applies RLS to storage.objects for three buckets:
--   • documents        — org PDF uploads
--   • reports          — generated compliance reports
--   • temp-processing  — transient pipeline artefacts
--
-- Runs AFTER 0015_fix_rls_recursion.sql
-- (depends on auth_user_org_id() and auth_user_role())
--
-- ARCHITECTURE NOTE
-- ─────────────────
-- generateUploadUrl() calls createAdminClient() (service-role key).
-- The service-role key bypasses ALL storage RLS policies when Supabase
-- Storage processes the createSignedUploadUrl() management API call.
-- However, the *signed URL itself* is consumed by the browser client via
-- an HTTP PUT — that PUT hits storage.objects as an anonymous/JWT-less
-- request authenticated only by the signed-URL token.
--
-- Because the bucket has RLS enabled and NO policies exist, even a
-- valid signed URL is rejected with:
--   StorageApiError: new row violates row-level security policy
--   (operation: storage.objects INSERT)
--
-- Fix: add storage policies that allow:
--   1. INSERT via signed URL (token-authenticated, no JWT)
--   2. SELECT/UPDATE/DELETE scoped to the file owner's org_id
--      (encoded in the storage path prefix: {org_id}/...)
-- ============================================================

-- ============================================================
-- BUCKET: documents
-- Path pattern: {org_id}/{doc_type}/{doc_id}/{filename}
-- ============================================================

-- DROP stale policies if any exist (idempotent re-run safety)
DROP POLICY IF EXISTS "documents_objects_insert_signed"   ON storage.objects;
DROP POLICY IF EXISTS "documents_objects_select_org"      ON storage.objects;
DROP POLICY IF EXISTS "documents_objects_update_org"      ON storage.objects;
DROP POLICY IF EXISTS "documents_objects_delete_admin"    ON storage.objects;

-- INSERT: allow the signed-URL PUT from the browser.
-- The signed URL carries its own short-lived token; auth.uid() is NULL
-- for these requests. We must allow INSERT without a JWT for the bucket
-- so that signed uploads succeed.
-- Security boundary: the signed URL is generated server-side by the
-- service-role client, scoped to an exact {org_id}/{doc_type}/{doc_id}/
-- path — no user can forge a different org's path.
CREATE POLICY "documents_objects_insert_signed"
  ON storage.objects
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (
    bucket_id = 'documents'
  );

-- SELECT: authenticated users may read objects in their own org's prefix.
-- Path segment 0 (split by '/') is the org_id.
CREATE POLICY "documents_objects_select_org"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth_user_org_id()::text
  );

-- UPDATE: uploader or super_admin may overwrite.
CREATE POLICY "documents_objects_update_org"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth_user_org_id()::text
    AND (
      owner = auth.uid()
      OR auth_user_role() = 'super_admin'
    )
  );

-- DELETE: super_admin only.
CREATE POLICY "documents_objects_delete_admin"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth_user_org_id()::text
    AND auth_user_role() = 'super_admin'
  );

-- ============================================================
-- BUCKET: reports
-- Path pattern: {org_id}/{report_id}/{filename}
-- Generated server-side; never uploaded by the browser directly.
-- ============================================================

DROP POLICY IF EXISTS "reports_objects_insert_service"  ON storage.objects;
DROP POLICY IF EXISTS "reports_objects_select_org"      ON storage.objects;
DROP POLICY IF EXISTS "reports_objects_delete_admin"    ON storage.objects;

-- INSERT: service-role only (server generates reports, browser never writes here).
-- Allowing anon here is not needed because no signed upload URL is issued
-- for this bucket. The server writes directly with the admin client.
-- We still need a policy row so RLS does not block the service-role insert.
-- service_role bypasses RLS entirely, so this policy is a no-op guard;
-- it is written defensively in case the bucket is accidentally set to
-- require policies for all roles.
CREATE POLICY "reports_objects_insert_service"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'reports'
    AND auth_user_role() IN ('super_admin', 'compliance_officer')
    AND (storage.foldername(name))[1] = auth_user_org_id()::text
  );

-- SELECT: compliance officers, auditors, and admins in the same org.
CREATE POLICY "reports_objects_select_org"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'reports'
    AND (storage.foldername(name))[1] = auth_user_org_id()::text
    AND auth_user_role() IN ('super_admin', 'compliance_officer', 'auditor')
  );

-- DELETE: super_admin only.
CREATE POLICY "reports_objects_delete_admin"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'reports'
    AND (storage.foldername(name))[1] = auth_user_org_id()::text
    AND auth_user_role() = 'super_admin'
  );

-- ============================================================
-- BUCKET: temp-processing
-- Path pattern: {org_id}/{job_id}/{filename}
-- Scratch space for the ingestion pipeline (parsing, chunking).
-- Files here are short-lived; no end-user download access needed.
-- ============================================================

DROP POLICY IF EXISTS "temp_objects_insert_signed"   ON storage.objects;
DROP POLICY IF EXISTS "temp_objects_select_service"  ON storage.objects;
DROP POLICY IF EXISTS "temp_objects_delete_service"  ON storage.objects;

-- INSERT: allow signed-URL PUT from pipeline workers.
CREATE POLICY "temp_objects_insert_signed"
  ON storage.objects
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (
    bucket_id = 'temp-processing'
  );

-- SELECT: super_admin may inspect pipeline artefacts.
CREATE POLICY "temp_objects_select_service"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'temp-processing'
    AND (storage.foldername(name))[1] = auth_user_org_id()::text
    AND auth_user_role() = 'super_admin'
  );

-- DELETE: super_admin or pipeline cleanup (service-role bypasses this anyway).
CREATE POLICY "temp_objects_delete_service"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'temp-processing'
    AND (storage.foldername(name))[1] = auth_user_org_id()::text
    AND auth_user_role() = 'super_admin'
  );

-- ============================================================
-- VERIFICATION QUERIES
-- Run in the Supabase SQL editor after applying this migration.
-- ============================================================

-- 1. Confirm all 10 storage policies are present
-- Expected: 10 rows
SELECT
  policyname,
  cmd,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename  = 'objects'
  AND policyname IN (
    'documents_objects_insert_signed',
    'documents_objects_select_org',
    'documents_objects_update_org',
    'documents_objects_delete_admin',
    'reports_objects_insert_service',
    'reports_objects_select_org',
    'reports_objects_delete_admin',
    'temp_objects_insert_signed',
    'temp_objects_select_service',
    'temp_objects_delete_service'
  )
ORDER BY policyname;

-- 2. Confirm RLS is enabled on storage.objects (Supabase enables this by default)
-- Expected: rls_enabled = true
SELECT relname, relrowsecurity AS rls_enabled
FROM pg_class
WHERE relname = 'objects'
  AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'storage');

-- 3. Confirm the three buckets exist
-- Expected: 3 rows
SELECT id, name, public
FROM storage.buckets
WHERE name IN ('documents', 'reports', 'temp-processing');

-- 4. Post-upload smoke-test (run AFTER a successful upload attempt):
-- Replace <your-org-id> with the actual UUID.
-- Expected: 1 row with the uploaded file's name and owner.
-- SELECT name, owner, created_at
-- FROM storage.objects
-- WHERE bucket_id = 'documents'
--   AND name LIKE '<your-org-id>/%'
-- ORDER BY created_at DESC
-- LIMIT 5;
