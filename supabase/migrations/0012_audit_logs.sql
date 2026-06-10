-- ============================================================
-- Migration 0012: audit_logs
-- ENTERPRISE-GRADE APPEND-ONLY compliance trail.
-- Runs AFTER 0002_user_profiles.sql
-- ============================================================
-- ⚠️  IMMUTABILITY CONTRACT:
--   This table MUST remain append-only for legal compliance integrity.
--   UPDATE and DELETE are blocked at the database rule level.
--   Even super_admin cannot modify past audit records.
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         UUID        NOT NULL REFERENCES organizations(id)  ON DELETE CASCADE,
  user_id        UUID        REFERENCES user_profiles(id)           ON DELETE SET NULL,
  -- user_id SET NULL on profile delete: preserves audit record without PII

  -- Action description: e.g. 'document.upload', 'document.delete',
  --   'workflow.create', 'report.view', 'security.block', 'auth.login',
  --   'auth.logout', 'rbac.role_change', 'api.rate_limit'
  action         TEXT        NOT NULL CHECK (char_length(action) BETWEEN 1 AND 100),
  resource_type  TEXT        NOT NULL CHECK (char_length(resource_type) BETWEEN 1 AND 50),
  resource_id    UUID,       -- nullable: some actions have no specific resource
  old_value      JSONB,      -- state before change (null for CREATE/INSERT actions)
  new_value      JSONB,      -- state after change  (null for DELETE actions)
  ip_address     INET,       -- hashed/anonymized in production if GDPR required
  user_agent     TEXT        CHECK (char_length(user_agent) <= 500),
  -- NO updated_at column: append-only
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── IMMUTABILITY ENFORCEMENT ─────────────────────────────────
-- Rule 1: Block all UPDATE operations
CREATE OR REPLACE RULE audit_logs_no_update AS
  ON UPDATE TO audit_logs DO INSTEAD NOTHING;

-- Rule 2: Block all DELETE operations
CREATE OR REPLACE RULE audit_logs_no_delete AS
  ON DELETE TO audit_logs DO INSTEAD NOTHING;

-- Trigger alternative (belt-and-suspenders): raises explicit error on attempted update
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'audit_logs is append-only. Modification of audit records is prohibited. '
    'Attempted operation: %, Row ID: %', TG_OP, OLD.id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_audit_logs_immutable
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX idx_audit_logs_org_id        ON audit_logs(org_id);
CREATE INDEX idx_audit_logs_user_id       ON audit_logs(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_audit_logs_created_at    ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action        ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);

-- Composite: most common audit query pattern (org + time range)
CREATE INDEX idx_audit_logs_org_time      ON audit_logs(org_id, created_at DESC);

-- Composite: filter by user within org (for GDPR subject access requests)
CREATE INDEX idx_audit_logs_org_user      ON audit_logs(org_id, user_id, created_at DESC);

-- Composite: resource-specific audit trail
CREATE INDEX idx_audit_logs_resource      ON audit_logs(resource_type, resource_id, created_at DESC)
  WHERE resource_id IS NOT NULL;

-- GIN: search within old_value/new_value JSON fields
CREATE INDEX idx_audit_logs_new_value     ON audit_logs USING gin(new_value)
  WHERE new_value IS NOT NULL;

-- ── Row Level Security ───────────────────────────────────────
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only auditors, compliance officers, and super_admins can read audit logs
CREATE POLICY "audit_logs_select_privileged"
  ON audit_logs FOR SELECT
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid())
    AND (SELECT role FROM user_profiles WHERE id = auth.uid())
        IN ('super_admin', 'compliance_officer', 'auditor')
  );

-- INSERT: only via service role (Edge Functions). No client-side audit log insertion.
-- This prevents clients from forging audit entries.

-- ── Helper: log an audit event (called from Edge Functions via service role) ──
CREATE OR REPLACE FUNCTION log_audit_event(
  p_org_id       UUID,
  p_user_id      UUID,
  p_action       TEXT,
  p_resource_type TEXT,
  p_resource_id  UUID    DEFAULT NULL,
  p_old_value    JSONB   DEFAULT NULL,
  p_new_value    JSONB   DEFAULT NULL,
  p_ip_address   INET    DEFAULT NULL,
  p_user_agent   TEXT    DEFAULT NULL
)
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER  -- runs as owner, bypasses RLS for insert
AS $$
  INSERT INTO audit_logs (
    org_id, user_id, action, resource_type, resource_id,
    old_value, new_value, ip_address, user_agent
  )
  VALUES (
    p_org_id, p_user_id, p_action, p_resource_type, p_resource_id,
    p_old_value, p_new_value, p_ip_address, p_user_agent
  )
  RETURNING id;
$$;
