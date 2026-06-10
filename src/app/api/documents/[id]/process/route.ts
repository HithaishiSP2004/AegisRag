// =============================================================================
// Sprint 1B: POST /api/documents/[id]/process
// Triggered by the client immediately after confirmDocumentUpload().
// Verifies the requesting user owns the document (via RLS), then kicks off
// the PDF processing pipeline asynchronously.
//
// The pipeline runs in the same Node.js process (not a separate worker) and
// streams back a JSON result once complete. For large documents this may take
// 10–60 seconds — the client polls /api/documents/[id]/status separately.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { processDocument } from '@/features/pipeline/processor'

export const maxDuration = 300  // 5-minute timeout (Vercel Pro / self-hosted)
export const dynamic    = 'force-dynamic'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: documentId } = await params

  // ── 1. Authenticate the requesting user ─────────────────────────────────
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()

  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 2. Confirm the document exists and belongs to the user's org ────────
  //    (RLS on documents table enforces org isolation automatically)
  const { data: doc, error: docErr } = await supabase
    .from('documents')
    .select('id, status, org_id')
    .eq('id', documentId)
    .single()

  if (docErr || !doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  const force = _req.nextUrl.searchParams.get('force') === 'true'

  // ── 3. Guard: only process documents in 'parsing' state ─────────────────
  //    If a document is already indexed or being processed, return 409.
  if (doc.status === 'indexed' && !force) {
    return NextResponse.json({
      message: 'Document already indexed',
      status: doc.status,
    }, { status: 200 })
  }

  if (['chunking', 'embedding'].includes(doc.status)) {
    return NextResponse.json({
      message: 'Processing already in progress',
      status: doc.status,
    }, { status: 202 })
  }

  if (doc.status === 'failed' || doc.status === 'embedding_failed' || (doc.status === 'indexed' && force)) {
    // Allow retry: reset to 'parsing' so the pipeline re-runs from scratch.
    // For embedding_failed the pages/chunks are intact but we re-generate embeddings
    // as part of a full re-run (simpler than a partial resume for Sprint 1B).
    const admin = createAdminClient()
    await admin
      .from('documents')
      .update({ status: 'parsing', error_message: null, updated_at: new Date().toISOString() })
      .eq('id', documentId)
  }

  // ── 4. Run the pipeline (synchronous within the request lifecycle) ───────
  //    For production at scale this should be a background job (e.g. BullMQ
  //    or Supabase Edge Function queue), but for Sprint 1B this is sufficient.
  console.log('[process-route] Triggering pipeline for doc:', documentId)

  const result = await processDocument(documentId)

  if (!result.success) {
    return NextResponse.json({
      success:  false,
      error:    result.error,
      document_id: documentId,
    }, { status: 500 })
  }

  return NextResponse.json({
    success:           true,
    document_id:       documentId,
    pages_processed:   result.pagesProcessed,
    chunks_created:    result.chunksCreated,
    embeddings_created: result.embeddingsCreated,
  }, { status: 200 })
}
