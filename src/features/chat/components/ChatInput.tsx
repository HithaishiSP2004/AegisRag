'use client'
// =============================================================================
// ChatInput — Sprint 6A Chat Redesign
// Modern textarea with send button, char counter, keyboard hints.
// Wrapped in ChamferedShard for consistent design signature.
// =============================================================================
import { useRef, useEffect } from 'react'
import { Send, Loader2 } from 'lucide-react'
import { colors, font, radius, transition } from '@/components/ui/tokens'
import { ChamferedShard } from '@/components/ui'

const MAX_CHARS = 4000

interface Props {
  value:      string
  onChange:   (v: string) => void
  onSubmit:   () => void
  disabled:   boolean
  placeholder?: string
  inputMode:  'ask' | 'deep' | 'citation'
  setInputMode: (m: 'ask' | 'deep' | 'citation') => void
  onToggleScope: () => void
  activeFiltersCount: number
}

export function ChatInput({ value, onChange, onSubmit, disabled, placeholder, inputMode, setInputMode, onToggleScope, activeFiltersCount }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const charCount   = value.length
  const isOverLimit = charCount > MAX_CHARS
  const canSend     = !disabled && value.trim().length > 0 && !isOverLimit

  // Dynamic placeholder text
  const dynamicPlaceholder = placeholder ?? (
    inputMode === 'deep'
      ? 'Initiate agentic deep research across document chunks (slower, exhaustive search)...'
      : inputMode === 'citation'
      ? 'Ask with strict citation constraints and document mapping...'
      : 'Ask about your compliance documents… (Enter to send, Shift+Enter for new line)'
  )

  // Auto-resize
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }, [value])

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (canSend) onSubmit()
    }
  }

  const tabStyle = (active: boolean, mode: 'ask' | 'deep' | 'citation'): React.CSSProperties => {
    const activeColor = mode === 'deep' ? colors.violetLight : colors.cyan
    const activeBg = mode === 'deep' ? 'rgba(139,92,246,0.12)' : 'rgba(34,211,238,0.12)'
    const activeBorder = mode === 'deep' ? 'rgba(139,92,246,0.25)' : 'rgba(34,211,238,0.25)'

    return {
      background: active ? activeBg : 'rgba(255,255,255,0.01)',
      border: `1px solid ${active ? activeBorder : colors.glassBorder}`,
      borderRadius: radius.md,
      padding: '4px 10px',
      color: active ? activeColor : colors.textMuted,
      fontSize: font.sizes.xs,
      fontWeight: 600,
      cursor: 'pointer',
      transition: transition.fast,
      outline: 'none',
      fontFamily: font.mono,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    }
  }

  return (
    <div
      style={{
        borderTop: `1px solid ${colors.glassBorder}`,
        background: `rgba(8,12,20,0.92)`,
        backdropFilter: 'blur(16px)',
        flexShrink: 0,
        padding: '8px 14px 10px',
      }}
    >
      <ChamferedShard
        variant={isOverLimit ? 'danger' : canSend ? 'cognitive' : 'default'}
        noPad={true}
        style={{
          boxShadow: canSend ? `0 0 16px rgba(99,102,241,0.15)` : 'none',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Segmented controls */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px 6px',
            borderBottom: `1px solid ${colors.glassBorder}`,
            background: 'rgba(255,255,255,0.01)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setInputMode('ask')}
                style={tabStyle(inputMode === 'ask', 'ask')}
              >
                Ask
              </button>
              <button
                type="button"
                onClick={() => setInputMode('deep')}
                style={tabStyle(inputMode === 'deep', 'deep')}
              >
                Deep Research
              </button>
              <button
                type="button"
                onClick={() => setInputMode('citation')}
                style={tabStyle(inputMode === 'citation', 'citation')}
              >
                Citation Mode
              </button>
            </div>

            <button
              id="scope-toggle-btn"
              type="button"
              onClick={onToggleScope}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: activeFiltersCount > 0 ? 'rgba(34,211,238,0.12)' : 'transparent',
                border: `1px solid ${activeFiltersCount > 0 ? 'rgba(34,211,238,0.25)' : colors.glassBorder}`,
                borderRadius: radius.md,
                padding: '4px 10px',
                color: activeFiltersCount > 0 ? colors.cyan : colors.textMuted,
                fontSize: font.sizes.xs,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: font.mono,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              <span>Scope</span>
              {activeFiltersCount > 0 && (
                <span style={{
                  background: colors.cyan,
                  color: '#000',
                  borderRadius: '99px',
                  fontSize: '0.65rem',
                  padding: '1px 5px',
                  fontWeight: 700,
                }}>
                  {activeFiltersCount}
                </span>
              )}
              <span style={{ fontSize: '0.75rem' }}>▾</span>
            </button>
          </div>

          <div
            style={{
              display:      'flex',
              alignItems:   'flex-end',
              gap:          '10px',
              padding:      '10px 14px',
              background:   'transparent',
              transition:   transition.colors,
            }}
          >
            <textarea
              ref={textareaRef}
              id="chat-input"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKey}
              disabled={disabled}
              placeholder={dynamicPlaceholder}
              rows={1}
              aria-label="Message input"
              aria-describedby="chat-input-hint"
              aria-invalid={isOverLimit}
              style={{
                flex:       1,
                background: 'transparent',
                border:     'none',
                outline:    'none',
                color:      colors.textPrimary,
                fontSize:   font.sizes.base,
                lineHeight: 1.6,
                resize:     'none',
                fontFamily: font.sans,
                minHeight:  '44px',
                maxHeight:  '160px',
                overflowY:  'auto',
              }}
            />

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            {/* Char counter */}
            <span
              style={{
                fontSize: font.sizes.xs,
                color: isOverLimit ? colors.rose : charCount > MAX_CHARS * 0.8 ? colors.amber : colors.textFaint,
                fontFamily: font.mono,
                transition: transition.colors,
              }}
            >
              {charCount > 0 ? `${charCount}/${MAX_CHARS}` : ''}
            </span>

            {/* Send button */}
            <button
              id="chat-send-btn"
              type="button"
              onClick={onSubmit}
              disabled={!canSend}
              aria-label={disabled ? 'Waiting for response' : 'Send message'}
              style={{
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                width:          '36px',
                height:         '36px',
                borderRadius:   radius.md,
                background:     canSend
                  ? `linear-gradient(135deg, ${colors.indigo}, ${colors.violet})`
                  : colors.glassSurface,
                border:    `1px solid ${canSend ? 'rgba(99,102,241,0.4)' : colors.glassBorder}`,
                color:     canSend ? '#fff' : colors.textFaint,
                cursor:    canSend ? 'pointer' : 'not-allowed',
                flexShrink:0,
                transition: transition.base,
                boxShadow: canSend ? `0 0 16px rgba(99,102,241,0.30)` : 'none',
              }}
            >
              {disabled
                ? <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite' }} aria-hidden="true" />
                : <Send size={15} aria-hidden="true" />
              }
            </button>
          </div>
          </div>
        </div>
      </ChamferedShard>

      <p
        id="chat-input-hint"
        style={{
          color: colors.textFaint, fontSize: font.sizes.xs,
          textAlign: 'center', marginTop: '6px',
        }}
      >
        Enter to send · Shift+Enter for new line · Responses include citations from your knowledge vault
      </p>
    </div>
  )
}
