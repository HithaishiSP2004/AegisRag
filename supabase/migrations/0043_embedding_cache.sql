-- Creates a global database-backed cache table for vector embeddings.
CREATE TABLE IF NOT EXISTS embedding_cache (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  content_hash         TEXT         UNIQUE NOT NULL,
  provider             TEXT         NOT NULL,
  model_name           TEXT         NOT NULL,
  embedding_dimensions INTEGER      NOT NULL,
  provider_version     TEXT         NOT NULL,
  embedding            vector(768)  NOT NULL,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  last_accessed_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  hit_count            INTEGER      NOT NULL DEFAULT 0
);

-- Index on last_accessed_at for cache eviction/analytics queries
CREATE INDEX IF NOT EXISTS idx_embedding_cache_last_accessed_at ON embedding_cache(last_accessed_at);

-- Enable Row Level Security (RLS) with no public/authenticated policies
ALTER TABLE embedding_cache ENABLE ROW LEVEL SECURITY;

-- Stats Helper Function for the admin API route
CREATE OR REPLACE FUNCTION get_cache_stats()
RETURNS TABLE (
  total_entries BIGINT,
  total_hits BIGINT
)
LANGUAGE SQL STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*) AS total_entries,
    COALESCE(SUM(hit_count), 0)::BIGINT AS total_hits
  FROM embedding_cache;
$$;

GRANT EXECUTE ON FUNCTION get_cache_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_cache_stats TO service_role;
