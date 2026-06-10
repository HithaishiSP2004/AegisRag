-- ============================================================
-- Migration 0006: pages
-- One row per PDF page. Runs AFTER 0004_documents.sql
-- ============================================================

-- Page processing status ENUM
CREATE TYPE page_status AS ENUM ('pending', 'chunked', 'embedded', 'failed');

CREATE TABLE IF NOT EXISTS pages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID        NOT NULL REFERENCES documents(id)     ON DELETE CASCADE,
  org_id      UUID        NOT NULL REFERENCES organizations(id)  ON DELETE CASCADE,
  page_number INT         NOT NULL CHECK (page_number > 0),
  raw_text    TEXT,       -- NULL until parsed; populated by Edge Function
  word_count  INT         NOT NULL DEFAULT 0 CHECK (word_count >= 0),
  status      page_status NOT NULL DEFAULT 'pending',
  error_message TEXT,     -- populated when status = 'failed'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (document_id, page_number)  -- each page number unique within a document
);

CREATE TRIGGER trg_pages_updated_at
  BEFORE UPDATE ON pages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX idx_pages_document_id ON pages(document_id);
CREATE INDEX idx_pages_org_id      ON pages(org_id);
CREATE INDEX idx_pages_status      ON pages(status);

-- Composite: used for "fetch all pending pages for org"
CREATE INDEX idx_pages_org_status  ON pages(org_id, status);

-- Partial: used for re-indexing failed pages
CREATE INDEX idx_pages_failed      ON pages(document_id) WHERE status = 'failed';

-- ── Row Level Security ───────────────────────────────────────
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pages_select_org_members"
  ON pages FOR SELECT
  USING (
    org_id = (SELECT org_id FROM user_profiles WHERE id = auth.uid())
  );

-- Service role handles INSERT/UPDATE via Edge Functions
