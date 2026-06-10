-- ============================================================
-- Migration 0026: Sprint 5B — Compliance Framework Registry
--
-- Depends on:
--   0001_organizations.sql
--   0002_user_profiles.sql
--   0015_fix_rls_recursion.sql (auth_user_org_id, auth_user_role)
--   0024_security_alerts.sql  (security_alerts, alert_severity enum)
--
-- Changes:
--   1. compliance_frameworks table   (SOC2, ISO27001, GDPR, HIPAA, NIST-CSF)
--   2. compliance_controls table     (per-framework controls seeded)
--   3. control_evidence table        (links controls to source records)
--   4. control_reviews table         (review lifecycle workflow)
--   5. get_compliance_stats()        (dashboard KPI aggregate)
--   6. get_org_risk_score()          (0-100 organizational risk score)
--   7. compliance_timeline view      (unified timeline incl. control_reviews)
-- ============================================================

-- ── 1. Enums ──────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE review_status AS ENUM ('pending', 'approved', 'rejected', 'needs_followup');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE evidence_type AS ENUM ('audit_logs', 'security_alerts', 'security_events', 'retrieval_evals', 'documents', 'ai_requests');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE finding_severity AS ENUM ('critical', 'high', 'medium', 'low');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── 2. compliance_frameworks ──────────────────────────────────

CREATE TABLE IF NOT EXISTS compliance_frameworks (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  description TEXT        NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_frameworks_org_name
  ON compliance_frameworks(org_id, name);

ALTER TABLE compliance_frameworks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "frameworks_select"
  ON compliance_frameworks FOR SELECT
  USING (
    org_id = auth_user_org_id()
    AND auth_user_role()::TEXT IN ('super_admin', 'compliance_officer', 'security_analyst', 'auditor')
  );

CREATE POLICY "frameworks_insert"
  ON compliance_frameworks FOR INSERT
  WITH CHECK (
    org_id = auth_user_org_id()
    AND auth_user_role()::TEXT IN ('super_admin', 'compliance_officer')
  );

-- ── 3. compliance_controls ────────────────────────────────────

CREATE TABLE IF NOT EXISTS compliance_controls (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  framework_id UUID         NOT NULL REFERENCES compliance_frameworks(id) ON DELETE CASCADE,
  control_id   TEXT         NOT NULL CHECK (char_length(control_id) BETWEEN 1 AND 50),
  title        TEXT         NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description  TEXT         NOT NULL DEFAULT '',
  category     TEXT         NOT NULL DEFAULT 'general',
  severity     finding_severity NOT NULL DEFAULT 'medium',
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_controls_framework
  ON compliance_controls(framework_id);

CREATE INDEX idx_controls_category
  ON compliance_controls(framework_id, category);

ALTER TABLE compliance_controls ENABLE ROW LEVEL SECURITY;

-- RLS: org is enforced via framework join — use SECURITY DEFINER helper on SELECT via admin client
-- For simplicity we allow any org member with the right role to SELECT via framework_id (framework is already org-scoped)
CREATE POLICY "controls_select"
  ON compliance_controls FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM compliance_frameworks cf
      WHERE cf.id = framework_id AND cf.org_id = auth_user_org_id()
    )
    AND auth_user_role()::TEXT IN ('super_admin', 'compliance_officer', 'security_analyst', 'auditor')
  );

-- ── 4. control_evidence ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS control_evidence (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  control_id        UUID          NOT NULL REFERENCES compliance_controls(id) ON DELETE CASCADE,

  -- Evidence classification
  evidence_type     evidence_type NOT NULL,
  evidence_reference TEXT         NOT NULL DEFAULT '',  -- human-readable label
  source_table      TEXT          NOT NULL,
  source_id         UUID          NOT NULL,

  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_evidence_control
  ON control_evidence(control_id, created_at DESC);

CREATE INDEX idx_evidence_source
  ON control_evidence(source_table, source_id);

-- Prevent exact duplicates
CREATE UNIQUE INDEX idx_evidence_unique
  ON control_evidence(control_id, source_table, source_id);

ALTER TABLE control_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "evidence_select"
  ON control_evidence FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM compliance_controls cc
        JOIN compliance_frameworks cf ON cf.id = cc.framework_id
      WHERE cc.id = control_evidence.control_id AND cf.org_id = auth_user_org_id()
    )
    AND auth_user_role()::TEXT IN ('super_admin', 'compliance_officer', 'security_analyst', 'auditor')
  );

