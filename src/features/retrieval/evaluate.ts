// =============================================================================
// Sprint 4C: Retrieval Evaluation — Groundedness, Citation, Hallucination
//
// Evaluates each assistant response using Gemini as a judge.
// Persists one row to retrieval_evals per query (migration 0023).
//
// Scores:
//   groundedness_score  0.0–1.0  — how well answer is supported by chunks
//   citation_hit_rate   0.0–1.0  — fraction of [N] markers that map to real chunks
//   hallucination_flag  boolean  — true if answer contains unsupported claims
//
// All evaluation is fire-and-forget:
//   - Gemini failure → default scores, still persists
//   - DB write failure → logged, never rethrown
// =============================================================================

import { GoogleGenAI }      from '@google/genai'
import { AI_MODELS }        from '@/config/ai'
import { createAdminClient } from '@/lib/supabase/server'
import type { SearchResult } from './types'

export interface EvalMeta {
  retrieval_mode:       string
  total_latency_ms:     number
  conversation_id?:     string | null
  vector_latency_ms?:   number | null
  keyword_latency_ms?:  number | null
  fusion_latency_ms?:   number | null
  rerank_latency_ms?:   number | null
  vector_candidates?:   number | null
  reranked_candidates?:  number | null
  context_tokens_saved?: number | null

  // Reranker telemetry
  reranker_enabled?:    boolean
  reranker_model?:      string
  pre_rerank_score?:    number | null
  post_rerank_score?:   number | null
  reranker_lift?:       number | null
}

interface GeminiEvalResponse {
  groundedness_score: number
  hallucination_flag: boolean
  notes:              string
}

// ── Citation hit rate (pure, no AI needed) ────────────────────────────────────
function computeCitationHitRate(answer: string, sourceCount: number): number {
  const cited = new Set<number>()
  const pattern = /\[(\d+)\]/g
  let m: RegExpExecArray | null
  while ((m = pattern.exec(answer)) !== null) {
    cited.add(parseInt(m[1], 10))
  }
  if (cited.size === 0) return 1.0   // no citations attempted → vacuously valid
  const valid = [...cited].filter((i) => i >= 1 && i <= sourceCount).length
  return valid / cited.size
}

// ── Gemini groundedness + hallucination judge ─────────────────────────────────
async function runGeminiEval(
  question: string,
  answer:   string,
  sources:  SearchResult[],
): Promise<GeminiEvalResponse> {
  const context = sources
    .map((s, i) => `[${i + 1}] (${s.document.originalName})\n${s.content.slice(0, 350)}`)
    .join('\n\n---\n\n')

  const prompt = `You are a retrieval quality evaluator. Given a QUESTION, CONTEXT chunks, and an AI-generated ANSWER, return a JSON object with exactly three fields:

"groundedness_score": float 0.0–1.0
  1.0 = every claim in the answer is directly supported by the context.
  0.0 = the answer contains claims with no support in the context.

"hallucination_flag": boolean
  true  = the answer asserts facts not present in any context chunk.
  false = all answer claims are traceable to the context.

"notes": string (one sentence, max 120 chars) explaining your judgment.

QUESTION: ${question}

CONTEXT:
${context}

ANSWER: ${answer}

Return ONLY valid JSON. No markdown, no explanation outside the JSON.`

  const ai  = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
  const res = await ai.models.generateContent({
    model:    AI_MODELS.GENERATION_PRIMARY,
    contents: prompt,
    config:   { responseMimeType: 'application/json' },
  })

  const raw = res.text ?? '{}'

  // H3 FIX: wrap JSON.parse in try/catch — malformed Gemini output (e.g. a
  // 503 error body returned as text) must not propagate a SyntaxError through
  // the outer evaluateRetrieval catch, violating "always resolves" guarantee.
  let parsed: Record<string, unknown> = {}
  try {
    parsed = JSON.parse(raw)
  } catch {
    console.warn('[eval] Gemini returned non-JSON text — using default scores. Raw:', raw.slice(0, 120))
  }

  return {
    groundedness_score: typeof parsed.groundedness_score === 'number'
      ? Math.max(0, Math.min(1, parsed.groundedness_score))
      : 0.5,
    hallucination_flag: Boolean(parsed.hallucination_flag),
    notes:              typeof parsed.notes === 'string'
      ? parsed.notes.slice(0, 500)
      : '',
  }
}

