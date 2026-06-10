// =============================================================================
// Sprint 1: Document Status API Route
// GET /api/documents/[id]/status
// Allows the client to poll processing status after upload.
// RLS on Supabase ensures org isolation — anon users get nothing.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  // Verify authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch document — RLS guarantees org_id match
  const { data, error } = await supabase
    .from('documents')
    .select('id, status, page_count, error_message, updated_at')
    .eq('id', id)
    .neq('status', 'deleted')
    .single()

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? 'Document not found' },
      { status: 404 }
    )
  }

  return NextResponse.json({
    id: data.id,
    status: data.status,
    page_count: data.page_count,
    error_message: data.error_message,
    updated_at: data.updated_at,
  })
}
