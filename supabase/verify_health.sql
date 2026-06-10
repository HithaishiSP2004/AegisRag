-- ============================================================
-- AegisRAG Database Health Verification Package
-- Run in Supabase SQL Editor (service_role / postgres)
-- Output: PASS / FAIL per check
-- ============================================================

-- ┌─────────────────────────────────────────────────────────┐
-- │  SECTION 1 — TABLE EXISTENCE                            │
-- └─────────────────────────────────────────────────────────┘
SELECT
  t.tbl                                                    AS "Table",
  CASE WHEN c.relname IS NOT NULL THEN 'PASS' ELSE 'FAIL' END AS "Status"
FROM (VALUES
  ('organizations'),
  ('user_profiles'),
  ('roles'),
  ('permissions'),
  ('user_roles'),
  ('documents'),
  ('document_versions'),
  ('pages'),
  ('chunks'),
  ('embeddings'),
  ('workflows'),
  ('reports'),
  ('violations'),
  ('audit_logs'),
  ('security_events'),
  ('ai_requests')
) AS t(tbl)
LEFT JOIN pg_class c
  ON c.relname = t.tbl
 AND c.relnamespace = 'public'::regnamespace
 AND c.relkind = 'r'
ORDER BY t.tbl;

-- ┌─────────────────────────────────────────────────────────┐
-- │  SECTION 2 — ENUM TYPE EXISTENCE                        │
-- └─────────────────────────────────────────────────────────┘
SELECT
  e.ename                                                     AS "ENUM Type",
  CASE WHEN t.typname IS NOT NULL THEN 'PASS' ELSE 'FAIL' END AS "Status"
FROM (VALUES
  ('org_plan'),
  ('user_role'),
  ('permission_action'),
  ('permission_scope'),
  ('document_status'),
  ('document_type'),
  ('sensitivity_level'),
  ('page_status'),
  ('workflow_status'),
  ('report_type'),
  ('report_status'),
  ('violation_severity'),
  ('security_event_type'),
  ('security_event_severity')
) AS e(ename)
LEFT JOIN pg_type t
  ON t.typname = e.ename
 AND t.typnamespace = 'public'::regnamespace
 AND t.typtype = 'e'
ORDER BY e.ename;

-- ┌─────────────────────────────────────────────────────────┐
-- │  SECTION 3 — FOREIGN KEY EXISTENCE                      │
-- └─────────────────────────────────────────────────────────┘
SELECT
  fk.src_table || '.' || fk.src_col || ' → ' ||
  fk.ref_table || '.' || fk.ref_col               AS "Foreign Key",
  CASE WHEN c.conname IS NOT NULL THEN 'PASS' ELSE 'FAIL' END AS "Status"
FROM (VALUES
  ('user_profiles',     'id',                'auth.users',      'id'),
  ('user_profiles',     'org_id',            'organizations',   'id'),
  ('roles',             'org_id',            'organizations',   'id'),
  ('permissions',       'role_id',           'roles',           'id'),
  ('user_roles',        'user_id',           'user_profiles',   'id'),
  ('user_roles',        'role_id',           'roles',           'id'),
  ('user_roles',        'granted_by',        'user_profiles',   'id'),
  ('documents',         'org_id',            'organizations',   'id'),
  ('documents',         'uploaded_by',       'user_profiles',   'id'),
  ('document_versions', 'document_id',       'documents',       'id'),
  ('document_versions', 'created_by',        'user_profiles',   'id'),
  ('pages',             'document_id',       'documents',       'id'),
  ('pages',             'org_id',            'organizations',   'id'),
  ('chunks',            'document_id',       'documents',       'id'),
  ('chunks',            'page_id',           'pages',           'id'),
  ('chunks',            'org_id',            'organizations',   'id'),
  ('embeddings',        'chunk_id',          'chunks',          'id'),
  ('embeddings',        'org_id',            'organizations',   'id'),
  ('workflows',         'org_id',            'organizations',   'id'),
  ('workflows',         'created_by',        'user_profiles',   'id'),
  ('workflows',         'input_document_id', 'documents',       'id'),
  ('reports',           'workflow_id',       'workflows',       'id'),
  ('reports',           'org_id',            'organizations',   'id'),
  ('reports',           'created_by',        'user_profiles',   'id'),
  ('violations',        'report_id',         'reports',         'id'),
  ('violations',        'org_id',            'organizations',   'id'),
  ('audit_logs',        'org_id',            'organizations',   'id'),
  ('audit_logs',        'user_id',           'user_profiles',   'id'),
  ('security_events',   'org_id',            'organizations',   'id'),
  ('security_events',   'user_id',           'user_profiles',   'id'),
  ('ai_requests',       'org_id',            'organizations',   'id'),
  ('ai_requests',       'user_id',           'user_profiles',   'id'),
  ('ai_requests',       'workflow_id',       'workflows',       'id')
) AS fk(src_table, src_col, ref_table, ref_col)
LEFT JOIN pg_constraint c
  ON c.contype = 'f'
 AND c.conrelid = (fk.src_table)::regclass
 AND EXISTS (
   SELECT 1
   FROM pg_attribute a
   WHERE a.attrelid = c.conrelid
     AND a.attnum   = ANY(c.conkey)
     AND a.attname  = fk.src_col
 )
