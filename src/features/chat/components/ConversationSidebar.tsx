'use client'
// =============================================================================
// ConversationSidebar — Sprint 6A Chat Redesign
// Premium conversation list with search, date grouping, three-dot menu.
// =============================================================================
import { useState, useRef, useEffect } from 'react'
import { Plus, Search, MessageSquare, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import type { ConversationMeta } from '../hooks/useConversations'
import { colors, font, radius, transition } from '@/components/ui/tokens'

interface Props {
  conversations:       ConversationMeta[]
  activeId:            string | null
  loading:             boolean
  onSelect:            (conv: ConversationMeta) => void
  onNew:               () => void
  onRename:            (id: string, title: string) => Promise<boolean>
  onDelete:            (id: string) => Promise<boolean>
}

function formatDate(iso: string): string {
  const d    = new Date(iso)
  const now  = new Date()
  const diff = now.getTime() - d.getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs  = Math.floor(mins / 60)
  if (hrs  < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7)  return `${days}d ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function ConversationSidebar({
  conversations, activeId, loading, onSelect, onNew, onRename, onDelete,
}: Props) {
  const [editingId,     setEditingId]     = useState<string | null>(null)
  const [editValue,     setEditValue]     = useState('')
  const [deletingId,    setDeletingId]    = useState<string | null>(null)
  const [contextMenuId, setContextMenuId] = useState<string | null>(null)
  const [hoveredId,     setHoveredId]     = useState<string | null>(null)
  const [search,        setSearch]        = useState('')

  const inputRef   = useRef<HTMLInputElement>(null)
  const sidebarRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (editingId && inputRef.current) inputRef.current.focus()
  }, [editingId])

  useEffect(() => {
    function handleNativeClick(e: MouseEvent) {
      if (contextMenuId !== null && sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        setContextMenuId(null)
      }
    }
    document.addEventListener('click', handleNativeClick, true)
    return () => document.removeEventListener('click', handleNativeClick, true)
  }, [contextMenuId])

  function startEdit(conv: ConversationMeta, e: React.MouseEvent) {
    e.stopPropagation()
    setContextMenuId(null)
    setEditingId(conv.id)
    setEditValue(conv.title)
  }

  async function commitRename(id: string) {
    const trimmed = editValue.trim()
    if (trimmed && trimmed.length <= 200) await onRename(id, trimmed)
    setEditingId(null)
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setContextMenuId(null)
    setDeletingId(id)
    await onDelete(id)
    setDeletingId(null)
  }

  const filtered = search
    ? conversations.filter((c) => c.title.toLowerCase().includes(search.toLowerCase()))
    : conversations

  return (
    <aside
      ref={sidebarRef}
      aria-label="Conversations"
      style={{
        width:         '280px',
        minWidth:      '280px',
        height:        '100%',
        display:       'flex',
        flexDirection: 'column',
        background:    colors.bgCard,
        borderRight:   `1px solid ${colors.glassBorder}`,
        overflow:      'visible',
        position:      'relative',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 12px 12px',
          borderBottom: `1px solid ${colors.glassBorder}`,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span
            style={{
              color: colors.textMuted, fontSize: font.sizes.sm,
              fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
            }}
          >
            Conversations
          </span>
          <button
            id="new-conversation-btn"
            onClick={onNew}
            aria-label="New conversation"
            title="New conversation"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '28px', height: '28px', borderRadius: radius.md,
              background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.24)',
              color: colors.indigoLight, cursor: 'pointer',
              transition: transition.fast, flexShrink: 0,
            }}
          >
            <Plus size={16} aria-hidden="true" />
          </button>
        </div>

        {/* Search */}
        <div style={{ position: 'relative' }}>
          <Search
            size={13}
            aria-hidden="true"
            style={{
              position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)',
              color: colors.textFaint, pointerEvents: 'none',
            }}
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations…"
            aria-label="Search conversations"
            style={{
              width: '100%', background: colors.glassSurface,
              border: `1px solid ${colors.glassBorder}`, borderRadius: radius.lg,
              padding: '6px 10px 6px 30px',
              color: colors.textSecondary, fontSize: font.sizes.base,
              outline: 'none', fontFamily: font.sans,
            }}
          />
        </div>
      </div>

      {/* Conversation list */}
      <div
        role="list"
        aria-label="Conversation list"
        style={{ flex: 1, overflowY: 'auto', overflowX: 'visible', padding: '6px 8px' }}
      >
        {loading && (
          <div aria-busy="true" style={{ padding: '20px', textAlign: 'center' }}>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  height: '48px', marginBottom: '6px', borderRadius: radius.lg,
                  background: `linear-gradient(90deg, ${colors.glassSurface} 25%, rgba(255,255,255,0.07) 50%, ${colors.glassSurface} 75%)`,
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 1.6s infinite',
                }}
              />
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div role="status" style={{ padding: '32px 12px', textAlign: 'center' }}>
            <MessageSquare size={28} style={{ color: colors.textFaint, margin: '0 auto 8px', display: 'block' }} aria-hidden="true" />
            <p style={{ color: colors.textFaint, fontSize: font.sizes.base, margin: 0 }}>
              {search ? 'No results found' : 'No conversations yet'}
            </p>
            {!search && (
              <button
                onClick={onNew}
                style={{
                  marginTop: '12px', padding: '7px 14px',
                  borderRadius: radius.lg, fontSize: font.sizes.base, fontWeight: 600,
                  background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.24)',
                  color: colors.indigoLight, cursor: 'pointer', fontFamily: font.sans,
                }}
              >
                Start a conversation
              </button>
            )}
          </div>
        )}

        {filtered.map((conv) => {
          const active = conv.id === activeId
          return (
            <div
              key={conv.id}
              id={`conv-${conv.id}`}
              role="listitem"
              onClick={() => editingId !== conv.id && onSelect(conv)}
              onMouseEnter={() => setHoveredId(conv.id)}
              onMouseLeave={() => setHoveredId((prev) => (prev === conv.id ? null : prev))}
              style={{
                position:     'relative',
                display:      'flex',
                alignItems:   'center',
                gap:          '8px',
                padding:      '9px 10px',
                borderRadius: radius.lg,
                marginBottom: '2px',
                cursor:       editingId === conv.id ? 'default' : 'pointer',
                background:   active ? 'rgba(99,102,241,0.10)' : hoveredId === conv.id ? colors.glassSurface : 'transparent',
                border:       active ? '1px solid rgba(99,102,241,0.20)' : '1px solid transparent',
                transition:   transition.fast,
                opacity:      deletingId === conv.id ? 0.4 : 1,
                overflow:     'visible',
              }}
            >
              <MessageSquare
                size={14}
                aria-hidden="true"
                style={{ color: active ? colors.indigoLight : colors.textFaint, flexShrink: 0 }}
              />

              <div style={{ flex: 1, minWidth: 0 }}>
                {editingId === conv.id ? (
                  <input
                    ref={inputRef}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => commitRename(conv.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter')  commitRename(conv.id)
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    onClick={(e) => e.stopPropagation()}
                    aria-label="Rename conversation"
                    style={{
                      width: '100%', background: colors.glassSurface,
                      border: `1px solid rgba(99,102,241,0.4)`, borderRadius: radius.sm,
                      color: colors.textPrimary, fontSize: font.sizes.base,
                      padding: '2px 6px', outline: 'none', fontFamily: font.sans,
                    }}
                  />
                ) : (
                  <>
                    <p
                      style={{
                        color: active ? colors.textPrimary : colors.textSecondary,
                        fontSize: font.sizes.md, fontWeight: active ? 600 : 400,
                        margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}
                    >
                      {conv.title}
                    </p>
                    <p style={{ color: colors.textFaint, fontSize: font.sizes.xs, margin: 0 }}>
                      {formatDate(conv.updated_at)}
                    </p>
                  </>
                )}
              </div>

              {/* Three-dot menu button */}
              {editingId !== conv.id && (
                <button
                  id={`conv-menu-${conv.id}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    e.nativeEvent.stopImmediatePropagation()
                    setContextMenuId(contextMenuId === conv.id ? null : conv.id)
                  }}
                  aria-label={`Options for ${conv.title}`}
                  aria-haspopup="menu"
                  aria-expanded={contextMenuId === conv.id}
                  style={{
                    flexShrink:    0,
                    background:    'none',
                    border:        'none',
                    cursor:        'pointer',
                    color:         colors.textSecondary,
                    padding:       '3px 4px',
                    borderRadius:  radius.sm,
                    display:       'flex',
                    alignItems:    'center',
                    opacity:       (hoveredId === conv.id || contextMenuId === conv.id) ? 1 : 0,
                    pointerEvents: (hoveredId === conv.id || contextMenuId === conv.id) ? 'auto' : 'none',
                    transition:    'opacity 0.1s',
                  }}
                >
                  <MoreHorizontal size={14} aria-hidden="true" />
                </button>
              )}

              {/* Dropdown menu */}
              {contextMenuId === conv.id && (
                <div
                  role="menu"
                  aria-label={`Actions for ${conv.title}`}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position:     'absolute',
                    right:        '6px',
                    top:          'calc(100% + 4px)',
                    zIndex:       50000,
                    background:   colors.bgElevated,
                    border:       `1px solid ${colors.glassBorderStrong}`,
                    borderRadius: radius.lg,
                    padding:      '4px',
                    minWidth:     '140px',
                    boxShadow:    '0 8px 24px rgba(0,0,0,0.5)',
                    animation:    'scaleIn 0.12s ease forwards',
                  }}
                >
                  <button
                    id={`conv-rename-${conv.id}`}
                    role="menuitem"
                    onClick={(e) => startEdit(conv, e)}
                    style={menuBtnStyle}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = colors.glassSurface }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                  >
                    <Pencil size={12} aria-hidden="true" />
                    Rename
                  </button>
                  <button
                    id={`conv-delete-${conv.id}`}
                    role="menuitem"
                    onClick={(e) => handleDelete(conv.id, e)}
                    style={{ ...menuBtnStyle, color: colors.rose }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(244,63,94,0.08)' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                  >
                    <Trash2 size={12} aria-hidden="true" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </aside>
  )
}

const menuBtnStyle: React.CSSProperties = {
  display:      'flex',
  alignItems:   'center',
  gap:          '7px',
  width:        '100%',
  padding:      '7px 10px',
  background:   'transparent',
  border:       'none',
  borderRadius: radius.sm,
  color:        colors.textSecondary,
  fontSize:     font.sizes.base,
  cursor:       'pointer',
  textAlign:    'left',
  transition:   transition.fast,
  fontFamily:   font.sans,
}
