/* eslint-disable @typescript-eslint/no-explicit-any */
// =============================================================================
// Sprint 5C: GET /api/reports/security
// Security health reporting dashboard API providing alerts breakdown and event tracking.
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
      kpiResult,
      eventsResult,
      alertsResult,
      mismatchesResult
    ] = await Promise.all([
      (admin as any).rpc('get_security_kpi', { p_org_id: profile.org_id, p_days: days }),
      admin
        .from('security_events')
        .select('event_type, severity, blocked, created_at')
        .eq('org_id', profile.org_id)
        .gte('created_at', since),
      admin
        .from('security_alerts')
        .select('id, title, severity, status, category, created_at, resolved_at')
        .eq('org_id', profile.org_id)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(20),
      admin
        .from('document_risk_flags')
        .select(`
          id, declared_sensitivity, detected_sensitivity, risk_score, mismatch_detected, created_at,
          documents!inner ( filename )
        `)
        .eq('org_id', profile.org_id)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(10)
    ])

    // Process security event breakdown in Javascript
    const rawEvents = eventsResult.data ?? []
    const severityCount: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
    const typeCount: Record<string, number> = {}
    let blockedEvents = 0

    for (const ev of rawEvents) {
      severityCount[ev.severity] = (severityCount[ev.severity] || 0) + 1
      typeCount[ev.event_type] = (typeCount[ev.event_type] || 0) + 1
      if (ev.blocked) blockedEvents++
    }

    return NextResponse.json({
      days,
      kpi: kpiResult.data?.[0] ?? null,
      eventsSummary: {
        total: rawEvents.length,
        blocked: blockedEvents,
        severities: severityCount,
        types: typeCount
      },
      alerts: alertsResult.data ?? [],
      mismatches: mismatchesResult.data ?? []
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
