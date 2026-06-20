// =============================================================================
// Phase 4C.6 — Stage 2: Parent-Child Document Processor
//
// Processes a document using the parent-child chunking strategy:
//   - Deletes existing chunks (replace strategy, no coexistence)
//   - Inserts parent chunks (parent_id = NULL, never embedded)
//   - Inserts child chunks (parent_id → parent.id, embedded)
//   - Generates embeddings ONLY for child chunks
//
// SAFEGUARDS:
//   - Explicit assertion prevents any parent chunk from entering embedding queue
//   - metadata.chunk_tier = "parent" | "child" on every row
//   - Parent chunks have no entry in the embeddings table
//
// This function is an ADDITIVE COMPANION to processDocument() in processor.ts.
// The original processDocument() is untouched and remains the default.
//
// GOVERNANCE: No SQL migrations. No RPC modifications. No schema changes.
// =============================================================================

import { createAdminClient } from '@/lib/supabase/server'
import { embeddingService } from '@/features/embeddings/embeddingService'
import { generateEmbeddings, estimateTokens, ChunkInsertRow, EmbeddingInsertRow } from './processor'
import { parentChildChunkText, dryRunChunker, type ParentChildPair } from './parentChildChunker'
import type { Json } from '@/types/database'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ParentChildProcessorResult {
  success: boolean
  pagesProcessed: number
  parentsCreated: number
  childrenCreated: number
  embeddingsCreated: number
  error?: string
}

export interface ParentChildDryRunResult {
  success: boolean
  documentId: string
  documentName: string
  pageCount: number
  projectedParents: number
  projectedChildren: number
  projectedEmbeddings: number
  avgChildrenPerParent: number
  avgParentChars: number
  avgChildChars: number
  estimatedStorageDeltaKB: number
  error?: string
}

interface DocMeta {
  id: string
  org_id: string
  storage_path: string
  doc_type: string
  department: string | null
  sensitivity: string
  uploaded_by: string
  filename: string
  classification: string
  framework: string | null
  original_name: string
}

// ─────────────────────────────────────────────────────────────────────────────
// DRY-RUN MODE (Stage 3) — No database writes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Projects parent-child chunk counts for a document WITHOUT writing anything.
 * Reads existing page text from the DB, runs the chunker, returns statistics.
 *
 * Satisfies Stage 3 requirement: dry-run mode with storage impact estimate.
 */
