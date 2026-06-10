// =============================================================================
// Sprint 4C: POST /api/benchmark
//
// Triggers the retrieval quality benchmark suite for the authenticated organization.
// RBAC: super_admin | compliance_officer only.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runBenchmarkSuite } from '@/features/retrieval/benchmark'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['super_admin', 'compliance_officer'] as const

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('org_id, role')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 403 })
  }
  if (!(ALLOWED_ROLES as readonly string[]).includes(profile.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  try {
    console.log(`[api/benchmark] Starting benchmark run for org ${profile.org_id}`)
    const results = await runBenchmarkSuite(profile.org_id)
    
    // Calculate averages
    const total = results.length
    if (total === 0) {
      return NextResponse.json({ success: true, results, summary: null })
    }

    const avgLatency = results.reduce((acc, r) => acc + r.latencyMs, 0) / total
    const avgGroundedness = results.reduce((acc, r) => acc + r.groundedness, 0) / total
    const avgCitationHit = results.reduce((acc, r) => acc + r.citationHitRate, 0) / total
    const hallucinationCount = results.filter(r => r.hallucination).length

    const summary = {
      total_queries: total,
      avg_latency_ms: avgLatency,
      avg_groundedness: avgGroundedness,
      avg_citation_hit_rate: avgCitationHit,
      hallucinations_detected: hallucinationCount,
      hallucination_rate_pct: (hallucinationCount / total) * 100
    }

    return NextResponse.json({
      success: true,
      results,
      summary
    })
  } catch (err: any) {
    console.error('[api/benchmark] Benchmark run failed:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
