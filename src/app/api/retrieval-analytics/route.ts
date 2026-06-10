// =============================================================================
// Sprint 4C: GET /api/retrieval-analytics
//
// Returns retrieval quality metrics from retrieval_evals + ai_requests.
// RBAC: super_admin | compliance_officer only.
//
// Query params:
//   days  — lookback window in days (default: 7, max: 90)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient }  from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['super_admin', 'compliance_officer'] as const

export async function GET(req: NextRequest) {
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

  // ── Params ────────────────────────────────────────────────────────────────
  const sp   = req.nextUrl.searchParams
  const days = Math.min(90, Math.max(1, parseInt(sp.get('days') ?? '7', 10)))

  // Use admin client to bypass RLS on retrieval_evals (service-role SELECT)
  const admin = createAdminClient()

  // ── Run all queries in parallel ───────────────────────────────────────────
  const [statsResult, recentsResult, tokenResult] = await Promise.all([
    // 1. Aggregate stats from get_retrieval_stats()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any).rpc('get_retrieval_stats', {
      p_org_id: profile.org_id,
      p_days:   days,
    }),

    // 2. Recent 20 eval rows for the table
    admin
      .from('retrieval_evals')
      .select(
        'id, query_text, retrieval_mode, chunk_count, total_latency_ms, ' +
        'groundedness_score, citation_hit_rate, hallucination_flag, eval_notes, created_at'
      )
      .eq('org_id', profile.org_id)
      .gte('created_at', new Date(Date.now() - days * 86400_000).toISOString())
      .order('created_at', { ascending: false })
      .limit(20),

    // 3. Token usage from ai_requests (existing function)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any).rpc('get_token_usage_stats', { p_org_id: profile.org_id }),
  ])

  const stats  = (statsResult.data  as Record<string, number>[] | null)?.[0]  ?? null
  const recents = recentsResult.data ?? []
  const tokens  = (tokenResult.data  as Record<string, number>[] | null)?.[0]  ?? null

  if (statsResult.error) {
    console.error('[retrieval-analytics] get_retrieval_stats error:', statsResult.error.message)
  }

  return NextResponse.json({
    days,
    stats,    // aggregate quality metrics
    recents,  // last 20 eval rows
    tokens,   // ai_requests aggregate
  })
}