CREATE POLICY "evidence_insert"
  ON control_evidence FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM compliance_controls cc
        JOIN compliance_frameworks cf ON cf.id = cc.framework_id
      WHERE cc.id = control_evidence.control_id AND cf.org_id = auth_user_org_id()
    )
    AND auth_user_role()::TEXT IN ('super_admin', 'compliance_officer', 'security_analyst')
  );

-- ── 5. control_reviews ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS control_reviews (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  control_id      UUID          NOT NULL REFERENCES compliance_controls(id) ON DELETE CASCADE,

  reviewer_id     UUID          REFERENCES user_profiles(id) ON DELETE SET NULL,
  status          review_status NOT NULL DEFAULT 'pending',
  notes           TEXT          CHECK (char_length(notes) <= 2000),
  review_date     DATE,
  next_review_date DATE,

  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_reviews_control
  ON control_reviews(control_id, created_at DESC);

CREATE INDEX idx_reviews_pending
  ON control_reviews(reviewer_id, status)
  WHERE status = 'pending';

CREATE INDEX idx_reviews_overdue
  ON control_reviews(next_review_date)
  WHERE status IN ('pending', 'needs_followup') AND next_review_date IS NOT NULL;

ALTER TABLE control_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reviews_select"
  ON control_reviews FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM compliance_controls cc
        JOIN compliance_frameworks cf ON cf.id = cc.framework_id
      WHERE cc.id = control_reviews.control_id AND cf.org_id = auth_user_org_id()
    )
    AND auth_user_role()::TEXT IN ('super_admin', 'compliance_officer', 'security_analyst', 'auditor')
  );

CREATE POLICY "reviews_insert"
  ON control_reviews FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM compliance_controls cc
        JOIN compliance_frameworks cf ON cf.id = cc.framework_id
      WHERE cc.id = control_reviews.control_id AND cf.org_id = auth_user_org_id()
    )
    AND auth_user_role()::TEXT IN ('super_admin', 'compliance_officer', 'security_analyst')
  );

CREATE POLICY "reviews_update"
  ON control_reviews FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM compliance_controls cc
        JOIN compliance_frameworks cf ON cf.id = cc.framework_id
      WHERE cc.id = control_reviews.control_id AND cf.org_id = auth_user_org_id()
    )
    AND auth_user_role()::TEXT IN ('super_admin', 'compliance_officer', 'security_analyst')
  );

-- updated_at trigger
CREATE OR REPLACE FUNCTION set_control_reviews_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_reviews_updated_at
  BEFORE UPDATE ON control_reviews
  FOR EACH ROW EXECUTE FUNCTION set_control_reviews_updated_at();

-- ── 6. Compliance stats aggregate ────────────────────────────

CREATE OR REPLACE FUNCTION get_compliance_stats(p_org_id UUID)
RETURNS TABLE (
  total_frameworks   BIGINT,
  total_controls     BIGINT,
  controls_with_evidence BIGINT,
  controls_missing_evidence BIGINT,
  reviews_pending    BIGINT,
  reviews_overdue    BIGINT,
  reviews_approved   BIGINT
)
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(*) FROM compliance_frameworks WHERE org_id = p_org_id)                AS total_frameworks,
    (SELECT COUNT(*) FROM compliance_controls cc
       JOIN compliance_frameworks cf ON cf.id = cc.framework_id
       WHERE cf.org_id = p_org_id)                                                       AS total_controls,
    (SELECT COUNT(DISTINCT ce.control_id) FROM control_evidence ce
       JOIN compliance_controls cc ON cc.id = ce.control_id
       JOIN compliance_frameworks cf ON cf.id = cc.framework_id
       WHERE cf.org_id = p_org_id)                                                       AS controls_with_evidence,
    (SELECT COUNT(*) FROM compliance_controls cc
       JOIN compliance_frameworks cf ON cf.id = cc.framework_id
       WHERE cf.org_id = p_org_id
         AND NOT EXISTS (
           SELECT 1 FROM control_evidence ce WHERE ce.control_id = cc.id
         ))                                                                               AS controls_missing_evidence,
    (SELECT COUNT(*) FROM control_reviews cr
       JOIN compliance_controls cc ON cc.id = cr.control_id
       JOIN compliance_frameworks cf ON cf.id = cc.framework_id
       WHERE cf.org_id = p_org_id AND cr.status::TEXT = 'pending')                      AS reviews_pending,
    (SELECT COUNT(*) FROM control_reviews cr
       JOIN compliance_controls cc ON cc.id = cr.control_id
       JOIN compliance_frameworks cf ON cf.id = cc.framework_id
       WHERE cf.org_id = p_org_id
         AND cr.status::TEXT IN ('pending', 'needs_followup')
         AND cr.next_review_date < CURRENT_DATE)                                         AS reviews_overdue,
    (SELECT COUNT(*) FROM control_reviews cr
       JOIN compliance_controls cc ON cc.id = cr.control_id
       JOIN compliance_frameworks cf ON cf.id = cc.framework_id
       WHERE cf.org_id = p_org_id AND cr.status::TEXT = 'approved')                    AS reviews_approved;
