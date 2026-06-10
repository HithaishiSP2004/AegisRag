// =============================================================================
// Sprint 6A: GET /api/security/timeline/detail
//
// Fetches detailed metadata for a timeline event (audit, security, or retrieval)
// and computes a SHA-256 verification hash for audit-grade logging.
//
// RBAC: super_admin | compliance_officer | security_analyst | auditor
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

const ALLOWED_ROLES = ['super_admin', 'compliance_officer', 'security_analyst', 'auditor'] as const

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
  const eventId = sp.get('id')
  const sourceType = sp.get('source_type') as 'audit' | 'security' | 'retrieval'

  if (!eventId || !sourceType) {
    return NextResponse.json({ error: 'id and source_type are required' }, { status: 400 })
  }

  const admin = createAdminClient()
  let detailData: Record<string, unknown> | null = null
  let resolvedUserRole: string | null = null

  // 1. Fetch raw event based on source type
  if (sourceType === 'audit') {
    const { data } = await admin
      .from('audit_logs')
      .select('*')
      .eq('id', eventId)
      .eq('org_id', profile.org_id)
      .single()
    detailData = data
  } else if (sourceType === 'security') {
    const { data } = await admin
      .from('security_events')
      .select('*')
      .eq('id', eventId)
      .eq('org_id', profile.org_id)
      .single()
    detailData = data
  } else if (sourceType === 'retrieval') {
    const { data } = await admin
      .from('retrieval_evals')
      .select('*')
      .eq('id', eventId)
      .eq('org_id', profile.org_id)
      .single()
    detailData = data
  }

  if (!detailData) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  // 2. Fetch User Role if user_id is present
  const eventUserId = detailData.user_id as string | undefined
  if (eventUserId) {
    const { data: userProfile } = await admin
      .from('user_profiles')
      .select('role')
      .eq('id', eventUserId)
      .single()
    if (userProfile) {
      resolvedUserRole = userProfile.role
    }
  }

  // 3. Construct response structure with high-fidelity mappings requested in sprint.md
  const payload = {
    id: detailData.id,
    source_type: sourceType,
    created_at: detailData.created_at,
    user_id: eventUserId || null,
    user_role: resolvedUserRole || 'system_process',
    resource_pathway: (detailData.metadata as Record<string, unknown>)?.pathway || 
                       detailData.resource_type || 
                       (sourceType === 'retrieval' ? 'RAG Engine Pipeline' : 'Internal Secure Gateway'),
    query_text: detailData.query_text || (detailData.metadata as Record<string, unknown>)?.query || null,
    generated_text: (detailData.metadata as Record<string, unknown>)?.response || 
                    (detailData.metadata as Record<string, unknown>)?.answer || null,
    classification: (detailData.metadata as Record<string, unknown>)?.sensitivity || 
                     detailData.declared_sensitivity || 
                     (sourceType === 'retrieval' ? 'internal' : 'public'),
    vector_distance_score: (detailData.metadata as Record<string, unknown>)?.distance || 
                            detailData.groundedness_score || 
                            null,
    raw_data: detailData
  }

  // 4. Compute Verification Hash (SHA-256)
  const hash = crypto.createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex')

  return NextResponse.json({
    ...payload,
    verification_hash: `sha256:${hash}`
  })
}
