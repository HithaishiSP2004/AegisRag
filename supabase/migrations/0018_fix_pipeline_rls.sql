-- ============================================================
-- Migration 0018: Fix pages/chunks/embeddings RLS recursion
-- and add document_versions SELECT policy.
--
-- pages, chunks, embeddings were created in 0006-0008 before the
-- SECURITY DEFINER helpers existed. Their policies still reference
-- user_profiles directly (recursion risk). Replace them all.
--
-- Depends on: 0015_fix_rls_recursion.sql
--   (auth_user_org_id() and auth_user_role() must exist)
-- ============================================================

-- ── pages ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "pages_select_org_members" ON pages;

CREATE POLICY "pages_select_org_members"
  ON pages FOR SELECT
  USING (org_id = auth_user_org_id());

-- Pipeline INSERT/UPDATE uses service-role (bypasses RLS). No policy needed.

-- ── chunks ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "chunks_select_org_members" ON chunks;

CREATE POLICY "chunks_select_org_members"
  ON chunks FOR SELECT
  USING (org_id = auth_user_org_id());

-- ── embeddings ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "embeddings_select_org_members" ON embeddings;

CREATE POLICY "embeddings_select_org_members"
  ON embeddings FOR SELECT
  USING (org_id = auth_user_org_id());

-- ── document_versions ────────────────────────────────────────────────────────
-- 0005 created the table but left no SELECT policy.
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "doc_versions_select_org_members" ON document_versions;

CREATE POLICY "doc_versions_select_org_members"
  ON document_versions FOR SELECT
  USING (
    document_id IN (
      SELECT id FROM documents WHERE org_id = auth_user_org_id()
    )
  );

-- ── VERIFICATION ─────────────────────────────────────────────────────────────
-- Expected: 4 rows (one per table above)
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND policyname IN (
    'pages_select_org_members',
    'chunks_select_org_members',
    'embeddings_select_org_members',
    'doc_versions_select_org_members'
  )
ORDER BY tablename;
