// =============================================================================
// Sprint 6A: GET/PATCH /api/security/document-risk
//
// GET   — Returns document risk flags with mismatch data and severity scoring.
// PATCH — Reviews or dismisses a document risk flag.
//
// RBAC: super_admin | compliance_officer | security_analyst | auditor (GET)
// RBAC: super_admin | compliance_officer | security_analyst (PATCH)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['super_admin', 'compliance_officer', 'security_analyst', 'auditor'] as const
const MUTATE_ROLES = ['super_admin', 'compliance_officer', 'security_analyst'] as const

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

  const sp               = req.nextUrl.searchParams
  const mismatches_only  = sp.get('mismatches_only') === 'true'
  const page             = Math.max(1, parseInt(sp.get('page')  ?? '1',  10))
  const limit            = Math.min(100, parseInt(sp.get('limit') ?? '25', 10))
  const offset           = (page - 1) * limit

  const admin = createAdminClient()

  // ── Fetch risk flags joined with document metadata ──────────────────────────
  let query = admin
    .from('document_risk_flags')
    .select(`
      id, org_id, document_id, declared_sensitivity, detected_sensitivity,
      mismatch_detected, risk_score, reasoning, reviewed, reviewed_by, reviewed_at, created_at,
      documents!inner(original_name, doc_type, status, created_at)
    `, { count: 'exact' })
    .eq('org_id', profile.org_id)
    .order('risk_score', { ascending: false })
    .range(offset, offset + limit - 1)

  if (mismatches_only) query = query.eq('mismatch_detected', true)

  const { data: flags, error: flagsErr, count } = await query

  if (flagsErr) return NextResponse.json({ error: flagsErr.message }, { status: 500 })

  // ── Summary stats ───────────────────────────────────────────────────────────
  const [totalDocsResult, mismatchCountResult, docsResult] = await Promise.all([
    admin.from('documents').select('id', { count: 'exact', head: true }).eq('org_id', profile.org_id).eq('status', 'indexed'),
    admin.from('document_risk_flags').select('id', { count: 'exact', head: true })
      .eq('org_id', profile.org_id).eq('mismatch_detected', true).eq('reviewed', false),
    admin.from('documents').select('sensitivity').eq('org_id', profile.org_id).eq('status', 'indexed'),
  ])

  const sensCounts = { public: 0, internal: 0, confidential: 0, restricted: 0 }
  if (docsResult.data) {
    docsResult.data.forEach(d => {
      const s = String(d.sensitivity || '').toLowerCase()
      if (s in sensCounts) {
        sensCounts[s as keyof typeof sensCounts]++
      } else {
        sensCounts.internal++
      }
    })
  }

  return NextResponse.json({
    flags: flags ?? [],
    total: count ?? 0,
    page,
    limit,
    summary: {
      total_indexed_docs:      totalDocsResult.count ?? 0,
      unreviewed_mismatches:   mismatchCountResult.count ?? 0,
      sensitivity_distribution: sensCounts,
    },
  })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('org_id, role')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 })
  if (!(MUTATE_ROLES as readonly string[]).includes(profile.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const body = await req.json()
  const { id, action } = body as {
    id: string
    action: 'review' | 'dismiss'
  }

  if (!id || !action) {
    return NextResponse.json({ error: 'id and action are required' }, { status: 400 })
  }

  const admin = createAdminClient()

  let updatePayload = {}
  if (action === 'review') {
    updatePayload = {
      reviewed: true,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString()
    }
  } else if (action === 'dismiss') {
    updatePayload = {
      reviewed: true,
      mismatch_detected: false,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString()
    }
  }

  const { data, error } = await admin
    .from('document_risk_flags')
    .update(updatePayload)
    .eq('id', id)
    .eq('org_id', profile.org_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ flag: data })
}
