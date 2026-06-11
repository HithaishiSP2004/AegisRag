-- ============================================================
-- Migration 0040: Fix retrieval_evals rules to allow conversation deletion
-- Drops rewrite rules that intercept UPDATE/DELETE, which break ON DELETE SET NULL.
-- Immutability for standard users is already fully handled via Row Level Security (RLS) policies.
-- ============================================================

DROP RULE IF EXISTS retrieval_evals_no_update ON retrieval_evals;
DROP RULE IF EXISTS retrieval_evals_no_delete ON retrieval_evals;
