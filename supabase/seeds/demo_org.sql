-- =============================================================================
-- AegisRAG Demo Seed Data
-- File: supabase/seeds/demo_org.sql
--
-- Prerequisites:
--   1. All migrations 0001-0014 must be applied.
--   2. The four auth.users accounts below must already exist in Supabase Auth.
--      Create them via Dashboard → Authentication → Users → Add User, then
--      paste their UUIDs into the DECLARE block.
--
-- Demo user accounts:
--   super.admin@aegisrag.demo    password: AegisDemo2025!
--   compliance@aegisrag.demo     password: AegisDemo2025!
--   auditor@aegisrag.demo        password: AegisDemo2025!
--   analyst@aegisrag.demo        password: AegisDemo2025!
--
-- Execution: Run in Supabase SQL Editor (runs as service_role automatically).
--            The service_role bypasses RLS, which is required for seeding.
-- =============================================================================

DO $$
DECLARE
  -- ── Paste your auth.users UUIDs here ────────────────────────────────────
  v_super_admin_auth_id   UUID := '3589e400-b7d7-49b7-9ebe-c414f53f88ac';
  v_compliance_auth_id    UUID := '357ff003-bc75-4903-ab97-6431a782934b';
  v_auditor_auth_id       UUID := 'f772791d-016b-45e6-b225-96ada02ebf05';
  v_analyst_auth_id       UUID := 'e04650fa-f555-4070-bda5-52a44d4f7b61';

  -- ── Internal working variables ───────────────────────────────────────────
  v_org_id            UUID;
  v_role_super_admin  UUID;
  v_role_compliance   UUID;
  v_role_auditor      UUID;
  v_role_analyst      UUID;

