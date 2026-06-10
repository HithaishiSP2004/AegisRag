// GET /api/compliance/controls — Sprint 5B
// Lists controls for a framework, with evidence count + last review.
// ?framework_id=UUID  (required)  ?category=string
// RBAC: super_admin | compliance_officer | security_analyst | auditor

import { NextRequest, NextResponse } from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
const ALLOWED = ['super_admin', 'compliance_officer', 'security_analyst', 'auditor'] as const

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('user_profiles').select('org_id, role').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 })
  if (!(ALLOWED as readonly string[]).includes(profile.role))
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })

  const sp           = req.nextUrl.searchParams
  const framework_id = sp.get('framework_id')
  const category     = sp.get('category')

  const admin = createAdminClient()

  let q = admin
    .from('compliance_controls')
    .select('*, compliance_frameworks!inner(org_id, name)')
    .eq('compliance_frameworks.org_id', profile.org_id)
    .order('control_id')

  if (framework_id) q = q.eq('framework_id', framework_id)
  if (category)     q = q.eq('category', category)

  const { data: controls, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enrich with evidence count and last review
  const enriched = await Promise.all((controls ?? []).map(async (ctrl) => {
    const [{ count: evCount }, lastReviewRes] = await Promise.all([
      admin.from('control_evidence')
        .select('id', { count:'exact', head:true }).eq('control_id', ctrl.id),
      admin.from('control_reviews')
        .select('status, review_date, next_review_date')
        .eq('control_id', ctrl.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])
    return {
      ...ctrl,
      framework_name:  ((ctrl as any).compliance_frameworks as { name: string } | null)?.name ?? '',
      evidence_count:  evCount ?? 0,
      last_review:     lastReviewRes.data ?? null,
    }
  }))

  return NextResponse.json({ controls: enriched })
}
