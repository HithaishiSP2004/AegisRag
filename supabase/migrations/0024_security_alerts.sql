-- ============================================================
-- Migration 0024: Sprint 5A — Security Alerts & Document Risk Classification
--
-- Depends on:
--   0001_organizations.sql
--   0002_user_profiles.sql
--   0004_documents.sql
--   0013_security_events.sql
--   0015_fix_rls_recursion.sql  (auth_user_org_id, auth_user_role)
--
-- Changes:
--   1. security_alerts table (severity levels, status tracking)
--   2. Trigger: auto-generate alert from critical/high security_events
--   3. document_risk_flags table (sensitivity mismatch detection)
--   4. get_security_kpi() aggregate function for dashboard KPI cards
-- ============================================================

-- ── 1. Alert severity & status enums ─────────────────────────
DO $$ BEGIN
  CREATE TYPE alert_severity AS ENUM ('critical', 'high', 'medium', 'low', 'info');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE alert_status AS ENUM ('open', 'acknowledged', 'resolved', 'suppressed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2. security_alerts table ──────────────────────────────────
CREATE TABLE IF NOT EXISTS security_alerts (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID          NOT NULL REFERENCES organizations(id)  ON DELETE CASCADE,

  -- Source linkage (one of these will be non-null for auto-generated alerts)
  source_event_id  UUID          REFERENCES security_events(id)         ON DELETE SET NULL,

  -- Alert classification
  title            TEXT          NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description      TEXT          NOT NULL CHECK (char_length(description) BETWEEN 1 AND 2000),
  severity         alert_severity NOT NULL,
  status           alert_status   NOT NULL DEFAULT 'open',

  -- Alert category for filtering
  category         TEXT          NOT NULL DEFAULT 'security' CHECK (
                                   category IN ('security', 'compliance', 'governance', 'risk', 'system')
                                 ),

  -- Resolution tracking
  acknowledged_by  UUID          REFERENCES user_profiles(id) ON DELETE SET NULL,
  acknowledged_at  TIMESTAMPTZ,
  resolved_at      TIMESTAMPTZ,
  resolution_note  TEXT          CHECK (char_length(resolution_note) <= 1000),

  -- Metadata
  metadata         JSONB         NOT NULL DEFAULT '{}',

  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX idx_security_alerts_org_status
  ON security_alerts(org_id, status, created_at DESC);

CREATE INDEX idx_security_alerts_org_severity
  ON security_alerts(org_id, severity, created_at DESC);

CREATE INDEX idx_security_alerts_open
  ON security_alerts(org_id, created_at DESC)
  WHERE status = 'open';

CREATE INDEX idx_security_alerts_critical
  ON security_alerts(org_id, created_at DESC)
  WHERE severity IN ('critical', 'high') AND status = 'open';

CREATE INDEX idx_security_alerts_source
  ON security_alerts(source_event_id)
  WHERE source_event_id IS NOT NULL;

-- ── updated_at auto-maintenance ───────────────────────────────
CREATE OR REPLACE FUNCTION set_security_alerts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_security_alerts_updated_at
  BEFORE UPDATE ON security_alerts
  FOR EACH ROW EXECUTE FUNCTION set_security_alerts_updated_at();

-- ── Row Level Security ───────────────────────────────────────
ALTER TABLE security_alerts ENABLE ROW LEVEL SECURITY;

-- SELECT: super_admin, compliance_officer, security_analyst
CREATE POLICY "security_alerts_select"
  ON security_alerts FOR SELECT
  USING (
    org_id = auth_user_org_id()
    AND auth_user_role() IN ('super_admin', 'compliance_officer', 'security_analyst', 'auditor')
  );

-- UPDATE (acknowledge/resolve): super_admin, compliance_officer, security_analyst
CREATE POLICY "security_alerts_update"
  ON security_alerts FOR UPDATE
  USING (
    org_id = auth_user_org_id()
    AND auth_user_role() IN ('super_admin', 'compliance_officer', 'security_analyst')
  );

-- ── 3. Auto-alert trigger from security_events ───────────────
-- When a critical or high security_event is inserted, auto-generate an open alert.

CREATE OR REPLACE FUNCTION fn_auto_create_security_alert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_sev alert_severity;
BEGIN
  -- Map security_event_severity to alert_severity
  v_sev := CASE NEW.severity
    WHEN 'critical' THEN 'critical'::alert_severity
    WHEN 'high'     THEN 'high'::alert_severity
    WHEN 'medium'   THEN 'medium'::alert_severity
    WHEN 'low'      THEN 'low'::alert_severity
    ELSE 'info'::alert_severity
  END;

  -- Only auto-alert for critical and high events (not demo events)
  IF NEW.severity IN ('critical', 'high') AND NEW.is_demo = false THEN
    INSERT INTO security_alerts (
      org_id, source_event_id, title, description,
      severity, status, category, metadata
    ) VALUES (
      NEW.org_id,
      NEW.id,
      CASE NEW.event_type
        WHEN 'prompt_injection'    THEN 'Prompt Injection Detected'
        WHEN 'jailbreak_attempt'   THEN 'Jailbreak Attempt Detected'
        WHEN 'unauthorized_access' THEN 'Unauthorized Access Attempt'
        WHEN 'hallucination_detected' THEN 'AI Hallucination Detected'
        WHEN 'rate_limit_exceeded' THEN 'Rate Limit Exceeded'
        WHEN 'auth_failure'        THEN 'Authentication Failure'
        ELSE 'Security Event: ' || NEW.event_type
      END,
      NEW.description,
      v_sev,
      'open',
      'security',
      jsonb_build_object(
        'event_type', NEW.event_type,
        'blocked',    NEW.blocked,
        'resolution', NEW.resolution
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_security_alert
  AFTER INSERT ON security_events
  FOR EACH ROW
  EXECUTE FUNCTION fn_auto_create_security_alert();

-- ── 4. document_risk_flags table ─────────────────────────────
-- Tracks sensitivity mismatch between doc metadata and AI-detected sensitivity.

CREATE TABLE IF NOT EXISTS document_risk_flags (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID         NOT NULL REFERENCES organizations(id)  ON DELETE CASCADE,
  document_id       UUID         NOT NULL REFERENCES documents(id)      ON DELETE CASCADE,

  -- Stored sensitivity vs. AI-detected
  declared_sensitivity  TEXT     NOT NULL,
  detected_sensitivity  TEXT     NOT NULL,
  mismatch_detected     BOOLEAN  NOT NULL DEFAULT false,
  risk_score            INT      NOT NULL DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),

  -- Justification from AI evaluator
  reasoning             TEXT     CHECK (char_length(reasoning) <= 1000),

  -- Status
  reviewed              BOOLEAN  NOT NULL DEFAULT false,
  reviewed_by           UUID     REFERENCES user_profiles(id) ON DELETE SET NULL,
  reviewed_at           TIMESTAMPTZ,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_doc_risk_flags_org
  ON document_risk_flags(org_id, created_at DESC);

CREATE INDEX idx_doc_risk_flags_mismatches
  ON document_risk_flags(org_id, created_at DESC)
  WHERE mismatch_detected = true AND reviewed = false;

CREATE INDEX idx_doc_risk_flags_document
  ON document_risk_flags(document_id);

ALTER TABLE document_risk_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doc_risk_flags_select"
  ON document_risk_flags FOR SELECT
  USING (
    org_id = auth_user_org_id()
    AND auth_user_role() IN ('super_admin', 'compliance_officer', 'security_analyst', 'auditor')
  );

CREATE POLICY "doc_risk_flags_update"
  ON document_risk_flags FOR UPDATE
  USING (
    org_id = auth_user_org_id()
    AND auth_user_role() IN ('super_admin', 'compliance_officer', 'security_analyst')
  );

-- ── 5. Security KPI aggregate function ───────────────────────
CREATE OR REPLACE FUNCTION get_security_kpi(
  p_org_id UUID,
  p_days   INT DEFAULT 7
)
RETURNS TABLE (
  open_alerts          BIGINT,
  critical_open        BIGINT,
  high_open            BIGINT,
  alerts_last_n_days   BIGINT,
  resolved_last_n_days BIGINT,
  risk_flags_open      BIGINT,
  avg_resolve_hours    NUMERIC(10,2)
)
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*)         FILTER (WHERE status = 'open')                                   AS open_alerts,
    COUNT(*)         FILTER (WHERE status = 'open' AND severity = 'critical')         AS critical_open,
    COUNT(*)         FILTER (WHERE status = 'open' AND severity = 'high')             AS high_open,
    COUNT(*)         FILTER (WHERE created_at >= now() - (p_days || ' days')::INTERVAL) AS alerts_last_n_days,
    COUNT(*)         FILTER (WHERE resolved_at >= now() - (p_days || ' days')::INTERVAL) AS resolved_last_n_days,
    (SELECT COUNT(*) FROM document_risk_flags
      WHERE org_id = p_org_id AND mismatch_detected = true AND reviewed = false)     AS risk_flags_open,
    ROUND(
      AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600)
        FILTER (WHERE resolved_at IS NOT NULL
                  AND created_at >= now() - (p_days || ' days')::INTERVAL),
      2
    )                                                                                 AS avg_resolve_hours
  FROM security_alerts
  WHERE org_id = p_org_id;
$$;

-- ── Verification ──────────────────────────────────────────────
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('security_alerts', 'document_risk_flags');
