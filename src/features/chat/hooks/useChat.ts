'use client'
// useChat — message state, sends to /api/chat, parses citations, syncs conversation
import { useState, useCallback, useRef } from 'react'
import type { Message, SearchFiltersUI } from '../types'
import type { CitationRef } from '@/features/retrieval'

// Helper: map raw API message shape → internal Message type
// NOTE: The DB column is `retrieval_mode` (snake_case); the Message type uses `mode`.
// The `citations` column is stored as JSONB and comes back as a plain object array
// that must already conform to CitationRef shape (index, chunkId, result { ... }).
function toMessage(raw: Record<string, unknown>): Message {
  const citations = (raw.citations as CitationRef[]) ?? []
  console.log('[restored citations]', citations)
  return {
    id:          String(raw.id ?? `${Date.now()}-${Math.random()}`),
    role:        (raw.role as 'user' | 'assistant') ?? 'user',
    content:     String(raw.content ?? ''),
    citations,
    // DB column is `retrieval_mode`, not `mode`
    mode:        (raw.retrieval_mode ?? raw.mode) as Message['mode'] ?? null,
    createdAt:   raw.created_at ? new Date(raw.created_at as string) : new Date(),
    isStreaming: false,
    reasoning_metadata: raw.reasoning_metadata,
  }
}

const uid = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`

export interface UseChatOptions {
  initialConversationId?: string
  onConversationCreated?: (id: string) => void
}

export function useChat(
  filters: SearchFiltersUI = {},
  options: UseChatOptions = {}
) {
  const [messages,        setMessages]        = useState<Message[]>([])
  const [input,           setInput]           = useState('')
  const [loading,         setLoading]         = useState(false)
  const [conversationId,  setConversationId]  = useState<string | null>(
    options.initialConversationId ?? null
  )
  const [activeCitation,  setActiveCitation]  = useState<number | null>(null)
  const [panelCitations,  setPanelCitations]  = useState<CitationRef[]>([])
  const abortRef = useRef<AbortController | null>(null)

  const sendMessage = useCallback(async (overrideText?: string) => {
    const text = (typeof overrideText === 'string' ? overrideText : input).trim()
    if (!text || loading) return

    // Add user message
    const userMsg: Message = {
      id:        uid(),
      role:      'user',
      content:   text,
      citations: [],
      mode:      null,
      createdAt: new Date(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    // Placeholder assistant message (streaming indicator)
    const asstId = uid()
    const placeholderMsg: Message = {
      id:          asstId,
      role:        'assistant',
      content:     '',
      citations:   [],
      mode:        null,
      createdAt:   new Date(),
      isStreaming: true,
    }
    setMessages((prev) => [...prev, placeholderMsg])

    try {
      abortRef.current = new AbortController()
      const res = await fetch('/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          message:        text,
          conversationId: conversationId ?? undefined,
          filters,
          dateFrom: filters.dateFrom,
          dateTo:   filters.dateTo,
        }),
        signal:  abortRef.current.signal,
      })

      const data = await res.json()

      if (!res.ok) {
        let errorMsg = data?.error ?? 'API error'
        if (res.status === 429) {
          errorMsg = `⚠️ Quota Limit Exceeded: ${data?.error || 'Daily AI request limit reached. Please request a tier upgrade in the sidebar.'}`
        } else if (res.status === 403) {
          errorMsg = `🚫 Access Denied: ${data?.error || 'Your current tier does not permit this action. Please request a tier upgrade.'}`
        }
        setMessages((prev) => prev.map((m) =>
          m.id === asstId
            ? { ...m, content: errorMsg, isStreaming: false, error: data?.error ?? 'API error' }
            : m
        ))
        return
      }

      if (data.conversationId) {
        const newId = data.conversationId
        if (!conversationId) {
          setConversationId(newId)
          options.onConversationCreated?.(newId)
        }
      }

      const finalMsg: Message = {
        id:          asstId,
        role:        'assistant',
        content:     data.answer ?? '',
        citations:   data.citations ?? [],
        mode:        data.mode ?? null,
        createdAt:   new Date(),
        isStreaming: false,
        reasoning_metadata: data.reasoning_metadata,
      }

      setMessages((prev) => prev.map((m) => m.id === asstId ? finalMsg : m))

      // Store citations, but keep panel collapsed by default
      if (data.citations?.length > 0) {
        setPanelCitations(data.citations)
      }
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') return
      setMessages((prev) => prev.map((m) =>
        m.id === asstId
          ? { ...m, content: 'Network error.', isStreaming: false, error: String(err) }
          : m
      ))
    } finally {
      setLoading(false)
    }
  }, [input, loading, conversationId, filters, options])

  const onCitationClick = useCallback((c: CitationRef) => {
    // Find the message that owns this citation and load its full citation list
    // into panelCitations so the panel shows all sources for that answer.
    setMessages((prev) => {
      const owner = prev.find(
        (m) => m.role === 'assistant' && m.citations.some((ref) => ref.chunkId === c.chunkId)
      )
      if (owner && owner.citations.length > 0) {
        setPanelCitations(owner.citations)
      }
      return prev  // no mutation — just a read
    })
    setActiveCitation(c.index)
  }, [])

  const closePanel = useCallback(() => {
    setActiveCitation(null)
  }, [])

  const reset = useCallback(() => {
    setMessages([])
    setConversationId(null)
    setActiveCitation(null)
    setPanelCitations([])
  }, [])

  // Load messages from a conversation fetched from the API
  const loadConversation = useCallback(async (id: string) => {
    console.log('[useChat] loadConversation called for id:', id)
    setConversationId(id)
    setMessages([])
    setActiveCitation(null)
    setPanelCitations([])
    try {
      const res  = await fetch(`/api/conversations/${id}`)
      const data = await res.json()
      console.log('[conversation api]', data)
      if (!res.ok) {
        console.error('[useChat] Failed to load conversation:', data.error)
        return
      }
      const rawMessages: Record<string, unknown>[] = data.messages ?? []
      const parsed = rawMessages.map(toMessage)
      console.log('[loadConversation]', parsed)
      setMessages(parsed)

      // ── Restore panelCitations from the last assistant message that has citations.
      // Without this, panelOpen is always false because panelCitations is empty.
      const lastWithCitations = [...parsed]
        .reverse()
        .find((m) => m.role === 'assistant' && m.citations.length > 0)
      if (lastWithCitations) {
        console.log('[useChat] restoring panelCitations from message, count:', lastWithCitations.citations.length)
        setPanelCitations(lastWithCitations.citations)
        // Do NOT auto-open the panel (activeCitation stays null) — user must click a badge
      }
    } catch (err) {
      console.error('[useChat] loadConversation error:', err)
    }
  }, [])

  return {
    messages, input, setInput,
    loading, sendMessage,
    conversationId, setConversationId,
    activeCitation, setActiveCitation,
    panelCitations,
    onCitationClick, closePanel,
    reset, loadConversation,
  }
}
