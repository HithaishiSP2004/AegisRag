// =============================================================================
// Sprint 5A: GET /api/security/timeline
//
// Returns paginated unified security timeline (audit + security + retrieval).
// Sources: security_timeline view (migration 0025).
//
// RBAC: super_admin | compliance_officer | security_analyst | auditor
//
// Query params:
//   page, limit, source_type (audit|security|retrieval), severity, days
// =============================================================================

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
    .from('user_profiles')
    .select('org_id, role')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 })
  if (!(ALLOWED_ROLES as readonly string[]).includes(profile.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const sp          = req.nextUrl.searchParams
  const page        = Math.max(1, parseInt(sp.get('page')  ?? '1',  10))
  const limit       = Math.min(100, parseInt(sp.get('limit') ?? '50', 10))
  const offset      = (page - 1) * limit
  const source_type = sp.get('source_type')
  const severity    = sp.get('severity')
  const days        = Math.min(90, Math.max(1, parseInt(sp.get('days') ?? '7', 10)))
  const since       = new Date(Date.now() - days * 86_400_000).toISOString()

  const admin = createAdminClient()

  let query = admin
    .from('security_timeline')
    .select('*', { count: 'exact' })
    .eq('org_id', profile.org_id)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (source_type) query = query.eq('source_type', source_type as 'audit' | 'security' | 'retrieval')
  if (severity)    query = query.eq('severity', severity)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ events: data ?? [], total: count ?? 0, page, limit })
}
