-- Seed 002: Roles and Permissions
-- Run AFTER 001_seed_org.sql

-- Insert 5 roles for the demo org
INSERT INTO roles (id, org_id, name, description)
VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'super_admin',         'Full system access — manages all resources'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'compliance_officer',  'Upload docs, run workflows, view all reports'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'security_analyst',    'Monitor security events, view SOC dashboard'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'auditor',             'Read-only access to reports and audit logs'),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'executive',           'View compliance health scores and summaries')
ON CONFLICT (org_id, name) DO NOTHING;

-- Permissions for compliance_officer role (example — extend as needed)
INSERT INTO permissions (role_id, resource, action, scope)
VALUES
  ('10000000-0000-0000-0000-000000000002', 'documents', 'read',   'org'),
  ('10000000-0000-0000-0000-000000000002', 'documents', 'write',  'org'),
  ('10000000-0000-0000-0000-000000000002', 'workflows', 'read',   'org'),
  ('10000000-0000-0000-0000-000000000002', 'workflows', 'write',  'org'),
  ('10000000-0000-0000-0000-000000000002', 'reports',   'read',   'org'),
  -- auditor: read-only
  ('10000000-0000-0000-0000-000000000004', 'documents', 'read',   'org'),
  ('10000000-0000-0000-0000-000000000004', 'reports',   'read',   'org'),
  ('10000000-0000-0000-0000-000000000004', 'audit_logs','read',   'org');
