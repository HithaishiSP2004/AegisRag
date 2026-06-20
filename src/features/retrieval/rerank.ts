// =============================================================================
// Sprint 4B: Gemini Reranker
//
// Uses gemini-2.5-flash to select the top-N most relevant chunk IDs from
// the fused result set.  Gemini is prompted to return a JSON array of IDs.
//
// Guarantees:
//   - Uses ONLY Gemini (no Cohere, no external reranker)
//   - Returns deterministic JSON via responseMimeType: 'application/json'
//   - Validates returned IDs against the candidate set
//   - Falls back to fused ranking top-N if Gemini fails for any reason
//   - Reranker failure NEVER crashes retrieval
// =============================================================================

import { GoogleGenAI } from '@google/genai'
import { AI_MODELS } from '@/config/ai'
import type { SearchResult } from './types'

const RERANK_INPUT_K = 30   // max chunks sent to the reranker

let isRerankerDegraded = false
let degradedTime = 0

export function isRerankDegraded(): boolean {
  if (isRerankerDegraded) {
    // Reset degraded mode after 1 minute to allow retry
    if (Date.now() - degradedTime > 60000) {
      isRerankerDegraded = false
      return false
    }
    return true
  }
  return false
}

export function resetDegradedMode(): void {
  isRerankerDegraded = false
  degradedTime = 0
}

/**
 * Ask Gemini to select the most relevant chunk IDs from `candidates`.
 *
 * @param question   - The user's question
 * @param candidates - Fused+sorted SearchResult[] (already top-N from RRF)
 * @param limit      - Target top-K count to return (default 5, max 10)
 * @returns          Top-K SearchResult[], reordered by Gemini relevance
 */
export async function rerankResults(
  question:   string,
  candidates: SearchResult[],
  limit = 5,
): Promise<SearchResult[]> {
  const topInput = candidates.slice(0, RERANK_INPUT_K)
  const targetTopK = Math.max(1, Math.min(10, limit))

  if (isRerankDegraded()) {
    console.warn('[rerank] skipping Gemini reranker — reason: degraded mode active')
    return topInput.slice(0, targetTopK)
  }

  // Fast-path: nothing to rerank
  if (topInput.length === 0) return []
  if (topInput.length <= targetTopK) {
    console.log(`[rerank] only ${topInput.length} candidates — skipping reranker`)
    return topInput.slice(0, targetTopK)
  }

  if (!process.env.GEMINI_API_KEY) {
    console.warn('[rerank] GEMINI_API_KEY missing — using fused order fallback')
    return topInput.slice(0, targetTopK)
  }

  // Build prompt
  const chunkSummaries = topInput
    .map((r, i) => `ID: ${r.chunkId}\nChunk ${i + 1} (${r.document.originalName}, p.${r.metadata.page_number}):\n${r.content.slice(0, 400)}`)
    .join('\n\n---\n\n')

  const prompt = `You are a relevance ranking assistant. Given a user question and a set of document chunks (each with a unique ID), return ONLY the IDs of the ${targetTopK} most relevant chunks for answering the question.

Return a JSON array of exactly ${targetTopK} chunk IDs (strings), ordered from most to least relevant.
If fewer than ${targetTopK} chunks are relevant, return as many as are relevant.
Return ONLY valid JSON — no explanation, no markdown, no code fences.

QUESTION: ${question}

CHUNKS:
${chunkSummaries}

RESPONSE FORMAT: ["chunk_id_1", "chunk_id_2", ...]`

  let t0: number
  try {
    t0 = Date.now()
    const ai  = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    
    // 3-second timeout race
    const rerankPromise = ai.models.generateContent({
      model:    AI_MODELS.GENERATION_FALLBACK_1,
      contents: prompt,
      config:   { responseMimeType: 'application/json' },
    })

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT_EXCEEDED')), 3000)
    )

    const res = await Promise.race([rerankPromise, timeoutPromise])
    const rerank_latency_ms = Date.now() - t0

    const raw = res.text?.trim() ?? ''
    console.log(`[rerank] Gemini response (${rerank_latency_ms}ms):`, raw.slice(0, 200))

    // Parse and validate with robust extraction
    let ids: unknown = null
    try {
      ids = JSON.parse(raw)
    } catch {
      try {
        const jsonMatch = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/)
        if (jsonMatch) {
          ids = JSON.parse(jsonMatch[0])
        }
      } catch (innerErr) {
        console.warn('[rerank] Regex JSON extraction failed:', innerErr)
      }
    }

    // Handle object wrapper cases containing list of IDs
    if (ids && typeof ids === 'object' && !Array.isArray(ids)) {
      const keys = Object.keys(ids)
      for (const key of keys) {
        const val = (ids as Record<string, unknown>)[key]
        if (Array.isArray(val)) {
          ids = val
          break
        }
      }
    }

    if (!ids || !Array.isArray(ids)) {
      console.warn('[rerank] response is not an array — using fused order fallback')
      return topInput.slice(0, targetTopK)
    }

    // Build lookup map for fast validation
    const candidateMap = new Map(topInput.map((r) => [r.chunkId, r]))

    // Filter to valid IDs only (Gemini may hallucinate IDs)
    const validIds = (ids as unknown[])
      .filter((id): id is string => typeof id === 'string' && candidateMap.has(id))
      .slice(0, targetTopK)

    if (validIds.length === 0) {
      console.warn('[rerank] no valid IDs in response — using fused order fallback')
      return topInput.slice(0, targetTopK)
    }

    const reranked = validIds.map((id) => candidateMap.get(id)!)
    console.log(`[rerank] selected ${reranked.length} results (rerank_latency_ms=${rerank_latency_ms})`)
    return reranked

  } catch (err: any) {
    const errMsg = err?.message || String(err)
    const status = err?.status || err?.statusCode
    const isDegraded =
      status === 429 ||
      status === 503 ||
      errMsg.includes('429') ||
      errMsg.includes('503') ||
      errMsg.toUpperCase().includes('RESOURCE_EXHAUSTED') ||
      errMsg.toUpperCase().includes('UNAVAILABLE') ||
      errMsg.includes('TIMEOUT_EXCEEDED')

    if (isDegraded) {
      console.warn('[rerank] degraded mode activated')
      isRerankerDegraded = true
      degradedTime = Date.now()
    } else {
      console.error('[rerank] Gemini reranker error — using fused order fallback:', err)
    }
    return topInput.slice(0, targetTopK)
  }
}
