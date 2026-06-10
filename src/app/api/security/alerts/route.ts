// =============================================================================
// Sprint 5A: GET/PATCH /api/security/alerts
//
// GET  — paginated list of security alerts, filterable by severity/status/category
// PATCH — acknowledge or resolve an alert
//
// RBAC SELECT:  super_admin | compliance_officer | security_analyst | auditor
// RBAC PATCH:   super_admin | compliance_officer | security_analyst
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import type { AlertSeverity, AlertStatus, AlertCategory } from '@/types/database'

export const dynamic = 'force-dynamic'

const SELECT_ROLES = ['super_admin', 'compliance_officer', 'security_analyst', 'auditor'] as const
const MUTATE_ROLES = ['super_admin', 'compliance_officer', 'security_analyst'] as const

// ── GET ──────────────────────────────────────────────────────────────────────
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
  if (!(SELECT_ROLES as readonly string[]).includes(profile.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }

  const sp       = req.nextUrl.searchParams
  const page     = Math.max(1, parseInt(sp.get('page')  ?? '1',  10))
  const limit    = Math.min(100, parseInt(sp.get('limit') ?? '25', 10))
  const offset   = (page - 1) * limit
  const severity = sp.get('severity')
  const status   = sp.get('status')
  const category = sp.get('category')

  const admin = createAdminClient()
  let query = admin
    .from('security_alerts')
    .select('*', { count: 'exact' })
    .eq('org_id', profile.org_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (severity) query = query.eq('severity', severity as AlertSeverity)
  if (status)   query = query.eq('status',   status   as AlertStatus)
  if (category) query = query.eq('category', category as AlertCategory)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ alerts: data ?? [], total: count ?? 0, page, limit })
}

// ── PATCH ─────────────────────────────────────────────────────────────────────
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
  const { id, action, resolution_note } = body as {
    id: string
    action: 'acknowledge' | 'resolve' | 'suppress'
    resolution_note?: string
  }

  if (!id || !action) {
    return NextResponse.json({ error: 'id and action are required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Build a typed update object (matches security_alerts Update shape)
  let updatePayload: {
    status?:          AlertStatus
    acknowledged_by?: string | null
    acknowledged_at?: string | null
    resolved_at?:     string | null
    resolution_note?: string | null
    updated_at?:      string
  } = {}

  if (action === 'acknowledge') {
    updatePayload = {
      status:          'acknowledged',
      acknowledged_by: user.id,
      acknowledged_at: new Date().toISOString(),
    }
  } else if (action === 'resolve') {
    updatePayload = {
      status:          'resolved',
      resolved_at:     new Date().toISOString(),
      ...(resolution_note ? { resolution_note } : {}),
    }
  } else if (action === 'suppress') {
    updatePayload = { status: 'suppressed' }
  }

  const { data, error } = await admin
    .from('security_alerts')
    .update(updatePayload)
    .eq('id', id)
    .eq('org_id', profile.org_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ alert: data })
}
