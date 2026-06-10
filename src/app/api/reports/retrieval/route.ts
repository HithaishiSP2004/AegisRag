/* eslint-disable @typescript-eslint/no-explicit-any */
// =============================================================================
// Sprint 5C: GET /api/reports/retrieval
// Retrieval quality reporting dashboard API providing latency and precision metrics.
// RBAC: super_admin | compliance_officer | security_analyst | auditor | executive
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['super_admin', 'compliance_officer', 'security_analyst', 'auditor', 'executive'] as const

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('org_id, role')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 })
  if (!(ALLOWED_ROLES as readonly string[]).includes(profile.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const sp = req.nextUrl.searchParams
  const days = Math.min(365, Math.max(7, parseInt(sp.get('days') ?? '30', 10)))

  const admin = createAdminClient()
  const since = new Date(Date.now() - days * 86_400_000).toISOString()

  try {
    const [
      statsResult,
      evalsResult
    ] = await Promise.all([
      (admin as any).rpc('get_retrieval_stats', { p_org_id: profile.org_id, p_days: days }),
      admin
        .from('retrieval_evals')
        .select('id, query_text, retrieval_mode, chunk_count, total_latency_ms, groundedness_score, citation_hit_rate, hallucination_flag, eval_notes, created_at')
        .eq('org_id', profile.org_id)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(20)
    ])

    return NextResponse.json({
      days,
      stats: statsResult.data?.[0] ?? null,
      recentEvals: evalsResult.data ?? []
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
