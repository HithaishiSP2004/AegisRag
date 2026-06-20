'use client'
// =============================================================================
// Sprint 1B: useDocumentStatus — polls /api/documents/[id]/status
// Auto-refreshes while document is in a processing state.
// Stops polling when status reaches 'indexed' or 'failed'.
// =============================================================================

import { useState, useEffect, useCallback, useRef } from 'react'
import type { DocumentStatus } from '../types'

export interface DocumentStatusState {
  status:        DocumentStatus | null
  pageCount:     number
  errorMessage:  string | null
  lastUpdated:   Date | null
  isProcessing:  boolean
}

const PROCESSING_STATUSES: DocumentStatus[] = ['parsing', 'chunking', 'embedding', 'uploading', 'queued', 'processing', 'waiting_provider']
const TERMINAL_STATUSES:   DocumentStatus[] = ['indexed', 'embedding_failed', 'failed', 'deleted']

const POLL_INTERVAL_MS = 3000  // poll every 3 seconds while processing

/**
 * Poll document status. If `documentId` is null, does nothing.
 * `onTerminal` fires once when status reaches 'indexed' or 'failed'.
 */
export function useDocumentStatus(
  documentId: string | null,
  options: { onTerminal?: (status: DocumentStatus) => void } = {}
) {
  const [state, setState] = useState<DocumentStatusState>({
    status:       null,
    pageCount:    0,
    errorMessage: null,
    lastUpdated:  null,
    isProcessing: false,
  })

  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null)
  const onTerminalRef = useRef(options.onTerminal)

  useEffect(() => {
    onTerminalRef.current = options.onTerminal
  }, [options.onTerminal])

  const stopPolling = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const poll = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/documents/${id}/status`, { cache: 'no-store' })
      if (!res.ok) return

      const data = await res.json() as {
        status:        DocumentStatus
        page_count:    number
        error_message: string | null
        updated_at:    string
      }

      const isProcessing = PROCESSING_STATUSES.includes(data.status)
      const isTerminal   = TERMINAL_STATUSES.includes(data.status)

      setState({
        status:       data.status,
        pageCount:    data.page_count ?? 0,
        errorMessage: data.error_message ?? null,
        lastUpdated:  new Date(data.updated_at),
        isProcessing,
      })

      if (isTerminal) {
        stopPolling()
        onTerminalRef.current?.(data.status)
      }
    } catch {
      // Network error — keep polling
    }
  }, [stopPolling])

  useEffect(() => {
    if (!documentId) return

    // Immediate first poll
    Promise.resolve().then(() => {
      poll(documentId)
    })

    // Start interval
    timerRef.current = setInterval(() => poll(documentId), POLL_INTERVAL_MS)

    return stopPolling
  }, [documentId, poll, stopPolling])

  return state
}
