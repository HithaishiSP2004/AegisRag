-- ============================================================
-- Migration 0031: Enterprise Onboarding Tables
-- Enforces one workspace per verified domain and tracks access requests.
-- ============================================================

-- 1. Add domain column to organizations if not present
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS domain TEXT;

-- Create unique index on domain to prevent duplicate workspaces
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_domain_unique ON organizations(domain) WHERE domain IS NOT NULL;

-- 2. Create access_requests table
CREATE TABLE IF NOT EXISTS access_requests (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email           TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, email)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_access_requests_org_id ON access_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_access_requests_email ON access_requests(email);

-- Enable RLS
ALTER TABLE access_requests ENABLE ROW LEVEL SECURITY;

-- Select policy: Admins can read access requests for their organization
CREATE POLICY "access_requests_select_admin" ON access_requests
  FOR SELECT
  USING (
    organization_id = auth_user_org_id()
    AND auth_user_role() IN ('super_admin', 'compliance_officer')
  );

-- Insert policy: Anyone can submit an access request during onboarding
CREATE POLICY "access_requests_insert_public" ON access_requests
  FOR INSERT
  WITH CHECK (
    email IS NOT NULL
    AND length(email) > 5
  );

-- Update policy: Admins can approve/reject requests
CREATE POLICY "access_requests_update_admin" ON access_requests
  FOR UPDATE
  USING (
    organization_id = auth_user_org_id()
    AND auth_user_role() IN ('super_admin', 'compliance_officer')
  )
  WITH CHECK (
    organization_id = auth_user_org_id()
    AND auth_user_role() IN ('super_admin', 'compliance_officer')
  );
