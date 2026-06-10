/* eslint-disable @typescript-eslint/no-explicit-any */
// =============================================================================
// Sprint 5C: GET /api/reports/executive
// Executive high-level reporting combining security, compliance, retrieval, and trends.
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

  try {
    const [
      riskResult,
      complianceResult,
      retrievalResult,
      securityResult,
      trendsResult
    ] = await Promise.all([
      (admin as any).rpc('get_org_risk_score', { p_org_id: profile.org_id }),
      (admin as any).rpc('get_compliance_stats', { p_org_id: profile.org_id }),
      (admin as any).rpc('get_retrieval_stats', { p_org_id: profile.org_id, p_days: days }),
      (admin as any).rpc('get_security_kpi', { p_org_id: profile.org_id, p_days: days }),
      (admin as any).rpc('get_daily_trends', { p_org_id: profile.org_id, p_days: days })
    ])

    return NextResponse.json({
      days,
      riskScore: riskResult.data?.[0] ?? null,
      compliance: complianceResult.data?.[0] ?? null,
      retrieval: retrievalResult.data?.[0] ?? null,
      security: securityResult.data?.[0] ?? null,
      trends: trendsResult.data ?? []
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
