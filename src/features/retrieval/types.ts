// =============================================================================
// Sprint 2: Retrieval — Domain Types
//
// These types define the stable contract between:
//   retrieval/service.ts  ← produces SearchResult[]
//   /api/search           ← serialises SearchResult[]
//   Chat UI               ← consumes SearchResult[] for citation rendering
//
// NEVER change the shape of SearchResult without updating the API response
// schema simultaneously. The UI depends on every field below.
// =============================================================================

// ── Retrieval mode ────────────────────────────────────────────────────────────
/** Which retrieval backend was used for a result. */
export type RetrievalMode = 'vector' | 'keyword' | 'hybrid'

// ── Filters the caller can apply ─────────────────────────────────────────────
export interface SearchFilters {
  department?:  string
  docType?:     string
  sensitivity?: string
  /** ISO date string — filter documents created after this date */
  dateFrom?:    string
  /** ISO date string — filter documents created before this date */
  dateTo?:      string
  /** Maximum number of results to return. Default: 8 */
  limit?:       number
  framework?:   string
  classification?: string
  documentId?:  string
  organizationId?: string
}

// ── Metadata attached to every chunk (mirrors chunk.metadata JSONB) ───────────
export interface ChunkMetadata {
  page_number:          number
  document_id:          string
  org_id:               string
  doc_type:             string
  department:           string | null
  sensitivity:          string
  chunk_in_page:        number
  total_chunks_in_page: number
}

// ── Slim document info joined for citation rendering ──────────────────────────
export interface DocumentMeta {
  id:            string
  originalName:  string
  docType:       string
  sensitivity:   string
  department:    string | null
}

// ── A single retrieval result — stable contract ───────────────────────────────
export interface SearchResult {
  /** Chunk primary key */
  chunkId:    string
  documentId: string
  pageId:     string
  orgId:      string
  /** Raw chunk text shown in citations */
  content:    string
  /** Normalised relevance score 0–1. Higher = more relevant. */
  score:      number
  /** Which backend produced this result */
  mode:       RetrievalMode
  metadata:   ChunkMetadata
  document:   DocumentMeta
}

// ── The query object passed to searchDocuments() ──────────────────────────────
export interface SearchQuery {
  text:      string
  orgId:     string
  filters:   SearchFilters
  userId?:   string
  userRole?: string
}

// ── Citation reference embedded in a chat message ─────────────────────────────
export interface CitationRef {
  /** 1-indexed reference number as it appears in the answer text */
  index:    number
  chunkId:  string
  result:   SearchResult
}