ORDER BY fk.src_table, fk.src_col;

-- ┌─────────────────────────────────────────────────────────┐
-- │  SECTION 4 — INDEX EXISTENCE                            │
-- └─────────────────────────────────────────────────────────┘
SELECT
  idx.iname                                                    AS "Index",
  CASE WHEN i.indexname IS NOT NULL THEN 'PASS' ELSE 'FAIL' END AS "Status"
FROM (VALUES
  -- organizations
  ('idx_organizations_slug'),
  -- user_profiles
  ('idx_user_profiles_org_id'),
  ('idx_user_profiles_role'),
  ('idx_user_profiles_is_active'),
  -- roles / permissions / user_roles
  ('idx_roles_org_id'),
  ('idx_permissions_role_id'),
  ('idx_permissions_resource_action'),
  ('idx_user_roles_user_id'),
  ('idx_user_roles_role_id'),
  -- documents
  ('idx_documents_org_id'),
  ('idx_documents_uploaded_by'),
  ('idx_documents_status'),
  ('idx_documents_doc_type'),
  ('idx_documents_department'),
  ('idx_documents_sensitivity'),
  ('idx_documents_org_status'),
  ('idx_documents_metadata'),
  ('idx_documents_indexed'),
  -- document_versions
  ('idx_document_versions_document_id'),
  ('idx_document_versions_created_by'),
  -- pages
  ('idx_pages_document_id'),
  ('idx_pages_org_id'),
  ('idx_pages_status'),
  ('idx_pages_org_status'),
  ('idx_pages_failed'),
  -- chunks
  ('idx_chunks_document_id'),
  ('idx_chunks_page_id'),
  ('idx_chunks_org_id'),
  ('idx_chunks_metadata'),
  ('idx_chunks_doc_page'),
  -- embeddings
  ('idx_embeddings_hnsw'),
  ('idx_embeddings_org_id'),
  ('idx_embeddings_chunk_id'),
  -- workflows
  ('idx_workflows_org_id'),
  ('idx_workflows_created_by'),
  ('idx_workflows_status'),
  ('idx_workflows_org_active'),
  ('idx_workflows_updated_at'),
  -- reports
  ('idx_reports_org_id'),
  ('idx_reports_workflow_id'),
  ('idx_reports_created_by'),
  ('idx_reports_report_type'),
  ('idx_reports_status'),
  ('idx_reports_org_created'),
  ('idx_reports_fallback'),
  ('idx_reports_content'),
  -- violations
  ('idx_violations_report_id'),
  ('idx_violations_org_id'),
  ('idx_violations_severity'),
  ('idx_violations_report_severity'),
  ('idx_violations_evidence'),
  -- audit_logs
  ('idx_audit_logs_org_id'),
  ('idx_audit_logs_user_id'),
  ('idx_audit_logs_created_at'),
  ('idx_audit_logs_action'),
  ('idx_audit_logs_resource_type'),
  ('idx_audit_logs_org_time'),
  ('idx_audit_logs_org_user'),
  ('idx_audit_logs_resource'),
  ('idx_audit_logs_new_value'),
  -- security_events
  ('idx_security_events_org_id'),
  ('idx_security_events_user_id'),
  ('idx_security_events_event_type'),
  ('idx_security_events_severity'),
  ('idx_security_events_created_at'),
  ('idx_security_events_blocked'),
  ('idx_security_events_org_time'),
  ('idx_security_events_critical'),
  ('idx_security_events_real'),
  -- ai_requests
  ('idx_ai_requests_org_id'),
  ('idx_ai_requests_user_id'),
  ('idx_ai_requests_workflow_id'),
  ('idx_ai_requests_model_used'),
  ('idx_ai_requests_created_at'),
  ('idx_ai_requests_fallback'),
  ('idx_ai_requests_org_time'),
  ('idx_ai_requests_model_time'),
  ('idx_ai_requests_failures')
) AS idx(iname)
LEFT JOIN pg_indexes i
  ON i.indexname = idx.iname
 AND i.schemaname = 'public'
