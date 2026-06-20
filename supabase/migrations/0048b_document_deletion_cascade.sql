-- =============================================================================
-- Migration 0048b: Phase 3C.1 — Ghost Resurrection Prevention
--
-- IMPORTANT: Run AFTER 0048a_add_cancelled_enum.sql is committed.
--
-- What this does:
--   1. Trigger: marks embedding_jobs as 'cancelled' when document is soft-deleted.
--      Pages, chunks, and embeddings are NOT touched (soft-delete stays reversible).
--
--   2. Hardens dequeue_next_embedding_job() with a deleted-document guard.
--
--   3. Retroactively cancels any orphaned jobs for already-deleted documents.
-- =============================================================================

-- ── 1. Trigger: cancel embedding_jobs on document soft-delete ─────────────────
CREATE OR REPLACE FUNCTION cancel_jobs_on_document_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only fire when status transitions TO 'deleted'
  IF NEW.status::TEXT = 'deleted'
     AND (OLD.status IS NULL OR OLD.status::TEXT <> 'deleted')
  THEN
    -- Cancel all active jobs for this document.
    -- 'cancelled' = user intent (vs 'failed' = system error). Clean telemetry.
    -- Job rows are preserved for audit trail.
    UPDATE embedding_jobs
    SET
      status        = 'cancelled',
      error_message = 'Document was deleted — job cancelled automatically.',
      completed_at  = now()
    WHERE document_id = NEW.id
      AND status IN ('queued', 'processing', 'waiting_provider');

  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cancel_jobs_on_document_delete ON documents;

CREATE TRIGGER trg_cancel_jobs_on_document_delete
  BEFORE UPDATE OF status ON documents
  FOR EACH ROW
  EXECUTE FUNCTION cancel_jobs_on_document_delete();

-- ── 2. Harden dequeue_next_embedding_job() with deleted-document guard ─────────
-- Adds JOIN to documents to skip jobs whose document is deleted.
-- Belt-and-suspenders alongside the trigger above.
CREATE OR REPLACE FUNCTION dequeue_next_embedding_job()
RETURNS TABLE (
  job_id          UUID,
  doc_id          UUID,
  organization_id UUID,
  tot_chunks      INT,
  proc_chunks     INT,
  last_chunk      INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_job_id UUID;
BEGIN
  -- Select next eligible job, skipping jobs whose document is deleted
  SELECT ej.id INTO next_job_id
  FROM embedding_jobs ej
  JOIN documents d ON d.id = ej.document_id
  WHERE (
      ej.status = 'queued'
      OR (ej.status = 'processing' AND ej.started_at < now() - INTERVAL '15 minutes')
      OR (ej.status = 'waiting_provider' AND (ej.next_retry_at IS NULL OR ej.next_retry_at <= now()))
    )
    -- Guard: never lease a job for a deleted document
    AND d.status::TEXT <> 'deleted'
  ORDER BY ej.priority ASC, ej.created_at ASC
  LIMIT 1
  FOR UPDATE OF ej SKIP LOCKED;

  IF next_job_id IS NOT NULL THEN
    UPDATE embedding_jobs
    SET
      status        = 'processing',
      started_at    = now(),
      error_message = NULL,
      next_retry_at = NULL
    WHERE id = next_job_id;

    UPDATE documents
    SET
      status     = 'processing',
      updated_at = now()
    WHERE id = (SELECT document_id FROM embedding_jobs WHERE id = next_job_id);

    RETURN QUERY
    SELECT
      id                    AS job_id,
      document_id           AS doc_id,
      org_id                AS organization_id,
      total_chunks          AS tot_chunks,
      processed_chunks      AS proc_chunks,
      last_processed_chunk  AS last_chunk
    FROM embedding_jobs
    WHERE id = next_job_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION dequeue_next_embedding_job          TO authenticated;
GRANT EXECUTE ON FUNCTION dequeue_next_embedding_job          TO service_role;
GRANT EXECUTE ON FUNCTION cancel_jobs_on_document_delete      TO service_role;

-- ── 3. Retroactively cancel orphaned jobs for already-deleted documents ─────────
-- Fixes jobs left orphaned by documents soft-deleted before this migration.
UPDATE embedding_jobs
SET
  status        = 'cancelled',
  error_message = 'Document was deleted — job retroactively cancelled by migration 0048b.',
  completed_at  = now()
WHERE document_id IN (
  SELECT id FROM documents WHERE status::TEXT = 'deleted'
)
AND status IN ('queued', 'processing', 'waiting_provider');
