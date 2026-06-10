-- ============================================================
-- Migration 0013: security_events
-- SOC dashboard feed + Attack Simulation mode backing store.
-- Runs AFTER 0002_user_profiles.sql
-- ============================================================

-- Security event type ENUM
CREATE TYPE security_event_type AS ENUM (
  'prompt_injection',
  'jailbreak_attempt',
  'unauthorized_access',
  'hallucination_detected',
  'rate_limit_exceeded',
  'auth_failure'
);

-- Security event severity ENUM (includes 'info' for non-threat events)
CREATE TYPE security_event_severity AS ENUM ('critical', 'high', 'medium', 'low', 'info');

CREATE TABLE IF NOT EXISTS security_events (
  id              UUID                   PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID                   NOT NULL REFERENCES organizations(id)  ON DELETE CASCADE,
  user_id         UUID                   REFERENCES user_profiles(id)           ON DELETE SET NULL,
  event_type      security_event_type    NOT NULL,
  severity        security_event_severity NOT NULL,
  description     TEXT                   NOT NULL CHECK (char_length(description) BETWEEN 1 AND 2000),

  -- Raw input is NEVER stored in plaintext — SHA-256 hash only
  -- Store: encode(sha256(raw_input::bytea), 'hex')
  raw_input_hash  TEXT                   CHECK (raw_input_hash ~ '^[0-9a-f]{64}$'),

  -- Whether the system blocked the request (true = guardrail fired)
  blocked         BOOLEAN                NOT NULL DEFAULT true,

  -- How the system resolved the event (e.g., "Request blocked by injection filter")
  resolution      TEXT                   CHECK (char_length(resolution) <= 500),

  -- True if this is a synthetic event from Attack Simulation Mode
  is_demo         BOOLEAN                NOT NULL DEFAULT false,

  created_at      TIMESTAMPTZ            NOT NULL DEFAULT now()
  -- NO updated_at — security events are append-only
);

-- ── Immutability ─────────────────────────────────────────────
CREATE OR REPLACE RULE security_events_no_update AS
  ON UPDATE TO security_events DO INSTEAD NOTHING;

CREATE OR REPLACE RULE security_events_no_delete AS
  ON DELETE TO security_events DO INSTEAD NOTHING;

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX idx_security_events_org_id     ON security_events(org_id);
CREATE INDEX idx_security_events_user_id    ON security_events(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_security_events_event_type ON security_events(event_type);
CREATE INDEX idx_security_events_severity   ON security_events(severity);
CREATE INDEX idx_security_events_created_at ON security_events(created_at DESC);
CREATE INDEX idx_security_events_blocked    ON security_events(blocked);

-- Composite: SOC dashboard query — recent events for org
CREATE INDEX idx_security_events_org_time   ON security_events(org_id, created_at DESC);

-- Composite: critical-severity filter for SOC alerts
CREATE INDEX idx_security_events_critical   ON security_events(org_id, created_at DESC)
  WHERE severity IN ('critical', 'high');

-- Partial: exclude demo events from production analytics
CREATE INDEX idx_security_events_real       ON security_events(org_id, event_type, created_at DESC)
  WHERE is_demo = false;

-- ── Row Level Security ───────────────────────────────────────
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

-- Security analysts, compliance officers, auditors, and admins can read
CREATE POLICY "security_events_select_privileged"
  ON security_events FOR SELECT
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid())
    AND (SELECT role FROM user_profiles WHERE id = auth.uid())
        IN ('super_admin', 'security_analyst', 'compliance_officer', 'auditor')
  );

-- ── SOC dashboard stats function ─────────────────────────────
CREATE OR REPLACE FUNCTION get_security_stats(p_org_id UUID, p_hours INT DEFAULT 24)
RETURNS TABLE (
  total_events          BIGINT,
  blocked_events        BIGINT,
  injection_attempts    BIGINT,
  unauthorized_attempts BIGINT,
  critical_events       BIGINT,
  events_last_n_hours   BIGINT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    COUNT(*) FILTER (WHERE is_demo = false),
    COUNT(*) FILTER (WHERE blocked = true  AND is_demo = false),
    COUNT(*) FILTER (WHERE event_type = 'prompt_injection' AND is_demo = false),
    COUNT(*) FILTER (WHERE event_type = 'unauthorized_access' AND is_demo = false),
    COUNT(*) FILTER (WHERE severity IN ('critical', 'high') AND is_demo = false),
    COUNT(*) FILTER (WHERE created_at >= now() - (p_hours || ' hours')::INTERVAL AND is_demo = false)
  FROM security_events
  WHERE org_id = p_org_id;
$$;
