// =============================================================================
// Sprint 3B: GET /api/audit
// Audit timeline with pagination, actor/action/resource_type/date filtering,
// KPI stats, and CSV export mode.
// RBAC: super_admin | compliance_officer | auditor only.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['super_admin', 'compliance_officer', 'auditor'] as const

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

  // ── Parse query params ───────────────────────────────────────────────────────
  const sp           = req.nextUrl.searchParams
  const page         = Math.max(1, parseInt(sp.get('page')  ?? '1',   10))
  const limit        = Math.min(100, parseInt(sp.get('limit') ?? '25', 10))
  const offset       = (page - 1) * limit
  const action       = sp.get('action')        ?? null
  const resType      = sp.get('resource_type') ?? null
  const actor        = sp.get('actor')         ?? null   // filter by actor_name
  const from         = sp.get('from')          ?? null
  const to           = sp.get('to')            ?? null
  const exportType   = sp.get('export') // can be 'csv', 'json', 'raw'
  const isExport     = exportType === 'csv' || exportType === 'json' || exportType === 'raw'

  // ── KPI counts (parallel) ───────────────────────────────────────────────────
  const [docCount, auditCount, convCount, userCount] = await Promise.all([
    supabase
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', profile.org_id),
    supabase
      .from('audit_logs')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', profile.org_id),
    supabase
      .from('conversations')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', profile.org_id),
    supabase
      .from('user_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', profile.org_id)
      .eq('is_active', true),
  ])

  const stats = {
    total_documents:    docCount.count   ?? 0,
    total_audit_events: auditCount.count ?? 0,
    total_conversations:convCount.count  ?? 0,
    active_users:       userCount.count  ?? 0,
  }

  // ── Audit timeline query ─────────────────────────────────────────────────────
  let query = supabase
    .from('audit_timeline')
    .select('*', { count: 'exact' })
    .eq('org_id', profile.org_id)
    .order('created_at', { ascending: false })

  if (!isExport) query = query.range(offset, offset + limit - 1)
  if (action)    query = query.ilike('action',        `%${action}%`)
  if (resType)   query = query.eq('resource_type',    resType)
  if (actor)     query = query.ilike('actor_name',    `%${actor}%`)
  if (from)      query = query.gte('created_at',      from)
  if (to)        query = query.lte('created_at',      to)

  const { data: logs, error: logsErr, count } = await query

  if (logsErr) return NextResponse.json({ error: logsErr.message }, { status: 500 })

  // ── Export modes ─────────────────────────────────────────────────────────────
  if (exportType === 'csv') {
    const headers = ['id','action','resource_type','actor_name','actor_role','ip_address','created_at']
    const rows = (logs ?? []).map((r) =>
      headers.map((h) => {
        const v = (r as Record<string, unknown>)[h]
        const s = v == null ? '' : String(v)
        return s.includes(',') || s.includes('"') || s.includes('\n')
          ? `"${s.replace(/"/g, '""')}"`
          : s
      }).join(',')
    )
    const csv = [headers.join(','), ...rows].join('\n')
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type':        'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="audit-export-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  }

  if (exportType === 'json') {
    return new NextResponse(JSON.stringify(logs ?? [], null, 2), {
      status: 200,
      headers: {
        'Content-Type':        'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="audit-export-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    })
  }

  if (exportType === 'raw') {
    return NextResponse.json({ logs: logs ?? [] })
  }

  return NextResponse.json({
    logs:  logs ?? [],
    total: count ?? 0,
    page,
    limit,
    stats,
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase as any)
    .from('user_profiles')
    .select('org_id, role, email, full_name')
    .eq('id', user.id)
    .single() as { data: { org_id: string; role: string; email: string; full_name: string | null } | null }

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 })

  let body: {
    action: string
    resource_type: string
    format: string
    days: number
    reportType: string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { action, resource_type, format, days, reportType } = body
  if (!action || !resource_type) {
    return NextResponse.json({ error: 'action and resource_type are required' }, { status: 400 })
  }

  // Insert into audit_logs (append-only compliance trail)
  const ip = req.headers.get('x-forwarded-for') || '127.0.0.1'
  const userAgent = req.headers.get('user-agent') || 'unknown'

  const { error: auditLogsErr } = await supabase
    .from('audit_logs')
    .insert({
      org_id: profile.org_id,
      user_id: user.id,
      action,
      resource_type,
      new_value: { format, days, reportType },
      ip_address: ip,
      user_agent: userAgent
    })

  if (auditLogsErr) {
    console.error('[audit] Failed to write to audit_logs:', auditLogsErr.message)
  }

  // Insert into audit_events (new Sprint Final telemetry table)
  const actorName = profile.full_name || profile.email || 'user'
  const description = `Exported ${reportType} report in ${format} format covering past ${days} days.`

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: auditEventsErr } = await (supabase as any)
    .from('audit_events')
    .insert({
      org_id: profile.org_id,
      tenant_id: profile.org_id,
      event_type: action,
      actor: actorName,
      description
    })


  if (auditEventsErr) {
    console.error('[audit] Failed to write to audit_events:', auditEventsErr.message)
  }

  return NextResponse.json({ success: true }, { status: 201 })
}

