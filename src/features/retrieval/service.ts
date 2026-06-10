// =============================================================================
// Sprint 4B: Retrieval Service Orchestrator — Hybrid Pipeline
//
// Pipeline:
//   1. Fire vectorSearch() and keywordSearch() in parallel (Promise.all)
//   2. Either leg failing does NOT crash the other
//   3. Fuse results with Reciprocal Rank Fusion (rrf.ts)
//   4. Rerank top-10 fused results with Gemini (rerank.ts)
//   5. Return top-5 reranked results, preserving citation-compatible order
//
// Telemetry emitted (all on stdout):
//   [hybrid] vector results: X
//   [hybrid] keyword results: Y
//   [rrf] fused results: Z hybrid=A vector-only=B keyword-only=C
//   [rerank] selected results: N (rerank_latency_ms=T)
//
// Latency logged per leg:
//   [retrieval/vector] vector_latency_ms=T
//   [retrieval/keyword] keyword_latency_ms=T
//   [hybrid] fusion_latency_ms=T
//
// Callers (API routes, chat pipeline) still only ever call searchDocuments().
// =============================================================================

import { keywordSearch }  from './keyword'
import { vectorSearch }   from './vector'
import { fuseResults }    from './rrf'
import { rerankResults }  from './rerank'
import type { SearchQuery, SearchResult, SearchFilters } from './types'

export type { SearchResult, SearchFilters, SearchQuery }
export type { RetrievalMode, CitationRef, ChunkMetadata, DocumentMeta } from './types'

// How many fused chunks to pass into the reranker
const FUSION_POOL = 10
// Final top-K after reranking
const FINAL_TOP_K = 5

/**
 * Primary retrieval function.  Always returns SearchResult[].
 *
 * Sprint 4B: Both vector and keyword always execute in parallel.
 * Results are fused via RRF then reranked by Gemini.
 * Any single-leg failure degrades gracefully — retrieval never crashes.
 */
export async function searchDocuments(
  text:    string,
  orgId:   string,
  filters: SearchFilters = {},
): Promise<SearchResult[]> {
  if (!text.trim()) return []

  // Increase pool before fusion: fetch more candidates for better RRF coverage
  const poolFilters: SearchFilters = {
    ...filters,
    limit: Math.max(filters.limit ?? 8, FUSION_POOL),
  }
  const query: SearchQuery = { text, orgId, filters: poolFilters }

  // ── 1. Parallel retrieval ─────────────────────────────────────────────────
  const [vectorResult, keywordResult] = await Promise.all([
    (async () => {
      const t0 = Date.now()
      try {
        const results = await vectorSearch(query)
        const vector_latency_ms = Date.now() - t0
        console.log(`[retrieval/vector] vector_latency_ms=${vector_latency_ms} results=${results.length}`)
        return results
      } catch (err) {
        console.error('[retrieval/vector] leg threw — isolated, continuing with keyword only:', err)
        return [] as SearchResult[]
      }
    })(),
    (async () => {
      const t0 = Date.now()
      try {
        const results = await keywordSearch(query)
        const keyword_latency_ms = Date.now() - t0
        console.log(`[retrieval/keyword] keyword_latency_ms=${keyword_latency_ms} results=${results.length}`)
        return results
      } catch (err) {
        console.error('[retrieval/keyword] leg threw — isolated, continuing with vector only:', err)
        return [] as SearchResult[]
      }
    })(),
  ])

  const vectorResults  = vectorResult
  const keywordResults = keywordResult

  console.log(`[hybrid] vector results: ${vectorResults.length}`)
  console.log(`[hybrid] keyword results: ${keywordResults.length}`)

  // ── 2. Both legs empty → nothing to return ────────────────────────────────
  if (vectorResults.length === 0 && keywordResults.length === 0) {
    console.log('[hybrid] both legs returned 0 results')
    return []
  }

  // ── 3. RRF Fusion ─────────────────────────────────────────────────────────
  const t1 = Date.now()
  const fused = fuseResults(vectorResults, keywordResults)
  const fusion_latency_ms = Date.now() - t1
  console.log(`[hybrid] fusion_latency_ms=${fusion_latency_ms}`)
  console.log(`[rrf] fused results: ${fused.length}`)

  // ── 4. Gemini Reranking ───────────────────────────────────────────────────
  const reranked = await rerankResults(text, fused.slice(0, FUSION_POOL))
  console.log(`[rerank] selected results: ${reranked.length}`)

  // ── 5. Final trim ─────────────────────────────────────────────────────────
  const final = reranked.slice(0, FINAL_TOP_K)

  // Determine overall retrieval_mode for the response
  const overallMode =
    vectorResults.length > 0 && keywordResults.length > 0
      ? 'hybrid'
      : vectorResults.length > 0
        ? 'vector'
        : 'keyword'
  console.log(`[hybrid] overall retrieval_mode=${overallMode} final=${final.length}`)

  // Stamp every result with the overall mode so the UI badge is consistent
  return final.map((r) => ({ ...r, mode: overallMode }))
}
