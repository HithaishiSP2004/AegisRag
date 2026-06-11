-- ============================================================
-- Migration 0034: Global Corpus Foundation
-- ============================================================

-- 1. Create document classification enum
CREATE TYPE document_classification AS ENUM ('global', 'organization', 'user');

-- 2. Add columns to documents table
ALTER TABLE documents 
  ADD COLUMN classification document_classification NOT NULL DEFAULT 'organization',
  ADD COLUMN framework TEXT CHECK (framework IN ('GDPR', 'HIPAA', 'SOC2', 'ISO27001', 'NIST', 'OWASP_LLM_TOP_10', 'EU_AI_ACT', 'SECURITY_FRAMEWORKS', 'RESEARCH_PAPERS'));

-- 3. Create indexes for the new columns to support massive scaling (5000+ pages)
CREATE INDEX idx_documents_classification ON documents(classification);
CREATE INDEX idx_documents_framework ON documents(framework) WHERE framework IS NOT NULL;

-- 4. Recreate/Update RLS Policies for documents table
DROP POLICY IF EXISTS "documents_select_org_members" ON documents;
DROP POLICY IF EXISTS "documents_insert_authorized" ON documents;
DROP POLICY IF EXISTS "documents_update_authorized" ON documents;
DROP POLICY IF EXISTS "documents_delete_admin" ON documents;
DROP POLICY IF EXISTS "documents_soft_delete_authorized" ON documents;

-- SELECT policy: Allows reading global documents, or org documents for members, or user documents for owners.
CREATE POLICY "documents_select_authorized"
  ON documents FOR SELECT
  USING (
    status != 'deleted' AND (
      classification = 'global'
      OR auth_user_role() = 'super_admin'
      OR (classification = 'organization' AND org_id = auth_user_org_id())
      OR (classification = 'user' AND uploaded_by = auth.uid())
    )
  );

-- INSERT policy: Super Admin can insert anything; Compliance Officers can insert org/user documents in their org.
CREATE POLICY "documents_insert_authorized"
  ON documents FOR INSERT
  WITH CHECK (
    (classification = 'global' AND auth_user_role() = 'super_admin')
    OR
    (classification IN ('organization', 'user') AND org_id = auth_user_org_id() AND auth_user_role() IN ('super_admin', 'compliance_officer'))
  );

-- UPDATE policy: Super Admin can update any document; owners can update organization/user documents in their org.
CREATE POLICY "documents_update_authorized"
  ON documents FOR UPDATE
  USING (
    (classification = 'global' AND auth_user_role() = 'super_admin')
    OR
    (classification IN ('organization', 'user') AND org_id = auth_user_org_id() AND (uploaded_by = auth.uid() OR auth_user_role() = 'super_admin'))
  )
  WITH CHECK (
    (classification = 'global' AND auth_user_role() = 'super_admin')
    OR
    (classification IN ('organization', 'user') AND org_id = auth_user_org_id())
  );

-- Soft-delete policy: compliance_officer and super_admin may mark any non-global org document as deleted.
CREATE POLICY "documents_soft_delete_authorized"
  ON documents FOR UPDATE
  USING (
    (classification = 'global' AND auth_user_role() = 'super_admin')
    OR
    (classification IN ('organization', 'user') AND org_id = auth_user_org_id() AND auth_user_role() IN ('super_admin', 'compliance_officer'))
  )
  WITH CHECK (
    status = 'deleted'
  );

-- DELETE policy: Only Super Admins can hard delete.
CREATE POLICY "documents_delete_admin"
  ON documents FOR DELETE
  USING (
    auth_user_role() = 'super_admin'
  );

-- 5. Recreate/Update RLS Policies for pages, chunks, and embeddings to inherit global access
DROP POLICY IF EXISTS "pages_select_org_members" ON pages;
DROP POLICY IF EXISTS "chunks_select_org_members" ON chunks;
DROP POLICY IF EXISTS "embeddings_select_org_members" ON embeddings;

CREATE POLICY "pages_select_authorized" ON pages FOR SELECT USING (
  org_id = auth_user_org_id()
  OR auth_user_role() = 'super_admin'
  OR EXISTS (
    SELECT 1 FROM documents
    WHERE documents.id = pages.document_id
      AND documents.classification = 'global'
  )
);

CREATE POLICY "chunks_select_authorized" ON chunks FOR SELECT USING (
  org_id = auth_user_org_id()
  OR auth_user_role() = 'super_admin'
  OR EXISTS (
    SELECT 1 FROM documents
    WHERE documents.id = chunks.document_id
      AND documents.classification = 'global'
  )
);

CREATE POLICY "embeddings_select_authorized" ON embeddings FOR SELECT USING (
  org_id = auth_user_org_id()
  OR auth_user_role() = 'super_admin'
  OR EXISTS (
    SELECT 1 FROM documents JOIN chunks ON chunks.id = embeddings.chunk_id
    WHERE documents.id = chunks.document_id
      AND documents.classification = 'global'
  )
);

-- 6. Create Views for separated documents (global, organization, user)
CREATE OR REPLACE VIEW global_documents WITH (security_invoker = true) AS
  SELECT * FROM documents WHERE classification = 'global';

CREATE OR REPLACE VIEW organization_documents WITH (security_invoker = true) AS
  SELECT * FROM documents WHERE classification = 'organization';

CREATE OR REPLACE VIEW user_documents WITH (security_invoker = true) AS
  SELECT * FROM documents WHERE classification = 'user';

-- 7. Design schemas for views that map all required metadata to pages and chunks
CREATE OR REPLACE VIEW document_pages WITH (security_invoker = true) AS
  SELECT 
    p.id AS page_id,
    p.document_id,
    p.page_number,
    p.raw_text,
    p.word_count,
    p.status,
    p.error_message,
    d.classification,
    d.framework,
    d.uploaded_by,
    d.created_at AS upload_date
  FROM pages p
  JOIN documents d ON p.document_id = d.id;

CREATE OR REPLACE VIEW document_chunks WITH (security_invoker = true) AS
  SELECT 
    c.id AS chunk_id,
    c.document_id,
    p.page_number,
    c.content,
    c.token_count,
    c.metadata,
    d.classification,
    d.framework,
    d.uploaded_by,
    d.created_at AS upload_date
  FROM chunks c
  JOIN pages p ON c.page_id = p.id
  JOIN documents d ON c.document_id = d.id;

-- 8. Add function to count total stats for Super Admins
CREATE OR REPLACE FUNCTION get_global_corpus_stats()
RETURNS TABLE (
  total_documents   BIGINT,
  total_pages       BIGINT,
  total_chunks      BIGINT,
  total_embeddings  BIGINT
)
LANGUAGE SQL STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(*) FROM documents  WHERE status = 'indexed'),
    (SELECT COUNT(*) FROM pages      WHERE status = 'embedded'),
    (SELECT COUNT(*) FROM chunks),
    (SELECT COUNT(*) FROM embeddings);
$$;
