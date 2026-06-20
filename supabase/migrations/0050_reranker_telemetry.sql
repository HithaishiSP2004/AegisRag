-- Migration 0050: Reranker Telemetry Columns
ALTER TABLE retrieval_evals
  ADD COLUMN IF NOT EXISTS reranker_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS reranker_model TEXT,
  ADD COLUMN IF NOT EXISTS pre_rerank_score FLOAT,
  ADD COLUMN IF NOT EXISTS post_rerank_score FLOAT,
  ADD COLUMN IF NOT EXISTS reranker_lift FLOAT;
