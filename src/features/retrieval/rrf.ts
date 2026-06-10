// =============================================================================
// Sprint 4B: Reciprocal Rank Fusion (RRF)
//
// Merges vector and keyword result lists into a single ranked list.
// Formula: score += 1 / (60 + rank)   (Cormack et al. 2009)
//
// Guarantees:
//   - Both lists contribute independently
//   - chunkIds are deduplicated (highest fused score wins)
//   - Source attribution preserved: mode becomes 'vector', 'keyword', or 'hybrid'
//   - Output sorted descending by fused score
//   - Output is RetrievalResult[] (= SearchResult[]) — same stable contract
// =============================================================================

import type { SearchResult } from './types'

const RRF_K = 60

/**
 * Fuse two ranked result lists using Reciprocal Rank Fusion.
 *
 * @param vectorResults  - Results from vectorSearch(), ranked by similarity
 * @param keywordResults - Results from keywordSearch(), ranked by ts_rank
 * @returns              Deduplicated, fused, descending-sorted SearchResult[]
 */
export function fuseResults(
  vectorResults:  SearchResult[],
  keywordResults: SearchResult[],
): SearchResult[] {
  // Accumulate RRF scores keyed by chunkId
  const scoreMap = new Map<string, number>()
  // Keep the best source object per chunkId (prefer vector for tie metadata)
  const resultMap = new Map<string, SearchResult>()
  // Track which backends contributed to each chunkId
  const sourceMap = new Map<string, Set<'vector' | 'keyword'>>()

  function addList(results: SearchResult[], source: 'vector' | 'keyword') {
    results.forEach((r, rank) => {
      const existing = scoreMap.get(r.chunkId) ?? 0
      const contribution = 1 / (RRF_K + rank + 1)   // rank is 0-indexed → +1
      scoreMap.set(r.chunkId, existing + contribution)

      if (!resultMap.has(r.chunkId)) {
        resultMap.set(r.chunkId, r)
      }
      if (!sourceMap.has(r.chunkId)) {
        sourceMap.set(r.chunkId, new Set())
      }
      sourceMap.get(r.chunkId)!.add(source)
    })
  }

  addList(vectorResults,  'vector')
  addList(keywordResults, 'keyword')

  // Build fused result list
  const fused: SearchResult[] = []
  for (const [chunkId, fusedScore] of scoreMap.entries()) {
    const base    = resultMap.get(chunkId)!
    const sources = sourceMap.get(chunkId)!
    const mode = sources.has('vector') && sources.has('keyword')
      ? 'hybrid'
      : sources.has('vector')
        ? 'vector'
        : 'keyword'

    fused.push({ ...base, score: fusedScore, mode })
  }

  // Sort descending by fused score
  fused.sort((a, b) => b.score - a.score)

  console.log(
    `[rrf] vector=${vectorResults.length} keyword=${keywordResults.length}` +
    ` → fused=${fused.length}` +
    ` hybrid=${fused.filter(r => r.mode === 'hybrid').length}` +
    ` vector-only=${fused.filter(r => r.mode === 'vector').length}` +
    ` keyword-only=${fused.filter(r => r.mode === 'keyword').length}`
  )

  return fused
}
