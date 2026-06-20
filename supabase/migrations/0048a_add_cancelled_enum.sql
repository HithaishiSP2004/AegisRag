-- =============================================================================
-- Migration 0048a: Add 'cancelled' to embedding_job_status enum
--
-- IMPORTANT: Run this file FIRST in Supabase SQL Editor.
-- Then run 0048b_document_deletion_cascade.sql in a SEPARATE query.
--
-- Reason: PostgreSQL requires ALTER TYPE ADD VALUE to be committed in its own
-- transaction before the new value can be referenced anywhere in the same
-- session. Running both in one SQL block causes:
--   ERROR 55P04: unsafe use of new value "cancelled" of enum type
-- =============================================================================

ALTER TYPE embedding_job_status ADD VALUE IF NOT EXISTS 'cancelled';
