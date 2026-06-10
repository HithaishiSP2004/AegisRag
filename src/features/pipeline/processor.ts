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
import { GoogleGenAI } from '@google/genai'
import type { Json } from '@/types/database'
import { PDFParse } from 'pdf-parse'
import mammoth from 'mammoth'
import { AI_MODELS } from '@/config/ai'

// ── Constants ────────────────────────────────────────────────────────────────
const DOCUMENTS_BUCKET = 'documents'
const EMBEDDING_MODEL  = AI_MODELS.EMBEDDING
const EMBEDDING_DIM    = 768

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
  const admin = createAdminClient()

  // ── 1. Fetch document metadata ────────────────────────────────────────────
  const { data: rawDoc, error: docErr } = await admin
    .from('documents')
    .select('id, org_id, storage_path, doc_type, department, sensitivity, uploaded_by, filename')
    .eq('id', documentId)
    .single()

  if (docErr || !rawDoc) {
    const msg = docErr?.message ?? 'Document not found'
    console.error('[pipeline] Failed to fetch document:', msg)
    return { success: false, pagesProcessed: 0, chunksCreated: 0, embeddingsCreated: 0, error: msg }
  }

  // Type the doc object explicitly (Supabase generated types are complex to unwrap here)
  const doc = rawDoc as {
    id: string
    org_id: string
    storage_path: string
    doc_type: string
    department: string | null
    sensitivity: string
    uploaded_by: string
    filename: string
  }

  console.log('[pipeline] Starting for doc:', documentId, '| org:', doc.org_id)

  // Audit: parser started
  await auditLog(admin, doc.org_id, doc.uploaded_by, 'document.parser_started', documentId, {
    doc_type: doc.doc_type, filename: doc.filename,
  })

  try {
    // ── 2. Set status → parsing (already set by confirmUpload, but ensure) ──
    await setStatus(admin, documentId, 'parsing')

    // Delete existing pages (which cascades to chunks and embeddings) for clean re-indexing
    await admin.from('pages').delete().eq('document_id', documentId)

    // ── 3. Download file bytes from Storage ───────────────────────────────────
    console.log('[pipeline] Downloading file from storage:', doc.storage_path)
    const fileBytes = await downloadPdf(admin, doc.storage_path)
    console.log('[pipeline] Downloaded', fileBytes.byteLength, 'bytes')

    // ── 4. Parse file → extract text per page ─────────────────────────────────
    const ext = doc.filename.substring(doc.filename.lastIndexOf('.')).toLowerCase()
    console.log(`[pipeline] Parsing file with extension ${ext}...`)
    const pages = await parseDocument(fileBytes, ext)
    console.log('[pipeline] Parsed', pages.length, 'pages')

    // ── 5. Persist pages rows ─────────────────────────────────────────────────
    const pageRows = pages.map((p) => ({
      document_id: documentId,
      org_id:      doc.org_id,
      page_number: p.pageNumber,
      raw_text:    p.text,
      word_count:  countWords(p.text),
      status:      'pending' as const,
    }))



    const { data: insertedPages, error: pageErr } = await admin
      .from('pages')
      .insert(pageRows)
      .select('id, page_number, raw_text')



    if (pageErr || !insertedPages) {
      throw new Error(`pages INSERT failed: ${pageErr?.message ?? 'no data'}`)
    }

    // Update document page_count
    await admin
      .from('documents')
      .update({ page_count: insertedPages.length })
      .eq('id', documentId)

    // ── 6. Set status → chunking ──────────────────────────────────────────────
    await setStatus(admin, documentId, 'chunking')

    // ── 7. Chunk pages ────────────────────────────────────────────────────────
    console.log('[pipeline] Chunking text...')
    const allChunks: ChunkInsertRow[] = []

    for (const page of insertedPages) {
      const text = (page as { raw_text?: string }).raw_text ?? ''
      if (!text.trim()) continue

      const textChunks = chunkText(text)
      for (let i = 0; i < textChunks.length; i++) {
        allChunks.push({
          document_id: documentId,
          page_id:     (page as { id: string }).id,
          org_id:      doc.org_id,
          chunk_index: allChunks.length,
          content:     textChunks[i],
          token_count: estimateTokens(textChunks[i]),
          metadata: {
            page_number:          (page as { page_number: number }).page_number,
            document_id:          documentId,
            org_id:               doc.org_id,
            doc_type:             doc.doc_type,
            department:           doc.department,
            sensitivity:          doc.sensitivity,
            chunk_in_page:        i,
            total_chunks_in_page: textChunks.length,
          } satisfies Json,
        })
      }
    }

    console.log('[pipeline] Created', allChunks.length, 'chunks')

    // Insert chunks in batches of 100
    const insertedChunkIds: string[] = []
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

    // ── 8. Set status → embedding ─────────────────────────────────────────────
    await setStatus(admin, documentId, 'embedding')

    // ── 9. Generate embeddings ────────────────────────────────────────────────
    console.log('[pipeline] Generating embeddings for', insertedChunkIds.length, 'chunks...')

    const { data: chunkRows, error: fetchChunkErr } = await admin
      .from('chunks')
      .select('id, content')
      .eq('document_id', documentId)
      .order('chunk_index', { ascending: true })

    if (fetchChunkErr || !chunkRows) {
      throw new Error(`Failed to fetch chunks for embedding: ${fetchChunkErr?.message}`)
    }

    // ── TEMPORARY DIAGNOSTIC — Gemini API key audit ──────────────────────────
    console.log('[pipeline] Gemini API key audit:', {
      GEMINI_API_KEY_EXISTS: !!process.env.GEMINI_API_KEY,
      GEMINI_API_KEY_PREFIX: process.env.GEMINI_API_KEY?.slice(0, 10),
      GEMINI_API_KEY_LENGTH: process.env.GEMINI_API_KEY?.length,
    })
    // ─────────────────────────────────────────────────────────────────────────

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
    const embeddingRows = await generateEmbeddings(
      ai,
      doc.org_id,
      chunkRows as Array<{ id: string; content: string }>
    )

    console.log('[pipeline] Generated', embeddingRows.length, 'embeddings')

    // Insert embeddings in batches of 50
    for (let i = 0; i < embeddingRows.length; i += 50) {
      const batch = embeddingRows.slice(i, i + 50)
      const { error: embErr } = await admin.from('embeddings').insert(batch)
      if (embErr) {
        throw new Error(`embeddings INSERT batch ${i / 50} failed: ${embErr.message}`)
      }
    }

    // Mark all pages as embedded only when we actually have embeddings
    if (embeddingRows.length > 0) {
      await admin
        .from('pages')
        .update({ status: 'embedded' })
        .eq('document_id', documentId)
    }

    // ── 10. Set final status ──────────────────────────────────────────────────
    // Pages and chunks are always preserved regardless of embedding outcome.
    // Only mark fully indexed when embeddings were successfully generated.
    if (embeddingRows.length === 0) {
      const reason = 'Embedding step produced 0 vectors — check GEMINI_API_KEY and quota.'
      console.warn('[pipeline] ⚠ embedding_failed:', reason)

      await admin
        .from('documents')
        .update({
          status:        'embedding_failed',
          error_message: reason,
          updated_at:    new Date().toISOString(),
        })
        .eq('id', documentId)

      await auditLog(admin, doc.org_id, doc.uploaded_by, 'document.parser_completed', documentId, {
        pages:            insertedPages.length,
        chunks:           allChunks.length,
        embeddings:       0,
        embedding_status: 'failed — 0 vectors generated',
      })

      console.log('[pipeline] ⚠ Partial complete (embedding_failed):', {
        pages: insertedPages.length, chunks: allChunks.length, embeddings: 0,
      })

      return {
        success:           false,
        pagesProcessed:    insertedPages.length,
        chunksCreated:     allChunks.length,
        embeddingsCreated: 0,
        error:             reason,
      }
    }

    await setStatus(admin, documentId, 'indexed')

    // Audit: parser completed
    await auditLog(admin, doc.org_id, doc.uploaded_by, 'document.parser_completed', documentId, {
      pages:      insertedPages.length,
      chunks:     allChunks.length,
      embeddings: embeddingRows.length,
    })

    console.log('[pipeline] ✅ Complete:', {
      pages: insertedPages.length,
      chunks: allChunks.length,
      embeddings: embeddingRows.length,
    })

    return {
      success:           true,
      pagesProcessed:    insertedPages.length,
      chunksCreated:     allChunks.length,
      embeddingsCreated: embeddingRows.length,
    }

  } catch (err: unknown) {
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

function chunkText(text: string): string[] {
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

interface ChunkInsertRow {
  document_id: string
  page_id:     string
  org_id:      string
  chunk_index: number
  content:     string
  token_count: number
  metadata:    Json
}

interface EmbeddingInsertRow {
  chunk_id:   string
  org_id:     string
  embedding:  number[]
  model_used: string
}

async function embedContentWithRetry(
  ai: GoogleGenAI,
  contents: string[],
  retries = 5,
  delay = 1000
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const promises = contents.map(async (text) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const result = await ai.models.embedContent({
          model: EMBEDDING_MODEL,
          contents: text,
          config: { outputDimensionality: 768 },
        })
        const values = result.embeddings?.[0]?.values
        if (!values) {
          throw new Error('No values returned in embedding')
        }
        return { values }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        const isRateLimit = msg.includes('429') || msg.toLowerCase().includes('resource_exhausted') || msg.toLowerCase().includes('rate limit')
        
        if (isRateLimit && attempt < retries) {
          const backoff = delay * Math.pow(2, attempt - 1) + Math.random() * 500
          console.warn(`[pipeline] Gemini rate limit hit (429/Resource Exhausted). Retrying chunk in ${Math.round(backoff)}ms (attempt ${attempt}/${retries})...`)
          await sleep(backoff)
        } else {
          throw err
        }
      }
    }
    throw new Error('Retries exhausted')
  })

  const embeddings = await Promise.all(promises)
  return { embeddings }
}

