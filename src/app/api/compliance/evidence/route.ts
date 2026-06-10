// GET /api/compliance/evidence — list evidence for a control
// POST /api/compliance/evidence — link new evidence record
// ?control_id=UUID (GET)
// RBAC SELECT: all compliance roles  RBAC INSERT: super_admin | compliance_officer | security_analyst

import { NextRequest, NextResponse } from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import type { EvidenceType } from '@/types/database'

export const dynamic = 'force-dynamic'
const SELECT_ROLES = ['super_admin', 'compliance_officer', 'security_analyst', 'auditor'] as const
const WRITE_ROLES  = ['super_admin', 'compliance_officer', 'security_analyst'] as const

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('user_profiles').select('org_id, role').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 })
  if (!(SELECT_ROLES as readonly string[]).includes(profile.role))
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })

  const control_id = req.nextUrl.searchParams.get('control_id')
  if (!control_id) return NextResponse.json({ error: 'control_id is required' }, { status: 400 })

  const admin = createAdminClient()
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  let controlUuid = control_id

  let qCtrl = admin
    .from('compliance_controls')
    .select('id, compliance_frameworks!inner(org_id)')
    .eq('compliance_frameworks.org_id', profile.org_id)

  if (uuidRegex.test(control_id)) {
    qCtrl = qCtrl.eq('id', control_id)
  } else {
    qCtrl = qCtrl.eq('control_id', control_id)
  }

  const { data: ctrlData } = await qCtrl.maybeSingle()
  if (!ctrlData) {
    return NextResponse.json({ error: 'Control not found or unauthorized' }, { status: 404 })
  }
  controlUuid = ctrlData.id

  const { data, error } = await admin
    .from('control_evidence')
    .select('*')
    .eq('control_id', controlUuid)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ evidence: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('user_profiles').select('org_id, role').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 })
  if (!(WRITE_ROLES as readonly string[]).includes(profile.role))
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })

  const body = await req.json()
  const { control_id, evidence_type, source_table, source_id, evidence_reference } = body as {
    control_id:          string
    evidence_type:       EvidenceType
    source_table:        string
    source_id:           string
    evidence_reference?: string
  }

  if (!control_id || !evidence_type || !source_table || !source_id)
    return NextResponse.json({ error: 'control_id, evidence_type, source_table, source_id required' }, { status: 400 })

  const admin = createAdminClient()
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  let controlUuid = control_id

  let qCtrl = admin
    .from('compliance_controls')
    .select('id, compliance_frameworks!inner(org_id)')
    .eq('compliance_frameworks.org_id', profile.org_id)

  if (uuidRegex.test(control_id)) {
    qCtrl = qCtrl.eq('id', control_id)
  } else {
    qCtrl = qCtrl.eq('control_id', control_id)
  }

  const { data: ctrlData } = await qCtrl.maybeSingle()
  if (!ctrlData) {
    return NextResponse.json({ error: 'Control not found or unauthorized' }, { status: 404 })
  }
  controlUuid = ctrlData.id

  const { data, error } = await admin
    .from('control_evidence')
    .insert({ control_id: controlUuid, evidence_type, source_table, source_id, evidence_reference: evidence_reference ?? source_table })
    .select().single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Evidence already linked' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ evidence: data }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('user_profiles').select('org_id, role').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 })
  if (!(WRITE_ROLES as readonly string[]).includes(profile.role))
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id parameter is required' }, { status: 400 })

  const admin = createAdminClient()

  // 1. Get control_id
  const { data: evData, error: evErr } = await admin
    .from('control_evidence')
    .select('control_id')
    .eq('id', id)
    .maybeSingle()

  if (evErr || !evData) {
    return NextResponse.json({ error: 'Evidence not found' }, { status: 404 })
  }

  // 2. Verify control belongs to org
  const { data: ctrlData, error: ctrlErr } = await admin
    .from('compliance_controls')
    .select('id, compliance_frameworks!inner(org_id)')
    .eq('id', evData.control_id)
    .eq('compliance_frameworks.org_id', profile.org_id)
    .maybeSingle()

  if (ctrlErr || !ctrlData) {
    return NextResponse.json({ error: 'Unauthorized or control not found' }, { status: 403 })
  }

  // 3. Delete evidence link
  const { error: deleteErr } = await admin
    .from('control_evidence')
    .delete()
    .eq('id', id)

  if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

