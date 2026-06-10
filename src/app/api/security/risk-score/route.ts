// GET /api/security/risk-score — Sprint 5B
// Returns organizational risk score (0-100) with breakdown.
// RBAC: super_admin | compliance_officer | security_analyst | auditor

import { NextResponse } from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { computeRiskScore }  from '@/features/security/engine/riskEngine'
import type { RiskInputs }   from '@/features/security/engine/riskEngine'

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

  // Fetch DB-computed risk score
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: dbScore, error } = await (admin as any).rpc('get_org_risk_score', { p_org_id: profile.org_id })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const row = (dbScore as Record<string, number>[] | null)?.[0]

  // Also run TS engine for breakdown detail
  const inputs: RiskInputs = {
    open_alerts:         row?.open_alerts         ?? 0,
    critical_alerts:     row?.critical_alerts      ?? 0,
    unresolved_alerts:   (row?.open_alerts ?? 0) + (row?.critical_alerts ?? 0),
    hallucinations:      row?.hallucinations        ?? 0,
    retrieval_failures:  row?.retrieval_failures    ?? 0,
    failed_reviews:      row?.failed_reviews        ?? 0,
    unauthorized_events: row?.unauthorized_events   ?? 0,
  }
  const engineResult = computeRiskScore(inputs)

  return NextResponse.json({
    db:     row   ?? null,
    engine: engineResult,
  })
}
