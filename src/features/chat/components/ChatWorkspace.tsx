'use client'
// =============================================================================
// ChatWorkspace — Sprint 6A Chat Redesign
// Enterprise AI copilot workspace with welcome state, typing indicator,
// conversation sidebar, retrieval filters, and citation panel.
// Redesigned with AegisConduit vector connectors for interactive citations.
// =============================================================================
import { useState, useCallback, useRef, useEffect } from 'react'
import { SidebarIcon, Database, LayoutDashboard } from 'lucide-react'
import { useChat } from '../hooks/useChat'
import { useConversations } from '../hooks/useConversations'
import { MessageList }           from './MessageList'
import { ChatInput }             from './ChatInput'
import { CitationPanel }         from './CitationPanel'
import { ConversationSidebar }   from './ConversationSidebar'
import { SearchFiltersPanel }    from './SearchFiltersPanel'
import { ActiveFilterChips, RetrievalScopePanel } from './RetrievalFilters'
import { WelcomeState }          from './WelcomeState'
import { TypingIndicator }       from './TypingIndicator'
import type { SearchFiltersUI }  from '../types'
import type { RetrievalFiltersState } from './RetrievalFilters'
import type { ConversationMeta } from '../hooks/useConversations'
import { colors, font, radius, transition } from '@/components/ui/tokens'
import { AegisConduit } from '@/components/ui'

