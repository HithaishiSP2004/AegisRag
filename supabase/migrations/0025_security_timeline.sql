-- ============================================================
-- Migration 0025: Sprint 5A — Unified Security Timeline View
--
-- Depends on:
--   0012_audit_logs.sql       (audit_logs)
--   0013_security_events.sql  (security_events)
--   0023_retrieval_quality.sql (retrieval_evals)
--   0024_security_alerts.sql  (security_alerts)
--
-- Creates a unified view joining audit_logs + security_events + retrieval_evals
-- for the Unified Security Timeline dashboard component.
-- ============================================================

CREATE OR REPLACE VIEW security_timeline AS
  SELECT
    id,
    org_id,
    user_id,
    'audit'     AS source_type,
    action      AS event_label,
    resource_type AS category,
    NULL::TEXT  AS severity,
    NULL::BOOLEAN AS blocked,
    created_at
  FROM audit_logs

  UNION ALL

  SELECT
    id,
    org_id,
    user_id,
    'security'  AS source_type,
    event_type::TEXT AS event_label,
    'security'  AS category,
    severity::TEXT AS severity,
    blocked,
    created_at
  FROM security_events
  WHERE is_demo = false

  UNION ALL

  SELECT
    id,
    org_id,
    NULL::UUID  AS user_id,
    'retrieval' AS source_type,
    CASE
      WHEN hallucination_flag THEN 'hallucination_detected'
      ELSE 'retrieval_eval'
    END         AS event_label,
    'retrieval' AS category,
    CASE
      WHEN hallucination_flag THEN 'high'
      ELSE 'info'
    END         AS severity,
    hallucination_flag AS blocked,
    created_at
  FROM retrieval_evals;

-- ── Compliance evidence export function ──────────────────────
-- Returns a structured JSON evidence package for a given date range.
-- Used by GET /api/security/compliance-export.

CREATE OR REPLACE FUNCTION get_compliance_evidence(
  p_org_id   UUID,
  p_from     TIMESTAMPTZ DEFAULT now() - INTERVAL '30 days',
  p_to       TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'generated_at',    now(),
    'org_id',          p_org_id,
    'period_from',     p_from,
    'period_to',       p_to,

    'summary', jsonb_build_object(
      'total_audit_events',    (
        SELECT COUNT(*) FROM audit_logs
        WHERE org_id = p_org_id AND created_at BETWEEN p_from AND p_to
      ),
      'security_events',       (
        SELECT COUNT(*) FROM security_events
        WHERE org_id = p_org_id AND is_demo = false AND created_at BETWEEN p_from AND p_to
      ),
      'critical_events',       (
        SELECT COUNT(*) FROM security_events
        WHERE org_id = p_org_id AND is_demo = false
          AND severity = 'critical' AND created_at BETWEEN p_from AND p_to
      ),
      'open_alerts',           (
        SELECT COUNT(*) FROM security_alerts
        WHERE org_id = p_org_id AND status = 'open'
      ),
      'retrieval_evals',       (
        SELECT COUNT(*) FROM retrieval_evals
        WHERE org_id = p_org_id AND created_at BETWEEN p_from AND p_to
      ),
      'hallucinations_detected', (
        SELECT COUNT(*) FROM retrieval_evals
        WHERE org_id = p_org_id AND hallucination_flag = true
          AND created_at BETWEEN p_from AND p_to
      ),
      'documents_with_risk_flags', (
        SELECT COUNT(*) FROM document_risk_flags
        WHERE org_id = p_org_id AND mismatch_detected = true
      )
    ),

    'recent_security_events', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id',          id,
          'event_type',  event_type,
          'severity',    severity,
          'description', description,
          'blocked',     blocked,
          'created_at',  created_at
        ) ORDER BY created_at DESC
      ), '[]'::jsonb)
      FROM security_events
      WHERE org_id = p_org_id AND is_demo = false
        AND created_at BETWEEN p_from AND p_to
      LIMIT 100
    ),

    'open_alerts', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'id',          id,
          'title',       title,
          'severity',    severity,
          'status',      status,
          'category',    category,
          'created_at',  created_at
        ) ORDER BY created_at DESC
      ), '[]'::jsonb)
      FROM security_alerts
      WHERE org_id = p_org_id AND status = 'open'
      LIMIT 50
    )
  );
$$;

-- ── Verification ──────────────────────────────────────────────
SELECT viewname FROM pg_views
WHERE schemaname = 'public' AND viewname = 'security_timeline';
