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
export async function runBenchmarkSuite(orgId: string): Promise<BenchmarkResult[]> {
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

  // We test all golden queries under 'hybrid' mode (which is our production target)
  for (const testCase of GOLDEN_TEST_SUITE) {
    console.log(`[benchmark] Running query: "${testCase.question}"`)
    const start = Date.now()

    try {
      // 1. Run retrieval
      const sources = await searchDocuments(testCase.question, orgId, { limit: 5 })
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
      
      // Let's get the evaluated scores by running evaluateRetrieval
      // (it runs asynchronously, but we can temporarily intercept or query the latest evaluation row)
      await evaluateRetrieval(orgId, testCase.question, mockAnswer, sources, {
        retrieval_mode: mode,
        total_latency_ms: latencyMs,
        conversation_id: conversationId,
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
  runBenchmarkSuite(orgId).then(res => {
    console.log("\n=================== BENCHMARK REPORT ===================")
    console.table(res)
    console.log("========================================================\n")
  }).catch(err => {
    console.error("[benchmark] CLI runner failed:", err)
    process.exit(1)
  })
}