async function generateEmbeddings(
  ai: GoogleGenAI,
  orgId: string,
  chunks: Array<{ id: string; content: string }>
): Promise<EmbeddingInsertRow[]> {
  console.log('[embedding]', {
    model: AI_MODELS.EMBEDDING,
    chunkCount: chunks.length,
  })

  const rows: EmbeddingInsertRow[] = []
  const BATCH_SIZE = 16

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE)
    console.log(`[pipeline] Processing batch of ${batch.length} chunks (${i} to ${i + batch.length} of ${chunks.length})`)

    try {
      // Try embedding the batch together
      const result = await embedContentWithRetry(ai, batch.map(c => c.content))
      const embeddings = result.embeddings ?? []
      
      for (let j = 0; j < batch.length; j++) {
        const values = embeddings[j]?.values
        console.log(`[pipeline] Chunk ${batch[j].id} embedding length: ${values?.length}, expected: ${EMBEDDING_DIM}`)
        if (!values || values.length !== EMBEDDING_DIM) {
          console.warn('[pipeline] Unexpected embedding dimension for chunk', batch[j].id, '— skipping')
          continue
        }
        rows.push({
          chunk_id:   batch[j].id,
          org_id:     orgId,
          embedding:  values,
          model_used: EMBEDDING_MODEL,
        })
      }
    } catch (batchErr: unknown) {
      const batchMsg = batchErr instanceof Error ? batchErr.message : String(batchErr)
      console.warn(`[pipeline] Batch embedding failed, falling back to individual chunk processing. Error: ${batchMsg}`)
      
      // Fallback: process chunks in this batch individually
      for (const chunk of batch) {
        try {
          const result = await embedContentWithRetry(ai, [chunk.content], 3, 1000)
          const values = result.embeddings?.[0]?.values
          console.log(`[pipeline] Individual chunk ${chunk.id} embedding length: ${values?.length}, expected: ${EMBEDDING_DIM}`)
          if (!values || values.length !== EMBEDDING_DIM) {
            console.warn('[pipeline] Unexpected embedding dimension for chunk', chunk.id, '— skipping')
            continue
          }
          rows.push({
            chunk_id:   chunk.id,
            org_id:     orgId,
            embedding:  values,
            model_used: EMBEDDING_MODEL,
          })
        } catch (individualErr: unknown) {
          const individualMsg = individualErr instanceof Error ? individualErr.message : String(individualErr)
          console.error(`[pipeline] Fallback embedding failed for chunk ${chunk.id}: ${individualMsg}`)
          // Non-fatal, keep going for other chunks
        }
        // Small delay between fallback requests to prevent hammering
        await sleep(200)
      }
    }

    // Small delay between batch calls to prevent rate limits
    if (i + BATCH_SIZE < chunks.length) {
      await sleep(1000)
    }
  }

  console.log('[embedding] generated vectors:', rows.length)
  return rows
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function setStatus(admin: any, docId: string, status: string) {
  await admin
    .from('documents')
    .update({ status, updated_at: new Date().toISOString() })
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

function estimateTokens(text: string): number {
  // Rough approximation: 1 token ≈ 4 characters
  return Math.ceil(text.length / 4)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