// ── Public entry point ────────────────────────────────────────────────────────

/**
 * Evaluate one retrieval+generation cycle and persist results to retrieval_evals.
 * Always resolves — never throws.
 */
export async function evaluateRetrieval(
  orgId:    string,
  question: string,
  answer:   string,
  sources:  SearchResult[],
  meta:     EvalMeta,
): Promise<void> {
  // ── 1. Citation hit rate (synchronous, always runs) ──────────────────────
  const citationHitRate = computeCitationHitRate(answer, sources.length)

  // ── 2. Gemini groundedness judge ─────────────────────────────────────────
  let groundednessScore = 0.5
  let hallucinationFlag = false
  let evalNotes         = 'evaluation_skipped'

  if (process.env.GEMINI_API_KEY && sources.length > 0 && answer.length > 0) {
    const t0 = Date.now()
    try {
      const result  = await runGeminiEval(question, answer, sources)
      const evalMs  = Date.now() - t0
      groundednessScore = result.groundedness_score
      hallucinationFlag = result.hallucination_flag
      evalNotes         = result.notes
      console.log(
        `[eval] groundedness=${groundednessScore.toFixed(3)}` +
        ` hallucination=${hallucinationFlag}` +
        ` citation_hit_rate=${citationHitRate.toFixed(3)}` +
        ` eval_ms=${evalMs}`
      )
      if (hallucinationFlag) {
        console.warn('[eval] ⚠ HALLUCINATION DETECTED — notes:', evalNotes)
      }
    } catch (err) {
      console.error('[eval] Gemini evaluation failed — using default scores:', err)
      evalNotes = 'gemini_eval_failed'
    }
  }

  // ── 3. Persist to retrieval_evals and retrieval_events ───────────────────
  try {
    const admin = createAdminClient()

    const { error } = await admin.from('retrieval_evals').insert({
      org_id:              orgId,
      conversation_id:     meta.conversation_id ?? null,
      query_text:          question,
      retrieval_mode:      (meta.retrieval_mode as 'vector' | 'keyword' | 'hybrid'),
      chunk_count:         sources.length,
      total_latency_ms:    meta.total_latency_ms,
      groundedness_score:  groundednessScore,
      citation_hit_rate:   citationHitRate,
      hallucination_flag:  hallucinationFlag,
      eval_notes:          evalNotes,
      vector_latency_ms:   meta.vector_latency_ms ?? null,
      keyword_latency_ms:  meta.keyword_latency_ms ?? null,
      fusion_latency_ms:   meta.fusion_latency_ms ?? null,
      rerank_latency_ms:   meta.rerank_latency_ms ?? null,
      vector_candidates:   meta.vector_candidates ?? null,
      reranked_candidates:  meta.reranked_candidates ?? null,
      context_tokens_saved: meta.context_tokens_saved ?? null,
      reranker_enabled:    meta.reranker_enabled ?? false,
      reranker_model:      meta.reranker_model ?? null,
      pre_rerank_score:    meta.pre_rerank_score ?? null,
      post_rerank_score:   meta.post_rerank_score ?? null,
      reranker_lift:       meta.reranker_lift ?? null,
    })
    if (error) {
      console.error('[eval] retrieval_evals insert error:', error.message)
    } else {
      console.log('[eval] persisted to retrieval_evals')
    }

    // Insert into retrieval_events (Sprint Final telemetry)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: eventsErr } = await (admin as any).from('retrieval_events').insert({
      org_id:             orgId,
      tenant_id:          orgId,
      query:              question,
      mode:               meta.retrieval_mode,
      groundedness:       groundednessScore,
      latency_ms:         meta.total_latency_ms,
      hallucination_detected: hallucinationFlag,
      citation_accuracy:  citationHitRate
    })
    if (eventsErr) {
      console.error('[eval] retrieval_events insert error:', eventsErr.message)
    } else {
      console.log('[eval] persisted to retrieval_events')
    }
  } catch (err) {
    console.error('[eval] DB persist threw (non-blocking):', err)
  }
}
