-- ============================================================
-- Migration 0036: Advanced Retrieval & Telemetry
-- ============================================================

-- 1. Add new telemetry columns to retrieval_evals
ALTER TABLE retrieval_evals 
  ADD COLUMN IF NOT EXISTS vector_candidates INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reranked_candidates INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS context_tokens_saved INT DEFAULT 0;

-- 2. Drop existing match_chunks function signatures
DROP FUNCTION IF EXISTS match_chunks(vector(768), UUID, INT, FLOAT, TEXT, TEXT, TEXT);

-- Define multi-corpus aware match_chunks
CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding       vector(768),
  match_org_id          UUID,
  match_user_id         UUID    DEFAULT NULL,
  match_user_role       TEXT    DEFAULT NULL,
  match_count           INT     DEFAULT 20,
  match_threshold       FLOAT   DEFAULT 0.40,
  filter_department     TEXT    DEFAULT NULL,
  filter_doc_type       TEXT    DEFAULT NULL,
  filter_sensitivity    TEXT    DEFAULT NULL,
  filter_framework      TEXT    DEFAULT NULL,
  filter_classification TEXT    DEFAULT NULL,
  filter_document_id    UUID    DEFAULT NULL,
  filter_organization_id UUID   DEFAULT NULL
)
RETURNS TABLE (
  chunk_id    UUID,
  document_id UUID,
  page_id     UUID,
  org_id      UUID,
  content     TEXT,
  metadata    JSONB,
  similarity  FLOAT
)
LANGUAGE SQL STABLE PARALLEL SAFE
AS $$
  SELECT
    c.id          AS chunk_id,
    c.document_id,
    c.page_id,
    c.org_id,
    c.content,
    c.metadata,
    1 - (e.embedding <=> query_embedding) AS similarity
  FROM embeddings e
  JOIN chunks c ON c.id = e.chunk_id
  JOIN documents d ON d.id = c.document_id
  WHERE
    -- Multi-Corpus isolation:
    -- Global documents are public, org/user documents are secured
    (
      match_user_role = 'super_admin'
      OR d.classification = 'global'
      OR (d.classification = 'organization' AND d.org_id = match_org_id)
      OR (d.classification = 'user' AND d.org_id = match_org_id AND (match_user_id IS NULL OR d.uploaded_by = match_user_id))
    )
    -- Minimum similarity threshold
    AND 1 - (e.embedding <=> query_embedding) >= match_threshold
    -- Document must be indexed
    AND d.status = 'indexed'
    -- Metadata filters
    AND (filter_department     IS NULL OR c.metadata->>'department' = filter_department)
    AND (filter_doc_type       IS NULL OR c.metadata->>'doc_type' = filter_doc_type OR c.metadata->>'docType' = filter_doc_type)
    AND (filter_sensitivity    IS NULL OR c.metadata->>'sensitivity' = ANY(
          CASE filter_sensitivity
            WHEN 'public'       THEN ARRAY['public']
            WHEN 'internal'     THEN ARRAY['public', 'internal']
            WHEN 'confidential' THEN ARRAY['public', 'internal', 'confidential']
            WHEN 'restricted'   THEN ARRAY['public', 'internal', 'confidential', 'restricted']
            ELSE ARRAY[filter_sensitivity]
          END
        ))
    AND (filter_framework      IS NULL OR d.framework = filter_framework)
    AND (filter_classification IS NULL OR d.classification::text = filter_classification)
    AND (filter_document_id    IS NULL OR d.id = filter_document_id)
    AND (filter_organization_id IS NULL OR d.org_id = filter_organization_id)
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- 3. Drop existing search_chunks_keyword function signatures
DROP FUNCTION IF EXISTS search_chunks_keyword(TEXT, UUID, INT, TEXT, TEXT, TEXT);

