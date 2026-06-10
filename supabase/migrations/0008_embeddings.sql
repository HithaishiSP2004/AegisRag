-- ============================================================
-- Migration 0008: embeddings + match_chunks function
-- CRITICAL: Run "CREATE EXTENSION IF NOT EXISTS vector;" FIRST
-- Runs AFTER 0007_chunks.sql
-- ============================================================

-- ── Embeddings table ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS embeddings (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id   UUID         NOT NULL UNIQUE REFERENCES chunks(id) ON DELETE CASCADE,
  org_id     UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- text-embedding-004 output: 768-dimensional float vectors
  embedding  vector(768)  NOT NULL,
  model_used TEXT         NOT NULL DEFAULT 'text-embedding-004'
                          CHECK (char_length(model_used) <= 100),
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
  -- NO updated_at: embeddings are immutable; re-embed = delete + insert
);

-- ── HNSW vector index ────────────────────────────────────────
-- Algorithm: Hierarchical Navigable Small World
-- operator: vector_cosine_ops (cosine similarity = 1 - cosine_distance)
-- m=16: max connections per node (higher = better quality, more memory)
-- ef_construction=64: build-time candidate list (higher = better quality, slower build)
-- For 5000 pages × ~10 chunks/page ≈ 50,000 vectors: these params are appropriate
CREATE INDEX idx_embeddings_hnsw
  ON embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Standard indexes
CREATE INDEX idx_embeddings_org_id   ON embeddings(org_id);
CREATE INDEX idx_embeddings_chunk_id ON embeddings(chunk_id);  -- chunk_id is UNIQUE but explicit idx helps joins

-- ── Row Level Security ───────────────────────────────────────
ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "embeddings_select_org_members"
  ON embeddings FOR SELECT
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid())
  );

-- ── match_chunks: core retrieval function ────────────────────
-- Called by the retrieval pipeline Edge Function.
-- Returns top-K chunks by cosine similarity, filtered by:
--   1. org_id isolation (mandatory — prevents cross-tenant data access)
--   2. department filter (RBAC — HR user cannot retrieve Finance chunks)
--   3. similarity threshold (quality gate — filters noise below 0.75)
--
-- Parameters:
--   query_embedding  : 768-dim vector of the user's query
--   match_org_id     : org_id from the authenticated user's profile
--   match_count      : number of candidates before reranking (default 20)
--   match_threshold  : minimum cosine similarity (default 0.75)
--   filter_department: if non-null, restricts to chunks of that department only
--   filter_doc_type  : if non-null, restricts to chunks of that doc_type only
--   filter_sensitivity: if non-null, restricts to chunks at or below this level
--
-- Returns ranked results ordered by similarity DESC (best first)
CREATE OR REPLACE FUNCTION match_chunks(
  query_embedding    vector(768),
  match_org_id       UUID,
  match_count        INT     DEFAULT 20,
  match_threshold    FLOAT   DEFAULT 0.75,
  filter_department  TEXT    DEFAULT NULL,
  filter_doc_type    TEXT    DEFAULT NULL,
  filter_sensitivity TEXT    DEFAULT NULL
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
    -- Mandatory: org isolation (primary security control)
    e.org_id = match_org_id

    -- Quality gate: reject low-similarity candidates before reranker
    AND 1 - (e.embedding <=> query_embedding) >= match_threshold

    -- Document must be indexed (not deleted/failed)
    AND d.status = 'indexed'

    -- Optional RBAC filters (passed from retrieval pipeline)
    AND (filter_department  IS NULL OR c.metadata->>'department' = filter_department)
    AND (filter_doc_type    IS NULL OR c.metadata->>'doc_type'   = filter_doc_type)
    AND (filter_sensitivity IS NULL OR c.metadata->>'sensitivity' = ANY(
          CASE filter_sensitivity
            WHEN 'public'       THEN ARRAY['public']
            WHEN 'internal'     THEN ARRAY['public', 'internal']
            WHEN 'confidential' THEN ARRAY['public', 'internal', 'confidential']
            WHEN 'restricted'   THEN ARRAY['public', 'internal', 'confidential', 'restricted']
            ELSE ARRAY[filter_sensitivity]
          END
        ))
  ORDER BY e.embedding <=> query_embedding  -- ascending distance = descending similarity
  LIMIT match_count;
$$;

-- ── Helper: count indexed chunks for an org ──────────────────
CREATE OR REPLACE FUNCTION get_corpus_stats(p_org_id UUID)
RETURNS TABLE (
  total_documents   BIGINT,
  total_pages       BIGINT,
  total_chunks      BIGINT,
  total_embeddings  BIGINT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    (SELECT COUNT(*) FROM documents  WHERE org_id = p_org_id AND status = 'indexed'),
    (SELECT COUNT(*) FROM pages      WHERE org_id = p_org_id AND status = 'embedded'),
    (SELECT COUNT(*) FROM chunks     WHERE org_id = p_org_id),
    (SELECT COUNT(*) FROM embeddings WHERE org_id = p_org_id);
$$;
