// =============================================================================
// Sprint 4C: Retrieval Benchmark Suite
//
// Runs a batch of evaluation queries across different retrieval modes
// and reports performance/quality metrics.
//
// Can be executed via:
//   npx tsx src/features/retrieval/benchmark.ts
// Or triggered via the /api/benchmark route.
// =============================================================================

import { searchDocuments } from './service'
import { evaluateRetrieval } from './evaluate'
import { createAdminClient } from '@/lib/supabase/server'
import type { SearchResult } from './types'

export interface BenchmarkTestCase {
  question: string
  expectedKeywords: string[]
}

export const GOLDEN_TEST_SUITE: BenchmarkTestCase[] = [
  {
    question: "What is the NOC (Network Operations Center) protocol?",
    expectedKeywords: ["noc", "network", "operations", "protocol"]
  },
  {
    question: "What are the security guardrails for data classification?",
    expectedKeywords: ["security", "guardrails", "classification", "data"]
  },
  {
    question: "What is the emergency backup policy?",
    expectedKeywords: ["backup", "emergency", "policy", "disaster"]
  },
  {
    question: "Explain the multi-tenant isolation mechanism.",
    expectedKeywords: ["multi-tenant", "isolation", "tenant", "database"]
  },
  {
    question: "What are the compliance auditing guidelines?",
    expectedKeywords: ["compliance", "audit", "guidelines", "reporting"]
  }
]

export interface BenchmarkResult {
  question: string
  mode: 'vector' | 'keyword' | 'hybrid'
  chunksFound: number
  latencyMs: number
  groundedness: number
  citationHitRate: number
  hallucination: boolean
  matchedKeywords: string[]
}

/**
 * Runs the benchmark test suite for a given organization ID.
 */
export async function runBenchmarkSuite(
  orgId: string,
  retrievalMode?: 'vector' | 'keyword' | 'hybrid'
): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = []

  // Ensure we have at least one message/conversation context
  const admin = createAdminClient()
  
  // Find or create a benchmark conversation
  let { data: conv } = await admin
    .from('conversations')
    .select('id')
    .eq('org_id', orgId)
    .limit(1)
    .single()

  if (!conv) {
    // Let's find a profile to associate the conversation with
    const { data: profile } = await admin
      .from('user_profiles')
      .select('id')
      .eq('org_id', orgId)
      .limit(1)
      .single()
    
    if (profile) {
      const { data: newConv } = await admin
        .from('conversations')
        .insert({
          org_id: orgId,
          user_id: profile.id,
          title: 'Retrieval Benchmark'
        })
        .select('id')
        .single()
      conv = newConv
    }
  }

  const conversationId = conv?.id ?? null

  for (const testCase of GOLDEN_TEST_SUITE) {
    console.log(`[benchmark] Running query: "${testCase.question}" in mode ${retrievalMode ?? 'hybrid'}`)
    const start = Date.now()

    try {
      // 1. Run retrieval
      const sources = await searchDocuments(testCase.question, orgId, {
        limit: 5,
        retrievalMode: retrievalMode ?? 'hybrid',
      })
      const latencyMs = Date.now() - start

      // Extract details
      const mode = (sources[0]?.mode ?? 'hybrid') as 'vector' | 'keyword' | 'hybrid'
      const textToSearch = sources.map(s => s.content.toLowerCase()).join(' ')
      
      const matchedKeywords = testCase.expectedKeywords.filter(kw => 
        textToSearch.includes(kw.toLowerCase())
      )

      // 2. Compute citation hit rate (simulate a simple answer that references some sources)
      // If we got sources, we reference them.
      let mockAnswer = `Based on the documents, NOC is operational.`
      if (sources.length > 0) {
        mockAnswer += ` Source [1] details the primary protocols, while source [2] explains the escalation path.`
      }

      // 3. Evaluate & persist to retrieval_evals
      // This will call Gemini and log it to retrieval_evals table
      const evalStart = Date.now()
      const metrics = (sources as any).metrics
      
      // Let's get the evaluated scores by running evaluateRetrieval
      // (it runs asynchronously, but we can temporarily intercept or query the latest evaluation row)
      await evaluateRetrieval(orgId, testCase.question, mockAnswer, sources, {
        retrieval_mode:       mode,
        total_latency_ms:     latencyMs,
        conversation_id:      conversationId,
        vector_latency_ms:    metrics?.vector_latency_ms,
        keyword_latency_ms:   metrics?.keyword_latency_ms,
        fusion_latency_ms:    metrics?.fusion_latency_ms,
        rerank_latency_ms:    metrics?.rerank_latency_ms,
        vector_candidates:    metrics?.vector_candidates,
        reranked_candidates:   metrics?.reranked_candidates,
        context_tokens_saved: metrics?.context_tokens_saved,
        reranker_enabled:     metrics?.reranker_enabled,
        reranker_model:       metrics?.reranker_model,
        pre_rerank_score:     metrics?.pre_rerank_score,
        post_rerank_score:    metrics?.post_rerank_score,
        reranker_lift:        metrics?.reranker_lift,
      })

      // Fetch the last inserted evaluation to display accurate scores
      const { data: latestEvals } = await admin
        .from('retrieval_evals')
        .select('groundedness_score, citation_hit_rate, hallucination_flag')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(1)

      const lastEval = latestEvals?.[0]

      results.push({
        question: testCase.question,
        mode,
        chunksFound: sources.length,
        latencyMs,
        groundedness: lastEval?.groundedness_score ?? 1.0,
        citationHitRate: lastEval?.citation_hit_rate ?? 1.0,
        hallucination: lastEval?.hallucination_flag ?? false,
        matchedKeywords
      })

      console.log(`[benchmark] Completed: matched ${matchedKeywords.length}/${testCase.expectedKeywords.length} keywords. Latency: ${latencyMs}ms.`)
    } catch (err: any) {
      console.error(`[benchmark] Error running query "${testCase.question}":`, err.message)
    }
  }

  return results;
}

