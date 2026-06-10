-- Seed 001: Demo Organization
-- Run AFTER all migrations are applied

INSERT INTO organizations (id, name, slug, plan, settings)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'AegisRAG Demo Corp',
  'aegisrag-demo',
  'enterprise',
  '{"demo": true, "max_documents": 1000, "max_users": 50}'
)
ON CONFLICT (slug) DO NOTHING;
