-- ============================================================
-- Migration 0011: violations
-- Individual compliance violations within a report.
-- Runs AFTER 0010_reports.sql
-- ============================================================

-- Violation severity ENUM
CREATE TYPE violation_severity AS ENUM ('critical', 'high', 'medium', 'low');

CREATE TABLE IF NOT EXISTS violations (
  id                  UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id           UUID               NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  org_id              UUID               NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- The exact clause/sentence from the analyzed contract that triggered this violation
  clause_text         TEXT               NOT NULL CHECK (char_length(clause_text) > 0),

  -- The policy document + section this clause violates
  policy_reference    TEXT               CHECK (char_length(policy_reference) <= 500),

  severity            violation_severity NOT NULL,
  description         TEXT               NOT NULL CHECK (char_length(description) > 0),
  recommendation      TEXT,

  -- Array of chunk UUIDs that provide evidence for this violation
  -- Enforces: every AI claim is grounded in retrieved evidence (hallucination guard)
  evidence_chunk_ids  UUID[]             NOT NULL DEFAULT '{}',

  -- Per-violation confidence (output of hallucination checker)
  -- < 0.6: claim marked unverified
  -- < 0.4: claim suppressed from output
  confidence_score    NUMERIC(4,3)       CHECK (confidence_score BETWEEN 0 AND 1),

  -- Scoring weights: critical=10, high=7, medium=4, low=1
  -- Used by risk scoring engine to compute report.risk_score
  severity_weight     INT                NOT NULL GENERATED ALWAYS AS (
    CASE severity
      WHEN 'critical' THEN 10
      WHEN 'high'     THEN 7
      WHEN 'medium'   THEN 4
      WHEN 'low'      THEN 1
    END
  ) STORED,

  created_at          TIMESTAMPTZ        NOT NULL DEFAULT now()
  -- NO updated_at — violations are immutable once created
);

-- ── Immutability rule ────────────────────────────────────────
CREATE OR REPLACE RULE violations_no_update AS
  ON UPDATE TO violations DO INSTEAD NOTHING;

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX idx_violations_report_id ON violations(report_id);
CREATE INDEX idx_violations_org_id    ON violations(org_id);
CREATE INDEX idx_violations_severity  ON violations(severity);

-- Composite: used for risk score computation query
CREATE INDEX idx_violations_report_severity ON violations(report_id, severity);

-- GIN: allows querying by specific evidence chunk IDs
CREATE INDEX idx_violations_evidence  ON violations USING gin(evidence_chunk_ids);

-- ── Row Level Security ───────────────────────────────────────
ALTER TABLE violations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "violations_select_org_members"
  ON violations FOR SELECT
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid())
  );

-- ── Risk score computation function ─────────────────────────
-- Called after all violations are inserted to compute final report.risk_score
CREATE OR REPLACE FUNCTION compute_risk_score(p_report_id UUID)
RETURNS NUMERIC(5,2)
LANGUAGE SQL STABLE
AS $$
  SELECT LEAST(
    100,
    ROUND(
      (
        SUM(severity_weight)::NUMERIC
        / GREATEST(COUNT(*), 1)  -- average severity weight per violation
        / 10.0                   -- normalize: max weight = 10
        * 100                    -- scale to 0-100
      ), 2
    )
  )
  FROM violations
  WHERE report_id = p_report_id;
$$;
