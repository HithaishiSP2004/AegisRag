// =============================================================================
// Sprint 2: POST /api/search
//
// Authenticated search endpoint. Validates the requesting user, extracts
// their org_id, then delegates entirely to searchDocuments().
//
// Request body:
//   { query: string, filters?: SearchFilters, limit?: number }
//
// Response:
//   { results: SearchResult[], mode: RetrievalMode, query: string }
//
// The `mode` field reflects what the retrieval layer actually used
// ('vector' | 'keyword') — the UI uses this to show a fallback notice.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { searchDocuments } from '@/features/retrieval'
import type { SearchFilters } from '@/features/retrieval'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  // ── 1. Auth ───────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()

  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 2. Resolve org from user profile ─────────────────────────────────────
  const { data: profile, error: profileErr } = await supabase
    .from('user_profiles')
    .select('org_id, role')
    .eq('id', user.id)
    .single()

  if (profileErr || !profile) {
    return NextResponse.json({ error: 'User profile not found' }, { status: 403 })
  }

  // ── 3. Parse request body ─────────────────────────────────────────────────
  let body: { query?: string; filters?: SearchFilters; limit?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const queryText = (body.query ?? '').trim()
  if (!queryText) {
    return NextResponse.json({ error: 'query is required' }, { status: 400 })
  }

  const filters: SearchFilters = {
    ...(body.filters ?? {}),
    limit: body.limit ?? body.filters?.limit ?? 8,
  }

  // ── 4. Search ─────────────────────────────────────────────────────────────
  console.log('[api/search] query:', queryText, '| org:', profile.org_id, '| filters:', filters)

  const results = await searchDocuments(queryText, profile.org_id, filters, user.id, profile.role)

  // ── 5. Derive the effective mode from results ─────────────────────────────
  const mode = results[0]?.mode ?? 'keyword'

  console.log('[api/search] returned', results.length, 'results in mode:', mode)

  return NextResponse.json({
    results,
    mode,
    query: queryText,
    total: results.length,
  }, { status: 200 })
}
