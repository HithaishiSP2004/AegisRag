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
import { rerankerProviderFactory } from './reranker/providerFactory'
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
  baseLimit: number,
  intent?: 'toc' | 'summary' | 'metadata' | 'compliance' | 'general'
): { limit: number; searchType: 'broad' | 'narrow' | 'standard' } {
  const q = question.toLowerCase().trim()

  // If the query guardrail has already classified the intent, honour it directly.
  // This prevents keyword mismatch (e.g. "table" in ToC query triggering narrow mode).
  if (intent === 'toc' || intent === 'summary') {
    return { limit: Math.max(baseLimit, 15), searchType: 'broad' }
  }
  if (intent === 'metadata') {
    return { limit: Math.min(baseLimit, 3), searchType: 'narrow' }
  }

  // Fallback: heuristic classification when no guardrail intent is supplied
  const broadKeywords = [
    'summarize', 'summary', 'overview', 'abstract', 'conclusion', 'conclusions',
    'key takeaways', 'takeaways', 'findings', 'results', 'discussion',
    'table of contents', 'toc', 'list of sections', 'list of chapters', 'chapters', 'contents'
  ]
  const isBroad = broadKeywords.some(kw => new RegExp(`\\b${kw}\\b`, 'i').test(q))

  const narrowKeywords = [
    'author', 'authors', 'publish', 'published', 'publisher', 'doi',
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

  // Normalize query text for typo tolerance and framework consistency
  let processedText = text.trim()
  processedText = processedText.replace(/\b(tile|titel|tilte|titl)\b/gi, 'title')
  processedText = processedText.replace(/\b(auther|authur)\b/gi, 'author')
  processedText = processedText.replace(/\b(cite|citate)\b/gi, 'citation')
  processedText = processedText.replace(/\bsoc[- ]?2\b/gi, 'soc 2')
  processedText = processedText.replace(/\bnist[- ]?800[- ]?53\b/gi, 'nist 800-53')

  const searchStart = Date.now()
  const strategy = documentAwareRetrievalStrategy(processedText, filters.limit ?? FINAL_TOP_K)
  const targetTopK = strategy.limit
  const retrievalMode = filters.retrievalMode ?? 'hybrid'
  const candidateLimit = 20

  const vectorQuery: SearchQuery = {
    text: processedText,
    orgId,
    filters: {
      ...filters,
      limit: candidateLimit,
    },
    userId,
    userRole,
  }

  const keywordQuery: SearchQuery = {
    text: processedText,
    orgId,
    filters: {
      ...filters,
      limit: candidateLimit,
    },
    userId,
    userRole,
  }

  let vectorResults: SearchResult[] = []
  let keywordResults: SearchResult[] = []

  let vectorLatencyMs: number | null = null
  let keywordLatencyMs: number | null = null

  // ── 1. Retrieval execution ────────────────────────────────────────────────
  if (retrievalMode === 'vector') {
    const t0 = Date.now()
    try {
      vectorResults = await vectorSearch(vectorQuery)
      vectorLatencyMs = Date.now() - t0
      console.log(`[retrieval/vector] vector_latency_ms=${vectorLatencyMs} results=${vectorResults.length}`)
    } catch (err) {
      console.error('[retrieval/vector] leg threw:', err)
    }
  } else if (retrievalMode === 'keyword') {
    const t0 = Date.now()
    try {
      keywordResults = await keywordSearch(keywordQuery)
      keywordLatencyMs = Date.now() - t0
      console.log(`[retrieval/keyword] keyword_latency_ms=${keywordLatencyMs} results=${keywordResults.length}`)
    } catch (err) {
      console.error('[retrieval/keyword] leg threw:', err)
    }
  } else {
    // default/hybrid: parallel execution
    const [vRes, kRes] = await Promise.all([
      (async () => {
        const t0 = Date.now()
        try {
          const results = await vectorSearch(vectorQuery)
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
          const results = await keywordSearch(keywordQuery)
          keywordLatencyMs = Date.now() - t0
          console.log(`[retrieval/keyword] keyword_latency_ms=${keywordLatencyMs} results=${results.length}`)
          return results
        } catch (err) {
          console.error('[retrieval/keyword] leg threw — isolated, continuing with vector only:', err)
          return [] as SearchResult[]
        }
      })(),
    ])
    vectorResults = vRes
    keywordResults = kRes
  }

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

  // ── 3B. Title-Oriented Retrieval Boosting ──────────────────────────────────
  const isTitleQuery = /title|filename|document\s+name|pdf|what\s+is\s+this\s+document\s+called|what\s+is\s+the\s+name\s+of\s+the\s+document|what\s+document/i.test(processedText)
  if (isTitleQuery) {
    const titleStopWords = new Set(['title', 'filename', 'document', 'name', 'pdf', 'what', 'is', 'called', 'show', 'the', 'of', 'from', 'page', 'to', 'a', 'in', 'on', 'with', 'for']);
    const queryTerms = processedText.toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .split(/\s+/)
      .filter(w => w.length >= 2 && !titleStopWords.has(w));

    if (queryTerms.length > 0) {
      console.log(`[retrieval/boost] Title query: "${processedText}". Terms:`, queryTerms);
      fused.forEach(cand => {
        const docTitle = (cand.document?.originalName || cand.metadata?.document_title || '').toLowerCase();
        const matches = queryTerms.filter(term => docTitle.includes(term));
        let boost = 0;
        if (matches.length > 0) {
          boost += 0.15 * matches.length;
        }
        const pageNum = cand.metadata?.page_number;
        if (pageNum === 1) {
          boost += 0.10;
        }
        if (cand.document?.originalName) {
          boost += 0.05;
        }

        if (boost > 0) {
          const originalScore = cand.score;
          cand.score += boost;
          console.log(`[retrieval/boost] Boosted chunk ${cand.chunkId} from "${cand.document?.originalName}" (page ${pageNum}): ${originalScore} -> ${cand.score}`);
        }
      });
      fused.sort((a, b) => b.score - a.score);
    }
  }

  // ── 3C. Bibliography Penalty & Executive Summary Boosting ──────────────────
  const adjustScores = (candidates: SearchResult[], stageLabel: string) => {
    const isBroadQuery = /\b(summarize|summary|overview|abstract|introduction|what is)\b/i.test(processedText);

    candidates.forEach(cand => {
      const content = cand.content || '';
      const pageNum = cand.metadata?.page_number;

      // 1. Detect individual bibliography and citation signatures
      const hasDOI = /doi\.org/i.test(content);
      const hasReferences = /\b(references|bibliography|appendix)\b/i.test(content);
      const hasSPCitations = /\[SP\s+800-\d+[a-z]?\]/i.test(content);
      const hasFIPSCitations = /\[FIPS\s+\d+\]/i.test(content);
      const isLatePage = pageNum !== undefined && pageNum > 400;

      // Apply score penalty only if at least 2 bibliography indicators are present
      const bibliographyScore =
        Number(hasDOI) +
        Number(hasReferences) +
        Number(hasSPCitations) +
        Number(hasFIPSCitations) +
        Number(isLatePage);

      if (bibliographyScore >= 2) {
        const penalty = 0.35;
        cand.score -= penalty;
        console.log(`[retrieval/penalty] [${stageLabel}] Applied penalty to bibliography chunk ${cand.chunkId} (page ${pageNum}) with score ${bibliographyScore}: -${penalty}`);
      }

      // 2. Apply executive summary / introduction boost for broad queries
      if (isBroadQuery) {
        let boost = 0;
        if (pageNum === 1) {
          boost += 0.25;
        } else if (pageNum !== undefined && pageNum >= 2 && pageNum <= 15) {
          const isIntroSection = /\b(executive summary|foreword|introduction|about this publication|overview|purpose|scope|intended audience)\b/i.test(content.toLowerCase());
          boost += isIntroSection ? 0.15 : 0.10;
        }

        if (boost > 0) {
          cand.score += boost;
          console.log(`[retrieval/boost] [${stageLabel}] Applied executive summary boost to chunk ${cand.chunkId} (page ${pageNum}): +${boost}`);
        }
      }

      // 3. Apply metadata/author boost for narrow queries looking for authors/writers
      const isAuthorQuery = /\b(author|authors|published|publisher|who wrote|by|correspondence)\b/i.test(processedText);
      if (isAuthorQuery) {
        let authorBoost = 0;
        if (pageNum === 1) {
          authorBoost += 0.35; // Strong boost for page 1 on author queries
        }
        if (content.toLowerCase().includes('author') || content.toLowerCase().includes('correspondence')) {
          authorBoost += 0.15;
        }
        if (authorBoost > 0) {
          cand.score += authorBoost;
          console.log(`[retrieval/boost] [${stageLabel}] Applied author query boost to chunk ${cand.chunkId} (page ${pageNum}): +${authorBoost}`);
        }
      }
    });

    candidates.sort((a, b) => b.score - a.score);
  };

  // Adjust scores and sort fused list before reranking to keep the fusion pool clean
  adjustScores(fused, 'fused');

  // ── 4. Reranker Provider Execution ─────────────────────────────────────────
  const rerankStart = Date.now()
  let reranked: SearchResult[]
  let rerankLatencyMs = 0
  let rerankTelemetry: any = null

  const provider = rerankerProviderFactory.getProvider()
  let activeProvider = provider
  let rerankerModel = provider.getModelName()

  const skipRerank =
    process.env.ENABLE_GEMINI_RERANKER === 'false' ||
    strategy.searchType === 'narrow' ||
    fused.length <= 5

  if (skipRerank) {
    let reason = ''
    if (process.env.ENABLE_GEMINI_RERANKER === 'false') {
      reason = 'disabled by feature flag'
    } else if (strategy.searchType === 'narrow') {
      reason = 'narrow metadata query'
    } else if (fused.length <= 5) {
      reason = 'candidate count <= 5'
    }
    console.log(`[rerank] skipping reranker — reason: ${reason}`)
    reranked = fused.slice(0, targetTopK)
    rerankerModel = 'none'
  } else {
    // Perform health-check and dynamic fallback to Gemini if BGE is chosen but offline
    if (provider.getProviderName() === 'bge') {
      try {
        const health = await provider.getHealth()
        if (!health.healthy) {
          console.warn(`[rerank] BGE reranker sidecar is unhealthy (${health.error}). Falling back to Gemini.`)
          activeProvider = rerankerProviderFactory.getFallbackProvider()
          rerankerModel = activeProvider.getModelName()
        }
      } catch (err) {
        console.warn(`[rerank] Error checking BGE health: ${err}. Falling back to Gemini.`)
        activeProvider = rerankerProviderFactory.getFallbackProvider()
        rerankerModel = activeProvider.getModelName()
      }
    }

    try {
      const rerankedRes = await activeProvider.rerank(text, fused.slice(0, FUSION_POOL), targetTopK)
      reranked = rerankedRes
      
      // Re-apply penalty and boost post-reranking to guarantee correct final ordering
      adjustScores(reranked, 'reranked');

      rerankTelemetry = (rerankedRes as any).telemetry || null
      rerankLatencyMs = Date.now() - rerankStart
      console.log(`[rerank] selected results: ${reranked.length} (${rerankLatencyMs}ms) via ${activeProvider.getProviderName()}`)
    } catch (err) {
      console.error(`[rerank] Reranking with provider ${activeProvider.getProviderName()} failed, using fused order fallback:`, err)
      reranked = fused.slice(0, targetTopK)
      // Make sure the fallback also has the scoring applied
      adjustScores(reranked, 'fallback');
      rerankLatencyMs = Date.now() - rerankStart
    }
  }

  const rerankerInputCount = skipRerank ? 0 : Math.min(fused.length, FUSION_POOL)
  const rerankerOutputCount = reranked.length
  console.log(
    `[hybrid-telemetry] vector_hits=${vectorResults.length} keyword_hits=${keywordResults.length} fused_hits=${fused.length} reranker_input_count=${rerankerInputCount} reranker_output_count=${rerankerOutputCount}`
  )

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
      // Add the new telemetry/diagnostics fields here
      reranker_enabled:     !skipRerank,
      reranker_model:       rerankerModel,
      pre_rerank_score:     rerankTelemetry?.preRerankScore ?? null,
      post_rerank_score:    rerankTelemetry?.postRerankScore ?? null,
      reranker_lift:        rerankTelemetry?.rerankerLift ?? null,
    },
    enumerable: false,
    writable: true,
  })

  return finalResults
}
