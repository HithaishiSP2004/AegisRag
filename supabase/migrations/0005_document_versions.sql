-- ============================================================
-- Migration 0005: document_versions
-- Immutable version history. Runs AFTER 0004_documents.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS document_versions (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id    UUID        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_number INT         NOT NULL CHECK (version_number > 0),
  storage_path   TEXT        NOT NULL CHECK (char_length(storage_path) BETWEEN 1 AND 1000),
  file_size_bytes BIGINT     NOT NULL DEFAULT 0 CHECK (file_size_bytes >= 0),
  page_count     INT         NOT NULL DEFAULT 0 CHECK (page_count >= 0),
  change_summary TEXT        CHECK (char_length(change_summary) <= 1000),
  created_by     UUID        NOT NULL REFERENCES user_profiles(id) ON DELETE RESTRICT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- NO updated_at: version records are immutable once created
  UNIQUE (document_id, version_number)
);

-- ── Prevent updates to version records ───────────────────────
CREATE OR REPLACE RULE document_versions_no_update AS
  ON UPDATE TO document_versions DO INSTEAD NOTHING;

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX idx_document_versions_document_id ON document_versions(document_id);
CREATE INDEX idx_document_versions_created_by  ON document_versions(created_by);

-- ── Row Level Security ───────────────────────────────────────
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "doc_versions_select_org_members"
  ON document_versions FOR SELECT
  USING (
    document_id IN (
      SELECT id FROM documents
      WHERE org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "doc_versions_insert_authorized"
  ON document_versions FOR INSERT
  WITH CHECK (
    document_id IN (
      SELECT id FROM documents
      WHERE org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid())
      AND (SELECT role FROM user_profiles WHERE id = auth.uid())
          IN ('super_admin', 'compliance_officer')
    )
  );
