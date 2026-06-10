/* eslint-disable @typescript-eslint/no-explicit-any */
// =============================================================================
// Sprint 5C: GET /api/reports/compliance
// Compliance reporting dashboard API providing frameworks breakdown and recent reviews.
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
    const { data: evData } = await admin.from('control_evidence').select('control_id')
    const hasEvidenceIds = evData?.map(e => e.control_id) ?? []

    let remediationQuery = admin
      .from('compliance_controls')
      .select(`
        id, control_id, title, category, severity,
        compliance_frameworks!inner ( name )
      `)
      .eq('compliance_frameworks.org_id', profile.org_id)
      .limit(100)

    if (hasEvidenceIds.length > 0) {
      remediationQuery = remediationQuery.not('id', 'in', `(${hasEvidenceIds.join(',')})`)
    }

    const [
      statsResult,
      frameworksResult,
      recentReviewsResult,
      remediationResult
    ] = await Promise.all([
      (admin as any).rpc('get_compliance_stats', { p_org_id: profile.org_id }),
      (admin as any).rpc('get_framework_compliance_details', { p_org_id: profile.org_id }),
      admin
        .from('control_reviews')
        .select(`
          id, status, notes, review_date, next_review_date, created_at,
          compliance_controls!inner (
            control_id, title, severity,
            compliance_frameworks!inner ( name )
          )
        `)
        .eq('compliance_controls.compliance_frameworks.org_id', profile.org_id)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(10),
      remediationQuery
    ])

    return NextResponse.json({
      days,
      stats: statsResult.data?.[0] ?? null,
      frameworks: frameworksResult.data ?? [],
      recentReviews: recentReviewsResult.data ?? [],
      remediationQueue: remediationResult.data ?? []
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
