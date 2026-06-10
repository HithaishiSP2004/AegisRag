// GET /api/compliance/evidence/preview — Sprint 5B
// Fetches detailed metadata from the source table for evidence verification.
// ?source_table=string&source_id=UUID
// RBAC SELECT: super_admin | compliance_officer | security_analyst | auditor

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
    .from('user_profiles').select('org_id, role').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 403 })
  if (!(ALLOWED_ROLES as readonly string[]).includes(profile.role))
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })

  const sp           = req.nextUrl.searchParams
  const source_table = sp.get('source_table')
  const source_id    = sp.get('source_id')

  if (!source_table || !source_id) {
    return NextResponse.json({ error: 'source_table and source_id are required' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Define supported tables and columns
  let query: any = null
  if (source_table === 'documents') {
    query = admin.from('documents')
      .select('id, filename, original_name, file_size_bytes, status, doc_type, sensitivity, metadata, created_at')
  } else if (source_table === 'audit_logs') {
    query = admin.from('audit_logs')
      .select('id, action, resource_type, resource_id, ip_address, created_at')
  } else if (source_table === 'security_events') {
    query = admin.from('security_events')
      .select('id, event_type, severity, description, blocked, resolution, created_at')
  } else if (source_table === 'security_alerts') {
    query = admin.from('security_alerts')
      .select('id, title, description, severity, status, category, created_at')
  } else if (source_table === 'retrieval_evals') {
    query = admin.from('retrieval_evals')
      .select('id, query_text, retrieval_mode, chunk_count, total_latency_ms, groundedness_score, citation_hit_rate, hallucination_flag, created_at')
  } else if (source_table === 'ai_requests') {
    query = admin.from('ai_requests')
      .select('id, model_used, total_tokens, latency_ms, success, error_message, call_type, created_at')
  } else {
    return NextResponse.json({ error: `Unsupported source table: ${source_table}` }, { status: 400 })
  }

  const { data, error } = await query
    .eq('id', source_id)
    .eq('org_id', profile.org_id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: 'Evidence source record not found in your organization.' }, { status: 404 })
  }

  return NextResponse.json({ preview: data })
}
