// =============================================================================
// Sprint 1B: PDF Processing Pipeline
// Sequence: download PDF → parse pages → chunk text → generate embeddings → index
//
// Status lifecycle:
//   parsing → chunking → embedding → indexed
//   parsing → failed   (on any exception)
//
// All DB writes use createAdminClient() (service-role) so RLS never blocks
// the pipeline. This module is NEVER imported by client components.
// =============================================================================

import { createAdminClient } from '@/lib/supabase/server'
import { embeddingService } from '@/features/embeddings/embeddingService'
import { normalizeText, computeSHA256 } from '@/features/embeddings/cache/contentHash'
import type { Json } from '@/types/database'
import { PDFParse } from 'pdf-parse'
import mammoth from 'mammoth'
import { AI_MODELS } from '@/config/ai'

// ── Constants ────────────────────────────────────────────────────────────────
const DOCUMENTS_BUCKET = 'documents'

// Chunking parameters (per spec)
const CHUNK_TARGET     = 1000   // target characters per chunk
const CHUNK_MIN        = 800
const CHUNK_MAX        = 1200
const CHUNK_OVERLAP    = 175    // characters of overlap between consecutive chunks

// ─────────────────────────────────────────────────────────────────────────────
// ENTRY POINT: processDocument
// Called by the API route. Orchestrates the full pipeline.
// ─────────────────────────────────────────────────────────────────────────────
export async function processDocument(documentId: string): Promise<{
  success: boolean
  pagesProcessed: number
  chunksCreated: number
  embeddingsCreated: number
  error?: string
}> {
  embeddingService.resetStats();
  const admin = createAdminClient()

  // ── 1. Fetch document metadata ────────────────────────────────────────────
  const { data: rawDoc, error: docErr } = await admin
    .from('documents')
    .select('id, org_id, storage_path, doc_type, department, sensitivity, uploaded_by, filename, classification, framework, original_name')
    .eq('id', documentId)
    .single()

  if (docErr || !rawDoc) {
    const msg = docErr?.message ?? 'Document not found'
    console.error('[pipeline] Failed to fetch document:', msg)
    return { success: false, pagesProcessed: 0, chunksCreated: 0, embeddingsCreated: 0, error: msg }
  }

  const doc = rawDoc as {
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

  console.log('[pipeline] Starting for doc:', documentId, '| org:', doc.org_id)

  // Audit: parser started
  await auditLog(admin, doc.org_id, doc.uploaded_by, 'document.parser_started', documentId, {
    doc_type: doc.doc_type, filename: doc.filename,
  })

  try {
    // ── 2. Set status → parsing (already set by confirmUpload, but ensure) ──
    await setStatus(admin, documentId, 'parsing')

    // Fetch existing pages (if any) before download to determine if this is an update
    const { data: existingPages, error: existingPagesErr } = await admin
      .from('pages')
      .select('id, page_number, raw_text')
      .eq('document_id', documentId)

    if (existingPagesErr) {
      throw new Error(`Failed to fetch existing pages: ${existingPagesErr.message}`)
    }

    // ── 3. Download file bytes from Storage ───────────────────────────────────
    console.log('[pipeline] Downloading file from storage:', doc.storage_path)
    const fileBytes = await downloadPdf(admin, doc.storage_path)
    console.log('[pipeline] Downloaded', fileBytes.byteLength, 'bytes')

    // ── 4. Parse file → extract text per page ─────────────────────────────────
    const ext = doc.filename.substring(doc.filename.lastIndexOf('.')).toLowerCase()
    console.log(`[pipeline] Parsing file with extension ${ext}...`)
    const parsedPages = await parseDocument(fileBytes, ext)
    console.log('[pipeline] Parsed', parsedPages.length, 'pages')

    const hasExisting = existingPages && existingPages.length > 0
    let insertedPages: Array<{ id: string; page_number: number; raw_text: string }> = []
    let pagesToProcess: Array<{ id: string; page_number: number; raw_text: string }> = []
    let isUpdate = false

    if (hasExisting) {
      isUpdate = true
      console.log('[pipeline] Version update detected. Performing page-level change detection...')
      const existingPageMap = new Map(existingPages.map(p => [p.page_number, p]))
      const newPageMap = new Map(parsedPages.map(p => [p.pageNumber, p]))

      // A. Deleted pages (exist in DB, not in new document)
      const deletedPageNums = Array.from(existingPageMap.keys()).filter(n => !newPageMap.has(n))
      if (deletedPageNums.length > 0) {
        console.log('[pipeline] Deleting pages:', deletedPageNums)
        const { error: delErr } = await admin
          .from('pages')
          .delete()
          .eq('document_id', documentId)
          .in('page_number', deletedPageNums)
        if (delErr) throw new Error(`Failed to delete old pages: ${delErr.message}`)

        for (const pageNum of deletedPageNums) {
          const pageRecord = existingPageMap.get(pageNum)
          await auditLog(admin, doc.org_id, doc.uploaded_by, 'PAGE_DELETED', documentId, { page_number: pageNum, page_id: pageRecord?.id })
        }
      }

      // B. Modified & Added pages
      const pagesToInsert: Array<{ document_id: string; org_id: string; page_number: number; raw_text: string; word_count: number; status: 'pending' }> = []
      const pagesToUpdate: Array<{ id: string; raw_text: string; word_count: number; status: 'pending' }> = []

      for (const newPage of parsedPages) {
        const existingPage = existingPageMap.get(newPage.pageNumber)
        if (existingPage) {
          if (existingPage.raw_text !== newPage.text) {
            // Modified page
            pagesToUpdate.push({
              id: existingPage.id,
              raw_text: newPage.text,
              word_count: countWords(newPage.text),
              status: 'pending'
            })
          } else {
            // Unchanged page - keep it in the final insertedPages list
            insertedPages.push({
              id: existingPage.id,
              page_number: existingPage.page_number,
              raw_text: existingPage.raw_text || ''
            })
          }
        } else {
          // Added page
          pagesToInsert.push({
            document_id: documentId,
            org_id: doc.org_id,
            page_number: newPage.pageNumber,
            raw_text: newPage.text,
            word_count: countWords(newPage.text),
            status: 'pending'
          })
        }
      }

      // Perform updates
      for (const updateInfo of pagesToUpdate) {
        const { data: updated, error: updErr } = await admin
          .from('pages')
          .update({
            raw_text: updateInfo.raw_text,
            word_count: updateInfo.word_count,
            status: 'pending',
            updated_at: new Date().toISOString()
          })
          .eq('id', updateInfo.id)
          .select('id, page_number, raw_text')
          .single()
        
        if (updErr || !updated) throw new Error(`Failed to update modified page ${updateInfo.id}: ${updErr?.message}`)

        // Delete existing chunks for modified page (cascades to embeddings)
        const { error: chunkDelErr } = await admin
          .from('chunks')
          .delete()
          .eq('page_id', updateInfo.id)
        if (chunkDelErr) throw new Error(`Failed to delete chunks for modified page ${updateInfo.id}: ${chunkDelErr.message}`)

        insertedPages.push(updated as any)
        pagesToProcess.push(updated as any)
      }

      // Perform inserts
      if (pagesToInsert.length > 0) {
        const { data: inserted, error: insErr } = await admin
          .from('pages')
          .insert(pagesToInsert)
          .select('id, page_number, raw_text')

        if (insErr || !inserted) throw new Error(`Failed to insert added pages: ${insErr?.message}`)
        insertedPages.push(...inserted as any)
        pagesToProcess.push(...inserted as any)
      }

      // Update document page_count
      await admin
        .from('documents')
        .update({ page_count: parsedPages.length })
        .eq('id', documentId)

    } else {
      // Clean initial upload flow
      isUpdate = false
      await admin.from('pages').delete().eq('document_id', documentId)

      const pageRows = parsedPages.map((p) => ({
        document_id: documentId,
        org_id:      doc.org_id,
        page_number: p.pageNumber,
        raw_text:    p.text,
        word_count:  countWords(p.text),
        status:      'pending' as const,
      }))

      const { data: inserted, error: pageErr } = await admin
        .from('pages')
        .insert(pageRows)
        .select('id, page_number, raw_text')

      if (pageErr || !inserted) {
        throw new Error(`pages INSERT failed: ${pageErr?.message ?? 'no data'}`)
      }

      insertedPages = inserted as any
      pagesToProcess = inserted as any

      // Update document page_count
      await admin
        .from('documents')
        .update({ page_count: insertedPages.length })
        .eq('id', documentId)
    }

    // ── 6. Set status → chunking ──────────────────────────────────────────────
    await setStatus(admin, documentId, 'chunking')

    // ── 7. Chunk pages ────────────────────────────────────────────────────────
    console.log('[pipeline] Chunking text...')
    const allChunks: ChunkInsertRow[] = []

    for (const page of pagesToProcess) {
      const text = page.raw_text ?? ''
      if (!text.trim()) continue

      const textChunks = chunkText(text)
      for (let i = 0; i < textChunks.length; i++) {
        allChunks.push({
          document_id: documentId,
          page_id:     page.id,
          org_id:      doc.org_id,
          chunk_index: page.page_number * 10000 + i, // structured unique index
          content:     textChunks[i],
          token_count: estimateTokens(textChunks[i]),
          metadata: {
            page_number:          page.page_number,
            document_id:          documentId,
            org_id:               doc.org_id,
            doc_type:             doc.doc_type,
            department:           doc.department,
            sensitivity:          doc.sensitivity,
            classification:       doc.classification,
            framework:            doc.framework,
            chunk_in_page:        i,
            total_chunks_in_page: textChunks.length,
            document_title:       doc.original_name,
          } satisfies Json,
        })
      }
    }

    console.log('[pipeline] Created', allChunks.length, 'new/updated chunks')

    // Insert chunks in batches of 100
    const insertedChunkIds: string[] = []
    if (allChunks.length > 0) {
      for (let i = 0; i < allChunks.length; i += 100) {
        const batch = allChunks.slice(i, i + 100)
        const { data: inserted, error: chunkErr } = await admin
          .from('chunks')
          .insert(batch)
          .select('id')

        if (chunkErr || !inserted) {
          throw new Error(`chunks INSERT batch ${i / 100} failed: ${chunkErr?.message ?? 'no data'}`)
        }

        insertedChunkIds.push(...(inserted as Array<{ id: string }>).map((c) => c.id))

        // Mark pages chunked
        const pageIdsInBatch = [...new Set(batch.map((c) => c.page_id))]
        await admin.from('pages').update({ status: 'chunked' }).in('id', pageIdsInBatch)
      }
    }

    // ── 8. Enqueue background embedding job ───────────────────────────────────
    await setStatus(admin, documentId, 'queued')

    // Import queue service and background worker dynamically
    const { queueService } = await import('@/features/embeddings/queue/queueService')
    const { backgroundWorker } = await import('@/features/embeddings/queue/worker')

    // Create background job with default priority (100)
    const jobId = await queueService.createJob(documentId, doc.org_id, allChunks.length, 100)
    console.log(`[pipeline] Enqueued background job=${jobId} with ${allChunks.length} chunks`)

    // Write page-level update audit logs
    for (const page of pagesToProcess) {
      await auditLog(admin, doc.org_id, doc.uploaded_by, 'PAGE_UPDATED', documentId, { page_number: page.page_number, page_id: page.id })
    }

    // Audit: DOCUMENT_QUEUED
    const completionAction = isUpdate ? 'DOCUMENT_UPDATED' : 'DOCUMENT_CREATED'
    await auditLog(admin, doc.org_id, doc.uploaded_by, completionAction, documentId, {
      pages:      parsedPages.length,
      is_update:  isUpdate,
      queued:     true
    })

    // Trigger background worker asynchronously (fire-and-forget)
    backgroundWorker.startWorker()

    return {
      success:           true,
      pagesProcessed:    parsedPages.length,
      chunksCreated:     allChunks.length,
      embeddingsCreated: 0,
    }

  } catch (err: unknown) {
    const stats = embeddingService.getStats();
    console.log(`[embedding-cache]\nhits=${stats.hits}\nmisses=${stats.misses}\nhit_rate=${stats.hitRate}%`);

    const msg = err instanceof Error ? err.message : String(err)
    console.error('[pipeline] ❌ FAILED:', msg, err instanceof Error ? err.stack : '')

    await admin
      .from('documents')
      .update({ status: 'failed', error_message: msg.slice(0, 500) })
      .eq('id', documentId)

    await admin
      .from('pages')
      .update({ status: 'failed', error_message: msg.slice(0, 200) })
      .eq('document_id', documentId)
      .in('status', ['pending', 'chunked'])

    await auditLog(admin, doc.org_id, doc.uploaded_by, 'document.parser_failed', documentId, {
      error: msg,
    })

    return { success: false, pagesProcessed: 0, chunksCreated: 0, embeddingsCreated: 0, error: msg }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function downloadPdf(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  storagePath: string
): Promise<ArrayBuffer> {
  const { data, error } = await admin.storage
    .from(DOCUMENTS_BUCKET)
    .download(storagePath)

  if (error || !data) {
    throw new Error(`Storage download failed: ${error?.message ?? 'no data'}`)
  }

  return data.arrayBuffer()
}

interface ParsedPage {
  pageNumber: number
  text: string
}

async function parseDocument(bytes: ArrayBuffer, ext: string): Promise<ParsedPage[]> {
  const pages: ParsedPage[] = []

  if (ext === '.pdf') {
    // Diagnostic log — confirms the import resolved correctly
    console.log('[parseDocument] PDFParse:', PDFParse)
    console.log('[parseDocument] typeof PDFParse:', typeof PDFParse)

    const data = Buffer.from(bytes)
    const parser = new PDFParse({ data })
    const result = await parser.getText()

    // Diagnostic log — confirms the result shape
    console.log('[parseDocument] result.total:', result.total)
    if (result.pages) {
      console.log('[parseDocument] result.pages.length:', result.pages.length)
    }
    console.log('[parseDocument] typeof result.text:', typeof result.text)

    if (result.pages && result.pages.length > 0) {
      // Per-page text is in result.pages: Array<{ num: number; text: string }>
      for (const p of result.pages) {
        pages.push({
          pageNumber: p.num,
          text: p.text.replace(/\s+/g, ' ').trim(),
        })
      }
    } else if (result.text) {
      // Fallback: concatenated full text → treat as single page
      pages.push({ pageNumber: 1, text: result.text.replace(/\s+/g, ' ').trim() })
    }

    await parser.destroy()
  } else if (ext === '.docx') {
    const docxResult = await mammoth.extractRawText({ buffer: Buffer.from(bytes) })
    const text = docxResult.value.replace(/\s+/g, ' ').trim()
    pages.push({ pageNumber: 1, text })
  } else if (ext === '.txt' || ext === '.md') {
    const text = new TextDecoder('utf-8').decode(bytes).replace(/\s+/g, ' ').trim()
    pages.push({ pageNumber: 1, text })
  } else {
    throw new Error(`Unsupported file extension: ${ext}`)
  }

  return pages
}

export function chunkText(text: string): string[] {
  if (text.length <= CHUNK_MAX) return [text]

  const chunks: string[] = []
  let start = 0

  while (start < text.length) {
    let end = start + CHUNK_TARGET

    if (end >= text.length) {
      chunks.push(text.slice(start))
      break
    }

    // Try to find a sentence boundary within [CHUNK_MIN, CHUNK_MAX]
    const window = text.slice(start + CHUNK_MIN, start + CHUNK_MAX)
    const sentenceEnd = Math.max(
      window.lastIndexOf('. '),
      window.lastIndexOf('.\n'),
      window.lastIndexOf('! '),
      window.lastIndexOf('? '),
    )

    if (sentenceEnd !== -1) {
      end = start + CHUNK_MIN + sentenceEnd + 2  // include the punctuation
    }

    chunks.push(text.slice(start, end).trim())
    start = end - CHUNK_OVERLAP  // overlap into next chunk
    if (start < 0) start = 0
  }

  return chunks.filter((c) => c.length >= 10)
}

export interface ChunkInsertRow {
  document_id: string
  page_id:     string
  org_id:      string
  chunk_index: number
  content:     string
  token_count: number
  metadata:    Json
}

export interface EmbeddingInsertRow {
  chunk_id:   string
  org_id:     string
  embedding:  number[]
  model_used: string
  provider:   string
  model_name: string
  embedding_dimensions: number
}

export async function generateEmbeddings(
  orgId: string,
  chunks: Array<{ id: string; content: string }>
): Promise<EmbeddingInsertRow[]> {
  const providerName = embeddingService.getProviderName()
  const modelName = embeddingService.getModelName()
  const expectedDimensions = embeddingService.getDimensions()

  console.log('[embedding]', {
    provider: providerName,
    model: modelName,
    chunkCount: chunks.length,
  })

  const hashToChunks = new Map<string, Array<{ id: string; content: string }>>();
  const uniqueHashes: string[] = [];
  const uniqueTexts: string[] = [];

  for (const chunk of chunks) {
    const hash = computeSHA256(normalizeText(chunk.content));
    if (!hashToChunks.has(hash)) {
      hashToChunks.set(hash, []);
      uniqueHashes.push(hash);
      uniqueTexts.push(chunk.content);
    }
    hashToChunks.get(hash)!.push(chunk);
  }

  console.log(`[embedding-dedup] In-batch deduplication: unique_chunks=${uniqueTexts.length}/${chunks.length}`);

  const uniqueEmbeddings = await embeddingService.generateEmbeddings(uniqueTexts);

  const rows: EmbeddingInsertRow[] = [];
  for (let i = 0; i < uniqueHashes.length; i++) {
    const hash = uniqueHashes[i];
    const embedding = uniqueEmbeddings[i];
    const chunksWithHash = hashToChunks.get(hash) || [];

    if (!embedding || embedding.length !== expectedDimensions) {
      throw new Error(
        `[pipeline] Failed to generate valid embedding for chunk at index ${i} (hash=${hash}): expected ${expectedDimensions} dimensions, got ${embedding?.length ?? 0}. Aborting to prevent checkpoint advancement on incomplete data.`
      );
    }

    for (const chunk of chunksWithHash) {
      rows.push({
        chunk_id:             chunk.id,
        org_id:               orgId,
        embedding:            embedding,
        model_used:           modelName,
        provider:             providerName,
        model_name:           modelName,
        embedding_dimensions: expectedDimensions,
      });
    }
  }

  console.log('[embedding] generated vectors:', rows.length)
  return rows;
}

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
  console.log('[pipeline] Status →', status)
}

async function auditLog(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  orgId: string,
  userId: string,
  action: string,
  resourceId: string,
  newValue: Record<string, unknown>
) {
  try {
    await admin.rpc('log_audit_event', {
      p_org_id:        orgId,
      p_user_id:       userId,
      p_action:        action,
      p_resource_type: 'document',
      p_resource_id:   resourceId,
      p_old_value:     null,
      p_new_value:     newValue,
      p_ip_address:    null,
      p_user_agent:    null,
    })
  } catch (e) {
    console.error('[pipeline] Audit log failed (non-fatal):', e)
  }
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export function estimateTokens(text: string): number {
  // Rough approximation: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
