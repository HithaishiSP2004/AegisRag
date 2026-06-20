-- Migration 0047: Waiting Provider Queue State & Auto-Resume
-- 1. Add 'waiting_provider' value to embedding_job_status enum
ALTER TYPE embedding_job_status ADD VALUE IF NOT EXISTS 'waiting_provider';

-- 2. Add 'waiting_provider' value to document_status enum
ALTER TYPE document_status ADD VALUE IF NOT EXISTS 'waiting_provider' AFTER 'processing';

-- 3. Add next_retry_at column to embedding_jobs table
ALTER TABLE embedding_jobs ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;

-- 4. Recreate dequeue_next_embedding_job() function to support wait timers
CREATE OR REPLACE FUNCTION dequeue_next_embedding_job()
RETURNS TABLE (
  job_id       UUID,
  doc_id       UUID,
  organization_id UUID,
  tot_chunks   INT,
  proc_chunks  INT,
  last_chunk   INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_job_id UUID;
BEGIN
  -- Select next queued job, processing job stuck >15m, or suspended job whose retry time has passed
  SELECT id INTO next_job_id
  FROM embedding_jobs
  WHERE status = 'queued'
     OR (status = 'processing' AND started_at < now() - INTERVAL '15 minutes')
     OR (status = 'waiting_provider' AND (next_retry_at IS NULL OR next_retry_at <= now()))
  ORDER BY priority ASC, created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF next_job_id IS NOT NULL THEN
    -- Lock and transition to processing, resetting retry parameters
    UPDATE embedding_jobs
    SET 
      status = 'processing',
      started_at = now(),
      error_message = NULL,
      next_retry_at = NULL
    WHERE id = next_job_id;

    -- Atomically update document status to 'processing'
    UPDATE documents
    SET 
      status = 'processing',
      updated_at = now()
    WHERE id = (SELECT document_id FROM embedding_jobs WHERE id = next_job_id);

    RETURN QUERY
    SELECT 
      id AS job_id,
      document_id AS doc_id,
      org_id AS organization_id,
      total_chunks AS tot_chunks,
      processed_chunks AS proc_chunks,
      last_processed_chunk AS last_chunk
    FROM embedding_jobs
    WHERE id = next_job_id;
  END IF;
END;
$$;
