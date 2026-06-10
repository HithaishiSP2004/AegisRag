/* eslint-disable @typescript-eslint/no-explicit-any */
// =============================================================================
// Sprint 5C: GET/POST /api/reports/snapshots
// Snapshot scheduler endpoint to trigger daily metric persistence.
// Authorized via super_admin, executive, or CRON_SECRET auth header.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { generateDailySnapshot } from '@/features/security/engine/analyticsService'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  return handleTrigger(req)
}

export async function GET(req: NextRequest) {
  return handleTrigger(req)
}

async function handleTrigger(req: NextRequest) {
  // Check auth or Cron header
  const authHeader = req.headers.get('Authorization')
  const cronSecret = process.env.CRON_SECRET || 'aegisrag-cron-secret-123'
  const isCron = authHeader === `Bearer ${cronSecret}`

  const admin = createAdminClient()
  let orgIds: string[] = []

  if (isCron) {
    console.log('[snapshots] Cron auth verified. Running snapshot generation for all organizations.')
    // Fetch all active orgs
    const { data: orgs, error: orgsErr } = await admin.from('organizations').select('id')
    if (orgsErr) {
      return NextResponse.json({ error: `Failed to fetch organizations: ${orgsErr.message}` }, { status: 500 })
    }
    orgIds = (orgs ?? []).map(o => o.id)
  } else {
    // User auth check
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('org_id, role')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 403 })
    }

    const allowedRoles = ['super_admin', 'executive', 'compliance_officer']
    if (!allowedRoles.includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    orgIds = [profile.org_id]
  }

  if (orgIds.length === 0) {
    return NextResponse.json({ message: 'No organizations found to process.' }, { status: 200 })
  }

  const results: any[] = []
  const errors: string[] = []

  for (const orgId of orgIds) {
    try {
      const snap = await generateDailySnapshot(orgId)
      results.push({ orgId, status: 'success', data: snap })
    } catch (err: any) {
      console.error(`[snapshots] Error generating snapshot for org ${orgId}:`, err)
      errors.push(`Org ${orgId}: ${err.message || String(err)}`)
      results.push({ orgId, status: 'error', error: err.message || String(err) })
    }
  }

  // Log to audit events if ran via authenticated user
  const actor = isCron ? 'system-scheduler' : 'user'
  await (admin as any).from('audit_events').insert({
    org_id: orgIds[0],
    tenant_id: orgIds[0],
    event_type: 'daily_snapshot_triggered',
    actor,
    description: `Triggered daily metrics snapshots for ${orgIds.length} organizations. Errors: ${errors.length}`
  })

  return NextResponse.json({
    processed: orgIds.length,
    success: orgIds.length - errors.length,
    failed: errors.length,
    errors,
    results
  }, { status: errors.length > 0 && isCron ? 207 : 200 })
}