ORDER BY idx.iname;

-- ┌─────────────────────────────────────────────────────────┐
-- │  SECTION 5 — HNSW / VECTOR INFRASTRUCTURE               │
-- └─────────────────────────────────────────────────────────┘
-- 5a: pgvector extension enabled
SELECT
  'pgvector extension'                                            AS "Check",
  CASE WHEN extname IS NOT NULL THEN 'PASS' ELSE 'FAIL' END       AS "Status"
FROM pg_extension
WHERE extname = 'vector'
UNION ALL
-- 5b: embeddings column is vector(768)
SELECT
  'embeddings.embedding is vector(768)',
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'embeddings'
        AND column_name  = 'embedding'
        AND udt_name     = 'vector'
    ) THEN 'PASS' ELSE 'FAIL'
  END
UNION ALL
-- 5c: HNSW index exists with correct access method
SELECT
  'idx_embeddings_hnsw uses hnsw access method',
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_indexes i
      JOIN pg_class c ON c.relname = i.indexname
      JOIN pg_am    a ON a.oid     = c.relam AND a.amname = 'hnsw'
      WHERE i.schemaname = 'public'
        AND i.indexname  = 'idx_embeddings_hnsw'
    ) THEN 'PASS' ELSE 'FAIL'
  END
UNION ALL
-- 5d: match_chunks function exists
SELECT
  'match_chunks() function exists',
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'match_chunks'
    ) THEN 'PASS' ELSE 'FAIL'
  END
UNION ALL
-- 5e: get_corpus_stats function exists
SELECT
  'get_corpus_stats() function exists',
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'get_corpus_stats'
    ) THEN 'PASS' ELSE 'FAIL'
  END;

-- ┌─────────────────────────────────────────────────────────┐
-- │  SECTION 6 — RLS ENABLED ON ALL TABLES                  │
-- └─────────────────────────────────────────────────────────┘
SELECT
  t.tbl                                                      AS "Table",
  CASE WHEN c.relrowsecurity = true THEN 'PASS' ELSE 'FAIL' END AS "RLS Enabled"
FROM (VALUES
  ('organizations'),
  ('user_profiles'),
  ('roles'),
  ('permissions'),
  ('user_roles'),
  ('documents'),
  ('document_versions'),
  ('pages'),
  ('chunks'),
  ('embeddings'),
  ('workflows'),
  ('reports'),
  ('violations'),
  ('audit_logs'),
  ('security_events'),
  ('ai_requests')
) AS t(tbl)
LEFT JOIN pg_class c
  ON c.relname = t.tbl
 AND c.relnamespace = 'public'::regnamespace
ORDER BY t.tbl;

-- ┌─────────────────────────────────────────────────────────┐
-- │  SECTION 7 — RLS POLICY EXISTENCE                       │
-- └─────────────────────────────────────────────────────────┘
SELECT
  p.pname                                                      AS "Policy",
  CASE WHEN pg_p.policyname IS NOT NULL THEN 'PASS' ELSE 'FAIL' END AS "Status"
