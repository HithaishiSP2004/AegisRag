// =============================================================================
// Sprint 3A: Chat Feature — Domain Types (updated)
// =============================================================================

import type { SearchResult, RetrievalMode, CitationRef } from '@/features/retrieval'

export type { CitationRef }

export type MessageRole = 'user' | 'assistant'

export interface Message {
  id:         string
  role:       MessageRole
  content:    string           // raw text (may contain [1] [2] citation markers)
  citations:  CitationRef[]
  mode:       RetrievalMode | null
  createdAt:  Date
  isStreaming?: boolean
  error?:     string | null
}

export interface Conversation {
  id:          string
  messages:    Message[]
  createdAt:   Date
  updatedAt:   Date
}

export interface SearchFiltersUI {
  department?:  string
  docType?:     string
  sensitivity?: string
  dateFrom?:    string   // ISO date string
  dateTo?:      string   // ISO date string
}

// API request/response shapes
export interface ChatRequest {
  message:         string
  conversationId?: string
  filters?:        SearchFiltersUI
  dateFrom?:       string
  dateTo?:         string
}

export interface ChatResponse {
  answer:         string
  citations:      CitationRef[]
  conversationId: string
  mode:           RetrievalMode
  sources:        SearchResult[]
}
