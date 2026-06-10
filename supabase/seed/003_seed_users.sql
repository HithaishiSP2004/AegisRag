-- Seed 003: Demo Users
-- ⚠️  IMPORTANT: Do NOT run this directly in SQL Editor
-- Users must be created via Supabase Auth API first, then profiles inserted here.
--
-- Step 1: Create each user via Supabase Dashboard → Authentication → Add User:
--   admin@aegisdemo.com        / Demo@1234
--   compliance@aegisdemo.com   / Demo@1234
--   auditor@aegisdemo.com      / Demo@1234
--
-- Step 2: Note each user's UUID from the Auth table.
--
-- Step 3: Replace the placeholder UUIDs below with actual auth UUIDs.
-- Step 4: Run this script.

-- Replace these UUIDs with real auth.users UUIDs after creating users in Auth dashboard:
-- ADMIN_UUID     = <copy from Auth dashboard>
-- COMPLIANCE_UUID = <copy from Auth dashboard>
-- AUDITOR_UUID   = <copy from Auth dashboard>

-- Example (replace UUIDs before running):
/*
INSERT INTO user_profiles (id, org_id, full_name, role, department, is_active)
VALUES
  ('ADMIN_UUID',      '00000000-0000-0000-0000-000000000001', 'Demo Admin',              'super_admin',        'IT',         true),
  ('COMPLIANCE_UUID', '00000000-0000-0000-0000-000000000001', 'Demo Compliance Officer', 'compliance_officer', 'Legal',      true),
  ('AUDITOR_UUID',    '00000000-0000-0000-0000-000000000001', 'Demo Auditor',            'auditor',            'Compliance', true)
ON CONFLICT (id) DO NOTHING;

-- Assign roles in user_roles junction table
INSERT INTO user_roles (user_id, role_id)
VALUES
  ('ADMIN_UUID',      '10000000-0000-0000-0000-000000000001'),
  ('COMPLIANCE_UUID', '10000000-0000-0000-0000-000000000002'),
  ('AUDITOR_UUID',    '10000000-0000-0000-0000-000000000004')
ON CONFLICT DO NOTHING;
*/