-- Define multi-corpus aware search_chunks_keyword
CREATE OR REPLACE FUNCTION search_chunks_keyword(
  query_text            TEXT,
  match_org_id          UUID,
  match_user_id         UUID    DEFAULT NULL,
  match_user_role       TEXT    DEFAULT NULL,
  match_count           INT     DEFAULT 10,
  filter_department     TEXT    DEFAULT NULL,
  filter_doc_type       TEXT    DEFAULT NULL,
  filter_sensitivity    TEXT    DEFAULT NULL,
  filter_framework      TEXT    DEFAULT NULL,
  filter_classification TEXT    DEFAULT NULL,
  filter_document_id    UUID    DEFAULT NULL,
  filter_organization_id UUID   DEFAULT NULL
)
RETURNS TABLE (
  chunk_id    UUID,
  document_id UUID,
  page_id     UUID,
  org_id      UUID,
  content     TEXT,
  metadata    JSONB,
  similarity  FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tsq tsquery;
BEGIN
  tsq := websearch_to_tsquery('english', query_text);
  IF tsq IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH ranked AS (
    SELECT
      c.id                                      AS cid,
      c.document_id                             AS doc_id,
      c.page_id                                 AS pg_id,
      c.org_id                                  AS oid,
      c.content                                 AS body,
      c.metadata                                AS meta,
      ts_rank_cd(c.search_vector, tsq)          AS raw_rank
    FROM chunks c
    JOIN documents d ON d.id = c.document_id
    WHERE
      -- Multi-Corpus isolation:
      (
        match_user_role = 'super_admin'
        OR d.classification = 'global'
        OR (d.classification = 'organization' AND d.org_id = match_org_id)
        OR (d.classification = 'user' AND d.org_id = match_org_id AND (match_user_id IS NULL OR d.uploaded_by = match_user_id))
      )
      AND c.search_vector @@ tsq
      AND d.status = 'indexed'
      AND (filter_department     IS NULL OR c.metadata->>'department' = filter_department)
      AND (filter_doc_type       IS NULL OR c.metadata->>'doc_type' = filter_doc_type OR c.metadata->>'docType' = filter_doc_type)
      AND (filter_sensitivity    IS NULL OR c.metadata->>'sensitivity' = filter_sensitivity)
      AND (filter_framework      IS NULL OR d.framework = filter_framework)
      AND (filter_classification IS NULL OR d.classification::text = filter_classification)
      AND (filter_document_id    IS NULL OR d.id = filter_document_id)
      AND (filter_organization_id IS NULL OR d.org_id = filter_organization_id)
    ORDER BY raw_rank DESC
    LIMIT match_count
  ),
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

GRANT EXECUTE ON FUNCTION search_chunks_keyword TO authenticated;
GRANT EXECUTE ON FUNCTION search_chunks_keyword TO service_role;

-- 4. Drop existing get_retrieval_stats function
DROP FUNCTION IF EXISTS get_retrieval_stats(UUID, INT);

-- Define updated get_retrieval_stats with telemetry fields
CREATE OR REPLACE FUNCTION get_retrieval_stats(
  p_org_id UUID,
  p_days   INT DEFAULT 7
)
RETURNS TABLE (
  total_queries          BIGINT,
  hybrid_pct             NUMERIC(5,2),
  vector_pct             NUMERIC(5,2),
  keyword_pct            NUMERIC(5,2),
  avg_groundedness        NUMERIC(4,3),
  avg_citation_hit_rate   NUMERIC(4,3),
  hallucination_rate_pct  NUMERIC(5,2),
  avg_total_latency_ms    NUMERIC(10,2),
  avg_vector_latency_ms   NUMERIC(10,2),
  avg_keyword_latency_ms  NUMERIC(10,2),
  avg_chunk_count         NUMERIC(6,2),
  avg_vector_candidates   NUMERIC(6,2),
  avg_reranked_candidates  NUMERIC(6,2),
  avg_tokens_saved        NUMERIC(10,2)
)
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*) AS total_queries,
    ROUND(100.0 * COUNT(*) FILTER (WHERE retrieval_mode = 'hybrid') / NULLIF(COUNT(*), 0), 2) AS hybrid_pct,
    ROUND(100.0 * COUNT(*) FILTER (WHERE retrieval_mode = 'vector') / NULLIF(COUNT(*), 0), 2) AS vector_pct,
    ROUND(100.0 * COUNT(*) FILTER (WHERE retrieval_mode = 'keyword') / NULLIF(COUNT(*), 0), 2) AS keyword_pct,
    ROUND(AVG(groundedness_score)::NUMERIC, 3) AS avg_groundedness,
    ROUND(AVG(citation_hit_rate)::NUMERIC, 3) AS avg_citation_hit_rate,
    ROUND(100.0 * COUNT(*) FILTER (WHERE hallucination_flag = true) / NULLIF(COUNT(*), 0), 2) AS hallucination_rate_pct,
    ROUND(AVG(total_latency_ms)::NUMERIC, 2) AS avg_total_latency_ms,
    ROUND(AVG(vector_latency_ms)::NUMERIC, 2) AS avg_vector_latency_ms,
    ROUND(AVG(keyword_latency_ms)::NUMERIC, 2) AS avg_keyword_latency_ms,
    ROUND(AVG(chunk_count)::NUMERIC, 2) AS avg_chunk_count,
    ROUND(AVG(COALESCE(vector_candidates, 0))::NUMERIC, 2) AS avg_vector_candidates,
    ROUND(AVG(COALESCE(reranked_candidates, 0))::NUMERIC, 2) AS avg_reranked_candidates,
    ROUND(AVG(COALESCE(context_tokens_saved, 0))::NUMERIC, 2) AS avg_tokens_saved
  FROM retrieval_evals
  WHERE org_id = p_org_id
    AND created_at >= now() - (p_days || ' days')::INTERVAL;
$$;
