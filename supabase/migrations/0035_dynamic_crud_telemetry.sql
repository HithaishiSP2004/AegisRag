-- ============================================================
-- Migration 0035: Dynamic CRUD Telemetry Functions
-- ============================================================

-- Drop existing functions before redefining
DROP FUNCTION IF EXISTS get_corpus_stats(UUID);
DROP FUNCTION IF EXISTS get_global_corpus_stats();

-- Define updated get_corpus_stats
CREATE OR REPLACE FUNCTION get_corpus_stats(p_org_id UUID)
RETURNS TABLE (
  total_documents   BIGINT,
  total_pages       BIGINT,
  total_chunks      BIGINT,
  total_embeddings  BIGINT,
  documents_added_today BIGINT,
  documents_updated_today BIGINT,
  documents_deleted_today BIGINT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    (SELECT COUNT(*) FROM documents  WHERE org_id = p_org_id AND status = 'indexed'),
    (SELECT COUNT(*) FROM pages      WHERE org_id = p_org_id AND status = 'embedded'),
    (SELECT COUNT(*) FROM chunks     WHERE org_id = p_org_id),
    (SELECT COUNT(*) FROM embeddings WHERE org_id = p_org_id),
    (SELECT COUNT(*) FROM audit_logs WHERE org_id = p_org_id AND action = 'DOCUMENT_CREATED' AND created_at >= CURRENT_DATE),
    (SELECT COUNT(*) FROM audit_logs WHERE org_id = p_org_id AND action = 'DOCUMENT_UPDATED' AND created_at >= CURRENT_DATE),
    (SELECT COUNT(*) FROM audit_logs WHERE org_id = p_org_id AND action = 'DOCUMENT_DELETED' AND created_at >= CURRENT_DATE);
$$;

-- Define updated get_global_corpus_stats
CREATE OR REPLACE FUNCTION get_global_corpus_stats()
RETURNS TABLE (
  total_documents   BIGINT,
  total_pages       BIGINT,
  total_chunks      BIGINT,
  total_embeddings  BIGINT,
  documents_added_today BIGINT,
  documents_updated_today BIGINT,
  documents_deleted_today BIGINT
)
LANGUAGE SQL STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(*) FROM documents  WHERE status = 'indexed'),
    (SELECT COUNT(*) FROM pages      WHERE status = 'embedded'),
    (SELECT COUNT(*) FROM chunks),
    (SELECT COUNT(*) FROM embeddings),
    (SELECT COUNT(*) FROM audit_logs WHERE action = 'DOCUMENT_CREATED' AND created_at >= CURRENT_DATE),
    (SELECT COUNT(*) FROM audit_logs WHERE action = 'DOCUMENT_UPDATED' AND created_at >= CURRENT_DATE),
    (SELECT COUNT(*) FROM audit_logs WHERE action = 'DOCUMENT_DELETED' AND created_at >= CURRENT_DATE);
$$;
