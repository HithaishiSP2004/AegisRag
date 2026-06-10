-- ============================================================
-- Migration 0032: Trial Access Model & Usage Metering
-- ============================================================

-- 1. Extend user_role ENUM to support public trial tiers
-- Note: PostgreSQL allows ADD VALUE within transaction blocks since v12,
-- provided the enum is not referenced in the same transaction.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'trial_user';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'academic_user';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'approved_user';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'enterprise_user';

-- 2. Create trial_usage_metrics table for usage metering
CREATE TABLE IF NOT EXISTS trial_usage_metrics (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID        NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  date               DATE        NOT NULL DEFAULT CURRENT_DATE,
  ai_requests        INTEGER     NOT NULL DEFAULT 0,
  document_uploads   INTEGER     NOT NULL DEFAULT 0,
  exports            INTEGER     NOT NULL DEFAULT 0,
  tokens_used        INTEGER     NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_trial_usage_metrics_user_id ON trial_usage_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_trial_usage_metrics_date ON trial_usage_metrics(date);

-- Enable RLS on trial_usage_metrics
ALTER TABLE trial_usage_metrics ENABLE ROW LEVEL SECURITY;

-- Select policy: users can read their own usage metrics
CREATE POLICY "metrics_select_own" ON trial_usage_metrics
  FOR SELECT
  USING (user_id = auth.uid());


-- 3. Create tier_upgrade_requests table for controlled upgrades
CREATE TABLE IF NOT EXISTS tier_upgrade_requests (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  email           TEXT        NOT NULL,
  organization    TEXT,
  department      TEXT,
  role            TEXT        NOT NULL,
  use_case        TEXT        NOT NULL,
  expected_usage  TEXT        NOT NULL,
  message         TEXT,
  target_tier     TEXT        NOT NULL CHECK (target_tier IN ('academic_user', 'approved_user', 'enterprise_user')),
  status          TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_tier_upgrade_requests_user_id ON tier_upgrade_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_tier_upgrade_requests_status ON tier_upgrade_requests(status);

-- Enable RLS on tier_upgrade_requests
ALTER TABLE tier_upgrade_requests ENABLE ROW LEVEL SECURITY;

-- Select policy: users can read their own upgrade requests
CREATE POLICY "upgrade_requests_select_own" ON tier_upgrade_requests
  FOR SELECT
  USING (user_id = auth.uid());

-- Insert policy: authenticated users can insert their own upgrade requests
CREATE POLICY "upgrade_requests_insert_own" ON tier_upgrade_requests
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Select policy for admins: super_admins and compliance_officers can read upgrade requests
CREATE POLICY "upgrade_requests_select_admin" ON tier_upgrade_requests
  FOR SELECT
  USING (
    auth_user_role() IN ('super_admin', 'compliance_officer')
  );

-- Update policy for admins: super_admins and compliance_officers can approve/reject requests
CREATE POLICY "upgrade_requests_update_admin" ON tier_upgrade_requests
  FOR UPDATE
  USING (
    auth_user_role() IN ('super_admin', 'compliance_officer')
  )
  WITH CHECK (
    auth_user_role() IN ('super_admin', 'compliance_officer')
  );
