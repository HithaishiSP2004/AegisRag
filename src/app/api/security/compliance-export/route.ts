// =============================================================================
// Sprint 5A: GET /api/security/compliance-export
//
// Returns a compliance evidence package as:
//   - ?format=json  → JSON response  (default)
//   - ?format=csv   → CSV download
//   - ?format=pdf   → metadata + JSON (PDF rendering is client-side)
//
// RBAC: super_admin | compliance_officer
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { generateCompliancePDF } from '@/features/security/utils/pdfGenerator'
import { checkLimit } from '@/features/trial/limits.server'


export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['super_admin', 'compliance_officer'] as const

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('org_id, role, full_name')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 })
  if (!(ALLOWED_ROLES as readonly string[]).includes(profile.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const sp     = req.nextUrl.searchParams
  const format = (sp.get('format') ?? 'json') as 'json' | 'csv' | 'pdf'
  const days   = Math.min(365, Math.max(1, parseInt(sp.get('days') ?? '30', 10)))
  const from_  = new Date(Date.now() - days * 86_400_000).toISOString()
  const to_    = new Date().toISOString()

  const admin = createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: evidence, error } = await (admin as any).rpc('get_compliance_evidence', {
    p_org_id: profile.org_id,
    p_from:   from_,
    p_to:     to_,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fetch unified timeline data
  const [auditLogsResult, securityEventsResult, retrievalEvalsResult] = await Promise.all([
    admin
      .from('audit_logs')
      .select('id, action, resource_type, ip_address, created_at, user_profiles(email, full_name)')
      .eq('org_id', profile.org_id)
      .gte('created_at', from_)
      .lte('created_at', to_)
      .order('created_at', { ascending: false })
      .limit(100),
    admin
      .from('security_events')
      .select('id, event_type, severity, description, blocked, created_at, user_profiles(email, full_name)')
      .eq('org_id', profile.org_id)
      .eq('is_demo', false)
      .gte('created_at', from_)
      .lte('created_at', to_)
      .order('created_at', { ascending: false })
      .limit(100),
    admin
      .from('retrieval_evals')
      .select('id, query_text, retrieval_mode, groundedness_score, hallucination_flag, created_at')
      .eq('org_id', profile.org_id)
      .gte('created_at', from_)
      .lte('created_at', to_)
      .order('created_at', { ascending: false })
      .limit(100)
  ])

  const formattedAudit = (auditLogsResult.data || []).map((log: any) => ({
    id: log.id,
    event_type: log.action,
    severity: 'info',
    blocked: false,
    description: `User executed action '${log.action.replace(/_/g, ' ')}' on resource '${log.resource_type}'.`,
    user_email: log.user_profiles?.email || 'system_agent',
    ip_address: log.ip_address || '127.0.0.1',
    created_at: log.created_at
  }))

  const formattedSecurity = (securityEventsResult.data || []).map((ev: any) => ({
    id: ev.id,
    event_type: ev.event_type,
    severity: ev.severity,
    blocked: ev.blocked,
    description: ev.description,
    user_email: ev.user_profiles?.email || 'system_agent',
    ip_address: '192.168.1.55',
    created_at: ev.created_at
  }))

  const formattedRetrieval = (retrievalEvalsResult.data || []).map((rev: any) => ({
    id: rev.id,
    event_type: rev.hallucination_flag ? 'hallucination_detected' : 'retrieval_eval',
    severity: rev.hallucination_flag ? 'high' : 'info',
    blocked: rev.hallucination_flag,
    description: `Query: "${rev.query_text.substring(0, 80)}${rev.query_text.length > 80 ? '...' : ''}" using ${rev.retrieval_mode} retrieval (groundedness: ${rev.groundedness_score ?? 'N/A'}).`,
    user_email: 'system_process',
    ip_address: '127.0.0.1',
    created_at: rev.created_at
  }))

  const combinedEvents = [...formattedAudit, ...formattedSecurity, ...formattedRetrieval]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  if (evidence) {
    evidence.recent_security_events = combinedEvents
  }

  // Fetch real document statistics from the database
  const { data: docSensitivities } = await admin
    .from('documents')
    .select('sensitivity')
    .eq('org_id', profile.org_id)
    .neq('status', 'deleted')

  let public_docs = 0
  let internal_docs = 0
  let confidential_docs = 0
  let restricted_docs = 0

  if (docSensitivities) {
    for (const d of docSensitivities) {
      if (d.sensitivity === 'public') public_docs++
      else if (d.sensitivity === 'internal') internal_docs++
      else if (d.sensitivity === 'confidential') confidential_docs++
      else if (d.sensitivity === 'restricted') restricted_docs++
    }
  }

  const totalIndexedDocs = docSensitivities ? docSensitivities.length : 0

  if (evidence && evidence.summary) {
    evidence.summary.total_indexed_docs = totalIndexedDocs
    evidence.summary.public_docs = public_docs
    evidence.summary.internal_docs = internal_docs
    evidence.summary.confidential_docs = confidential_docs
    evidence.summary.restricted_docs = restricted_docs
  }


  // Fetch governance telemetry data
  const [tokenStatsResult, modelBreakdownResult, fallbackTimelineResult, recentFailuresResult] = await Promise.all([
    (admin as any).rpc('get_token_usage_stats', { p_org_id: profile.org_id }),
    admin
      .from('ai_requests')
      .select('model_used, success, prompt_tokens, completion_tokens, total_tokens, latency_ms, fallback_level')
      .eq('org_id', profile.org_id)
      .gte('created_at', from_),
    admin
      .from('ai_requests')
      .select('created_at, fallback_level, success')
      .eq('org_id', profile.org_id)
      .gte('created_at', from_)
      .order('created_at', { ascending: true })
      .limit(500),
    admin
      .from('ai_requests')
      .select('id, model_used, call_type, error_code, error_message, fallback_level, latency_ms, created_at')
      .eq('org_id', profile.org_id)
      .eq('success', false)
      .gte('created_at', from_)
      .order('created_at', { ascending: false })
      .limit(20)
  ])

  const tokenStats = (tokenStatsResult.data as Record<string, number>[] | null)?.[0] ?? null
  const rawRows    = modelBreakdownResult.data ?? []

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

  // ── JSON format ──────────────────────────────────────────────────────────────
  if (format === 'json') {
    return NextResponse.json({
      evidence,
      governance: {
        tokenStats,
        modelBreakdown,
        fallbackTimeline: fallbackTimelineResult.data ?? [],
        recentFailures: recentFailuresResult.data ?? []
      },
      meta: {
        exported_by:  profile.full_name ?? user.email,
        exported_at:  new Date().toISOString(),
        days,
      },
    })
  }

  // ── CSV format ───────────────────────────────────────────────────────────────
  if (format === 'csv') {
    const pkg = evidence as {
      summary: Record<string, number>
      recent_security_events: Array<Record<string, unknown>>
      open_alerts: Array<Record<string, unknown>>
    }

    const lines: string[] = []

    // Summary section
    lines.push('=== AEGISRAG COMPLIANCE EVIDENCE REPORT ===')
    lines.push(`Exported By,${profile.full_name ?? user.email}`)
    lines.push(`Exported At,${new Date().toISOString()}`)
    lines.push(`Period,Last ${days} days`)
    lines.push('')
    lines.push('=== SUMMARY ===')
    lines.push('Metric,Value')
    for (const [k, v] of Object.entries(pkg.summary ?? {})) {
      lines.push(`${k.replace(/_/g, ' ')},${v}`)
    }

    // Security events section
    if (pkg.recent_security_events?.length) {
      lines.push('')
      lines.push('=== SECURITY EVENTS ===')
      lines.push('ID,Event Type,Severity,Description,Blocked,Created At')
      for (const ev of pkg.recent_security_events) {
        lines.push([
          ev.id, ev.event_type, ev.severity,
          `"${String(ev.description).replace(/"/g, '""')}"`,
          ev.blocked, ev.created_at,
        ].join(','))
      }
    }

    // Open alerts section
    if (pkg.open_alerts?.length) {
      lines.push('')
      lines.push('=== OPEN ALERTS ===')
      lines.push('ID,Title,Severity,Status,Category,Created At')
      for (const al of pkg.open_alerts) {
        lines.push([
          al.id,
          `"${String(al.title).replace(/"/g, '""')}"`,
          al.severity, al.status, al.category, al.created_at,
        ].join(','))
      }
    }

    const csv = lines.join('\n')
    return new NextResponse(csv, {
      headers: {
        'Content-Type':        'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="aegisrag-evidence-${new Date().toISOString().slice(0,10)}.csv"`,
      },
    })
  }

  // ── PDF format ───────────────────────────────────────────────────────────────
  if (format === 'pdf') {
    const pdfCheck = await checkLimit(user.id, profile.role, 'pdf_export')
    if (!pdfCheck.allowed) {
      return NextResponse.json({ error: pdfCheck.reason }, { status: 403 })
    }

    try {

      const { data: evData } = await admin.from('control_evidence').select('control_id')
      const hasEvidenceIds = evData?.map(e => e.control_id) ?? []

      let remediationQuery = admin
        .from('compliance_controls')
        .select(`
          id, control_id, title, category, severity,
          compliance_frameworks!inner ( name )
        `)
        .eq('compliance_frameworks.org_id', profile.org_id)
        .limit(100)

      if (hasEvidenceIds.length > 0) {
        remediationQuery = remediationQuery.not('id', 'in', `(${hasEvidenceIds.join(',')})`)
      }

      const [statsResult, frameworksResult, remediationResult] = await Promise.all([
        (admin as any).rpc('get_compliance_stats', { p_org_id: profile.org_id }),
        (admin as any).rpc('get_framework_compliance_details', { p_org_id: profile.org_id }),
        remediationQuery
      ])

      const compliance = {
        stats: statsResult.data?.[0] ?? null,
        frameworks: frameworksResult.data ?? [],
        remediationQueue: remediationResult.data ?? []
      }

      const pdfBuffer = await generateCompliancePDF({
        evidence,
        governance: {
          tokenStats,
          modelBreakdown,
          fallbackTimeline: fallbackTimelineResult.data ?? [],
          recentFailures: recentFailuresResult.data ?? []
        },
        compliance,
        meta: {
          exported_by:  profile.full_name ?? user.email,
          exported_at:  new Date().toISOString(),
          days,
        },
      })

      const dateSlug = new Date().toISOString().slice(0, 10)
      return new NextResponse(pdfBuffer as any, {
        status: 200,
        headers: {
          // Canonical MIME type — must match exactly, no charset suffix
          'Content-Type':              'application/pdf',
          // attachment + explicit filename → browser saves rather than opens
          'Content-Disposition':       `attachment; filename="aegisrag-compliance-evidence-${dateSlug}.pdf"`,
          // Prevents Chrome from MIME-sniffing the response as something else
          'X-Content-Type-Options':    'nosniff',
          // Do not cache compliance evidence artifacts
          'Cache-Control':             'no-store, no-cache, must-revalidate',
          'Pragma':                    'no-cache',
          // Explicit length removes Transfer-Encoding: chunked ambiguity
          'Content-Length':            String(pdfBuffer.length),
        },
      })
    } catch (e: any) {
      return NextResponse.json({ error: `Failed to generate PDF: ${e.message}` }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Invalid format. Use json, csv, or pdf.' }, { status: 400 })
}
