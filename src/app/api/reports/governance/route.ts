/* eslint-disable @typescript-eslint/no-explicit-any */
// =============================================================================
// Sprint 5C: GET /api/reports/governance
// AI Governance & Audit report containing model distribution, token stats, and audit trails.
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
      tokenStatsResult,
      aiRequestsResult,
      auditLogsResult
    ] = await Promise.all([
      (admin as any).rpc('get_token_usage_stats', { p_org_id: profile.org_id }),
      admin
        .from('ai_requests')
        .select('model_used, call_type, success, prompt_tokens, completion_tokens, total_tokens, latency_ms, fallback_level')
        .eq('org_id', profile.org_id)
        .gte('created_at', since),
      admin
        .from('audit_logs')
        .select('action, resource_type, created_at')
        .eq('org_id', profile.org_id)
        .gte('created_at', since)
    ])

    const tokenStats = (tokenStatsResult.data as Record<string, number>[] | null)?.[0] ?? null
    const rawRequests = aiRequestsResult.data ?? []
    
    // Group and aggregate model stats in JS
    const modelMap: Record<string, {
      calls: number; tokens: number; prompt: number; completion: number
      avgLatency: number; failures: number; fallbacks: number
      latencySum: number
    }> = {}

    for (const row of rawRequests) {
      if (!modelMap[row.model_used]) {
        modelMap[row.model_used] = { calls: 0, tokens: 0, prompt: 0, completion: 0, avgLatency: 0, failures: 0, fallbacks: 0, latencySum: 0 }
      }
      const m = modelMap[row.model_used]!
      m.calls++
      m.tokens += row.total_tokens
      m.prompt += row.prompt_tokens
      m.completion += row.completion_tokens
      m.latencySum += row.latency_ms
      if (!row.success) m.failures++
      if (row.fallback_level > 0) m.fallbacks++
    }

    const modelBreakdown = Object.entries(modelMap).map(([model, stats]) => ({
      model,
      calls: stats.calls,
      total_tokens: stats.tokens,
      prompt_tokens: stats.prompt,
      completion_tokens: stats.completion,
      avg_latency_ms: stats.calls > 0 ? Math.round(stats.latencySum / stats.calls) : 0,
      failure_count: stats.failures,
      fallback_count: stats.fallbacks
    }))

    // Process audit logs breakdown in Javascript
    const rawAudit = auditLogsResult.data ?? []
    const auditSummary: Record<string, number> = {}
    for (const log of rawAudit) {
      const key = `${log.resource_type}:${log.action}`
      auditSummary[key] = (auditSummary[key] || 0) + 1
    }

    return NextResponse.json({
      days,
      tokenStats,
      modelBreakdown,
      auditSummary,
      auditCount: rawAudit.length
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
