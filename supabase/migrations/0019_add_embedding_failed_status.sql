-- ============================================================
-- Migration 0019: add embedding_failed to document_status enum
--
-- Postgres enums are immutable once created — you cannot drop a
-- value, only add one. ALTER TYPE … ADD VALUE is the safe path.
--
-- 'embedding_failed' sits between 'indexed' and 'failed' in the
-- lifecycle: pages and chunks are preserved; only embeddings are
-- missing. The document can be retried via POST /api/documents/
-- [id]/process which resets status back to 'parsing'.
-- ============================================================

-- Add the new enum value (idempotent when run against an already-
-- migrated DB because IF NOT EXISTS is supported in Postgres 14+)
ALTER TYPE document_status ADD VALUE IF NOT EXISTS 'embedding_failed' AFTER 'indexed';

-- Update the comment on the column to reflect the new value
COMMENT ON COLUMN documents.error_message IS
  'Populated when status = ''failed'' or status = ''embedding_failed''. '
  'Pages and chunks remain intact for embedding_failed documents.';
