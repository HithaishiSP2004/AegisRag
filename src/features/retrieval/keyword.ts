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

  // ── Pre-process text to make it lenient for keyword search ──
  // 1. Remove appended controls details if any (everything after the first colon)
  const cleanText = text.split(':')[0].trim()
  
  // 2. If it's a long sentence, convert it to OR joined keywords. If it is already short, leave it as is.
  let queryText = cleanText
  if (cleanText.split(/\s+/).length > 3) {
    const words = cleanText
      .replace(/[^\w\s-]/g, '')
      .split(/\s+/)
      .map(w => w.trim())
      .filter(w => w.length > 2 && !['and', 'for', 'the', 'with', 'from', 'this', 'that', 'these', 'those'].includes(w.toLowerCase()))
      .filter(w => !['table', 'contents', 'list', 'page', 'pages', 'show', 'give', 'what', 'where', 'how', 'does'].includes(w.toLowerCase()))
    
    if (words.length > 0) {
      queryText = words.join(' OR ')
    }
  }

  const admin = createAdminClient()

  // ── Call the PG function ─────────────────────────────────────────────────
  const rpcPayload = {
    query_text:            queryText,
    match_org_id:          orgId,
    match_user_id:         query.userId ?? null,
    match_user_role:       query.userRole ?? null,
    match_count:           limit,
    filter_department:     filters.department  ?? null,
    filter_doc_type:       filters.docType     ?? null,
    filter_sensitivity:    filters.sensitivity ?? null,
    filter_framework:      filters.framework   ?? null,
    filter_classification: filters.classification ?? null,
    filter_document_id:    filters.documentId  ?? null,
    filter_organization_id: filters.organizationId ?? null,
  }
  console.log('[retrieval/keyword] query_text   :', text)
  console.log('[retrieval/keyword] match_org_id :', orgId)
  console.log('[retrieval/keyword] RPC payload  :', JSON.stringify(rpcPayload))

  const rpcName = process.env.ENABLE_PARENT_CHILD_RETRIEVAL === 'true'
    ? 'search_chunks_keyword_parent_child'
    : 'search_chunks_keyword'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rpcResult = await (admin as any).rpc(rpcName, rpcPayload) as {
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

  const rawResults = rows.map((row): SearchResult => ({
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

  if (process.env.ENABLE_PARENT_CHILD_RETRIEVAL === 'true') {
    const deduped = deduplicateByParent(rawResults)
    console.log(`[retrieval/keyword] parent-child dedup: ${rawResults.length} children → ${deduped.length} parents`)
    return deduped
  }

  return rawResults
}

function deduplicateByParent(results: SearchResult[]): SearchResult[] {
  const best = new Map<string, SearchResult>()

  for (const result of results) {
    const existing = best.get(result.chunkId)

    if (!existing || result.score > existing.score) {
      best.set(result.chunkId, result)
    }
  }

  return Array.from(best.values())
    .sort((a, b) => b.score - a.score)
}