$$;

-- ── 7. Organizational risk score ─────────────────────────────

CREATE OR REPLACE FUNCTION get_org_risk_score(p_org_id UUID)
RETURNS TABLE (
  risk_score        INT,
  risk_level        TEXT,
  open_alerts       BIGINT,
  critical_alerts   BIGINT,
  hallucinations    BIGINT,
  retrieval_failures BIGINT,
  failed_reviews    BIGINT,
  unauthorized_events BIGINT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_open_alerts       BIGINT := 0;
  v_critical          BIGINT := 0;
  v_hallucinations    BIGINT := 0;
  v_retrieval_fail    BIGINT := 0;
  v_failed_reviews    BIGINT := 0;
  v_unauth_events     BIGINT := 0;
  v_score             INT    := 0;
BEGIN
  -- Security alerts (open, unresolved)
  SELECT
    COUNT(*)         FILTER (WHERE status::TEXT IN ('open','acknowledged')),
    COUNT(*)         FILTER (WHERE severity::TEXT = 'critical' AND status::TEXT IN ('open','acknowledged'))
  INTO v_open_alerts, v_critical
  FROM security_alerts
  WHERE org_id = p_org_id;

  -- Hallucinations (last 30d)
  SELECT COUNT(*) INTO v_hallucinations
  FROM security_events
  WHERE org_id = p_org_id AND is_demo = false
    AND event_type::TEXT = 'hallucination_detected'
    AND created_at >= now() - INTERVAL '30 days';

  -- Retrieval failures (last 30d — low quality scores)
  SELECT COUNT(*) INTO v_retrieval_fail
  FROM retrieval_evals
  WHERE org_id = p_org_id
    AND groundedness_score < 0.3
    AND created_at >= now() - INTERVAL '30 days';

  -- Failed / rejected reviews
  SELECT COUNT(*) INTO v_failed_reviews
  FROM control_reviews cr
    JOIN compliance_controls cc ON cc.id = cr.control_id
    JOIN compliance_frameworks cf ON cf.id = cc.framework_id
  WHERE cf.org_id = p_org_id AND cr.status::TEXT = 'rejected';

  -- Unauthorized access events (last 30d)
  SELECT COUNT(*) INTO v_unauth_events
  FROM security_events
  WHERE org_id = p_org_id AND is_demo = false
    AND event_type::TEXT = 'unauthorized_access'
    AND created_at >= now() - INTERVAL '30 days';

  -- Score calculation (weights sum to 100 at threshold)
  v_score := LEAST(100,
    LEAST(v_open_alerts, 5)       * 4 +   -- max 20 pts
    LEAST(v_critical,    4)       * 8 +   -- max 32 pts
    LEAST(v_hallucinations, 5)    * 3 +   -- max 15 pts
    LEAST(v_retrieval_fail, 5)    * 2 +   -- max 10 pts
    LEAST(v_failed_reviews, 5)    * 2 +   -- max 10 pts
    LEAST(v_unauth_events, 5)     * 2     -- max 10 pts (total cap 97 → padded)
  );

  RETURN QUERY SELECT
    v_score,
    CASE
      WHEN v_score >= 76 THEN 'critical'
      WHEN v_score >= 51 THEN 'high'
      WHEN v_score >= 26 THEN 'moderate'
      ELSE 'low'
    END,
    v_open_alerts, v_critical, v_hallucinations,
    v_retrieval_fail, v_failed_reviews, v_unauth_events;
END;
$$;

-- ── 8. Compliance timeline view ───────────────────────────────

CREATE OR REPLACE VIEW compliance_timeline AS
  -- Audit logs
  SELECT
    id,
    org_id,
    user_id,
    'audit'::TEXT          AS source_type,
    action                 AS event_label,
    resource_type          AS category,
    NULL::TEXT             AS severity,
    NULL::TEXT             AS framework_name,
    NULL::UUID             AS control_id,
    created_at
  FROM audit_logs

  UNION ALL

  -- Security events
  SELECT
    id,
    org_id,
    user_id,
    'security'::TEXT       AS source_type,
    event_type::TEXT       AS event_label,
    'security_event'::TEXT AS category,
    severity::TEXT         AS severity,
    NULL::TEXT             AS framework_name,
    NULL::UUID             AS control_id,
    created_at
  FROM security_events
  WHERE is_demo = false

  UNION ALL

  -- Security alerts
  SELECT
    id,
    org_id,
    NULL::UUID             AS user_id,
    'alert'::TEXT          AS source_type,
    title                  AS event_label,
    category               AS category,
    severity::TEXT         AS severity,
    NULL::TEXT             AS framework_name,
    NULL::UUID             AS control_id,
    created_at
  FROM security_alerts

  UNION ALL

  -- Control reviews
  SELECT
    cr.id,
    cf.org_id,
    cr.reviewer_id         AS user_id,
    'review'::TEXT         AS source_type,
    'Control Review: ' || cc.control_id || ' — ' || cr.status::TEXT AS event_label,
    'compliance'::TEXT     AS category,
    CASE cr.status::TEXT
      WHEN 'rejected'       THEN 'high'
      WHEN 'needs_followup' THEN 'medium'
      ELSE NULL
    END                    AS severity,
    cf.name                AS framework_name,
    cr.control_id          AS control_id,
    cr.created_at
  FROM control_reviews cr
    JOIN compliance_controls cc ON cc.id = cr.control_id
    JOIN compliance_frameworks cf ON cf.id = cc.framework_id;

-- ── 9. Seed compliance frameworks ────────────────────────────
-- Only seeds if an org exists. In multi-tenant mode each org gets its own copy.
-- Called per-org from the onboarding flow; here we seed for any existing orgs.

CREATE OR REPLACE FUNCTION seed_compliance_frameworks(p_org_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fw_id UUID;
BEGIN
  -- SOC2
  INSERT INTO compliance_frameworks(org_id, name, description)
  VALUES (p_org_id, 'SOC2', 'System and Organization Controls 2 — Trust Services Criteria')
  ON CONFLICT (org_id, name) DO NOTHING
  RETURNING id INTO fw_id;

  IF fw_id IS NOT NULL THEN
    INSERT INTO compliance_controls(framework_id, control_id, title, description, category, severity) VALUES
      (fw_id, 'CC1.1', 'Control Environment', 'COSO principle 1 — demonstrates commitment to integrity.', 'organizational', 'high'),
      (fw_id, 'CC6.1', 'Logical & Physical Access', 'Implements logical access security controls.', 'access_control', 'critical'),
      (fw_id, 'CC6.2', 'Authentication Controls', 'Multi-factor and password policy enforcement.', 'access_control', 'high'),
      (fw_id, 'CC7.1', 'System Operations', 'Monitoring of infrastructure and applications.', 'operations', 'medium'),
      (fw_id, 'CC7.2', 'Incident Response', 'Defined incident response procedures.', 'incident_response', 'high'),
      (fw_id, 'CC9.1', 'Risk Mitigation', 'Identified risks are mitigated to acceptable levels.', 'risk', 'medium')
    ON CONFLICT DO NOTHING;
  END IF;

  -- ISO27001
  INSERT INTO compliance_frameworks(org_id, name, description)
  VALUES (p_org_id, 'ISO27001', 'ISO/IEC 27001 — Information Security Management System')
  ON CONFLICT (org_id, name) DO NOTHING
  RETURNING id INTO fw_id;

  IF fw_id IS NOT NULL THEN
    INSERT INTO compliance_controls(framework_id, control_id, title, description, category, severity) VALUES
      (fw_id, 'A.5.1',  'Information Security Policies', 'Policies approved and communicated.', 'policies', 'high'),
      (fw_id, 'A.9.1',  'Access Control Policy', 'Business and security requirements for access control.', 'access_control', 'critical'),
      (fw_id, 'A.12.1', 'Operational Procedures', 'Documented operating procedures.', 'operations', 'medium'),
      (fw_id, 'A.16.1', 'Incident Management', 'Responsibilities and procedures for incident management.', 'incident_response', 'high'),
      (fw_id, 'A.18.1', 'Legal Requirements', 'Compliance with legal and regulatory requirements.', 'legal', 'high')
    ON CONFLICT DO NOTHING;
  END IF;

  -- GDPR
  INSERT INTO compliance_frameworks(org_id, name, description)
  VALUES (p_org_id, 'GDPR', 'General Data Protection Regulation')
  ON CONFLICT (org_id, name) DO NOTHING
  RETURNING id INTO fw_id;

  IF fw_id IS NOT NULL THEN
    INSERT INTO compliance_controls(framework_id, control_id, title, description, category, severity) VALUES
      (fw_id, 'ART.5',  'Data Processing Principles', 'Lawfulness, fairness, transparency, data minimisation.', 'data_protection', 'critical'),
      (fw_id, 'ART.17', 'Right to Erasure', 'Data subject right to erasure on request.', 'data_subject_rights', 'high'),
      (fw_id, 'ART.25', 'Privacy by Design', 'Data protection by design and by default.', 'privacy', 'high'),
      (fw_id, 'ART.32', 'Security of Processing', 'Technical and organisational security measures.', 'security', 'critical'),
      (fw_id, 'ART.33', 'Breach Notification', 'Notification of personal data breach within 72 hours.', 'incident_response', 'critical')
    ON CONFLICT DO NOTHING;
  END IF;

  -- HIPAA
  INSERT INTO compliance_frameworks(org_id, name, description)
  VALUES (p_org_id, 'HIPAA', 'Health Insurance Portability and Accountability Act')
  ON CONFLICT (org_id, name) DO NOTHING
  RETURNING id INTO fw_id;

  IF fw_id IS NOT NULL THEN
    INSERT INTO compliance_controls(framework_id, control_id, title, description, category, severity) VALUES
      (fw_id, '164.308', 'Administrative Safeguards', 'Risk analysis and security management process.', 'administrative', 'critical'),
      (fw_id, '164.310', 'Physical Safeguards', 'Facility access and workstation security.', 'physical', 'high'),
      (fw_id, '164.312', 'Technical Safeguards', 'Access control, audit controls, integrity.', 'technical', 'critical'),
      (fw_id, '164.316', 'Policies Documentation', 'Documentation requirements for policies.', 'policies', 'medium')
    ON CONFLICT DO NOTHING;
  END IF;

  -- NIST-CSF
  INSERT INTO compliance_frameworks(org_id, name, description)
  VALUES (p_org_id, 'NIST-CSF', 'NIST Cybersecurity Framework')
  ON CONFLICT (org_id, name) DO NOTHING
  RETURNING id INTO fw_id;

  IF fw_id IS NOT NULL THEN
    INSERT INTO compliance_controls(framework_id, control_id, title, description, category, severity) VALUES
      (fw_id, 'ID.AM',  'Asset Management', 'Physical and software assets inventoried.', 'identify', 'medium'),
      (fw_id, 'PR.AC',  'Identity Management', 'Identities and credentials managed for authorized users.', 'protect', 'critical'),
      (fw_id, 'PR.DS',  'Data Security', 'Data-at-rest and data-in-transit protection.', 'protect', 'high'),
      (fw_id, 'DE.AE',  'Anomalies Detection', 'Anomalies and events are detected.', 'detect', 'high'),
      (fw_id, 'RS.AN',  'Analysis', 'Analysis conducted to ensure effective response.', 'respond', 'medium'),
      (fw_id, 'RC.RP',  'Recovery Planning', 'Recovery plan executed during or after incidents.', 'recover', 'medium')
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

-- ── 10. Verification ─────────────────────────────────────────
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('compliance_frameworks', 'compliance_controls', 'control_evidence', 'control_reviews');
