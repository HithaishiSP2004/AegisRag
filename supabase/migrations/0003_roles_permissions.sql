-- ============================================================
-- Migration 0003: roles, permissions, user_roles
-- RBAC foundation. Runs AFTER 0002_user_profiles.sql
-- ============================================================

-- Permission action ENUM
CREATE TYPE permission_action AS ENUM ('read', 'write', 'delete', 'admin');

-- Permission scope ENUM
CREATE TYPE permission_scope AS ENUM ('org', 'department', 'document');

-- ── roles ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        user_role   NOT NULL,  -- reuses user_role ENUM from 0002
  description TEXT        CHECK (char_length(description) <= 500),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, name)
);

CREATE INDEX idx_roles_org_id ON roles(org_id);

-- ── permissions ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS permissions (
  id          UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id     UUID              NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  resource    TEXT              NOT NULL CHECK (char_length(resource) <= 100),
  action      permission_action NOT NULL,
  scope       permission_scope  NOT NULL,
  created_at  TIMESTAMPTZ       NOT NULL DEFAULT now(),
  UNIQUE (role_id, resource, action, scope)
);

CREATE INDEX idx_permissions_role_id          ON permissions(role_id);
CREATE INDEX idx_permissions_resource_action  ON permissions(resource, action);

-- ── user_roles (junction) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_roles (
  user_id    UUID        NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  role_id    UUID        NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  granted_by UUID        REFERENCES user_profiles(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);

CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);

-- ── Row Level Security ───────────────────────────────────────
ALTER TABLE roles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles  ENABLE ROW LEVEL SECURITY;

-- All org members can read roles defined in their org
CREATE POLICY "roles_select_org_members"
  ON roles FOR SELECT
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid())
  );

-- All org members can read permissions for roles in their org
CREATE POLICY "permissions_select_org_members"
  ON permissions FOR SELECT
  USING (
    role_id IN (
      SELECT id FROM roles
      WHERE org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid())
    )
  );

-- Users can read their own role assignments
CREATE POLICY "user_roles_select_own"
  ON user_roles FOR SELECT
  USING (user_id = auth.uid());

-- Admins can read all role assignments in org
CREATE POLICY "user_roles_select_admin"
  ON user_roles FOR SELECT
  USING (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) IN ('super_admin', 'compliance_officer')
    AND role_id IN (
      SELECT id FROM roles
      WHERE org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid())
    )
  );
