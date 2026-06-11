-- ============================================================
-- Migration 0039: Resilience & Recovery Telemetry
-- Alters workflows table and creates resilience_telemetry table.
-- ============================================================

ALTER TABLE workflows ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS resilience_telemetry (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id          UUID        NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  fallback_type    TEXT        NOT NULL, -- e.g., 'primary_to_secondary', 'secondary_to_evidence_only', 'pdf_export_retry', 'storage_upload_retry', 'workflow_resume'
  failure_reason   TEXT,
  recovery_action  TEXT        NOT NULL, -- e.g., 'model_switch', 'evidence_only', 'retry', 'resume_stage'
  retry_count      INT         NOT NULL DEFAULT 0,
  recovery_success BOOLEAN     NOT NULL DEFAULT true,
  workflow_stage   TEXT,                 -- e.g., 'retrieving', 'analyzing', 'generating', 'exporting'
  duration_ms      INT         NOT NULL,
  cache_hit        BOOLEAN     DEFAULT false,
  cache_miss       BOOLEAN     DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexing for dashboard and governance queries
CREATE INDEX IF NOT EXISTS idx_resilience_telemetry_org_id ON resilience_telemetry(org_id);
CREATE INDEX IF NOT EXISTS idx_resilience_telemetry_created ON resilience_telemetry(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resilience_telemetry_reason ON resilience_telemetry(failure_reason);
CREATE INDEX IF NOT EXISTS idx_resilience_telemetry_type ON resilience_telemetry(fallback_type);

-- Enable Row Level Security
ALTER TABLE resilience_telemetry ENABLE ROW LEVEL SECURITY;

-- Define security policies matching org boundaries
CREATE POLICY "resilience_telemetry_select"
  ON resilience_telemetry FOR SELECT
  USING (org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid()));

CREATE POLICY "resilience_telemetry_insert"
  ON resilience_telemetry FOR INSERT
  WITH CHECK (true);

-- Grant access permissions
GRANT SELECT, INSERT ON resilience_telemetry TO authenticated;
GRANT ALL ON resilience_telemetry TO service_role;
