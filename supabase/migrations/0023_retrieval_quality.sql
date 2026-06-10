-- ============================================================
-- Migration 0023: Sprint 4C — Retrieval Quality & Evaluation
--
-- Depends on:
--   0001_organizations.sql
--   0014_ai_requests.sql    (ai_requests table)
--   0015_fix_rls_recursion  (auth_user_org_id, auth_user_role)
--   0021_conversations.sql  (conversations, messages)
--
-- Changes:
--   1. Fix ai_requests.model_used CHECK constraint
--      (adds 'gemini-2.5-flash' — the actual current production model)
--   2. Create retrieval_evals table for per-query quality tracking
--   3. RLS on retrieval_evals
--   4. get_retrieval_stats() analytics function
-- ============================================================

-- ── 1. Fix ai_requests model constraint ───────────────────────
-- The existing CHECK only allowed old model names.
-- gemini-2.5-flash is the real current primary model (verified Sprint 4A).

ALTER TABLE ai_requests DROP CONSTRAINT IF EXISTS ai_requests_model_used_check;

ALTER TABLE ai_requests
  ADD CONSTRAINT ai_requests_model_used_check
  CHECK (model_used IN (
    'gemini-2.5-flash',        -- ✅ current primary generation model (Sprint 4A)
    'gemini-3.5-flash',        -- legacy (kept for historical rows)
    'gemini-3-flash',          -- legacy
    'gemini-3.1-flash-lite',   -- legacy
    'gemini-embedding-2',      -- ✅ current embedding model (Sprint 4A)
    'raw_chunk_fallback'       -- fallback: no AI used
  ));

-- ── 2. retrieval_evals — per-query quality tracking ───────────
-- Every assistant response can have one eval row.
-- Rows are immutable (no UPDATE/DELETE allowed).

CREATE TABLE IF NOT EXISTS retrieval_evals (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID        NOT NULL REFERENCES organizations(id)  ON DELETE CASCADE,
  conversation_id     UUID        REFERENCES conversations(id)           ON DELETE SET NULL,

  -- Query
  query_text          TEXT        NOT NULL CHECK (char_length(query_text) > 0),
  retrieval_mode      TEXT        NOT NULL CHECK (retrieval_mode IN ('vector', 'keyword', 'hybrid')),
  chunk_count         INT         NOT NULL DEFAULT 0 CHECK (chunk_count >= 0),

  -- Latency (ms); NULL when leg did not run
  vector_latency_ms   INT         CHECK (vector_latency_ms >= 0),
  keyword_latency_ms  INT         CHECK (keyword_latency_ms >= 0),
  fusion_latency_ms   INT         CHECK (fusion_latency_ms >= 0),
  rerank_latency_ms   INT         CHECK (rerank_latency_ms >= 0),
  total_latency_ms    INT         CHECK (total_latency_ms >= 0),

  -- Quality scores [0.0, 1.0]; NULL when eval was skipped
  groundedness_score  NUMERIC(4,3) CHECK (groundedness_score BETWEEN 0 AND 1),
  citation_hit_rate   NUMERIC(4,3) CHECK (citation_hit_rate  BETWEEN 0 AND 1),

  -- Hallucination detection
  hallucination_flag  BOOLEAN     NOT NULL DEFAULT false,

  -- Gemini evaluator reasoning (one sentence)
  eval_notes          TEXT        CHECK (char_length(eval_notes) <= 500),

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
  -- NO updated_at — append-only telemetry
);

-- ── Immutability ─────────────────────────────────────────────
CREATE OR REPLACE RULE retrieval_evals_no_update AS
  ON UPDATE TO retrieval_evals DO INSTEAD NOTHING;

CREATE OR REPLACE RULE retrieval_evals_no_delete AS
  ON DELETE TO retrieval_evals DO INSTEAD NOTHING;

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX idx_retrieval_evals_org_time
  ON retrieval_evals(org_id, created_at DESC);

CREATE INDEX idx_retrieval_evals_mode
  ON retrieval_evals(org_id, retrieval_mode, created_at DESC);

CREATE INDEX idx_retrieval_evals_hallucination
  ON retrieval_evals(org_id, created_at DESC)
  WHERE hallucination_flag = true;

CREATE INDEX idx_retrieval_evals_conversation
  ON retrieval_evals(conversation_id)
  WHERE conversation_id IS NOT NULL;

-- ── Row Level Security ───────────────────────────────────────
ALTER TABLE retrieval_evals ENABLE ROW LEVEL SECURITY;

-- SELECT: super_admin and compliance_officer only
CREATE POLICY "retrieval_evals_select"
  ON retrieval_evals FOR SELECT
  USING (
    org_id = auth_user_org_id()
    AND auth_user_role() IN ('super_admin', 'compliance_officer')
  );

-- INSERT: service role only (via createAdminClient in API routes)
-- No client-side direct insert.

-- ── Analytics function ────────────────────────────────────────
-- Returns aggregate retrieval quality metrics for an org.
-- Used by GET /api/retrieval-analytics.

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
  avg_chunk_count         NUMERIC(6,2)
)
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*) AS total_queries,

    ROUND(
      100.0 * COUNT(*) FILTER (WHERE retrieval_mode = 'hybrid')
      / NULLIF(COUNT(*), 0), 2
    ) AS hybrid_pct,

    ROUND(
      100.0 * COUNT(*) FILTER (WHERE retrieval_mode = 'vector')
      / NULLIF(COUNT(*), 0), 2
    ) AS vector_pct,

    ROUND(
      100.0 * COUNT(*) FILTER (WHERE retrieval_mode = 'keyword')
      / NULLIF(COUNT(*), 0), 2
    ) AS keyword_pct,

    ROUND(AVG(groundedness_score)::NUMERIC,  3) AS avg_groundedness,
    ROUND(AVG(citation_hit_rate)::NUMERIC,   3) AS avg_citation_hit_rate,

    ROUND(
      100.0 * COUNT(*) FILTER (WHERE hallucination_flag = true)
      / NULLIF(COUNT(*), 0), 2
    ) AS hallucination_rate_pct,

    ROUND(AVG(total_latency_ms)::NUMERIC,   2) AS avg_total_latency_ms,
    ROUND(AVG(vector_latency_ms)::NUMERIC,  2) AS avg_vector_latency_ms,
    ROUND(AVG(keyword_latency_ms)::NUMERIC, 2) AS avg_keyword_latency_ms,
    ROUND(AVG(chunk_count)::NUMERIC,        2) AS avg_chunk_count

  FROM retrieval_evals
  WHERE org_id = p_org_id
    AND created_at >= now() - (p_days || ' days')::INTERVAL;
$$;

-- ── Verification ─────────────────────────────────────────────
SELECT tablename FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'retrieval_evals';
