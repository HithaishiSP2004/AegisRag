-- ============================================================
-- Migration 0010: reports
-- Generated compliance reports. Runs AFTER 0009_workflows.sql
-- ============================================================

-- Report type ENUM
CREATE TYPE report_type AS ENUM ('compliance', 'risk', 'audit', 'security');

-- Report status ENUM
CREATE TYPE report_status AS ENUM ('generating', 'complete', 'failed');

CREATE TABLE IF NOT EXISTS reports (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id       UUID          NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  org_id            UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by        UUID          NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  title             TEXT          NOT NULL CHECK (char_length(title) BETWEEN 1 AND 500),
  report_type       report_type   NOT NULL,
  compliance_score  NUMERIC(5,2)  CHECK (compliance_score BETWEEN 0 AND 100),
  risk_score        NUMERIC(5,2)  CHECK (risk_score BETWEEN 0 AND 100),
  status            report_status NOT NULL DEFAULT 'generating',

  -- Structured report content (JSONB for flexibility)
  -- Expected schema:
  -- {
  --   executive_summary: string,
  --   methodology: string,
  --   violations: [{id, clause, severity, description, recommendation, evidence_chunks}],
  --   recommendations: [{priority, action, rationale}],
  --   evidence: [{chunk_id, content, source_doc, page_number}],
  --   token_usage: {prompt, context, output, total},
  --   retrieval_stats: {candidates_before_rerank, candidates_after_rerank, similarity_scores}
  -- }
  content           JSONB         NOT NULL DEFAULT '{}',

  ai_model_used     TEXT          CHECK (char_length(ai_model_used) <= 100),
  fallback_used     BOOLEAN       NOT NULL DEFAULT false,
  -- 0=primary (gemini-2.5-flash), 1=secondary, 2=tertiary, 3=raw chunks
  fallback_level    INT           CHECK (fallback_level BETWEEN 0 AND 3),
  confidence_score  NUMERIC(4,3)  CHECK (confidence_score BETWEEN 0 AND 1),
  error_message     TEXT,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_reports_updated_at
  BEFORE UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX idx_reports_org_id        ON reports(org_id);
CREATE INDEX idx_reports_workflow_id   ON reports(workflow_id);
CREATE INDEX idx_reports_created_by    ON reports(created_by);
CREATE INDEX idx_reports_report_type   ON reports(report_type);
CREATE INDEX idx_reports_status        ON reports(status);

-- Composite: report list page — org + date descending
CREATE INDEX idx_reports_org_created   ON reports(org_id, created_at DESC);

-- Partial: reports using fallback (for SOC analytics)
CREATE INDEX idx_reports_fallback      ON reports(org_id, fallback_level)
  WHERE fallback_used = true;

-- GIN: for searching report content
CREATE INDEX idx_reports_content       ON reports USING gin(content);

-- ── Row Level Security ───────────────────────────────────────
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reports_select_org_members"
  ON reports FOR SELECT
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid())
  );
