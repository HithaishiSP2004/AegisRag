// =============================================================================
// Sprint 2: Vector Retrieval (stub — activated once GEMINI_API_KEY is set)
//
// When embeddings are available this calls match_chunks() (migration 0008).
// When they are not (embedding_failed state or no API key), it returns [].
// The service layer detects the empty result and falls back to keyword search.
// =============================================================================

import { createAdminClient } from '@/lib/supabase/server'
import { GoogleGenAI } from '@google/genai'
import type { SearchQuery, SearchResult, ChunkMetadata, DocumentMeta } from './types'
import { AI_MODELS } from '@/config/ai'

const EMBEDDING_MODEL = AI_MODELS.EMBEDDING

interface RawVectorRow {
  chunk_id:    string
  document_id: string
  page_id:     string
  org_id:      string
  content:     string
  metadata:    ChunkMetadata
  similarity:  number
}

interface RawDocRow {
  id:            string
  original_name: string
  doc_type:      string
  sensitivity:   string
  department:    string | null
}

/**
 * Returns [] immediately if GEMINI_API_KEY is missing or embeddings table
 * is empty for this org. Caller falls back to keyword search.
 */
export async function vectorSearch(query: SearchQuery): Promise<SearchResult[]> {
  const { text, orgId, filters } = query

  // ── Guard: no API key → skip silently ────────────────────────────────────
  if (!process.env.GEMINI_API_KEY) {
    console.warn('[retrieval/vector] GEMINI_API_KEY not set — skipping vector search')
    return []
  }

  // ── Guard: check if org has any embeddings ────────────────────────────────
  const admin = createAdminClient()
  const { count } = await admin
    .from('embeddings')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)

  if (!count || count === 0) {
    console.warn('[retrieval/vector] No embeddings for org', orgId, '— skipping vector search')
    return []
  }

  // ── Embed the query ───────────────────────────────────────────────────────
  let queryEmbedding: number[]
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    const result = await ai.models.embedContent({
      model:    EMBEDDING_MODEL,
      contents: text,
      config:   { outputDimensionality: 768 },
    })
    queryEmbedding = result.embeddings?.[0]?.values ?? []
    if (queryEmbedding.length === 0) {
      console.warn('[retrieval/vector] Empty embedding returned for query')
      return []
    }
    console.log('[retrieval/vector] generated query embedding')
  } catch (err) {
    console.error('[retrieval/vector] Embedding generation failed:', err)
    return []
  }

  // ── Run vector similarity search ──────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rows, error } = await (admin as any).rpc('match_chunks', {
    query_embedding:    queryEmbedding,
    match_org_id:       orgId,
    match_count:        filters.limit ?? 8,
    match_threshold:    0.50,
    filter_department:  filters.department  ?? null,
    filter_doc_type:    filters.docType     ?? null,
    filter_sensitivity: filters.sensitivity ?? null,
  }) as { data: RawVectorRow[] | null; error: { message: string } | null }

  if (error || !rows || rows.length === 0) {
    if (error) console.error('[retrieval/vector] match_chunks error:', error.message)
    return []
  }

  // ── Join document metadata ────────────────────────────────────────────────
  const docIds = [...new Set(rows.map((r) => r.document_id))]
  const { data: docs } = await admin
    .from('documents')
    .select('id, original_name, doc_type, sensitivity, department')
    .in('id', docIds) as { data: RawDocRow[] | null }

  const docMap = new Map<string, DocumentMeta>()
  for (const d of docs ?? []) {
    docMap.set(d.id, {
      id:           d.id,
      originalName: d.original_name,
      docType:      d.doc_type,
      sensitivity:  d.sensitivity,
      department:   d.department,
    })
  }

  const results = rows.map((row): SearchResult => ({
    chunkId:    row.chunk_id,
    documentId: row.document_id,
    pageId:     row.page_id,
    orgId:      row.org_id,
    content:    row.content,
    score:      row.similarity,
    mode:       'vector',
    metadata:   row.metadata,
    document:   docMap.get(row.document_id) ?? {
      id:           row.document_id,
      originalName: 'Unknown document',
      docType:      row.metadata.doc_type ?? 'other',
      sensitivity:  row.metadata.sensitivity ?? 'internal',
      department:   row.metadata.department ?? null,
    },
  }))
  console.log(`[retrieval/vector] returned ${results.length} results`)
  return results
}
