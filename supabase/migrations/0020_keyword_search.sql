-- ============================================================
-- Migration 0020: keyword search support
--
-- Adds full-text search to the chunks table using Postgres
-- tsvector. This is the fallback retrieval path when vector
-- embeddings are unavailable (embedding_failed or no API key).
--
-- Design:
--   chunks.search_vector  tsvector, populated by trigger
--   GIN index for fast @@ queries
--   search_chunks_keyword() function — returns ranked results
--   in the same shape as the vector match_chunks() function so
--   the application layer can treat them interchangeably.
-- ============================================================

-- ── 1. Add tsvector column ────────────────────────────────────
ALTER TABLE chunks
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;

-- ── 2. GIN index for fast full-text queries ───────────────────
CREATE INDEX IF NOT EXISTS idx_chunks_search_vector
  ON chunks USING gin(search_vector);

-- ── 3. Keyword search function ────────────────────────────────
-- Returns the same columns as match_chunks() so callers can
-- union or swap them without changing application code.
CREATE OR REPLACE FUNCTION search_chunks_keyword(
  query_text    TEXT,
  match_org_id  UUID,
  match_count   INT  DEFAULT 10,
  filter_department   TEXT DEFAULT NULL,
  filter_doc_type     TEXT DEFAULT NULL,
  filter_sensitivity  TEXT DEFAULT NULL
)
RETURNS TABLE (
  chunk_id    UUID,
  document_id UUID,
  page_id     UUID,
  org_id      UUID,
  content     TEXT,
  metadata    JSONB,
  similarity  FLOAT   -- ts_rank normalised to 0–1 range
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tsq tsquery;
  max_rank FLOAT;
BEGIN
  -- Build query: phrase → plain websearch for robustness
  tsq := websearch_to_tsquery('english', query_text);

  -- Guard: empty/invalid query returns nothing
  IF tsq IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH ranked AS (
    SELECT
      c.id                                      AS cid,    -- renamed: avoids collision with RETURNS TABLE column "chunk_id"
      c.document_id                             AS doc_id,
      c.page_id                                 AS pg_id,
      c.org_id                                  AS oid,
      c.content                                 AS body,
      c.metadata                                AS meta,
      ts_rank_cd(c.search_vector, tsq)          AS raw_rank
    FROM chunks c
    WHERE
      c.org_id = match_org_id
      AND c.search_vector @@ tsq
      AND (filter_department  IS NULL OR c.metadata->>'department'  = filter_department)
      AND (filter_doc_type    IS NULL OR c.metadata->>'doc_type'    = filter_doc_type)
      AND (filter_sensitivity IS NULL OR c.metadata->>'sensitivity' = filter_sensitivity)
    ORDER BY raw_rank DESC
    LIMIT match_count
  ),
  -- Normalise raw_rank to [0, 1] so scores are comparable with
  -- cosine-similarity scores from vector search.
  normalised AS (
    SELECT
      r.cid,
      r.doc_id,
      r.pg_id,
      r.oid,
      r.body,
      r.meta,
      r.raw_rank,
      MAX(r.raw_rank) OVER () AS max_r
    FROM ranked r
  )
  SELECT
    n.cid                                                                      AS chunk_id,
    n.doc_id                                                                   AS document_id,
    n.pg_id                                                                    AS page_id,
    n.oid                                                                      AS org_id,
    n.body                                                                     AS content,
    n.meta                                                                     AS metadata,
    CASE WHEN n.max_r = 0 THEN 0::FLOAT ELSE (n.raw_rank / n.max_r)::FLOAT END AS similarity
  FROM normalised n;
END;
$$;

-- ── 4. Grant execute to authenticated + service_role ──────────
GRANT EXECUTE ON FUNCTION search_chunks_keyword TO authenticated;
GRANT EXECUTE ON FUNCTION search_chunks_keyword TO service_role;

-- ── 5. Backfill existing chunks (generated column auto-fills) ─
-- The GENERATED ALWAYS AS … STORED column is populated on
-- INSERT/UPDATE. Existing rows need a dummy update to trigger it.
-- Safe to run: touches no user-visible data.
UPDATE chunks SET content = content WHERE search_vector IS NULL;
