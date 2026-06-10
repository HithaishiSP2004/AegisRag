// GET /api/compliance/frameworks — Sprint 5B
// Lists frameworks for org. Auto-seeds on first call if empty.
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

  // Check if frameworks exist; seed if first call
  const { count } = await admin
    .from('compliance_frameworks')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', profile.org_id)

  if ((count ?? 0) === 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).rpc('seed_compliance_frameworks', { p_org_id: profile.org_id })
  }

  const { data: frameworks, error } = await admin
    .from('compliance_frameworks')
    .select('*')
    .eq('org_id', profile.org_id)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // For each framework, count controls + evidence coverage
  const enriched = await Promise.all((frameworks ?? []).map(async (fw) => {
    const { count: ctrl } = await admin.from('compliance_controls')
      .select('id', { count: 'exact', head: true })
      .eq('framework_id', fw.id)

    const controlIds = (await admin.from('compliance_controls').select('id').eq('framework_id', fw.id)).data?.map(c => c.id) ?? []
    
    let uniqueEvidenceCount = 0
    if (controlIds.length > 0) {
      const { data: evControls } = await admin.from('control_evidence')
        .select('control_id')
        .in('control_id', controlIds)
      const uniqueIds = new Set(evControls?.map(e => e.control_id) ?? [])
      uniqueEvidenceCount = uniqueIds.size
    }

    return { ...fw, control_count: ctrl ?? 0, evidence_count: uniqueEvidenceCount }
  }))

  return NextResponse.json({ frameworks: enriched })
}
