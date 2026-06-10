// GET /api/compliance/reviews  — list reviews (paginated, filterable)
// POST /api/compliance/reviews — create new review
// PATCH /api/compliance/reviews — update status / notes
// RBAC: see inline

import { NextRequest, NextResponse } from 'next/server'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import type { ReviewStatus } from '@/types/database'

export const dynamic = 'force-dynamic'
const SELECT_ROLES = ['super_admin', 'compliance_officer', 'security_analyst', 'auditor'] as const
const WRITE_ROLES  = ['super_admin', 'compliance_officer', 'security_analyst'] as const

// ── GET ───────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('user_profiles').select('org_id, role').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 })
  if (!(SELECT_ROLES as readonly string[]).includes(profile.role))
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })

  const sp         = req.nextUrl.searchParams
  const page       = Math.max(1, parseInt(sp.get('page')  ?? '1',  10))
  const limit      = Math.min(100, parseInt(sp.get('limit') ?? '25', 10))
  const offset     = (page - 1) * limit
  const status     = sp.get('status')
  const control_id = sp.get('control_id')

  const admin = createAdminClient()

  let q = admin
    .from('control_reviews')
    .select(`
      *,
      compliance_controls!inner(
        control_id, title, severity,
        compliance_frameworks!inner(org_id, name)
      )
    `, { count: 'exact' })
    .eq('compliance_controls.compliance_frameworks.org_id', profile.org_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status)     q = q.eq('status', status as ReviewStatus)
  if (control_id) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (uuidRegex.test(control_id)) {
      q = q.eq('control_id', control_id)
    } else {
      q = q.eq('compliance_controls.control_id', control_id)
    }
  }

  const { data, error, count } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Calculate stats dynamically from DB records
  const { data: allOrgReviews } = await admin
    .from('control_reviews')
    .select('status, next_review_date, created_at, updated_at, compliance_controls!inner(compliance_frameworks!inner(org_id))')
    .eq('compliance_controls.compliance_frameworks.org_id', profile.org_id)

  let openReviews = 0
  let overdueReviews = 0
  let completedThisMonth = 0
  let totalReviewTimeMs = 0
  let completedCount = 0

  const now = new Date()
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

  if (allOrgReviews) {
    allOrgReviews.forEach((r: any) => {
      if (r.status === 'pending' || r.status === 'needs_followup') {
        openReviews++
        if (r.next_review_date && new Date(r.next_review_date) < now) {
          overdueReviews++
        }
      } else if (r.status === 'approved' || r.status === 'rejected') {
        const updatedAt = new Date(r.updated_at)
        if (updatedAt >= firstDayOfMonth) {
          completedThisMonth++
        }
        const createdAt = new Date(r.created_at)
        const diff = updatedAt.getTime() - createdAt.getTime()
        if (diff > 0) {
          totalReviewTimeMs += diff
          completedCount++
        }
      }
    })
  }

  const avgReviewTimeHours = completedCount > 0 
    ? parseFloat((totalReviewTimeMs / (1000 * 60 * 60 * completedCount)).toFixed(1)) 
    : 0.0

  return NextResponse.json({ 
    reviews: data ?? [], 
    total: count ?? 0, 
    page, 
    limit,
    stats: {
      openReviews,
      overdueReviews,
      completedThisMonth,
      avgReviewTimeHours
    }
  })
}

// ── POST ──────────────────────────────────────────────────────
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
  const { control_id, status = 'pending', notes, review_date, next_review_date } = body as {
    control_id:       string
    status?:          ReviewStatus
    notes?:           string
    review_date?:     string
    next_review_date?: string
  }

  if (!control_id) return NextResponse.json({ error: 'control_id required' }, { status: 400 })

  if ((status === 'rejected' || status === 'needs_followup') && (!notes || notes.trim() === '')) {
    return NextResponse.json({ error: 'Justification notes are required for rejected or needs_followup status' }, { status: 400 })
  }

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
    .from('control_reviews')
    .insert({ control_id: controlUuid, reviewer_id: user.id, status, notes, review_date, next_review_date })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ review: data }, { status: 201 })
}

// ── PATCH ─────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('user_profiles').select('org_id, role').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 })
  if (!(WRITE_ROLES as readonly string[]).includes(profile.role))
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })

  const body = await req.json()
  const { id, status, notes, next_review_date } = body as {
    id:               string
    status?:          ReviewStatus
    notes?:           string
    next_review_date?: string
  }
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  if ((status === 'rejected' || status === 'needs_followup') && (!notes || notes.trim() === '')) {
    return NextResponse.json({ error: 'Justification notes are required for rejected or needs_followup status' }, { status: 400 })
  }

  const updatePayload: {
    status?: ReviewStatus
    notes?:  string | null
    next_review_date?: string | null
    updated_at: string
  } = { updated_at: new Date().toISOString() }

  if (status)          updatePayload.status           = status
  if (notes !== undefined) updatePayload.notes        = notes
  if (next_review_date !== undefined) updatePayload.next_review_date = next_review_date

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('control_reviews')
    .update(updatePayload)
    .eq('id', id)
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ review: data })
}
