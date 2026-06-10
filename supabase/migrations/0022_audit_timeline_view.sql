CREATE OR REPLACE VIEW audit_timeline AS
SELECT
  al.id,
  al.org_id,
  al.user_id,
  up.full_name AS actor_name,
  up.role AS actor_role,
  al.action,
  al.resource_type,
  al.resource_id,
  al.new_value,
  al.old_value,
  al.ip_address::TEXT AS ip_address,
  al.created_at
FROM audit_logs al
LEFT JOIN user_profiles up
  ON up.id = al.user_id;