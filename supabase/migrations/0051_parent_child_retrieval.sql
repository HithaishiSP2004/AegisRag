-- ============================================================
-- Migration 0051: Parent-Child Retrieval Schema (Non-destructive)
-- Add self-referencing relationship for small-to-large chunking
-- and define new isolated parent-child RPC functions.
-- ============================================================

-- 1. Add parent_id column to chunks table (additive, nullable)
ALTER TABLE public.chunks
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.chunks(id) ON DELETE CASCADE;

-- Add comment explaining the column mapping
COMMENT ON COLUMN public.chunks.parent_id 
  IS 'Self-referential link mapping a child chunk to its parent chunk. NULL for parent chunks or standard single-level chunks.';

-- 2. Create index on parent_id to optimize parent resolution joins
CREATE INDEX IF NOT EXISTS idx_chunks_parent_id ON public.chunks(parent_id);

-- 3. Define new isolated match_chunks_parent_child function (current match_chunks is left untouched)
CREATE OR REPLACE FUNCTION public.match_chunks_parent_child(
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
  WITH matched_children AS (
    SELECT
      c.id          AS matched_id,
      c.parent_id   AS matched_parent_id,
      c.document_id AS matched_doc_id,
      c.page_id     AS matched_page_id,
      c.org_id      AS matched_org_id,
      c.content     AS matched_content,
      c.metadata    AS matched_metadata,
      1 - (e.embedding <=> query_embedding) AS sim
    FROM public.embeddings e
    JOIN public.chunks c ON c.id = e.chunk_id
    JOIN public.documents d ON d.id = c.document_id
    WHERE
      -- Multi-Corpus isolation:
      (
        match_user_role = 'super_admin'
        OR d.classification = 'global'
        OR (d.classification = 'organization' AND d.org_id = match_org_id)
        OR (d.classification = 'user' AND d.org_id = match_org_id AND (match_user_id IS NULL OR d.uploaded_by = match_user_id))
      )
      AND 1 - (e.embedding <=> query_embedding) >= match_threshold
      AND d.status = 'indexed'
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
    LIMIT match_count
  )
  SELECT
    COALESCE(p.id, mc.matched_id)              AS chunk_id,
    COALESCE(p.document_id, mc.matched_doc_id) AS document_id,
    COALESCE(p.page_id, mc.matched_page_id)     AS page_id,
    COALESCE(p.org_id, mc.matched_org_id)      AS org_id,
    COALESCE(p.content, mc.matched_content)    AS content,
    COALESCE(p.metadata, mc.matched_metadata)  AS metadata,
    mc.sim                                     AS similarity
  FROM matched_children mc
  LEFT JOIN public.chunks p ON p.id = mc.matched_parent_id;
$$;

GRANT EXECUTE ON FUNCTION public.match_chunks_parent_child TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_chunks_parent_child TO service_role;

-- 4. Define new isolated search_chunks_keyword_parent_child function (current search_chunks_keyword is left untouched)
CREATE OR REPLACE FUNCTION public.search_chunks_keyword_parent_child(
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
      c.parent_id                               AS pid,
      c.document_id                             AS doc_id,
      c.page_id                                 AS pg_id,
      c.org_id                                  AS oid,
      c.content                                 AS body,
      c.metadata                                AS meta,
      ts_rank_cd(c.search_vector, tsq)          AS raw_rank
    FROM public.chunks c
    JOIN public.documents d ON d.id = c.document_id
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
      r.pid,
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
    COALESCE(p.id, n.cid)                                                      AS chunk_id,
    COALESCE(p.document_id, n.doc_id)                                          AS document_id,
    COALESCE(p.page_id, n.pg_id)                                               AS page_id,
    COALESCE(p.org_id, n.oid)                                                  AS org_id,
    COALESCE(p.content, n.body)                                                AS content,
    COALESCE(p.metadata, n.meta)                                               AS metadata,
    CASE WHEN n.max_r = 0 THEN 0::FLOAT ELSE (n.raw_rank / n.max_r)::FLOAT END AS similarity
  FROM normalised n
  LEFT JOIN public.chunks p ON p.id = n.pid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_chunks_keyword_parent_child TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_chunks_keyword_parent_child TO service_role;
