-- Migration 0046: Benchmark Runs Database Table
CREATE TABLE IF NOT EXISTS benchmark_runs (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_name          TEXT         NOT NULL,
  total_pages           INTEGER      NOT NULL CHECK (total_pages >= 0),
  total_documents       INTEGER      NOT NULL CHECK (total_documents >= 0),
  total_chunks          INTEGER      NOT NULL CHECK (total_chunks >= 0),
  total_embeddings      INTEGER      NOT NULL CHECK (total_embeddings >= 0),
  upload_duration_ms    INTEGER      NOT NULL CHECK (upload_duration_ms >= 0),
  embedding_duration_ms INTEGER      NOT NULL CHECK (embedding_duration_ms >= 0),
  retrieval_latency_ms  INTEGER      NOT NULL CHECK (retrieval_latency_ms >= 0),
  cache_hit_rate        NUMERIC(5,2) NOT NULL CHECK (cache_hit_rate >= 0.0 AND cache_hit_rate <= 100.0),
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Enable Row Level Security (RLS) - admin/service-role access only
ALTER TABLE benchmark_runs ENABLE ROW LEVEL SECURITY;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_benchmark_runs_created_at ON benchmark_runs(created_at DESC);
