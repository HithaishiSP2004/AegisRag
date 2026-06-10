// Retrieval feature — public API
export { searchDocuments } from './service'
export { fuseResults }     from './rrf'
export { rerankResults }   from './rerank'
export type {
  SearchResult,
  SearchFilters,
  SearchQuery,
  RetrievalMode,
  CitationRef,
  ChunkMetadata,
  DocumentMeta,
} from './types'
