-- ============================================================
-- Migration 0009: workflows
-- Compliance analysis workflow orchestration.
-- Runs AFTER 0004_documents.sql
-- ============================================================

-- Workflow status ENUM
CREATE TYPE workflow_status AS ENUM (
  'pending',
  'retrieving',
  'analyzing',
  'generating',
  'complete',
  'failed'
);

CREATE TABLE IF NOT EXISTS workflows (
  id                 UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             UUID             NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by         UUID             NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  input_document_id  UUID             REFERENCES documents(id) ON DELETE SET NULL,
  name               TEXT             NOT NULL CHECK (char_length(name) BETWEEN 1 AND 300),
  status             workflow_status  NOT NULL DEFAULT 'pending',
  progress_pct       INT              NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  current_step       TEXT             CHECK (char_length(current_step) <= 200),
  result_summary     TEXT,            -- brief one-liner populated on completion
  error_message      TEXT,            -- populated on failure
  started_at         TIMESTAMPTZ,
  completed_at       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ      NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ      NOT NULL DEFAULT now(),

  -- Enforce: completed_at only set when status is terminal
  CONSTRAINT chk_completed_at CHECK (
    completed_at IS NULL OR status IN ('complete', 'failed')
  )
);

CREATE TRIGGER trg_workflows_updated_at
  BEFORE UPDATE ON workflows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX idx_workflows_org_id     ON workflows(org_id);
CREATE INDEX idx_workflows_created_by ON workflows(created_by);
CREATE INDEX idx_workflows_status     ON workflows(status);

-- Composite: dashboard query — recent incomplete workflows for an org
CREATE INDEX idx_workflows_org_active ON workflows(org_id, created_at DESC)
  WHERE status NOT IN ('complete', 'failed');

-- Realtime subscription will use this index for polling
CREATE INDEX idx_workflows_updated_at ON workflows(updated_at DESC);

-- ── Row Level Security ───────────────────────────────────────
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workflows_select_org_members"
  ON workflows FOR SELECT
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid())
  );

CREATE POLICY "workflows_insert_authorized"
  ON workflows FOR INSERT
  WITH CHECK (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid())
    AND (SELECT role FROM user_profiles WHERE id = auth.uid())
        IN ('super_admin', 'compliance_officer')
  );

-- Service role updates workflow status/progress from Edge Functions
