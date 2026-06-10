-- ============================================================
-- Migration 0030: Generated Reports Storage + Narrative TTL
-- Run this in your Supabase SQL editor
-- ============================================================

-- 1. generated_reports — persistent export history per tenant
CREATE TABLE IF NOT EXISTS generated_reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  org_id       UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  report_type  VARCHAR(50)  NOT NULL,
  format       VARCHAR(10)  NOT NULL,  -- PPTX, PDF, JSON
  file_name    VARCHAR(255) NOT NULL,
  storage_path TEXT,                   -- reports/{tenantId}/{year}/{month}/{file}
  file_size    BIGINT       DEFAULT 0,
  generated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  generated_at TIMESTAMPTZ  DEFAULT now(),
  status       VARCHAR(20)  DEFAULT 'completed',  -- completed | failed | pending
  metadata     JSONB        DEFAULT '{}'
);

ALTER TABLE generated_reports ENABLE ROW LEVEL SECURITY;

-- Tenant-isolated SELECT
CREATE POLICY "generated_reports_select" ON generated_reports
  FOR SELECT USING (
    tenant_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid())
  );

-- Any authenticated user in the tenant can insert
CREATE POLICY "generated_reports_insert" ON generated_reports
  FOR INSERT WITH CHECK (
    tenant_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid())
  );

-- Only the creator can delete their own report
CREATE POLICY "generated_reports_delete" ON generated_reports
  FOR DELETE USING (
    tenant_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid())
    AND generated_by = auth.uid()
  );

-- 2. Add expires_at and cache_key to analytics_narratives (Section 4)
ALTER TABLE analytics_narratives ADD COLUMN IF NOT EXISTS cache_key    VARCHAR(128);
ALTER TABLE analytics_narratives ADD COLUMN IF NOT EXISTS expires_at   TIMESTAMPTZ;

-- Index for fast cache lookups
CREATE INDEX IF NOT EXISTS idx_analytics_narratives_cache
  ON analytics_narratives(org_id, report_type, period, hash)
  WHERE expires_at > now();

-- 3. Add tenant_id index on retrieval_events for performance
CREATE INDEX IF NOT EXISTS idx_retrieval_events_tenant_date
  ON retrieval_events(tenant_id, created_at DESC);

-- 4. Add tenant_id index on executive_snapshots
CREATE INDEX IF NOT EXISTS idx_executive_snapshots_tenant_date
  ON executive_snapshots(tenant_id, snapshot_date DESC);

-- 5. Add tenant_id index on audit_events
CREATE INDEX IF NOT EXISTS idx_audit_events_tenant_date
  ON audit_events(tenant_id, created_at DESC);

-- 6. Add tenant_id index on compliance_events
CREATE INDEX IF NOT EXISTS idx_compliance_events_tenant_date
  ON compliance_events(tenant_id, created_at DESC);