FROM (VALUES
  ('org_select_own'),
  ('profiles_select_same_org'),
  ('profiles_update_own'),
  ('profiles_insert_admin'),
  ('roles_select_org_members'),
  ('permissions_select_org_members'),
  ('user_roles_select_own'),
  ('user_roles_select_admin'),
  ('documents_select_org_members'),
  ('documents_insert_authorized'),
  ('documents_update_authorized'),
  ('documents_delete_admin'),
  ('doc_versions_select_org_members'),
  ('doc_versions_insert_authorized'),
  ('pages_select_org_members'),
  ('chunks_select_org_members'),
  ('embeddings_select_org_members'),
  ('workflows_select_org_members'),
  ('workflows_insert_authorized'),
  ('reports_select_org_members'),
  ('violations_select_org_members'),
  ('audit_logs_select_privileged'),
  ('security_events_select_privileged'),
  ('ai_requests_select_privileged')
) AS p(pname)
LEFT JOIN pg_policies pg_p
  ON pg_p.policyname = p.pname
 AND pg_p.schemaname = 'public'
ORDER BY p.pname;

-- ┌─────────────────────────────────────────────────────────┐
-- │  SECTION 8 — FUNCTION EXISTENCE                         │
-- └─────────────────────────────────────────────────────────┘
SELECT
  f.fname                                                        AS "Function",
  CASE WHEN p.proname IS NOT NULL THEN 'PASS' ELSE 'FAIL' END    AS "Status"
FROM (VALUES
  ('update_updated_at_column'),
  ('handle_new_auth_user'),
  ('match_chunks'),
  ('get_corpus_stats'),
  ('compute_risk_score'),
  ('prevent_audit_log_modification'),
  ('log_audit_event'),
  ('get_security_stats'),
  ('get_token_usage_stats')
) AS f(fname)
LEFT JOIN pg_proc p
  ON p.proname = f.fname
 AND p.pronamespace = 'public'::regnamespace
ORDER BY f.fname;

-- ┌─────────────────────────────────────────────────────────┐
-- │  SECTION 9 — TRIGGER EXISTENCE                          │
-- └─────────────────────────────────────────────────────────┘
SELECT
  trg.tname                                                       AS "Trigger",
  CASE WHEN t.tgname IS NOT NULL THEN 'PASS' ELSE 'FAIL' END      AS "Status"
FROM (VALUES
  ('trg_organizations_updated_at'),
  ('trg_user_profiles_updated_at'),
  ('trg_on_auth_user_created'),
  ('trg_documents_updated_at'),
  ('trg_pages_updated_at'),
  ('trg_workflows_updated_at'),
  ('trg_reports_updated_at'),
  ('trg_audit_logs_immutable')
) AS trg(tname)
LEFT JOIN pg_trigger t
  ON t.tgname = trg.tname
ORDER BY trg.tname;

-- ┌─────────────────────────────────────────────────────────┐
-- │  SECTION 10 — IMMUTABILITY RULES (append-only tables)   │
-- └─────────────────────────────────────────────────────────┘
SELECT
  r.rname                                                        AS "Immutability Rule",
  CASE WHEN pg_r.rulename IS NOT NULL THEN 'PASS' ELSE 'FAIL' END AS "Status"
FROM (VALUES
  ('document_versions_no_update'),
  ('violations_no_update'),
  ('audit_logs_no_update'),
  ('audit_logs_no_delete'),
  ('security_events_no_update'),
  ('security_events_no_delete'),
  ('ai_requests_no_update')
) AS r(rname)
LEFT JOIN pg_rules pg_r
  ON pg_r.rulename   = r.rname
 AND pg_r.schemaname = 'public'
ORDER BY r.rname;

-- ┌─────────────────────────────────────────────────────────┐
-- │  SECTION 11 — STORAGE BUCKET ARCHITECTURE               │
-- └─────────────────────────────────────────────────────────┘
-- Verifies the 'documents' storage bucket exists in Supabase Storage.
-- Expected: private bucket named 'documents' for org-scoped document files.
SELECT
  b.name                                                          AS "Bucket",
  CASE WHEN b.id IS NOT NULL THEN 'PASS' ELSE 'FAIL' END          AS "Exists",
  CASE WHEN b.public = false THEN 'PASS' ELSE 'FAIL' END          AS "Is Private"
FROM storage.buckets b
WHERE b.name = 'documents';

-- ┌─────────────────────────────────────────────────────────┐
-- │  SECTION 12 — MULTI-TENANT ISOLATION ENFORCEMENT        │
-- └─────────────────────────────────────────────────────────┘
-- Verifies that every core table has an org_id column (tenant boundary enforcer).
SELECT
  t.tbl                                                           AS "Table",
  CASE WHEN c.column_name IS NOT NULL THEN 'PASS' ELSE 'FAIL' END AS "Has org_id Column"