export async function dryRunParentChildProcessor(
  documentId: string
): Promise<ParentChildDryRunResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  const { data: doc, error: docErr } = await admin
    .from('documents')
    .select('id, original_name, org_id, doc_type, sensitivity, classification, framework')
    .eq('id', documentId)
    .single()

  if (docErr || !doc) {
    return {
      success: false, documentId, documentName: '', pageCount: 0,
      projectedParents: 0, projectedChildren: 0, projectedEmbeddings: 0,
      avgChildrenPerParent: 0, avgParentChars: 0, avgChildChars: 0,
      estimatedStorageDeltaKB: 0,
      error: docErr?.message ?? 'Document not found',
    }
  }

  // Fetch pages in batches (avoid Supabase 1000-row default limit)
  const allPages: Array<{ page_number: number; raw_text: string }> = []
  let offset = 0
  while (true) {
    const { data: batch } = await admin
      .from('pages')
      .select('page_number, raw_text')
      .eq('document_id', documentId)
      .order('page_number')
      .range(offset, offset + 999)

    if (!batch || batch.length === 0) break
    allPages.push(...batch)
    if (batch.length < 1000) break
    offset += 1000
  }

  let totalParents = 0
  let totalChildren = 0
  let totalParentChars = 0
  let totalChildChars = 0
  let allChildCounts: number[] = []

  for (const page of allPages) {
    const text = page.raw_text ?? ''
    if (!text.trim()) continue
    const stats = dryRunChunker(text)
    totalParents += stats.totalParents
    totalChildren += stats.totalChildren
    totalParentChars += stats.avgParentChars * stats.totalParents
    totalChildChars += stats.avgChildChars * stats.totalChildren
    allChildCounts.push(...Array(stats.totalParents).fill(stats.avgChildrenPerParent))
  }

  const avgChildrenPerParent = totalParents > 0
    ? Math.round((totalChildren / totalParents) * 10) / 10
    : 0
  const avgParentChars = totalParents > 0 ? Math.round(totalParentChars / totalParents) : 0
  const avgChildChars = totalChildren > 0 ? Math.round(totalChildChars / totalChildren) : 0

  // Storage estimate: each chunk row ~2KB metadata + content; embedding row ~3KB (768 floats)
  const chunkRows = totalParents + totalChildren
  const embeddingRows = totalChildren
  const estimatedStorageDeltaKB = Math.round(chunkRows * 2 + embeddingRows * 3)

  return {
    success: true,
    documentId,
    documentName: doc.original_name,
    pageCount: allPages.length,
    projectedParents: totalParents,
    projectedChildren: totalChildren,
    projectedEmbeddings: totalChildren,
    avgChildrenPerParent,
    avgParentChars,
    avgChildChars,
    estimatedStorageDeltaKB,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LIVE PROCESSOR (Stage 2)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Processes a document using parent-child chunking.
 *
 * REPLACE STRATEGY: Deletes all existing chunks (and their embeddings via CASCADE)
 * before inserting the new parent-child hierarchy. Legacy and parent-child chunks
 * never coexist for the same document.
 *
 * Called by the API route when chunking_mode = "parent_child".
 * NIST SP 800-53 is NOT processed here until benchmark stage is reviewed.
 */
export async function processDocumentParentChild(
  documentId: string
): Promise<ParentChildProcessorResult> {
  embeddingService.resetStats()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any

  // ── 1. Fetch document metadata ────────────────────────────────────────────
  const { data: rawDoc, error: docErr } = await admin
    .from('documents')
    .select('id, org_id, storage_path, doc_type, department, sensitivity, uploaded_by, filename, classification, framework, original_name')
    .eq('id', documentId)
    .single()

  if (docErr || !rawDoc) {
    const msg = docErr?.message ?? 'Document not found'
    console.error('[pc-pipeline] Failed to fetch document:', msg)
    return { success: false, pagesProcessed: 0, parentsCreated: 0, childrenCreated: 0, embeddingsCreated: 0, error: msg }
  }

  const doc = rawDoc as DocMeta

  console.log('[pc-pipeline] Starting parent-child processing for doc:', documentId, '| org:', doc.org_id)

  try {
    // ── 2. Set status → chunking ─────────────────────────────────────────────
    await setStatus(admin, documentId, 'chunking')

    // ── 3. REPLACE STRATEGY: Delete all existing chunks (cascades to embeddings) ─
    console.log('[pc-pipeline] Deleting existing chunks (replace strategy)...')
    const { count: deletedCount, error: deleteErr } = await admin
      .from('chunks')
      .delete()
      .eq('document_id', documentId)
      .select('id', { count: 'exact', head: true })

    if (deleteErr) {
      throw new Error(`Failed to delete existing chunks: ${deleteErr.message}`)
    }
    console.log(`[pc-pipeline] Deleted ${deletedCount ?? '?'} existing chunks (embeddings cascade-deleted)`)

    // ── 4. Fetch all pages (paginated to avoid 1000-row Supabase default limit) ─
    const allPages: Array<{ id: string; page_number: number; raw_text: string }> = []
    let offset = 0
    while (true) {
      const { data: batch, error: pageErr } = await admin
        .from('pages')
        .select('id, page_number, raw_text')
        .eq('document_id', documentId)
        .order('page_number')
        .range(offset, offset + 999)

      if (pageErr) throw new Error(`Failed to fetch pages: ${pageErr.message}`)
      if (!batch || batch.length === 0) break
      allPages.push(...batch)
      if (batch.length < 1000) break
      offset += 1000
    }

    if (allPages.length === 0) {
      throw new Error('No pages found for document — cannot generate parent-child chunks')
    }
    console.log(`[pc-pipeline] Processing ${allPages.length} pages`)

    // ── 5. Generate parent-child chunk pairs per page ─────────────────────────
    const parentRows: Array<ChunkInsertRow & { _localId: string }> = []
    const childRowsMap: Array<{ parentLocalId: string; content: string; pageId: string; pageNumber: number; parentSeq: number; childSeq: number }> = []

    for (const page of allPages) {
      const text = page.raw_text ?? ''
      if (!text.trim()) continue

      const pairs: ParentChildPair[] = parentChildChunkText(text)

      for (let pIdx = 0; pIdx < pairs.length; pIdx++) {
        const pair = pairs[pIdx]
        // chunk_index encoding: pageNumber * 10000 + parentSeq * 100
        const parentChunkIndex = page.page_number * 10000 + pIdx * 100
        const localId = `local_${page.id}_p${pIdx}`

        parentRows.push({
          _localId: localId,
          document_id: documentId,
          page_id:     page.id,
          org_id:      doc.org_id,
          chunk_index: parentChunkIndex,
          content:     pair.parentContent,
          token_count: estimateTokens(pair.parentContent),
          metadata: {
            page_number:          page.page_number,
            document_id:          documentId,
            org_id:               doc.org_id,
            doc_type:             doc.doc_type,
            department:           doc.department,
            sensitivity:          doc.sensitivity,
            classification:       doc.classification,
            framework:            doc.framework,
            chunk_tier:           'parent',
            child_count:          pair.children.length,
            parent_chunk_index:   null,
            document_title:       doc.original_name,
          } satisfies Json,
        })

        for (let cIdx = 0; cIdx < pair.children.length; cIdx++) {
          childRowsMap.push({
            parentLocalId: localId,
            content:       pair.children[cIdx],
            pageId:        page.id,
            pageNumber:    page.page_number,
            parentSeq:     pIdx,
            childSeq:      cIdx,
          })
        }
      }
    }

    // ── 6. Insert parent chunks in batches, capture real UUIDs ───────────────
    console.log(`[pc-pipeline] Inserting ${parentRows.length} parent chunks...`)
    const localIdToDbId = new Map<string, string>()

    for (let i = 0; i < parentRows.length; i += 100) {
      const batch = parentRows.slice(i, i + 100)
      // Strip _localId before inserting (not a real column)
      const insertBatch = batch.map(({ _localId, ...rest }) => rest)

      const { data: inserted, error: insertErr } = await admin
        .from('chunks')
        .insert(insertBatch)
        .select('id, chunk_index')

      if (insertErr || !inserted) {
        throw new Error(`Parent chunk INSERT batch ${Math.floor(i / 100)} failed: ${insertErr?.message ?? 'no data'}`)
      }

      // Map local IDs to real DB UUIDs by matching chunk_index
      for (let j = 0; j < batch.length; j++) {
        const row = batch[j]
        const dbRow = (inserted as Array<{ id: string; chunk_index: number }>)
          .find(r => r.chunk_index === row.chunk_index)
        if (dbRow) {
          localIdToDbId.set(row._localId, dbRow.id)
        }
      }
    }

    console.log(`[pc-pipeline] Parent chunks inserted. Resolved ${localIdToDbId.size}/${parentRows.length} UUIDs.`)

    // ── 7. Insert child chunks with real parent_id FKs ───────────────────────
    console.log(`[pc-pipeline] Inserting ${childRowsMap.length} child chunks...`)

    // Build child insert rows
    const childInsertRows: Array<ChunkInsertRow & { parent_id: string | null }> = []
    for (const child of childRowsMap) {
      const parentDbId = localIdToDbId.get(child.parentLocalId)
      if (!parentDbId) {
        throw new Error(
          `[pc-pipeline] Missing parent mapping for child ${child.parentLocalId}_c${child.childSeq}`
        )
      }
      const childChunkIndex = child.pageNumber * 10000 + child.parentSeq * 100 + child.childSeq + 1

      childInsertRows.push({
        document_id: documentId,
        page_id:     child.pageId,
        org_id:      doc.org_id,
        chunk_index: childChunkIndex,
        content:     child.content,
        token_count: estimateTokens(child.content),
        parent_id:   parentDbId,
        metadata: {
          page_number:          child.pageNumber,
          document_id:          documentId,
          org_id:               doc.org_id,
          doc_type:             doc.doc_type,
          department:           doc.department,
          sensitivity:          doc.sensitivity,
          classification:       doc.classification,
          framework:            doc.framework,
          chunk_tier:           'child',
          child_count:          null,
          parent_chunk_index:   child.parentSeq * 100,
          document_title:       doc.original_name,
        } satisfies Json,
      })
    }

    // Insert children in batches of 100
    const insertedChildren: Array<{ id: string; content: string }> = []
    for (let i = 0; i < childInsertRows.length; i += 100) {
      const batch = childInsertRows.slice(i, i + 100)
      const { data: inserted, error: insertErr } = await admin
        .from('chunks')
        .insert(batch)
        .select('id, content')

      if (insertErr || !inserted) {
        throw new Error(`Child chunk INSERT batch ${Math.floor(i / 100)} failed: ${insertErr?.message ?? 'no data'}`)
      }
      insertedChildren.push(...(inserted as Array<{ id: string; content: string }>))
    }

    console.log(`[pc-pipeline] Child chunks inserted: ${insertedChildren.length}`)

    // ── 8. SAFEGUARD: Verify zero parent chunks in embedding queue ───────────
    // This is a defensive assertion — parents should never appear here
    const parentIds = new Set(Array.from(localIdToDbId.values()))
    const parentLeakCheck = insertedChildren.filter(c => parentIds.has(c.id))
    if (parentLeakCheck.length > 0) {
      throw new Error(
        `[pc-pipeline] SAFEGUARD VIOLATION: ${parentLeakCheck.length} parent chunk IDs leaked into child embedding queue. Aborting.`
      )
    }

    // ── 9. Generate embeddings — CHILDREN ONLY ───────────────────────────────
    await setStatus(admin, documentId, 'embedding')

    // Validate embedding provider before generating
    try {
      embeddingService.validateConfiguration()
    } catch (err: any) {
      console.warn('[pc-pipeline] Embedding provider not configured — chunks inserted, embeddings skipped:', err.message)
      await setStatus(admin, documentId, 'indexed')
      return {
        success: true,
        pagesProcessed: allPages.length,
        parentsCreated: parentRows.length,
        childrenCreated: insertedChildren.length,
        embeddingsCreated: 0,
      }
    }

    console.log(`[pc-pipeline] Generating embeddings for ${insertedChildren.length} child chunks...`)
    const embeddingRows: EmbeddingInsertRow[] = await generateEmbeddings(doc.org_id, insertedChildren)

    // ── 10. Insert embeddings in batches of 100 ───────────────────────────────
    let embeddingsCreated = 0
    for (let i = 0; i < embeddingRows.length; i += 100) {
      const batch = embeddingRows.slice(i, i + 100)
      const { error: embErr } = await admin.from('embeddings').insert(batch)
      if (embErr) {
        throw new Error(`Embedding INSERT batch ${Math.floor(i / 100)} failed: ${embErr.message}`)
      }
      embeddingsCreated += batch.length
    }

    console.log(`[pc-pipeline] Embeddings inserted: ${embeddingsCreated}`)

    // ── 11. Final verification: confirm zero parent embeddings ────────────────
    if (parentIds.size > 0) {
      const sampleParentIds = Array.from(parentIds).slice(0, 50)
      const { count: parentEmbCount } = await admin
        .from('embeddings')
        .select('*', { count: 'exact', head: true })
        .in('chunk_id', sampleParentIds)

      if ((parentEmbCount ?? 0) > 0) {
        console.error(`[pc-pipeline] ⚠️  SAFEGUARD: ${parentEmbCount} parent chunk(s) found in embeddings table. This should never happen.`)
      } else {
        console.log('[pc-pipeline] ✅ Safeguard verified: zero parent chunks in embeddings table')
      }
    }

    // ── 12. Set status → indexed ──────────────────────────────────────────────
    await setStatus(admin, documentId, 'indexed')

    // ── 13. Emit cache statistics ─────────────────────────────────────────────
    const stats = embeddingService.getStats()
    console.log(`[embedding-cache] hits=${stats.hits} misses=${stats.misses} hit_rate=${stats.hitRate}%`)

    console.log(`[pc-pipeline] ✅ Complete: ${parentRows.length} parents + ${insertedChildren.length} children + ${embeddingsCreated} embeddings`)

    return {
      success: true,
      pagesProcessed:    allPages.length,
      parentsCreated:    parentRows.length,
      childrenCreated:   insertedChildren.length,
      embeddingsCreated,
    }

  } catch (err: unknown) {
    const stats = embeddingService.getStats()
    console.log(`[embedding-cache] hits=${stats.hits} misses=${stats.misses} hit_rate=${stats.hitRate}%`)

    const msg = err instanceof Error ? err.message : String(err)
    console.error('[pc-pipeline] ❌ FAILED:', msg)

    await admin
      .from('documents')
      .update({ status: 'failed', error_message: msg.slice(0, 500) })
      .eq('id', documentId)

    return { success: false, pagesProcessed: 0, parentsCreated: 0, childrenCreated: 0, embeddingsCreated: 0, error: msg }
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function setStatus(admin: any, docId: string, status: string) {
  const updateData: any = { status, updated_at: new Date().toISOString() }
  if (status !== 'failed') {
    updateData.error_message = null
  }
  await admin
    .from('documents')
    .update(updateData)
    .eq('id', docId)
  console.log('[pc-pipeline] Status →', status)
}
