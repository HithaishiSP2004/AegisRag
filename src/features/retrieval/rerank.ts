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

const RERANK_TOP_K = 5
const RERANK_INPUT_K = 10   // max chunks sent to the reranker

/**
 * Ask Gemini to select the most relevant chunk IDs from `candidates`.
 *
 * @param question   - The user's question
 * @param candidates - Fused+sorted SearchResult[] (already top-N from RRF)
 * @returns          Top-K SearchResult[], reordered by Gemini relevance
 */
export async function rerankResults(
  question:   string,
  candidates: SearchResult[],
): Promise<SearchResult[]> {
  const topInput = candidates.slice(0, RERANK_INPUT_K)

  // Fast-path: nothing to rerank
  if (topInput.length === 0) return []
  if (topInput.length <= RERANK_TOP_K) {
    console.log(`[rerank] only ${topInput.length} candidates — skipping reranker`)
    return topInput
  }

  if (!process.env.GEMINI_API_KEY) {
    console.warn('[rerank] GEMINI_API_KEY missing — using fused order fallback')
    return topInput.slice(0, RERANK_TOP_K)
  }

  // Build prompt
  const chunkSummaries = topInput
    .map((r, i) => `ID: ${r.chunkId}\nChunk ${i + 1} (${r.document.originalName}, p.${r.metadata.page_number}):\n${r.content.slice(0, 400)}`)
    .join('\n\n---\n\n')

  const prompt = `You are a relevance ranking assistant. Given a user question and a set of document chunks (each with a unique ID), return ONLY the IDs of the ${RERANK_TOP_K} most relevant chunks for answering the question.

Return a JSON array of exactly ${RERANK_TOP_K} chunk IDs (strings), ordered from most to least relevant.
If fewer than ${RERANK_TOP_K} chunks are relevant, return as many as are relevant.
Return ONLY valid JSON — no explanation, no markdown, no code fences.

QUESTION: ${question}

CHUNKS:
${chunkSummaries}

RESPONSE FORMAT: ["chunk_id_1", "chunk_id_2", ...]`

  let t0: number
  try {
    t0 = Date.now()
    const ai  = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    const res = await ai.models.generateContent({
      model:    AI_MODELS.GENERATION_PRIMARY,
      contents: prompt,
      config:   { responseMimeType: 'application/json' },
    })
    const rerank_latency_ms = Date.now() - t0

    const raw = res.text?.trim() ?? ''
    console.log(`[rerank] Gemini response (${rerank_latency_ms}ms):`, raw.slice(0, 200))

    // Parse and validate
    let ids: unknown
    try {
      ids = JSON.parse(raw)
    } catch {
      console.warn('[rerank] JSON parse failed — using fused order fallback')
      return topInput.slice(0, RERANK_TOP_K)
    }

    if (!Array.isArray(ids)) {
      console.warn('[rerank] response is not an array — using fused order fallback')
      return topInput.slice(0, RERANK_TOP_K)
    }

    // Build lookup map for fast validation
    const candidateMap = new Map(topInput.map((r) => [r.chunkId, r]))

    // Filter to valid IDs only (Gemini may hallucinate IDs)
    const validIds = (ids as unknown[])
      .filter((id): id is string => typeof id === 'string' && candidateMap.has(id))
      .slice(0, RERANK_TOP_K)

    if (validIds.length === 0) {
      console.warn('[rerank] no valid IDs in response — using fused order fallback')
      return topInput.slice(0, RERANK_TOP_K)
    }

    const reranked = validIds.map((id) => candidateMap.get(id)!)
    console.log(`[rerank] selected ${reranked.length} results (rerank_latency_ms=${rerank_latency_ms})`)
    return reranked

  } catch (err) {
    console.error('[rerank] Gemini reranker error — using fused order fallback:', err)
    return topInput.slice(0, RERANK_TOP_K)
  }
}
