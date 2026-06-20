// =============================================================================
// AegisRAG AI Configuration
// Source of Truth: AegisRAG-Implementation-Roadmap.md (C2 Contradiction Fix)
// =============================================================================
//
// ⚠️  CRITICAL: Use ONLY @google/genai (new unified SDK)
// ❌  DO NOT use @google/generative-ai (deprecated)
// ❌  DO NOT use the fictional model names from the architecture documents
//
// Install in Sprint 1: npm install @google/genai

// Real Google AI API model identifiers
export const AI_MODELS = {
  // Chat models
  GENERATION_PRIMARY: 'gemini-3.5-flash',
  GENERATION_FALLBACK: 'gemini-3.1-flash-lite', // kept for general fallback compatibility
  GENERATION_FALLBACK_1: 'gemini-3.1-flash-lite',
  GENERATION_FALLBACK_2: 'gemini-2.5-flash',
  GENERATION_FALLBACK_3: 'gemini-2.5-flash-lite',
  EMBEDDING: 'gemini-embedding-2',

  // Report / summary / narrative models (Analytics & Reports, PDF/PPTX exports)
  REPORT_PRIMARY: 'gemini-2.5-flash',
  REPORT_FALLBACK: 'gemini-2.5-flash-lite',
} as const

// Chat fallback chain (3.5-flash → 3.1-flash-lite → 2.5-flash → 2.5-flash-lite)
export const AI_MODELS_FALLBACK_CHAIN = [
  AI_MODELS.GENERATION_PRIMARY,
  AI_MODELS.GENERATION_FALLBACK_1,
  AI_MODELS.GENERATION_FALLBACK_2,
  AI_MODELS.GENERATION_FALLBACK_3,
] as const

// Report/summary fallback chain — 2.5-flash → 2.5-flash-lite ONLY (not chat models)
export const REPORT_MODEL_CHAIN = [
  AI_MODELS.REPORT_PRIMARY,
  AI_MODELS.REPORT_FALLBACK,
] as const

console.log('[AI CONFIG]', {
  generation: AI_MODELS.GENERATION_PRIMARY,
  fallback: AI_MODELS.GENERATION_FALLBACK,
  embedding: AI_MODELS.EMBEDDING,
  fallbackChain: AI_MODELS_FALLBACK_CHAIN,
})

export type AIModelKey = keyof typeof AI_MODELS
export type AIModelId = (typeof AI_MODELS)[AIModelKey]

// Token budget constraints (enforced at every prompt layer)
export const TOKEN_BUDGET = {
  SYSTEM_PROMPT: 500,
  CONTEXT: 3000,
  OUTPUT: 1000,
  TOTAL_MAX: 4500,
} as const

// Retrieval configuration
export const RETRIEVAL_CONFIG = {
  TOP_K_BEFORE_RERANK: 20,
  TOP_K_AFTER_RERANK: 5,
  SIMILARITY_THRESHOLD: 0.75, // Cosine similarity minimum
} as const

// Chunking strategy (compliance document optimized)
export const CHUNKING_CONFIG = {
  CHUNK_SIZE_TOKENS: 512,
  CHUNK_OVERLAP_TOKENS: 50,
} as const

// Reranker — Cohere Rerank API (HTTP, language-agnostic — works in Edge Functions)
export const RERANKER_CONFIG = {
  MODEL: 'rerank-english-v3.0',
  API_ENDPOINT: 'https://api.cohere.ai/v1/rerank',
} as const

// AI Failover — levels for audit logging
export const FALLBACK_LEVEL = {
  PRIMARY: 0, // gemini-2.5-flash
  FALLBACK: 1, // gemini-3.5-flash
  RAW_CHUNKS: 2, // No AI — return retrieved chunks directly
} as const
