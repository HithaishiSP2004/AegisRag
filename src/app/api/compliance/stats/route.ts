// GET /api/compliance/stats — Sprint 5B
// Aggregated KPI stats for the compliance dashboard.
// RBAC: super_admin | compliance_officer | security_analyst | auditor

import { NextResponse } from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
const ALLOWED = ['super_admin', 'compliance_officer', 'security_analyst', 'auditor'] as const

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('user_profiles').select('org_id, role').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 })
  if (!(ALLOWED as readonly string[]).includes(profile.role))
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })

  const admin = createAdminClient()

  const [
    statsResult,
    riskResult,
    documentsCountResult,
    reportsCountResult,
    workflowsCountResult,
    violationsCountResult,
    auditLogsCountResult
  ] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any).rpc('get_compliance_stats',  { p_org_id: profile.org_id }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin as any).rpc('get_org_risk_score',    { p_org_id: profile.org_id }),
    admin.from('documents').select('*', { count: 'exact', head: true }).eq('org_id', profile.org_id),
    admin.from('reports').select('*', { count: 'exact', head: true }).eq('org_id', profile.org_id),
    admin.from('workflows').select('*', { count: 'exact', head: true }).eq('org_id', profile.org_id),
    admin.from('violations').select('*', { count: 'exact', head: true }).eq('org_id', profile.org_id),
    admin.from('audit_logs').select('*', { count: 'exact', head: true }).eq('org_id', profile.org_id),
  ])

  if (statsResult.error) return NextResponse.json({ error: statsResult.error.message }, { status: 500 })

  const stats     = (statsResult.data as Record<string, number>[] | null)?.[0] ?? null
  const riskScore = (riskResult.data  as Record<string, number | string>[] | null)?.[0] ?? null
  const counts = {
    documents: documentsCountResult.count ?? 0,
    reports: reportsCountResult.count ?? 0,
    workflows: workflowsCountResult.count ?? 0,
    violations: violationsCountResult.count ?? 0,
    audit_logs: auditLogsCountResult.count ?? 0,
  }

  return NextResponse.json({ stats, riskScore, counts })
}