export function ChatWorkspace() {
  const [retrieval,   setRetrieval]   = useState<RetrievalFiltersState>({})
  const [dateFilters, setDateFilters] = useState<Pick<SearchFiltersUI,'dateFrom'|'dateTo'>>({})
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [conversationFilters, setConversationFilters] = useState<Record<string, {
    retrieval: RetrievalFiltersState
    dateFilters: Pick<SearchFiltersUI,'dateFrom'|'dateTo'>
  }>>({})
  const [inputMode, setInputMode] = useState<'ask' | 'deep' | 'citation'>('ask')
  const [scopePanelOpen, setScopePanelOpen] = useState(false)
  const [inspectorWidth, setInspectorWidth] = useState(320)
  const isResizingRef = useRef(false)

  const handleResize = useCallback((e: MouseEvent) => {
    if (!isResizingRef.current) return
    const width = window.innerWidth - e.clientX
    const constrainedWidth = Math.max(320, Math.min(420, width))
    setInspectorWidth(constrainedWidth)
  }, [])

  const stopResize = useCallback(() => {
    isResizingRef.current = false
    document.removeEventListener('mousemove', handleResize)
    document.removeEventListener('mouseup', stopResize)
  }, [handleResize])

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isResizingRef.current = true
    document.addEventListener('mousemove', handleResize)
    document.addEventListener('mouseup', stopResize)
  }, [handleResize, stopResize])

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleResize)
      document.removeEventListener('mouseup', stopResize)
    }
  }, [handleResize, stopResize])

  const workspaceRef = useRef<HTMLDivElement>(null)
  const [conduitCoords, setConduitCoords] = useState<{
    startX: number
    startY: number
    endX: number
    endY: number
    state: 'nominal' | 'warning' | 'danger' | 'cognitive' | 'neutral'
  } | null>(null)

  const filters: SearchFiltersUI = {
    department:  retrieval.department,
    docType:     retrieval.docType,
    sensitivity: retrieval.sensitivity,
    dateFrom:    dateFilters.dateFrom,
    dateTo:      dateFilters.dateTo,
  }

  const convHook = useConversations()

  const onConversationCreated = useCallback((id: string) => {
    setConversationFilters(prev => ({ ...prev, [id]: { retrieval, dateFilters } }))
    setActiveConvId(id)
    convHook.reload()
  }, [convHook, retrieval, dateFilters])

  const chat = useChat(filters, {
    initialConversationId: activeConvId ?? undefined,
    onConversationCreated,
  })

  const panelOpen = chat.activeCitation !== null && chat.panelCitations.length > 0

  function handleSelectConversation(conv: ConversationMeta) {
    if (conv.id === activeConvId) return
    if (activeConvId) {
      setConversationFilters(prev => ({ ...prev, [activeConvId]: { retrieval, dateFilters } }))
    }
    const saved = conversationFilters[conv.id] || { retrieval: {}, dateFilters: {} }
    setRetrieval(saved.retrieval)
    setDateFilters(saved.dateFilters)
    setActiveConvId(conv.id)
    chat.loadConversation(conv.id)
  }

  function handleNewConversation() {
    if (activeConvId) {
      setConversationFilters(prev => ({ ...prev, [activeConvId]: { retrieval, dateFilters } }))
    }
    setRetrieval({})
    setDateFilters({})
    setActiveConvId(null)
    chat.reset()
  }


  // Handle welcome prompt submission
  const handleWelcomeSubmit = useCallback((text: string, mode: 'ask' | 'deep' | 'citation') => {
    setInputMode(mode)
    chat.sendMessage(text)
  }, [chat])

  // Calculate coordinates of the AegisConduit connection path
  const updateConduit = useCallback(() => {
    if (!workspaceRef.current || chat.activeCitation === null) {
      setConduitCoords(null)
      return
    }

    const activeRef = chat.panelCitations.find((c) => c.index === chat.activeCitation)
    if (!activeRef) {
      setConduitCoords(null)
      return
    }

    const badgeId = `citation-badge-${activeRef.chunkId}`
    const cardId = `source-card-${activeRef.chunkId}`

    const badgeEl = document.getElementById(badgeId)
    const cardEl = document.getElementById(cardId)

    if (!badgeEl || !cardEl) {
      setConduitCoords(null)
      return
    }

    const containerRect = workspaceRef.current.getBoundingClientRect()
    const badgeRect = badgeEl.getBoundingClientRect()
    const cardRect = cardEl.getBoundingClientRect()

    // Position of conduit start (right edge of the badge)
    const startX = badgeRect.right - containerRect.left
    const startY = badgeRect.top - containerRect.top + badgeRect.height / 2

    // Position of conduit end (left edge of the card)
    const endX = cardRect.left - containerRect.left
    const endY = cardRect.top - containerRect.top + cardRect.height / 2

    // Adjust conduit state color depending on sensitivity
    const sensitivity = activeRef.result.document.sensitivity
    const state =
      sensitivity === 'restricted'
        ? 'danger'
        : sensitivity === 'confidential'
        ? 'warning'
        : 'cognitive'

    setConduitCoords({ startX, startY, endX, endY, state })
  }, [chat.activeCitation, chat.panelCitations])

  // Coordinate tracking effect
  useEffect(() => {
    updateConduit()

    // Capture scrolling inside panels to update conduit positioning instantly
    window.addEventListener('scroll', updateConduit, true)
    window.addEventListener('resize', updateConduit)

    const interval = setInterval(updateConduit, 100)

    return () => {
      window.removeEventListener('scroll', updateConduit, true)
      window.removeEventListener('resize', updateConduit)
      clearInterval(interval)
    }
  }, [updateConduit])

  const showWelcome = chat.messages.length === 0 && !chat.loading
  const showTyping  = chat.loading && chat.messages.length > 0 &&
                      chat.messages[chat.messages.length - 1]?.role === 'user'

  return (
    <div
      style={{
        display:       'flex',
        flexDirection: 'column',
        height:        '100%',
        overflow:      'hidden',
        background:    `radial-gradient(ellipse at 20% 60%, rgba(99,102,241,0.04) 0%, transparent 60%),
                        radial-gradient(ellipse at 80% 10%, rgba(59,130,246,0.03) 0%, transparent 60%),
                        ${colors.bgBase}`,
      }}
    >
      {/* ── Top header ─────────────────────────────────────────────── */}
      <header
        className="app-header"
        style={{ height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', flexShrink: 0, zIndex: 10 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Sidebar toggle */}
          <button
            id="sidebar-toggle"
            onClick={() => setSidebarOpen((o) => !o)}
            aria-label={sidebarOpen ? 'Hide conversation sidebar' : 'Show conversation sidebar'}
            aria-pressed={sidebarOpen}
            title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
            style={{
              background: 'none', border: 'none',
              color: colors.textMuted, cursor: 'pointer',
              padding: '4px', borderRadius: radius.sm,
              display: 'flex', alignItems: 'center',
              transition: transition.fast,
            }}
          >
            <SidebarIcon size={17} aria-hidden="true" />
          </button>

          {/* Branding — Knowledge Workbench */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              aria-hidden="true"
              style={{
                width: '28px', height: '28px', borderRadius: radius.sm,
                background: `linear-gradient(135deg, ${colors.indigo}, ${colors.violet})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>

            {/* Title + subtitle — stacked, contained within the 60px header */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', lineHeight: 1 }}>
              <span style={{ color: colors.textPrimary, fontSize: '0.9rem', fontWeight: 700, letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>
                Knowledge Workbench
              </span>
              <span style={{ color: 'rgba(99,102,241,0.55)', fontSize: '0.6rem', fontFamily: font.mono, letterSpacing: '0.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                Hybrid Retrieval Intelligence
              </span>
            </div>

            {/* Operational status strip */}
            <div
              aria-label="System status"
              style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                marginLeft: '12px',
                padding: '3px 12px',
                background: 'rgba(16,185,129,0.04)',
                border: '1px solid rgba(16,185,129,0.12)',
                borderRadius: radius.full,
              }}
            >
              <StatusDot label="132 Documents Indexed" />
              <StatusDot label="Vector Search Active" />
              <StatusDot label="Grounding Enabled" />
            </div>
          </div>
        </div>

        {/* Nav links */}
        <nav aria-label="App navigation shortcuts">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <HeaderNavLink href="/knowledge-vault" icon={<Database size={13} aria-hidden="true" />} label="Knowledge Vault" />
            <HeaderNavLink href="/dashboard"       icon={<LayoutDashboard size={13} aria-hidden="true" />} label="Dashboard" />
          </div>
        </nav>
      </header>

      {/* ── Body ─────────────────────────────────────────────────────── */}
      <div
        ref={workspaceRef}
        style={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Aegis Conduit connection link layer */}
        {conduitCoords && (
          <AegisConduit
            startX={conduitCoords.startX}
            startY={conduitCoords.startY}
            endX={conduitCoords.endX}
            endY={conduitCoords.endY}
            state={conduitCoords.state}
            style={{
              zIndex: 999,
              pointerEvents: 'none',
              filter: 'drop-shadow(0 0 4px rgba(99, 102, 241, 0.4))',
            }}
          />
        )}

        {/* ── Conversation Sidebar ────────────────────────────────────── */}
        {sidebarOpen && (
          <ConversationSidebar
            conversations={convHook.conversations}
            activeId={activeConvId}
            loading={convHook.loading}
            onSelect={handleSelectConversation}
            onNew={handleNewConversation}
            onRename={convHook.renameConversation}
            onDelete={async (id) => {
              const ok = await convHook.deleteConversation(id)
              if (ok && id === activeConvId) {
                setActiveConvId(null)
                chat.reset()
              }
              return ok
            }}
          />
        )}

        {/* ── Chat column ─────────────────────────────────────────────── */}
        {/* position:relative is the anchor for the absolute-positioned input bar */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, position: 'relative', background: 'rgba(5, 7, 12, 0.4)' }}>
          {/* Centered content limiter */}
          <div style={{ width: '100%', maxWidth: '1050px', margin: '0 auto', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', position: 'relative' }}>

            {/* Active filter chips — fixed above messages */}
            <div style={{ flexShrink: 0 }}>
              <ActiveFilterChips
                filters={retrieval}
                onClear={(field) => setRetrieval((prev) => { const next = { ...prev }; delete next[field]; return next })}
              />
            </div>

            {/* Messages or welcome state */}
            {showWelcome ? (
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                <WelcomeState onSubmit={handleWelcomeSubmit} />
              </div>
            ) : (
              /* MessagesArea: the ONLY scrollable region in the chat column */
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <MessageList
                  messages={chat.messages}
                  activeCitationIdx={chat.activeCitation}
                  onCitationClick={chat.onCitationClick}
                />
                {/* Typing indicator sits above the input padding */}
                {showTyping && (
                  <div style={{ padding: '0 28px 8px', flexShrink: 0 }}>
                    <TypingIndicator />
                  </div>
                )}
              </div>
            )}

            {/* Keyword fallback notice — above the input */}
            {chat.messages.length > 0 && chat.messages[chat.messages.length - 1]?.mode === 'keyword' && (
              <div
                role="alert"
                style={{
                  margin: '0 20px 4px',
                  padding: '7px 12px',
                  background: 'rgba(100,116,139,0.08)',
                  border: `1px solid rgba(100,116,139,0.15)`,
                  borderRadius: radius.md,
                  display: 'flex', alignItems: 'center', gap: '7px',
                  flexShrink: 0,
                }}
              >
                <Database size={13} style={{ color: colors.textMuted }} aria-hidden="true" />
                <span style={{ color: colors.textMuted, fontSize: font.sizes.base }}>
                  Keyword search active — vector embeddings unavailable.{' '}
                  <a href="/knowledge-vault" style={{ color: colors.violetLight, textDecoration: 'none' }}>
                    Reprocess documents
                  </a>{' '}
                  once GEMINI_API_KEY is configured.
                </span>
              </div>
            )}

            {/* ── Input bar — absolute anchored to bottom of chat column ── */}
            {/* This means it NEVER scrolls away regardless of message count */}
            {!showWelcome && (
              <div style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 10,
              }}>
                <ChatInput
                  value={chat.input}
                  onChange={chat.setInput}
                  onSubmit={chat.sendMessage}
                  disabled={chat.loading}
                  inputMode={inputMode}
                  setInputMode={setInputMode}
                  onToggleScope={() => setScopePanelOpen((o) => !o)}
                  activeFiltersCount={[retrieval.department, retrieval.docType, retrieval.sensitivity].filter(Boolean).length}
                />
              </div>
            )}
          </div>
        </div>

        {/* ── Citation panel ──────────────────────────────────────────── */}
        {panelOpen && (
          <CitationPanel
            citations={chat.panelCitations}
            activeCitationIdx={chat.activeCitation}
            onClose={chat.closePanel}
            onSelectCitation={chat.setActiveCitation}
            width={inspectorWidth}
            onWidthChange={setInspectorWidth}
            onStartResize={startResize}
          />
        )}

        {/* ── Retrieval Scope Panel + backdrop ─────────────────────────── */}
        {scopePanelOpen && (
          <div
            aria-label="Close retrieval scope panel"
            onClick={() => setScopePanelOpen(false)}
            style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0.35)',
              zIndex: 99,
            }}
          />
        )}
        <RetrievalScopePanel
          isOpen={scopePanelOpen}
          onClose={() => setScopePanelOpen(false)}
          filters={retrieval}
          onChange={setRetrieval}
        />
      </div>
    </div>
  )
}

function HeaderNavLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <a
      href={href}
      style={{
        display: 'flex', alignItems: 'center', gap: '5px',
        color: colors.textMuted, fontSize: font.sizes.base,
        textDecoration: 'none', padding: '5px 10px', borderRadius: radius.md,
        border: `1px solid ${colors.glassBorder}`,
        background: colors.glassSurface, transition: transition.fast,
      }}
    >
      {icon}
      {label}
    </a>
  )
}

function StatusDot({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
      <span
        aria-hidden="true"
        style={{
          width: '5px', height: '5px', borderRadius: '50%',
          background: '#10b981',
          boxShadow: '0 0 6px rgba(16,185,129,0.7)',
          flexShrink: 0,
          animation: 'statusPulse 2.4s ease-in-out infinite',
        }}
      />
      <span
        style={{
          color: 'rgba(16,185,129,0.75)',
          fontSize: '0.62rem',
          fontFamily: font.mono,
          letterSpacing: '0.04em',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
    </div>
  )
}