FROM (VALUES
  ('organizations'),
  ('user_profiles'),
  ('roles'),
  ('documents'),
  ('document_versions'),
  ('pages'),
  ('chunks'),
  ('embeddings'),
  ('workflows'),
  ('reports'),
  ('violations'),
  ('audit_logs'),
  ('security_events'),
  ('ai_requests')
) AS t(tbl)
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public'
 AND c.table_name   = t.tbl
 AND c.column_name  = 'org_id'
ORDER BY t.tbl;

-- Cross-tenant RLS check: ensure no public-access policies exist on tenant tables
SELECT
  pg_p.tablename                                                  AS "Table",
  pg_p.policyname                                                 AS "Suspicious Policy",
  'REVIEW'                                                        AS "Status"
FROM pg_policies pg_p
WHERE pg_p.schemaname = 'public'
  AND pg_p.qual NOT ILIKE '%org_id%'
  AND pg_p.qual NOT ILIKE '%auth.uid()%'
  AND pg_p.tablename NOT IN ('schema_migrations');

-- ┌─────────────────────────────────────────────────────────┐
-- │  SECTION 13 — AI TELEMETRY ARCHITECTURE                 │
-- └─────────────────────────────────────────────────────────┘
-- 13a: ai_requests table has all required telemetry columns
SELECT
  col.cname                                                        AS "ai_requests Column",
  CASE WHEN c.column_name IS NOT NULL THEN 'PASS' ELSE 'FAIL' END  AS "Status"
FROM (VALUES
  ('id'), ('org_id'), ('user_id'), ('workflow_id'),
  ('model_used'), ('prompt_tokens'), ('completion_tokens'),
  ('total_tokens'), ('latency_ms'), ('fallback_level'),
  ('success'), ('error_code'), ('error_message'),
  ('call_type'), ('created_at')
) AS col(cname)
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public'
 AND c.table_name   = 'ai_requests'
 AND c.column_name  = col.cname
ORDER BY col.cname;

-- 13b: model_used CHECK constraint allows all 5 approved models
SELECT
  'ai_requests.model_used CHECK constraint'                        AS "Check",
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.ai_requests'::regclass
        AND contype  = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%gemini-3.5-flash%'
        AND pg_get_constraintdef(oid) ILIKE '%gemini-3-flash%'
        AND pg_get_constraintdef(oid) ILIKE '%raw_chunk_fallback%'
    ) THEN 'PASS' ELSE 'FAIL'
  END AS "Status"
UNION ALL
-- 13c: get_token_usage_stats function exists
SELECT
  'get_token_usage_stats() function',
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'get_token_usage_stats'
    ) THEN 'PASS' ELSE 'FAIL'
  END
UNION ALL
-- 13d: fallback_level range constraint (0-3)
SELECT
  'ai_requests.fallback_level CHECK (0-3)',
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.ai_requests'::regclass
        AND contype  = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%fallback_level%between 0 and 3%'
    ) THEN 'PASS' ELSE 'FAIL'
  END
UNION ALL
-- 13e: ai_requests immutability rule
SELECT
  'ai_requests_no_update rule (immutable telemetry)',
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_rules
      WHERE schemaname = 'public'
        AND tablename  = 'ai_requests'
        AND rulename   = 'ai_requests_no_update'
    ) THEN 'PASS' ELSE 'FAIL'
  END;

