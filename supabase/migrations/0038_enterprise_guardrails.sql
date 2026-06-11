-- ============================================================
-- Migration 0038: Enterprise Guardrails Telemetry
-- Creates guardrail_telemetry table.
-- ============================================================

CREATE TABLE IF NOT EXISTS guardrail_telemetry (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id        UUID        NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  guardrail_type TEXT        NOT NULL CHECK (guardrail_type IN ('input', 'output', 'workflow')),
  category       TEXT        NOT NULL, -- e.g., 'prompt_injection', 'jailbreak', 'pii', 'hallucination', 'citation_integrity', 'evidence_strength', 'framework_presence'
  severity       TEXT        NOT NULL CHECK (severity IN ('ALLOW', 'WARN', 'BLOCK')),
  risk_score     INT         NOT NULL DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
  action_taken   TEXT        NOT NULL CHECK (action_taken IN ('allowed', 'warned', 'blocked')),
  prompt_hash    TEXT,                 -- sha256 hash of prompt, or null for outputs
  workflow_id    UUID        REFERENCES workflows(id) ON DELETE SET NULL,
  metadata       JSONB       DEFAULT '{}'::jsonb, -- dynamic payload like confidence, groundedness_score, specific PII categories
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexing for governance queries
CREATE INDEX IF NOT EXISTS idx_guardrail_telemetry_org_id ON guardrail_telemetry(org_id);
CREATE INDEX IF NOT EXISTS idx_guardrail_telemetry_created ON guardrail_telemetry(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_guardrail_telemetry_type ON guardrail_telemetry(guardrail_type);

-- Enable Row Level Security
ALTER TABLE guardrail_telemetry ENABLE ROW LEVEL SECURITY;

-- Define security policies matching org boundaries
CREATE POLICY "guardrail_telemetry_select"
  ON guardrail_telemetry FOR SELECT
  USING (org_id = auth_user_org_id());

CREATE POLICY "guardrail_telemetry_insert"
  ON guardrail_telemetry FOR INSERT
  WITH CHECK (org_id = auth_user_org_id());

-- Grant access permissions
GRANT SELECT, INSERT ON guardrail_telemetry TO authenticated;
GRANT ALL ON guardrail_telemetry TO service_role;
