import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const SELECT_ROLES = ['super_admin', 'compliance_officer', 'security_analyst', 'auditor'] as const

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
  if (!(SELECT_ROLES as readonly string[]).includes(profile.role))
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })

  const admin = createAdminClient()

  // 1. Fetch all controls in the organization
  const { data: controls, error: controlsErr } = await admin
    .from('compliance_controls')
    .select('id, control_id, title, severity, compliance_frameworks!inner(id, name, org_id)')
    .eq('compliance_frameworks.org_id', profile.org_id)

  if (controlsErr) return NextResponse.json({ error: controlsErr.message }, { status: 500 })

  const controlIds = (controls ?? []).map((c: any) => c.id)

  // 2. Fetch all evidence and reviews for these controls in parallel
  const [evidenceRes, reviewsRes, docs, alerts, events, evals] = await Promise.all([
    admin.from('control_evidence').select('*').in('control_id', controlIds),
    admin.from('control_reviews').select('*').in('control_id', controlIds).order('created_at', { ascending: false }),
    admin.from('documents').select('id'),
    admin.from('security_alerts').select('id'),
    admin.from('security_events').select('id'),
    admin.from('retrieval_evals').select('id')
  ])

  const evidence = evidenceRes.data ?? []
  const reviews = reviewsRes.data ?? []

  const validIds = new Set<string>([
    ...(docs.data ?? []).map(x => x.id),
    ...(alerts.data ?? []).map(x => x.id),
    ...(events.data ?? []).map(x => x.id),
    ...(evals.data ?? []).map(x => x.id)
  ])

  // Group by control_id
  const evidenceByControl: Record<string, any[]> = {}
  evidence.forEach((ev: any) => {
    if (!evidenceByControl[ev.control_id]) {
      evidenceByControl[ev.control_id] = []
    }
    evidenceByControl[ev.control_id].push(ev)
  })

  const reviewsByControl: Record<string, any[]> = {}
  reviews.forEach((rv: any) => {
    if (!reviewsByControl[rv.control_id]) {
      reviewsByControl[rv.control_id] = []
    }
    reviewsByControl[rv.control_id].push(rv)
  })

  // 3. Run validation checks
  const issues: Array<{
    type: 'evidence_completeness' | 'reference_integrity' | 'signoff_coverage'
    severity: 'critical' | 'high' | 'medium'
    message: string
    control_id: string
    control_code: string
  }> = []

  let controlsWithEvidence = 0
  let controlsWithSignoff = 0
  let totalEvidenceCount = 0
  let validEvidenceCount = 0

  const totalControls = controls?.length ?? 0

  if (controls) {
    controls.forEach((ctrl: any) => {
      // Evidence completeness check
      const evidenceList = evidenceByControl[ctrl.id] ?? []
      if (evidenceList.length === 0) {
        issues.push({
          type: 'evidence_completeness',
          severity: 'high',
          message: `Control has no linked evidence.`,
          control_id: ctrl.id,
          control_code: ctrl.control_id
        })
      } else {
        controlsWithEvidence++
      }

      // Reference integrity check
      evidenceList.forEach((ev: any) => {
        totalEvidenceCount++
        const isValid = validIds.has(ev.source_id)
        if (isValid) {
          validEvidenceCount++
        } else {
          issues.push({
            type: 'reference_integrity',
            severity: 'critical',
            message: `Evidence ref ${ev.id.slice(0, 8)}: Linked resource in table '${ev.source_table}' was deleted or is missing.`,
            control_id: ctrl.id,
            control_code: ctrl.control_id
          })
        }
      })

      // Sign-off coverage check
      const reviewList = reviewsByControl[ctrl.id] ?? []
      const latestReview = reviewList.length > 0 ? reviewList[0] : null
      if (!latestReview || latestReview.status !== 'approved') {
        issues.push({
          type: 'signoff_coverage',
          severity: 'medium',
          message: latestReview 
            ? `Control review is currently marked as '${latestReview.status}'.`
            : `Control has not been audited or signed-off by an officer.`,
          control_id: ctrl.id,
          control_code: ctrl.control_id
        })
      } else {
        controlsWithSignoff++
      }
    })
  }

  // 4. Calculate Readiness Scores
  const evidenceScore = totalControls > 0 ? (controlsWithEvidence / totalControls) * 100 : 100
  const signoffScore = totalControls > 0 ? (controlsWithSignoff / totalControls) * 100 : 100
  const integrityScore = totalEvidenceCount > 0 ? (validEvidenceCount / totalEvidenceCount) * 100 : 100

  // Final composite score (evidence: 40%, signoff: 40%, integrity: 20%)
  const score = Math.round(evidenceScore * 0.4 + signoffScore * 0.4 + integrityScore * 0.2)

  return NextResponse.json({
    score,
    stats: {
      totalControls,
      controlsWithEvidence,
      controlsWithSignoff,
      totalEvidenceCount,
      validEvidenceCount
    },
    issues
  })
}
