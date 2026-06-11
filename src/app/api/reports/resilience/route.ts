import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile, error: profileErr } = await supabase
      .from('user_profiles')
      .select('org_id, role')
      .eq('id', user.id)
      .single()

    if (profileErr || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 403 })
    }

    // Restrict to super_admin or compliance_officer
    if (!['super_admin', 'compliance_officer'].includes(profile.role)) {
      return NextResponse.json({ error: 'Access restricted' }, { status: 403 })
    }

    const orgId = profile.org_id

    // 1. Fetch resilience telemetry
    const { data: telemetryLogs, error: dbErr } = await (supabase as any)
      .from('resilience_telemetry')
      .select('*')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })

    if (dbErr) {
      return NextResponse.json({ error: dbErr.message }, { status: 500 })
    }

    const logs = telemetryLogs || []

    // 2. Fetch AI requests for LLM Failure/Fallback Rate
    const { data: aiRequests } = await supabase
      .from('ai_requests')
      .select('fallback_level')
      .eq('org_id', orgId)

    const totalAI = aiRequests?.length || 0
    const fallbackAI = aiRequests?.filter(r => r.fallback_level > 0).length || 0
    const llmFailureRate = totalAI > 0 ? Math.round((fallbackAI / totalAI) * 100) : 0

    // 3. Compute Metrics
    const totalLogs = logs.length
    const successLogs = logs.filter((l: any) => l.recovery_success).length
    const recoverySuccessRate = totalLogs > 0 ? Math.round((successLogs / totalLogs) * 100) : 0

    const workflowResumeLogs = logs.filter((l: any) => l.fallback_type === 'workflow_resume')
    const workflowResumeSuccess = workflowResumeLogs.filter((l: any) => l.recovery_success).length
    const workflowRecoveryRate = workflowResumeLogs.length > 0
      ? Math.round((workflowResumeSuccess / workflowResumeLogs.length) * 100)
      : 0

    const exportLogs = logs.filter((l: any) => l.fallback_type.includes('export') || l.fallback_type.includes('storage'))
    const exportSuccess = exportLogs.filter((l: any) => l.recovery_success).length
    const exportRecoveryRate = exportLogs.length > 0
      ? Math.round((exportSuccess / exportLogs.length) * 100)
      : 0

    const avgRecoveryTime = logs.length > 0
      ? Math.round(logs.reduce((sum: number, l: any) => sum + l.duration_ms, 0) / logs.length)
      : 0

    // Unified System Resilience Score (bounded 0-100)
    // Formula: Success Rate * 0.4 + Workflow Recovery * 0.3 + Export Recovery * 0.3 - (LLM Failure Rate * 0.2)
    // But if totalLogs === 0, it should evaluate to 0 instead of carrying mathematical weights of 0 fallbacks
    const rawResilienceScore = totalLogs > 0 
      ? (recoverySuccessRate * 0.4) + (workflowRecoveryRate * 0.3) + (exportRecoveryRate * 0.3) - (llmFailureRate * 0.2)
      : 0
    const systemResilienceScore = Math.max(0, Math.min(100, Math.round(rawResilienceScore)))

    // Cache Stats
    const cacheHits = logs.filter((l: any) => l.cache_hit).length
    const cacheMisses = logs.filter((l: any) => l.cache_miss).length
    const totalCache = cacheHits + cacheMisses
    const cacheHitRate = totalCache > 0 ? Math.round((cacheHits / totalCache) * 100) : 0
    const fallbackCount = logs.filter((l: any) => l.fallback_type === 'primary_to_secondary' || l.fallback_type === 'secondary_retry').length
    const evidenceOnlyCount = logs.filter((l: any) => l.fallback_type === 'secondary_to_evidence_only').length

    return NextResponse.json({
      metrics: {
        recoverySuccessRate,
        workflowRecoveryRate,
        exportRecoveryRate,
        llmFailureRate,
        avgRecoveryTime,
        systemResilienceScore,
        cacheHitRate,
        fallbackCount,
        evidenceOnlyCount
      },
      events: logs.slice(0, 100) // return last 100 events
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}
