-- ============================================================
-- Migration 0004: documents
-- Core entity. Runs AFTER 0002_user_profiles.sql
-- ============================================================

-- Document processing status ENUM
CREATE TYPE document_status AS ENUM (
  'uploading',
  'parsing',
  'chunking',
  'embedding',
  'indexed',
  'failed',
  'deleted'
);

-- Document type ENUM
CREATE TYPE document_type AS ENUM (
  'hr_policy',
  'security_policy',
  'compliance_manual',
  'legal',
  'vendor',
  'regulatory',
  'other'
);

-- Sensitivity level ENUM
CREATE TYPE sensitivity_level AS ENUM (
  'public',
  'internal',
  'confidential',
  'restricted'
);

CREATE TABLE IF NOT EXISTS documents (
  id               UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID              NOT NULL REFERENCES organizations(id)  ON DELETE CASCADE,
  uploaded_by      UUID              NOT NULL REFERENCES user_profiles(id)  ON DELETE RESTRICT,
  filename         TEXT              NOT NULL CHECK (char_length(filename) BETWEEN 1 AND 500),
  original_name    TEXT              NOT NULL CHECK (char_length(original_name) BETWEEN 1 AND 500),
  storage_path     TEXT              NOT NULL CHECK (char_length(storage_path) BETWEEN 1 AND 1000),
  file_size_bytes  BIGINT            NOT NULL DEFAULT 0 CHECK (file_size_bytes >= 0),
  page_count       INT               NOT NULL DEFAULT 0 CHECK (page_count >= 0),
  status           document_status   NOT NULL DEFAULT 'uploading',
  doc_type         document_type     NOT NULL DEFAULT 'other',
  department       TEXT              CHECK (char_length(department) <= 100),
  sensitivity      sensitivity_level NOT NULL DEFAULT 'internal',
  metadata         JSONB             NOT NULL DEFAULT '{}',
  -- metadata expected keys: {source_url, tags[], custom_fields{}}
  error_message    TEXT,  -- populated when status = 'failed'
  created_at       TIMESTAMPTZ       NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ       NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX idx_documents_org_id      ON documents(org_id);
CREATE INDEX idx_documents_uploaded_by ON documents(uploaded_by);
CREATE INDEX idx_documents_status      ON documents(status);
CREATE INDEX idx_documents_doc_type    ON documents(doc_type);
CREATE INDEX idx_documents_department  ON documents(department) WHERE department IS NOT NULL;
CREATE INDEX idx_documents_sensitivity ON documents(sensitivity);

-- Composite: most common query pattern (org + status filter)
CREATE INDEX idx_documents_org_status  ON documents(org_id, status);

-- JSONB: enables fast queries on metadata fields
CREATE INDEX idx_documents_metadata    ON documents USING gin(metadata);

-- Partial: fast query for "documents ready to query"
CREATE INDEX idx_documents_indexed     ON documents(org_id, doc_type, department)
  WHERE status = 'indexed';

-- ── Row Level Security ───────────────────────────────────────
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- All org members can read documents
CREATE POLICY "documents_select_org_members"
  ON documents FOR SELECT
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid())
    AND status != 'deleted'
  );

-- Compliance officers and admins can insert documents
CREATE POLICY "documents_insert_authorized"
  ON documents FOR INSERT
  WITH CHECK (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid())
    AND (SELECT role FROM user_profiles WHERE id = auth.uid())
        IN ('super_admin', 'compliance_officer')
  );

-- Uploaders and admins can update (status transitions, metadata)
CREATE POLICY "documents_update_authorized"
  ON documents FOR UPDATE
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid())
    AND (
      uploaded_by = auth.uid()
      OR (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'super_admin'
    )
  );

-- Only admins can hard-delete (soft-delete preferred via status='deleted')
CREATE POLICY "documents_delete_admin"
  ON documents FOR DELETE
  USING (
    (SELECT role FROM user_profiles WHERE id = auth.uid()) = 'super_admin'
    AND org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid())
  );
