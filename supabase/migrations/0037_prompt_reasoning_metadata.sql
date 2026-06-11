-- ============================================================
-- Migration 0037: Prompt Reasoning & Metadata (Phase 5)
-- Adds prompt engineering telemetry to ai_requests,
-- reasoning summary to messages, and creates prompt_test_results.
-- ============================================================

-- 1. Add telemetry columns to ai_requests
ALTER TABLE ai_requests
  ADD COLUMN IF NOT EXISTS prompt_template_used TEXT,
  ADD COLUMN IF NOT EXISTS prompt_version TEXT,
  ADD COLUMN IF NOT EXISTS estimated_tokens INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tokens_saved INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reasoning_mode TEXT,
  ADD COLUMN IF NOT EXISTS workflow_type TEXT,
  ADD COLUMN IF NOT EXISTS confidence_score NUMERIC DEFAULT 0.0;

-- 2. Add reasoning summary storage to messages
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS reasoning_metadata JSONB DEFAULT '{}'::jsonb;

-- 3. Create prompt_test_results table
CREATE TABLE IF NOT EXISTS prompt_test_results (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  prompt_id    TEXT        NOT NULL,
  version      TEXT        NOT NULL,
  question     TEXT        NOT NULL,
  expected     TEXT        NOT NULL,
  actual       TEXT        NOT NULL,
  status       TEXT        NOT NULL CHECK (status IN ('pass', 'fail')),
  latency_ms   INT         NOT NULL,
  tokens_used  INT         NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexing for prompt diagnostics queries
CREATE INDEX IF NOT EXISTS idx_prompt_test_results_org_id ON prompt_test_results(org_id);
CREATE INDEX IF NOT EXISTS idx_prompt_test_results_prompt ON prompt_test_results(prompt_id, version);

-- 4. Enable Row Level Security
ALTER TABLE prompt_test_results ENABLE ROW LEVEL SECURITY;

-- 5. Define security policies matching org boundaries
CREATE POLICY "prompt_test_results_select"
  ON prompt_test_results FOR SELECT
  USING (org_id = auth_user_org_id());

CREATE POLICY "prompt_test_results_insert"
  ON prompt_test_results FOR INSERT
  WITH CHECK (org_id = auth_user_org_id());

-- Grant access permissions
GRANT SELECT, INSERT ON prompt_test_results TO authenticated;
GRANT ALL ON prompt_test_results TO service_role;