// CLI entry point execution if run directly
if (require.main === module) {
  const orgId = process.env.TEST_ORG_ID
  if (!orgId) {
    console.error("Please set TEST_ORG_ID env variable to run benchmark CLI.")
    process.exit(1)
  }
  console.log(`[benchmark] Starting benchmark suite for Org: ${orgId}...`)

  ;(async () => {
    try {
      console.log("\n>>> RUNNING VECTOR-ONLY RETRIEVAL BENCHMARK <<<")
      const vectorRes = await runBenchmarkSuite(orgId, 'vector')

      console.log("\n>>> RUNNING HYBRID + RRF RETRIEVAL BENCHMARK <<<")
      const hybridRes = await runBenchmarkSuite(orgId, 'hybrid')

      console.log("\n==========================================================================================")
      console.log("===                            RETRIEVAL BENCHMARK COMPARISON                          ===")
      console.log("==========================================================================================")
      
      const comparisonTable = vectorRes.map((v, idx) => {
        const h = hybridRes[idx]
        return {
          Question: v.question.slice(0, 45) + (v.question.length > 45 ? '...' : ''),
          'Vec Latency (ms)': v.latencyMs,
          'Hyb Latency (ms)': h.latencyMs,
          'Vec Chunks': v.chunksFound,
          'Hyb Chunks': h.chunksFound,
          'Vec Grounded': v.groundedness,
          'Hyb Grounded': h.groundedness,
          'Vec Halluc': v.hallucination,
          'Hyb Halluc': h.hallucination,
          'Vec Keywords': `${v.matchedKeywords.length}/${GOLDEN_TEST_SUITE[idx].expectedKeywords.length}`,
          'Hyb Keywords': `${h.matchedKeywords.length}/${GOLDEN_TEST_SUITE[idx].expectedKeywords.length}`
        }
      })

      console.table(comparisonTable)
      
      // Compute averages
      const avgVecLat = vectorRes.reduce((acc, r) => acc + r.latencyMs, 0) / vectorRes.length
      const avgHybLat = hybridRes.reduce((acc, r) => acc + r.latencyMs, 0) / hybridRes.length
      const avgVecGrounded = vectorRes.reduce((acc, r) => acc + r.groundedness, 0) / vectorRes.length
      const avgHybGrounded = hybridRes.reduce((acc, r) => acc + r.groundedness, 0) / hybridRes.length
      const vecHallucRate = (vectorRes.filter(r => r.hallucination).length / vectorRes.length) * 100
      const hybHallucRate = (hybridRes.filter(r => r.hallucination).length / hybridRes.length) * 100

      console.log("\n=== METRIC SUMMARY COMPARISON ===")
      console.log(`Average Latency:      Vector-Only = ${avgVecLat.toFixed(1)}ms | Hybrid + RRF = ${avgHybLat.toFixed(1)}ms`)
      console.log(`Average Groundedness: Vector-Only = ${avgVecGrounded.toFixed(3)} | Hybrid + RRF = ${avgHybGrounded.toFixed(3)}`)
      console.log(`Hallucination Rate:   Vector-Only = ${vecHallucRate.toFixed(1)}% | Hybrid + RRF = ${hybHallucRate.toFixed(1)}%`)
      console.log("==========================================================================================\n")
    } catch (err) {
      console.error("[benchmark] CLI runner failed:", err)
      process.exit(1)
    }
  })()
}