BEGIN

  -- ── Guard: verify all four auth.users rows exist before writing anything ─
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_super_admin_auth_id) THEN
    RAISE EXCEPTION 'auth.users row not found for super_admin. UUID: %', v_super_admin_auth_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_compliance_auth_id) THEN
    RAISE EXCEPTION 'auth.users row not found for compliance_officer. UUID: %', v_compliance_auth_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_auditor_auth_id) THEN
    RAISE EXCEPTION 'auth.users row not found for auditor. UUID: %', v_auditor_auth_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_analyst_auth_id) THEN
    RAISE EXCEPTION 'auth.users row not found for security_analyst. UUID: %', v_analyst_auth_id;
  END IF;

  RAISE NOTICE 'All auth.users guards passed — proceeding with seed.';

  -- =========================================================================
  -- 1. ORGANIZATION
  -- =========================================================================
  INSERT INTO public.organizations (
    id,
    name,
    slug,
    plan,
    settings
  )
  VALUES (
    gen_random_uuid(),
    'AegisRAG Demo Corp',
    'aegisrag-demo',
    'enterprise'::org_plan,
    jsonb_build_object(
      'industry',               'Financial Services',
      'compliance_frameworks',  jsonb_build_array('SOC2', 'ISO27001', 'GDPR'),
      'max_document_size_mb',   50,
      'demo_mode',              true,
      'created_by',             'seed_script',
      'timezone',               'Asia/Kolkata'
    )
  )
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO v_org_id;

  -- If the org already existed, fetch its id
  IF v_org_id IS NULL THEN
    SELECT id INTO v_org_id
    FROM public.organizations
    WHERE slug = 'aegisrag-demo';
    RAISE NOTICE 'Organization already exists — reusing id: %', v_org_id;
  ELSE
    RAISE NOTICE 'Organization created — id: %', v_org_id;
  END IF;

  -- =========================================================================
  -- 2. ROLES
  -- One row per role type per org (UNIQUE constraint: org_id, name)
  -- =========================================================================
  INSERT INTO public.roles (id, org_id, name, description)
  VALUES
    (
      gen_random_uuid(), v_org_id, 'super_admin'::user_role,
      'Full platform access. Can manage users, upload documents, run workflows, and view all audit logs.'
    ),
    (
      gen_random_uuid(), v_org_id, 'compliance_officer'::user_role,
      'Can upload documents, create and review compliance workflows, and generate reports.'
    ),
    (
      gen_random_uuid(), v_org_id, 'auditor'::user_role,
      'Read-only access to reports, audit logs, and compliance findings. Cannot upload or modify data.'
    ),
    (
      gen_random_uuid(), v_org_id, 'security_analyst'::user_role,
      'Can view security events, monitor violations, and review AI telemetry. Cannot upload documents.'
    )
  ON CONFLICT (org_id, name) DO NOTHING;

  -- Resolve role UUIDs (handles both fresh insert and pre-existing rows)
  SELECT id INTO v_role_super_admin
  FROM public.roles WHERE org_id = v_org_id AND name = 'super_admin'::user_role;

  SELECT id INTO v_role_compliance
  FROM public.roles WHERE org_id = v_org_id AND name = 'compliance_officer'::user_role;

  SELECT id INTO v_role_auditor
  FROM public.roles WHERE org_id = v_org_id AND name = 'auditor'::user_role;

  SELECT id INTO v_role_analyst
  FROM public.roles WHERE org_id = v_org_id AND name = 'security_analyst'::user_role;

  RAISE NOTICE 'Roles resolved — super_admin: %, compliance_officer: %, auditor: %, security_analyst: %',
    v_role_super_admin, v_role_compliance, v_role_auditor, v_role_analyst;

  -- =========================================================================
  -- 3. PERMISSIONS
  -- Enum casts required: permission_action, permission_scope
  -- =========================================================================

  -- super_admin — full admin across all resources
  INSERT INTO public.permissions (role_id, resource, action, scope)
  VALUES
    (v_role_super_admin, 'documents',       'admin'::permission_action, 'org'::permission_scope),
    (v_role_super_admin, 'workflows',       'admin'::permission_action, 'org'::permission_scope),
    (v_role_super_admin, 'reports',         'admin'::permission_action, 'org'::permission_scope),
    (v_role_super_admin, 'audit_logs',      'read'::permission_action,  'org'::permission_scope),
    (v_role_super_admin, 'security_events', 'read'::permission_action,  'org'::permission_scope),
    (v_role_super_admin, 'users',           'admin'::permission_action, 'org'::permission_scope),
    (v_role_super_admin, 'ai_requests',     'read'::permission_action,  'org'::permission_scope)
  ON CONFLICT (role_id, resource, action, scope) DO NOTHING;

  -- compliance_officer — upload, workflows, reports
  INSERT INTO public.permissions (role_id, resource, action, scope)
  VALUES
    (v_role_compliance, 'documents',  'write'::permission_action, 'org'::permission_scope),
    (v_role_compliance, 'documents',  'read'::permission_action,  'org'::permission_scope),
    (v_role_compliance, 'workflows',  'write'::permission_action, 'org'::permission_scope),
    (v_role_compliance, 'workflows',  'read'::permission_action,  'org'::permission_scope),
    (v_role_compliance, 'reports',    'read'::permission_action,  'org'::permission_scope),
    (v_role_compliance, 'reports',    'write'::permission_action, 'org'::permission_scope),
    (v_role_compliance, 'audit_logs', 'read'::permission_action,  'org'::permission_scope)
  ON CONFLICT (role_id, resource, action, scope) DO NOTHING;

  -- auditor — read-only across documents, reports, audit trail
  INSERT INTO public.permissions (role_id, resource, action, scope)
  VALUES
    (v_role_auditor, 'documents',  'read'::permission_action, 'org'::permission_scope),
    (v_role_auditor, 'reports',    'read'::permission_action, 'org'::permission_scope),
    (v_role_auditor, 'audit_logs', 'read'::permission_action, 'org'::permission_scope),
    (v_role_auditor, 'workflows',  'read'::permission_action, 'org'::permission_scope)
  ON CONFLICT (role_id, resource, action, scope) DO NOTHING;

  -- security_analyst — security telemetry and event monitoring
  INSERT INTO public.permissions (role_id, resource, action, scope)
  VALUES
    (v_role_analyst, 'security_events', 'read'::permission_action, 'org'::permission_scope),
    (v_role_analyst, 'violations',      'read'::permission_action, 'org'::permission_scope),
    (v_role_analyst, 'ai_requests',     'read'::permission_action, 'org'::permission_scope),
    (v_role_analyst, 'audit_logs',      'read'::permission_action, 'org'::permission_scope),
    (v_role_analyst, 'documents',       'read'::permission_action, 'org'::permission_scope)
  ON CONFLICT (role_id, resource, action, scope) DO NOTHING;

  RAISE NOTICE 'Permissions seeded.';

  -- =========================================================================
  -- 4. USER PROFILES
  -- The role column mirrors user_roles for fast RLS checks.
  -- ON CONFLICT updates are safe to re-run (idempotent).
  -- =========================================================================
  INSERT INTO public.user_profiles (id, org_id, full_name, role, department, is_active)
  VALUES
    (v_super_admin_auth_id, v_org_id, 'Hithaishi',       'super_admin'::user_role,        'Platform',       true),
    (v_compliance_auth_id,  v_org_id, 'Priya Nair',        'compliance_officer'::user_role, 'Compliance',     true),
    (v_auditor_auth_id,     v_org_id, 'Jordan Blake',      'auditor'::user_role,            'Internal Audit', true),
    (v_analyst_auth_id,     v_org_id, 'Sam Krishnamurthy', 'security_analyst'::user_role,   'Security',       true)
  ON CONFLICT (id) DO UPDATE
    SET
      org_id     = EXCLUDED.org_id,
      full_name  = EXCLUDED.full_name,
      role       = EXCLUDED.role,
      department = EXCLUDED.department,
      is_active  = EXCLUDED.is_active,
      updated_at = now();

  RAISE NOTICE 'User profiles seeded.';

  -- =========================================================================
  -- 5. USER_ROLES (junction table)
  -- Links each user profile to its role definition.
  -- super_admin is recorded as the granting authority for all assignments.
  -- =========================================================================
  INSERT INTO public.user_roles (user_id, role_id, granted_by)
  VALUES
    (v_super_admin_auth_id, v_role_super_admin, v_super_admin_auth_id),
    (v_compliance_auth_id,  v_role_compliance,  v_super_admin_auth_id),
    (v_auditor_auth_id,     v_role_auditor,     v_super_admin_auth_id),
    (v_analyst_auth_id,     v_role_analyst,     v_super_admin_auth_id)
  ON CONFLICT (user_id, role_id) DO NOTHING;

  RAISE NOTICE 'User role assignments seeded.';

  -- =========================================================================
  -- 6. AUDIT LOG
  -- Records this seed run as an immutable event via log_audit_event().
  -- Note: p_resource_id is UUID (not text) per migration 0012.
  -- =========================================================================
  PERFORM public.log_audit_event(
    p_org_id        => v_org_id,
    p_user_id       => v_super_admin_auth_id,
    p_action        => 'seed.org_initialized',
    p_resource_type => 'organization',
    p_resource_id   => v_org_id,
    p_new_value     => jsonb_build_object(
      'org_name',           'AegisRAG Demo Corp',
      'slug',               'aegisrag-demo',
      'seeded_users',       jsonb_build_array('super_admin', 'compliance_officer', 'auditor', 'security_analyst'),
      'seed_version',       '1.0.0',
      'migration_baseline', '0014'
    )
  );

  RAISE NOTICE 'Audit log entry written for seed.org_initialized.';

  -- =========================================================================
  -- SUMMARY
  -- =========================================================================
  RAISE NOTICE '========================================================';
  RAISE NOTICE 'AegisRAG Demo seed complete.';
  RAISE NOTICE '  Organization : AegisRAG Demo Corp (aegisrag-demo)';
  RAISE NOTICE '  Org ID       : %', v_org_id;
  RAISE NOTICE '  Users        : 4 profiles inserted/updated';
  RAISE NOTICE '  Roles        : 4 definitions, 23 permissions';
  RAISE NOTICE '  User roles   : 4 assignments';
  RAISE NOTICE '  Audit entry  : seed.org_initialized written';
  RAISE NOTICE '========================================================';

END $$;
