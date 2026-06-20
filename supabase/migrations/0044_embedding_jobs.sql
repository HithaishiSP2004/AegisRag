-- Migration 0044: Background Embedding Queue Table & leasing RPC
-- Adds status values to enum and creates the background jobs table and locked leasing function.

-- 1. Add 'queued' and 'processing' to document_status enum
-- In Postgres, we must disable transactions or run separately if we cannot ALTER TYPE in transaction,
-- but standard migrations in Supabase handle ADD VALUE IF NOT EXISTS cleanly.
ALTER TYPE document_status ADD VALUE IF NOT EXISTS 'queued' AFTER 'chunking';
ALTER TYPE document_status ADD VALUE IF NOT EXISTS 'processing' AFTER 'queued';

-- 2. Create embedding_job_status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'embedding_job_status') THEN
    CREATE TYPE embedding_job_status AS ENUM (
      'queued',
      'processing',
      'completed',
      'failed'
    );
  END IF;
END
$$;

-- 3. Create embedding_jobs table
CREATE TABLE IF NOT EXISTS embedding_jobs (
  id                    UUID                 PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id           UUID                 NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  org_id                UUID                 NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  status                embedding_job_status NOT NULL DEFAULT 'queued',
  priority              INTEGER              NOT NULL DEFAULT 100 CHECK (priority >= 0),
  total_chunks          INTEGER              NOT NULL DEFAULT 0 CHECK (total_chunks >= 0),
  processed_chunks      INTEGER              NOT NULL DEFAULT 0 CHECK (processed_chunks >= 0),
  last_processed_chunk  INTEGER              NOT NULL DEFAULT 0 CHECK (last_processed_chunk >= 0),
  created_at            TIMESTAMPTZ          NOT NULL DEFAULT now(),
  started_at            TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  error_message         TEXT
);

-- 4. Enable Row Level Security (RLS) - admin/service-role access only
ALTER TABLE embedding_jobs ENABLE ROW LEVEL SECURITY;

-- 5. Indexes for background query performance
CREATE INDEX IF NOT EXISTS idx_embedding_jobs_status ON embedding_jobs(status);
CREATE INDEX IF NOT EXISTS idx_embedding_jobs_org_priority ON embedding_jobs(priority, created_at);
CREATE INDEX IF NOT EXISTS idx_embedding_jobs_document_id ON embedding_jobs(document_id);

-- 6. RPC function to lease next job atomically using Postgres row locking
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
  -- Select the next queued job, or a job stuck in 'processing' status for more than 15 minutes
  SELECT id INTO next_job_id
  FROM embedding_jobs
  WHERE status = 'queued'
     OR (status = 'processing' AND started_at < now() - INTERVAL '15 minutes')
  ORDER BY priority ASC, created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF next_job_id IS NOT NULL THEN
    -- Lock and transition to processing
    UPDATE embedding_jobs
    SET 
      status = 'processing',
      started_at = now(),
      error_message = NULL
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

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION dequeue_next_embedding_job TO authenticated;
GRANT EXECUTE ON FUNCTION dequeue_next_embedding_job TO service_role;
