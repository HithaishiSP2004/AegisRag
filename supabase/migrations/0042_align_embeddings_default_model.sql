-- Migration 0042: Align embeddings default model to gemini-embedding-2
-- Fixes default mismatch: runtime uses gemini-embedding-2 while DB was set to text-embedding-004

ALTER TABLE embeddings
  ALTER COLUMN model_used SET DEFAULT 'gemini-embedding-2';
