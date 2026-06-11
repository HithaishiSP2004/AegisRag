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
import { rerankResults, isRerankDegraded }  from './rerank'
import { compressContext } from './compression'
import type { SearchQuery, SearchResult, SearchFilters } from './types'

export type { SearchResult, SearchFilters, SearchQuery }
export type { RetrievalMode, CitationRef, ChunkMetadata, DocumentMeta } from './types'

// How many fused chunks to pass into the reranker
const FUSION_POOL = 30
// Final default top-K after reranking
const FINAL_TOP_K = 6

export function documentAwareRetrievalStrategy(
  question: string,
  baseLimit: number
): { limit: number; searchType: 'broad' | 'narrow' | 'standard' } {
  const q = question.toLowerCase().trim()
  
  const broadKeywords = [
    'summarize', 'summary', 'overview', 'abstract', 'conclusion', 'conclusions',
    'key takeaways', 'takeaways', 'findings', 'results', 'discussion'
  ]
  const isBroad = broadKeywords.some(kw => new RegExp(`\\b${kw}\\b`, 'i').test(q))
  
  const narrowKeywords = [
    'title', 'author', 'authors', 'publish', 'published', 'publisher', 'doi',
    'journal', 'conference', 'year', 'volume', 'issue', 'citation'
  ]
  const isNarrow = narrowKeywords.some(kw => new RegExp(`\\b${kw}s?\\b`, 'i').test(q))

  if (isBroad) {
    return { limit: Math.max(baseLimit, 15), searchType: 'broad' }
  } else if (isNarrow) {
    return { limit: Math.min(baseLimit, 3), searchType: 'narrow' }
  }

  return { limit: baseLimit, searchType: 'standard' }
}

/**
 * Primary retrieval function.  Always returns SearchResult[].
 *
 * Phase 3: Both vector and keyword execute in parallel, querying Global/Org/User corpora.
 * Results are fused via RRF, reranked by Gemini, then compressed before return.
 * Telemetry metrics are attached as a non-enumerable property `metrics`.
 */
export async function searchDocuments(
  text:      string,
  orgId:     string,
  filters:   SearchFilters = {},
  userId?:   string,
  userRole?: string,
): Promise<SearchResult[] & { metrics?: any }> {
  if (!text.trim()) {
    const emptyRes = [] as SearchResult[] & { metrics?: any }
    emptyRes.metrics = {
      vector_latency_ms: null,
      keyword_latency_ms: null,
      fusion_latency_ms: null,
      rerank_latency_ms: null,
      total_latency_ms: 0,
      vector_candidates: 0,
      reranked_candidates: 0,
      context_tokens_saved: 0,
    }
    return emptyRes
  }

  const searchStart = Date.now()
  const strategy = documentAwareRetrievalStrategy(text, filters.limit ?? FINAL_TOP_K)
  const targetTopK = strategy.limit

  // Increase pool before fusion: fetch more candidates for better RRF coverage
  const poolFilters: SearchFilters = {
    ...filters,
    limit: Math.max(targetTopK, strategy.searchType === 'broad' ? 40 : FUSION_POOL),
  }
  const query: SearchQuery = { text, orgId, filters: poolFilters, userId, userRole }

  let vectorLatencyMs: number | null = null
  let keywordLatencyMs: number | null = null

  // ── 1. Parallel retrieval ─────────────────────────────────────────────────
  const [vectorResult, keywordResult] = await Promise.all([
    (async () => {
      const t0 = Date.now()
      try {
        const results = await vectorSearch(query)
        vectorLatencyMs = Date.now() - t0
        console.log(`[retrieval/vector] vector_latency_ms=${vectorLatencyMs} results=${results.length}`)
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
        keywordLatencyMs = Date.now() - t0
        console.log(`[retrieval/keyword] keyword_latency_ms=${keywordLatencyMs} results=${results.length}`)
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
    const emptyRes = [] as SearchResult[] & { metrics?: any }
    emptyRes.metrics = {
      vector_latency_ms: vectorLatencyMs,
      keyword_latency_ms: keywordLatencyMs,
      fusion_latency_ms: 0,
      rerank_latency_ms: 0,
      total_latency_ms: Date.now() - searchStart,
      vector_candidates: 0,
      reranked_candidates: 0,
      context_tokens_saved: 0,
    }
    return emptyRes
  }

  // ── 3. RRF Fusion ─────────────────────────────────────────────────────────
  const t1 = Date.now()
  const fused = fuseResults(vectorResults, keywordResults)
  const fusionLatencyMs = Date.now() - t1
  console.log(`[hybrid] fusion_latency_ms=${fusionLatencyMs}`)
  console.log(`[rrf] fused results: ${fused.length}`)

  // ── 4. Gemini Reranking ───────────────────────────────────────────────────
  const rerankStart = Date.now()
  let reranked: SearchResult[]
  let rerankLatencyMs = 0

  const skipRerank =
    process.env.ENABLE_GEMINI_RERANKER === 'false' ||
    strategy.searchType === 'narrow' ||
    fused.length <= 5 ||
    isRerankDegraded()

  if (skipRerank) {
    let reason = ''
    if (process.env.ENABLE_GEMINI_RERANKER === 'false') {
      reason = 'disabled by feature flag'
    } else if (strategy.searchType === 'narrow') {
      reason = 'narrow metadata query'
    } else if (fused.length <= 5) {
      reason = 'candidate count <= 5'
    } else if (isRerankDegraded()) {
      reason = 'degraded mode active'
    }
    console.log(`[rerank] skipping Gemini reranker — reason: ${reason}`)
    reranked = fused.slice(0, targetTopK)
  } else {
    reranked = await rerankResults(text, fused.slice(0, FUSION_POOL), targetTopK)
    rerankLatencyMs = Date.now() - rerankStart
    console.log(`[rerank] selected results: ${reranked.length} (${rerankLatencyMs}ms)`)
  }

  // ── 5. Context Compression ────────────────────────────────────────────────
  const { compressedChunks, tokensSaved } = compressContext(reranked)
  console.log(`[compression] tokens_saved=${tokensSaved}`)

  // Determine overall retrieval_mode for the response
  const overallMode =
    vectorResults.length > 0 && keywordResults.length > 0
      ? 'hybrid'
      : vectorResults.length > 0
        ? 'vector'
        : 'keyword'
  console.log(`[hybrid] overall retrieval_mode=${overallMode} final=${compressedChunks.length}`)

  const totalLatencyMs = Date.now() - searchStart

  // Stamp every result with the overall mode so the UI badge is consistent
  const finalResults = compressedChunks.map((r) => ({ ...r, mode: overallMode })) as SearchResult[] & { metrics?: any }

  // Attach non-enumerable metrics metadata to the array object
  Object.defineProperty(finalResults, 'metrics', {
    value: {
      vector_latency_ms:   vectorLatencyMs,
      keyword_latency_ms:  keywordLatencyMs,
      fusion_latency_ms:   fusionLatencyMs,
      rerank_latency_ms:   rerankLatencyMs,
      total_latency_ms:    totalLatencyMs,
      vector_candidates:   fused.length,
      reranked_candidates: compressedChunks.length,
      context_tokens_saved: tokensSaved,
    },
    enumerable: false,
    writable: true,
  })

  return finalResults
}
