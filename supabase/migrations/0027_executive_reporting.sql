-- ============================================================
-- Migration 0027: Sprint 5C — Executive Reporting & Analytics
--
-- Depends on:
--   0023_retrieval_quality.sql (retrieval_evals table)
--   0024_security_alerts.sql   (security_alerts table)
--   0026_compliance_frameworks.sql (compliance_frameworks table)
-- ============================================================

-- ── 1. Daily trends aggregation function ────────────────────
CREATE OR REPLACE FUNCTION get_daily_trends(
  p_org_id UUID,
  p_days   INT DEFAULT 30
)
RETURNS TABLE (
  trend_date       DATE,
  query_count      BIGINT,
  avg_groundedness NUMERIC(4,3),
  hallucinations   BIGINT,
  alert_count      BIGINT,
  token_count      BIGINT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH date_series AS (
    SELECT (d.day)::date AS gs_date
    FROM generate_series(
      (now() - ((p_days - 1) || ' days')::interval)::date,
      now()::date,
      '1 day'::interval
    ) d(day)
  ),
  retrieval_agg AS (
    SELECT
      created_at::date AS r_date,
      COUNT(*) AS q_count,
      AVG(groundedness_score)::NUMERIC AS avg_g,
      COUNT(*) FILTER (WHERE hallucination_flag = true) AS h_count
    FROM retrieval_evals
    WHERE org_id = p_org_id
      AND created_at >= (now() - (p_days || ' days')::interval)
    GROUP BY created_at::date
  ),
  alerts_agg AS (
    SELECT
      created_at::date AS a_date,
      COUNT(*) AS al_count
    FROM security_alerts
    WHERE org_id = p_org_id
      AND created_at >= (now() - (p_days || ' days')::interval)
    GROUP BY created_at::date
  ),
  tokens_agg AS (
    SELECT
      created_at::date AS t_date,
      SUM(total_tokens) AS tot_tokens
    FROM ai_requests
    WHERE org_id = p_org_id
      AND created_at >= (now() - (p_days || ' days')::interval)
    GROUP BY created_at::date
  )
  SELECT
    ds.gs_date AS trend_date,
    COALESCE(ra.q_count, 0)::BIGINT AS query_count,
    ROUND(COALESCE(ra.avg_g, 0.0), 3)::NUMERIC(4,3) AS avg_groundedness,
    COALESCE(ra.h_count, 0)::BIGINT AS hallucinations,
    COALESCE(aa.al_count, 0)::BIGINT AS alert_count,
    COALESCE(ta.tot_tokens, 0)::BIGINT AS token_count
  FROM date_series ds
  LEFT JOIN retrieval_agg ra ON ds.gs_date = ra.r_date
  LEFT JOIN alerts_agg aa ON ds.gs_date = aa.a_date
  LEFT JOIN tokens_agg ta ON ds.gs_date = ta.t_date
  ORDER BY ds.gs_date ASC;
END;
$$;

-- ── 2. Framework-level compliance details ────────────────────
CREATE OR REPLACE FUNCTION get_framework_compliance_details(p_org_id UUID)
RETURNS TABLE (
  framework_id       UUID,
  framework_name     TEXT,
  total_controls     BIGINT,
  controls_with_evidence BIGINT,
  reviews_pending    BIGINT,
  reviews_approved   BIGINT,
  coverage_pct       NUMERIC(5,2)
)
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    cf.id AS framework_id,
    cf.name AS framework_name,
    COUNT(DISTINCT cc.id) AS total_controls,
    COUNT(DISTINCT ce.control_id) AS controls_with_evidence,
    COUNT(DISTINCT CASE WHEN cr.status::TEXT = 'pending' THEN cr.id END) AS reviews_pending,
    COUNT(DISTINCT CASE WHEN cr.status::TEXT = 'approved' THEN cr.id END) AS reviews_approved,
    ROUND(
      COALESCE(100.0 * COUNT(DISTINCT ce.control_id) / NULLIF(COUNT(DISTINCT cc.id), 0), 0.0),
      2
    ) AS coverage_pct
  FROM compliance_frameworks cf
  LEFT JOIN compliance_controls cc ON cc.framework_id = cf.id
  LEFT JOIN control_evidence ce ON ce.control_id = cc.id
  LEFT JOIN control_reviews cr ON cr.control_id = cc.id
  WHERE cf.org_id = p_org_id
  GROUP BY cf.id, cf.name;
$$;
