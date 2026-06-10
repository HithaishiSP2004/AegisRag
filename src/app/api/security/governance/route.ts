// =============================================================================
// Sprint 5A: GET /api/security/governance
//
// Returns AI governance metrics: model usage, token consumption,
// latency, and fallback statistics from ai_requests.
//
// RBAC: super_admin | compliance_officer
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['super_admin', 'compliance_officer'] as const

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

  const sp   = req.nextUrl.searchParams
  const days = Math.min(90, Math.max(1, parseInt(sp.get('days') ?? '7', 10)))

  const admin    = createAdminClient()
  const since    = new Date(Date.now() - days * 86_400_000).toISOString()

  const [tokenStatsResult, modelBreakdownResult, fallbackTimelineResult, recentFailuresResult] = await Promise.all([
    // 1. Aggregate token usage stats
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any).rpc('get_token_usage_stats', { p_org_id: profile.org_id }),

    // 2. Per-model breakdown (group by model_used)
    admin
      .from('ai_requests')
      .select('model_used, call_type, success, prompt_tokens, completion_tokens, total_tokens, latency_ms, fallback_level')
      .eq('org_id', profile.org_id)
      .gte('created_at', since),

    // 3. Daily fallback counts for timeline chart (last N days, limited)
    admin
      .from('ai_requests')
      .select('created_at, fallback_level, success')
      .eq('org_id', profile.org_id)
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .limit(500),

    // 4. Recent failures for table display
    admin
      .from('ai_requests')
      .select('id, model_used, call_type, error_code, error_message, fallback_level, latency_ms, created_at')
      .eq('org_id', profile.org_id)
      .eq('success', false)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  const tokenStats = (tokenStatsResult.data as Record<string, number>[] | null)?.[0] ?? null
  const rawRows    = modelBreakdownResult.data ?? []

  // Aggregate per-model stats in JS
  const modelMap: Record<string, {
    calls: number; tokens: number; prompt: number; completion: number
    avgLatency: number; failures: number; fallbacks: number
    latencySum: number
  }> = {}

  for (const row of rawRows as Array<{
    model_used: string; success: boolean; prompt_tokens: number
    completion_tokens: number; total_tokens: number; latency_ms: number; fallback_level: number
  }>) {
    if (!modelMap[row.model_used]) {
      modelMap[row.model_used] = { calls:0, tokens:0, prompt:0, completion:0, avgLatency:0, failures:0, fallbacks:0, latencySum:0 }
    }
    const m = modelMap[row.model_used]!
    m.calls++
    m.tokens      += row.total_tokens
    m.prompt      += row.prompt_tokens
    m.completion  += row.completion_tokens
    m.latencySum  += row.latency_ms
    if (!row.success)           m.failures++
    if (row.fallback_level > 0) m.fallbacks++
  }

  const modelBreakdown = Object.entries(modelMap).map(([model, stats]) => ({
    model,
    calls:        stats.calls,
    total_tokens: stats.tokens,
    prompt_tokens: stats.prompt,
    completion_tokens: stats.completion,
    avg_latency_ms: stats.calls > 0 ? Math.round(stats.latencySum / stats.calls) : 0,
    failure_count:  stats.failures,
    fallback_count: stats.fallbacks,
  }))

  return NextResponse.json({
    days,
    tokenStats,
    modelBreakdown,
    fallbackTimeline: fallbackTimelineResult.data ?? [],
    recentFailures:   recentFailuresResult.data   ?? [],
  })
}
