// =============================================================================
// Sprint 5A: GET /api/security/dashboard
//
// Returns all security KPI data for the security dashboard:
//   - KPI cards (open alerts, critical, risk flags, resolve time)
//   - Recent alerts (last 20)
//   - Security event stats (reuse get_security_stats from migration 0013)
//   - Recent security events (last 20)
//
// RBAC: super_admin | compliance_officer | security_analyst | auditor
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient }       from '@/lib/supabase/server'
import { createAdminClient }  from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['super_admin', 'compliance_officer', 'security_analyst', 'auditor'] as const

export async function GET(req: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
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

  // ── Params ──────────────────────────────────────────────────────────────────
  const sp   = req.nextUrl.searchParams
  const days = Math.min(90, Math.max(1, parseInt(sp.get('days') ?? '7', 10)))

  const admin = createAdminClient()

  const [kpiResult, alertsResult, secStatsResult, eventsResult, corpusStatsResult, globalCorpusStatsResult] = await Promise.all([
    // 1. KPI aggregates
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any).rpc('get_security_kpi', { p_org_id: profile.org_id, p_days: days }),

    // 2. Recent 20 alerts
    admin
      .from('security_alerts')
      .select('id, title, description, severity, status, category, created_at, updated_at, resolved_at, source_event_id')
      .eq('org_id', profile.org_id)
      .order('created_at', { ascending: false })
      .limit(20),

    // 3. Security event stats (existing fn from migration 0013)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any).rpc('get_security_stats', { p_org_id: profile.org_id, p_hours: days * 24 }),

    // 4. Recent 10 security events for activity feed
    admin
      .from('security_events')
      .select('id, event_type, severity, description, blocked, resolution, created_at')
      .eq('org_id', profile.org_id)
      .eq('is_demo', false)
      .order('created_at', { ascending: false })
      .limit(10),

    // 5. Organization corpus stats
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any).rpc('get_corpus_stats', { p_org_id: profile.org_id }),

    // 6. Global corpus stats (for super admins)
    profile.role === 'super_admin'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (admin as any).rpc('get_global_corpus_stats')
      : Promise.resolve({ data: null, error: null })
  ])

  const kpi      = (kpiResult.data as Record<string, number>[] | null)?.[0] ?? null
  const alerts   = alertsResult.data ?? []
  const secStats = (secStatsResult.data as Record<string, number>[] | null)?.[0] ?? null
  const events   = eventsResult.data ?? []
  const corpusStats = (corpusStatsResult.data as Record<string, number>[] | null)?.[0] ?? null
  const globalCorpusStats = (globalCorpusStatsResult.data as Record<string, number>[] | null)?.[0] ?? null

  if (kpiResult.error)      console.error('[security/dashboard] kpi error:', kpiResult.error.message)
  if (alertsResult.error)   console.error('[security/dashboard] alerts error:', alertsResult.error.message)
  if (secStatsResult.error) console.error('[security/dashboard] secStats error:', secStatsResult.error.message)
  if (corpusStatsResult.error) console.error('[security/dashboard] corpusStats error:', corpusStatsResult.error.message)
  if (globalCorpusStatsResult.error) console.error('[security/dashboard] globalCorpusStats error:', globalCorpusStatsResult.error.message)

  return NextResponse.json({ days, kpi, alerts, secStats, events, corpusStats, globalCorpusStats })
}
