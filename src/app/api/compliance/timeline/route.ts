// GET /api/compliance/timeline — Sprint 5B
// Returns paginated compliance timeline events combining:
// audit_logs, security_events, security_alerts, retrieval_evals, control_reviews, evidence_exports
//
// RBAC: super_admin | compliance_officer | security_analyst | auditor

import { NextRequest, NextResponse } from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
const ALLOWED_ROLES = ['super_admin', 'compliance_officer', 'security_analyst', 'auditor'] as const

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('user_profiles').select('org_id, role').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 })
  if (!(ALLOWED_ROLES as readonly string[]).includes(profile.role))
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })

  const sp        = req.nextUrl.searchParams
  const page      = Math.max(1, parseInt(sp.get('page')  ?? '1',  10))
  const limit     = Math.min(100, parseInt(sp.get('limit') ?? '50', 10))
  const offset    = (page - 1) * limit

  // Filters
  const source_type   = sp.get('source_type')
  const severity      = sp.get('severity')
  const framework     = sp.get('framework')
  const control_id    = sp.get('control_id')
  const actor_id      = sp.get('actor_id')
  const since         = sp.get('since')
  const until         = sp.get('until')
  const days          = sp.get('days')

  const admin = createAdminClient()

  let controlUuid: string | null = null
  if (control_id) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (uuidRegex.test(control_id)) {
      controlUuid = control_id
    } else {
      let fwQuery = admin.from('compliance_frameworks').select('id').eq('org_id', profile.org_id)
      if (framework) {
        fwQuery = fwQuery.eq('name', framework)
      }
      const { data: frameworksData } = await fwQuery
      const fwIds = frameworksData?.map(f => f.id) || []
      
      if (fwIds.length > 0) {
        const { data: controlsData } = await admin
          .from('compliance_controls')
          .select('id')
          .in('framework_id', fwIds)
          .eq('control_id', control_id)
        if (controlsData && controlsData.length > 0) {
          controlUuid = controlsData[0].id
        }
      } else {
        const { data: controlsData } = await admin
          .from('compliance_controls')
          .select('id')
          .eq('control_id', control_id)
        if (controlsData && controlsData.length > 0) {
          controlUuid = controlsData[0].id
        }
      }
      
      if (!controlUuid) {
        controlUuid = '00000000-0000-0000-0000-000000000000'
      }
    }
  }

  let q = admin
    .from('compliance_timeline')
    .select('*', { count: 'exact' })
    .eq('org_id', profile.org_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (source_type) q = q.eq('source_type', source_type as any)
  if (severity)    q = q.eq('severity', severity)
  if (framework)   q = q.eq('framework_name', framework)
  if (controlUuid) q = q.eq('control_id', controlUuid)
  if (actor_id)    q = q.eq('user_id', actor_id)

  if (since) {
    q = q.gte('created_at', since)
  } else if (days) {
    const daysInt = Math.max(1, parseInt(days, 10))
    const sinceDate = new Date(Date.now() - daysInt * 86_400_000).toISOString()
    q = q.gte('created_at', sinceDate)
  }
  if (until) q = q.lte('created_at', until)

  const { data, error, count } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ events: data ?? [], total: count ?? 0, page, limit })
}
