// =============================================================================
// Sprint 2: Keyword Retrieval
//
// Full-text search via Postgres tsvector + websearch_to_tsquery.
// Calls search_chunks_keyword() defined in migration 0020.
// Returns SearchResult[] — same shape as vector results.
// =============================================================================

import { createAdminClient } from '@/lib/supabase/server'
import type { SearchQuery, SearchResult, ChunkMetadata, DocumentMeta } from './types'

// Raw row returned by search_chunks_keyword()
interface RawKeywordRow {
  chunk_id:    string
  document_id: string
  page_id:     string
  org_id:      string
  content:     string
  metadata:    ChunkMetadata
  similarity:  number
}

// Raw document row joined to enrich citations
interface RawDocRow {
  id:            string
  original_name: string
  doc_type:      string
  sensitivity:   string
  department:    string | null
}

export async function keywordSearch(query: SearchQuery): Promise<SearchResult[]> {
  const { text, orgId, filters } = query
  const limit = filters.limit ?? 8

  if (!text.trim()) return []

  const admin = createAdminClient()

  // ── Call the PG function ─────────────────────────────────────────────────
  const rpcPayload = {
    query_text:         text,
    match_org_id:       orgId,
    match_count:        limit,
    filter_department:  filters.department  ?? null,
    filter_doc_type:    filters.docType     ?? null,
    filter_sensitivity: filters.sensitivity ?? null,
  }
  console.log('[retrieval/keyword] query_text   :', text)
  console.log('[retrieval/keyword] match_org_id :', orgId)
  console.log('[retrieval/keyword] RPC payload  :', JSON.stringify(rpcPayload))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rpcResult = await (admin as any).rpc('search_chunks_keyword', rpcPayload) as {
    data:  RawKeywordRow[] | null
    error: { message: string; code?: string; details?: string } | null
  }
  const { data: rows, error } = rpcResult

  console.log('[retrieval/keyword] RPC error    :', error ? JSON.stringify(error) : 'none')
  console.log('[retrieval/keyword] row count    :', rows?.length ?? 0)
  if (rows && rows.length > 0) {
    console.log('[retrieval/keyword] first chunk  :', JSON.stringify({
      chunk_id:   rows[0].chunk_id,
      similarity: rows[0].similarity,
      preview:    rows[0].content?.slice(0, 80),
    }))
  }

  if (error || !rows || rows.length === 0) {
    if (error) console.error('[retrieval/keyword] RPC error (full):', error.message, error.code, error.details)
    return []
  }

  // ── Join document metadata for citation rendering ─────────────────────────
  const docIds = [...new Set(rows.map((r) => r.document_id))]
  console.log('[retrieval/keyword] doc IDs to join:', docIds)
  // Build docs query with optional date range on created_at
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let docsQuery: any = admin
    .from('documents')
    .select('id, original_name, doc_type, sensitivity, department')
    .in('id', docIds)
  if (filters.dateFrom) docsQuery = docsQuery.gte('created_at', filters.dateFrom)
  if (filters.dateTo)   docsQuery = docsQuery.lte('created_at', filters.dateTo)
  const { data: docs, error: docsErr } = await docsQuery as { data: RawDocRow[] | null; error: unknown }

  console.log('[retrieval/keyword] docs join count :', docs?.length ?? 0, docsErr ? '| join error:' + JSON.stringify(docsErr) : '')

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

  // ── Map to stable SearchResult shape ─────────────────────────────────────
  return rows.map((row): SearchResult => ({
    chunkId:    row.chunk_id,
    documentId: row.document_id,
    pageId:     row.page_id,
    orgId:      row.org_id,
    content:    row.content,
    score:      row.similarity,
    mode:       'keyword',
    metadata:   row.metadata,
    document:   docMap.get(row.document_id) ?? {
      id:           row.document_id,
      originalName: 'Unknown document',
      docType:      row.metadata.doc_type ?? 'other',
      sensitivity:  row.metadata.sensitivity ?? 'internal',
      department:   row.metadata.department ?? null,
    },
  }))
}
