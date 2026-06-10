// =============================================================================
// Sprint 3A: GET /api/audit-logs
// Returns audit log timeline for privileged users (super_admin,
// compliance_officer, auditor) scoped to the org.
// Supports: ?page=1&limit=50&action=&resource_type=&from=&to=
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

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

  // Only real user_role enum values (0002_user_profiles.sql):
  // 'super_admin' | 'compliance_officer' | 'security_analyst' | 'auditor' | 'executive'
  const ALLOWED = ['super_admin', 'compliance_officer', 'auditor']
  if (!ALLOWED.includes(profile.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  // ── Parse query params ───────────────────────────────────────────────────
  const sp       = req.nextUrl.searchParams
  const page     = Math.max(1, parseInt(sp.get('page')  ?? '1',  10))
  const limit    = Math.min(100, parseInt(sp.get('limit') ?? '50', 10))
  const offset   = (page - 1) * limit
  const action   = sp.get('action')        ?? null
  const resType  = sp.get('resource_type') ?? null
  const from     = sp.get('from')          ?? null
  const to       = sp.get('to')            ?? null

  // ── Query audit_timeline view (typed in database.ts) ─────────────────────
  let query = supabase
    .from('audit_timeline')
    .select('*', { count: 'exact' })
    .eq('org_id', profile.org_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (action)  query = query.ilike('action', `%${action}%`)
  if (resType) query = query.eq('resource_type', resType)
  if (from)    query = query.gte('created_at', from)
  if (to)      query = query.lte('created_at', to)

  const { data, error, count } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    logs:  data ?? [],
    total: count ?? 0,
    page,
    limit,
  })
}
