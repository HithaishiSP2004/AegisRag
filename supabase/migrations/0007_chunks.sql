-- ============================================================
-- Migration 0007: chunks
-- Text chunks with rich metadata for RBAC-filtered retrieval.
-- Runs AFTER 0006_pages.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS chunks (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID        NOT NULL REFERENCES documents(id)    ON DELETE CASCADE,
  page_id     UUID        NOT NULL REFERENCES pages(id)        ON DELETE CASCADE,
  org_id      UUID        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  chunk_index INT         NOT NULL CHECK (chunk_index >= 0),
  content     TEXT        NOT NULL CHECK (char_length(content) > 0),
  token_count INT         NOT NULL DEFAULT 0 CHECK (token_count >= 0),

  -- Denormalized metadata for fast retrieval filtering without joins
  -- Required keys: department, doc_type, sensitivity, page_number,
  --                section_title, document_id, org_id
  -- RBAC enforcement: retrieval pipeline filters on org_id + department
  metadata    JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (document_id, chunk_index)
);

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX idx_chunks_document_id ON chunks(document_id);
CREATE INDEX idx_chunks_page_id     ON chunks(page_id);
CREATE INDEX idx_chunks_org_id      ON chunks(org_id);

-- GIN on metadata: enables fast JSONB field filtering
-- Used in retrieval pipeline to enforce RBAC on vector search
CREATE INDEX idx_chunks_metadata    ON chunks USING gin(metadata);

-- Composite: used when deleting/re-indexing chunks for a specific page
CREATE INDEX idx_chunks_doc_page    ON chunks(document_id, page_id);

-- ── Row Level Security ───────────────────────────────────────
ALTER TABLE chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chunks_select_org_members"
  ON chunks FOR SELECT
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid())
  );

-- Service role handles all INSERT/DELETE operations via Edge Functions