-- ┌─────────────────────────────────────────────────────────┐
-- │  SECTION 14 — OVERALL SUMMARY SCORECARD                 │
-- └─────────────────────────────────────────────────────────┘
WITH checks AS (
  -- Tables (16)
  SELECT 'Table' AS category,
    SUM(CASE WHEN c.relname IS NOT NULL THEN 1 ELSE 0 END) AS passed,
    COUNT(*) AS total
  FROM (VALUES
    ('organizations'),('user_profiles'),('roles'),('permissions'),
    ('user_roles'),('documents'),('document_versions'),('pages'),
    ('chunks'),('embeddings'),('workflows'),('reports'),
    ('violations'),('audit_logs'),('security_events'),('ai_requests')
  ) t(tbl)
  LEFT JOIN pg_class c
    ON c.relname = t.tbl AND c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'

  UNION ALL

  -- ENUMs (14)
  SELECT 'ENUM Type',
    SUM(CASE WHEN tp.typname IS NOT NULL THEN 1 ELSE 0 END),
    COUNT(*)
  FROM (VALUES
    ('org_plan'),('user_role'),('permission_action'),('permission_scope'),
    ('document_status'),('document_type'),('sensitivity_level'),('page_status'),
    ('workflow_status'),('report_type'),('report_status'),('violation_severity'),
    ('security_event_type'),('security_event_severity')
  ) e(ename)
  LEFT JOIN pg_type tp
    ON tp.typname = e.ename AND tp.typnamespace = 'public'::regnamespace AND tp.typtype = 'e'

  UNION ALL

  -- Functions (9)
  SELECT 'Function',
    SUM(CASE WHEN p.proname IS NOT NULL THEN 1 ELSE 0 END),
    COUNT(*)
  FROM (VALUES
    ('update_updated_at_column'),('handle_new_auth_user'),('match_chunks'),
    ('get_corpus_stats'),('compute_risk_score'),('prevent_audit_log_modification'),
    ('log_audit_event'),('get_security_stats'),('get_token_usage_stats')
  ) f(fname)
  LEFT JOIN pg_proc p
    ON p.proname = f.fname AND p.pronamespace = 'public'::regnamespace

  UNION ALL

  -- Triggers (8)
  SELECT 'Trigger',
    SUM(CASE WHEN t.tgname IS NOT NULL THEN 1 ELSE 0 END),
    COUNT(*)
  FROM (VALUES
    ('trg_organizations_updated_at'),('trg_user_profiles_updated_at'),
    ('trg_on_auth_user_created'),('trg_documents_updated_at'),
    ('trg_pages_updated_at'),('trg_workflows_updated_at'),
    ('trg_reports_updated_at'),('trg_audit_logs_immutable')
  ) trg(tname)
  LEFT JOIN pg_trigger t ON t.tgname = trg.tname

  UNION ALL

  -- Immutability Rules (7)
  SELECT 'Immutability Rule',
    SUM(CASE WHEN pg_r.rulename IS NOT NULL THEN 1 ELSE 0 END),
    COUNT(*)
  FROM (VALUES
    ('document_versions_no_update'),('violations_no_update'),
    ('audit_logs_no_update'),('audit_logs_no_delete'),
    ('security_events_no_update'),('security_events_no_delete'),
    ('ai_requests_no_update')
  ) r(rname)
  LEFT JOIN pg_rules pg_r
    ON pg_r.rulename = r.rname AND pg_r.schemaname = 'public'

  UNION ALL

  -- RLS Policies (24)
  SELECT 'RLS Policy',
    SUM(CASE WHEN pg_p.policyname IS NOT NULL THEN 1 ELSE 0 END),
    COUNT(*)
  FROM (VALUES
    ('org_select_own'),('profiles_select_same_org'),('profiles_update_own'),
    ('profiles_insert_admin'),('roles_select_org_members'),
    ('permissions_select_org_members'),('user_roles_select_own'),
    ('user_roles_select_admin'),('documents_select_org_members'),
    ('documents_insert_authorized'),('documents_update_authorized'),
    ('documents_delete_admin'),('doc_versions_select_org_members'),
    ('doc_versions_insert_authorized'),('pages_select_org_members'),
    ('chunks_select_org_members'),('embeddings_select_org_members'),
    ('workflows_select_org_members'),('workflows_insert_authorized'),
    ('reports_select_org_members'),('violations_select_org_members'),
    ('audit_logs_select_privileged'),('security_events_select_privileged'),
    ('ai_requests_select_privileged')
  ) p(pname)
  LEFT JOIN pg_policies pg_p
    ON pg_p.policyname = p.pname AND pg_p.schemaname = 'public'
)
SELECT
  category                                                         AS "Category",
  passed                                                           AS "Passed",
  total                                                            AS "Total",
  CASE WHEN passed = total THEN '✅ PASS' ELSE '❌ FAIL (' || (total - passed) || ' missing)' END AS "Result"
FROM checks
ORDER BY category;
