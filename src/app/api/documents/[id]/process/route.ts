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
import { processDocumentParentChild, dryRunParentChildProcessor } from '@/features/pipeline/parentChildProcessor'

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
  const requestedMode = _req.nextUrl.searchParams.get('chunking_mode')
  const chunkingMode = requestedMode || 
    (process.env.ENABLE_PARENT_CHILD_RETRIEVAL === 'true' ? 'parent_child' : 'legacy')
  const isDryRun     = _req.nextUrl.searchParams.get('dry_run') === 'true'

  console.log('[process-route] Triggering pipeline for doc:', documentId, '| requested_mode:', requestedMode ?? 'absent', '| selected_mode:', chunkingMode)

  // ── Parent-child dry-run (Stage 3) — no DB writes ─────────────────────
  if (chunkingMode === 'parent_child' && isDryRun) {
    const dryResult = await dryRunParentChildProcessor(documentId)
    return NextResponse.json({
      dry_run:               true,
      document_id:           documentId,
      document_name:         dryResult.documentName,
      page_count:            dryResult.pageCount,
      projected_parents:     dryResult.projectedParents,
      projected_children:    dryResult.projectedChildren,
      projected_embeddings:  dryResult.projectedEmbeddings,
      avg_children_per_parent: dryResult.avgChildrenPerParent,
      avg_parent_chars:      dryResult.avgParentChars,
      avg_child_chars:       dryResult.avgChildChars,
      estimated_storage_delta_kb: dryResult.estimatedStorageDeltaKB,
      success:               dryResult.success,
      error:                 dryResult.error,
    }, { status: dryResult.success ? 200 : 500 })
  }

  // ── Parent-child live processing ───────────────────────────────────────
  if (chunkingMode === 'parent_child') {
    const result = await processDocumentParentChild(documentId)
    if (!result.success) {
      return NextResponse.json({
        success:      false,
        error:        result.error,
        document_id:  documentId,
        chunking_mode: 'parent_child',
      }, { status: 500 })
    }
    return NextResponse.json({
      success:            true,
      document_id:        documentId,
      chunking_mode:      'parent_child',
      pages_processed:    result.pagesProcessed,
      parents_created:    result.parentsCreated,
      children_created:   result.childrenCreated,
      embeddings_created: result.embeddingsCreated,
    }, { status: 200 })
  }

  // ── Legacy pipeline (default — unchanged) ─────────────────────────────
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
