-- =============================================================================
-- Migration 0049: Phase 4A — RAG Evaluations Schema
--
-- What this does:
--   1. Creates evaluation_runs table to track batch runs.
--   2. Creates rag_evaluations table to track per-question quality.
--   3. Enables Row Level Security (RLS) on both.
--   4. Grants permissions to authenticated/service_role.
-- =============================================================================

-- ── 1. Create evaluation_runs table ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS evaluation_runs (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  dataset_name          TEXT         NOT NULL,
  total_questions       INTEGER      NOT NULL CHECK (total_questions >= 0),
  passed_questions      INTEGER      NOT NULL CHECK (passed_questions >= 0),
  overall_score         NUMERIC(5,2) NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
  retrieval_score       NUMERIC(5,2) NOT NULL CHECK (retrieval_score BETWEEN 0 AND 100),
  grounding_score       NUMERIC(5,2) NOT NULL CHECK (grounding_score BETWEEN 0 AND 100),
  citation_score        NUMERIC(5,2) NOT NULL CHECK (citation_score BETWEEN 0 AND 100),
  hallucination_score   NUMERIC(5,2) NOT NULL CHECK (hallucination_score BETWEEN 0 AND 100),
  latency_ms            INTEGER      NOT NULL CHECK (latency_ms >= 0),
  provider              TEXT         NOT NULL,
  model_name            TEXT         NOT NULL,
  evaluation_version    TEXT         NOT NULL,
  dataset_version       TEXT         NOT NULL,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ── 2. Create rag_evaluations table ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rag_evaluations (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id                UUID         NOT NULL REFERENCES evaluation_runs(id) ON DELETE CASCADE,
  org_id                UUID         NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  question              TEXT         NOT NULL CHECK (char_length(question) > 0),
  expected_answer       TEXT         NULL,
  generated_answer      TEXT         NULL,
  retrieved_chunks      INTEGER      NOT NULL CHECK (retrieved_chunks >= 0),
  retrieval_score       NUMERIC      NOT NULL,
  grounding_score       NUMERIC      NOT NULL,
  citation_score        NUMERIC      NOT NULL,
  hallucination_score   NUMERIC      NOT NULL,
  latency_ms            INTEGER      NOT NULL CHECK (latency_ms >= 0),
  passed                BOOLEAN      NOT NULL,
  failure_reason        TEXT         NULL CHECK (failure_reason IN ('LOW_RETRIEVAL', 'NO_CHUNKS', 'BAD_CITATION', 'HALLUCINATION', 'TIMEOUT', 'OTHER')),
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ── 3. Indexes for performance ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_evaluation_runs_org_time ON evaluation_runs(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rag_evaluations_run_id ON rag_evaluations(run_id);
CREATE INDEX IF NOT EXISTS idx_rag_evaluations_org_time ON rag_evaluations(org_id, created_at DESC);

-- ── 4. Enable RLS ───────────────────────────────────────────────────────────
ALTER TABLE evaluation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_evaluations ENABLE ROW LEVEL SECURITY;

-- ── 5. Row Level Security Policies ──────────────────────────────────────────

-- Select policy: super_admin and compliance_officer only
CREATE POLICY "evaluation_runs_select"
  ON evaluation_runs FOR SELECT
  USING (
    org_id = auth_user_org_id()
    AND auth_user_role() IN ('super_admin', 'compliance_officer')
  );

CREATE POLICY "rag_evaluations_select"
  ON rag_evaluations FOR SELECT
  USING (
    org_id = auth_user_org_id()
    AND auth_user_role() IN ('super_admin', 'compliance_officer')
  );

-- Grants
GRANT SELECT, INSERT ON evaluation_runs TO authenticated;
GRANT SELECT, INSERT ON evaluation_runs TO service_role;
GRANT SELECT, INSERT ON rag_evaluations TO authenticated;
GRANT SELECT, INSERT ON rag_evaluations TO service_role;
