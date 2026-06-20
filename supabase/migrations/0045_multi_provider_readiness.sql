-- Migration 0045: Multi-Provider Embedding Readiness & Provenance
-- 1. Drop check constraint on ai_requests model_used to allow dynamic future models
ALTER TABLE ai_requests DROP CONSTRAINT IF EXISTS ai_requests_model_used_check;

-- 2. Drop unique constraint on embedding_cache content_hash
ALTER TABLE embedding_cache DROP CONSTRAINT IF EXISTS embedding_cache_content_hash_key;

-- 3. Add composite unique constraint on embedding_cache (content_hash, provider, model_name)
ALTER TABLE embedding_cache ADD CONSTRAINT embedding_cache_unique_provider UNIQUE (content_hash, provider, model_name);

-- 4. Add provenance columns to embeddings table (100% backward compatible)
ALTER TABLE embeddings ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'gemini';
ALTER TABLE embeddings ADD COLUMN IF NOT EXISTS model_name TEXT DEFAULT 'gemini-embedding-2';
ALTER TABLE embeddings ADD COLUMN IF NOT EXISTS embedding_dimensions INTEGER NOT NULL DEFAULT 768;

-- Backfill model_name from model_used for existing records
UPDATE embeddings SET model_name = model_used WHERE model_name IS NULL;

-- Enforce NOT NULL constraint on model_name after backfilling
ALTER TABLE embeddings ALTER COLUMN model_name SET NOT NULL;
