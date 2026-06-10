'use client'

import { useState, useRef, useEffect } from 'react'
import { Icon } from '@iconify/react'
import { colors, font, radius } from '@/components/ui/tokens'

interface Props {
  onSubmit: (text: string, mode: 'ask' | 'deep' | 'citation') => void
}

const SUGGESTED: { icon: string; label: string; query: string }[] = [
  { icon: 'solar:shield-check-linear',   label: 'SOC 2 Controls',     query: 'What are our SOC 2 Type II control requirements?' },
  { icon: 'solar:document-text-linear',  label: 'GDPR Retention',     query: 'Summarize GDPR data retention obligations' },
  { icon: 'solar:lock-password-linear',  label: 'Security Posture',   query: 'Security posture gap analysis' },
  { icon: 'solar:file-check-linear',     label: 'ISO 27001 Controls', query: 'ISO 27001 data flow controls' },
  { icon: 'solar:chart-linear',          label: 'Risk Overview',      query: 'Summarize our current risk exposure across all compliance frameworks' },
  { icon: 'solar:book-open-linear',      label: 'Policy Audit',       query: 'Audit our policy documents for completeness against NIST CSF' },
]

const CAPABILITIES = [
  {
    icon: 'solar:cpu-linear',
    title: 'Hybrid Retrieval',
    desc: 'Vector + keyword search fused with reciprocal rank fusion across your entire document corpus.',
    accent: colors.cyan,
    accentBg: 'rgba(34,211,238,0.06)',
  },
  {
    icon: 'solar:link-linear',
    title: 'Grounded Citations',
    desc: 'Every answer is traceable to exact source chunks with confidence scoring and page references.',
    accent: colors.violetLight,
    accentBg: 'rgba(139,92,246,0.06)',
  },
  {
    icon: 'solar:graph-linear',
    title: 'Deep Research',
    desc: 'Agentic multi-hop reasoning across document clusters for exhaustive compliance investigations.',
    accent: colors.emeraldLight,
    accentBg: 'rgba(52,211,153,0.06)',
  },
]

export function WelcomeState({ onSubmit }: Props) {
  const [value, setValue] = useState('')
  const [mode, setMode] = useState<'ask' | 'deep' | 'citation'>('ask')
  const [focused, setFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 140) + 'px'
  }, [value])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (value.trim()) onSubmit(value, mode)
    }
  }

  const getPlaceholder = () => {
    if (mode === 'deep')     return 'Initiate deep research across all document chunks…'
    if (mode === 'citation') return 'Ask with strict citation constraints and source mapping…'
    return 'Ask about your compliance documents, policies, or controls…'
  }

  const modeConfig = {
    ask:      { label: 'ASK',          color: colors.cyan,        bg: 'rgba(34,211,238,0.1)',   border: 'rgba(34,211,238,0.25)' },
    deep:     { label: 'DEEP RESEARCH',color: colors.violetLight, bg: 'rgba(139,92,246,0.1)',  border: 'rgba(139,92,246,0.25)' },
    citation: { label: 'CITATION MODE',color: colors.emeraldLight,bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.25)' },
  }
  const activeMode = modeConfig[mode]

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 32px 32px',
        position: 'relative',
        overflow: 'hidden',
        animation: 'fadeInUp 0.4s ease forwards',
      }}
    >
      {/* Ambient glow background */}
      <div aria-hidden="true" style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `
          radial-gradient(ellipse 60% 40% at 50% 30%, rgba(99,102,241,0.07) 0%, transparent 70%),
          radial-gradient(ellipse 40% 30% at 30% 70%, rgba(34,211,238,0.04) 0%, transparent 60%),
          radial-gradient(ellipse 40% 30% at 70% 80%, rgba(52,211,153,0.03) 0%, transparent 60%)
        `,
      }} />

      {/* Content stack */}
      <div style={{ width: '100%', maxWidth: '780px', display: 'flex', flexDirection: 'column', gap: '28px', position: 'relative', zIndex: 1 }}>

        {/* ── Hero title ── */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* System badge */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '3px 12px', borderRadius: radius.full,
              background: 'rgba(99,102,241,0.08)',
              border: '1px solid rgba(99,102,241,0.2)',
            }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: colors.emeraldLight, boxShadow: '0 0 6px rgba(52,211,153,0.8)', flexShrink: 0, animation: 'statusPulse 2.4s ease-in-out infinite' }} />
              <span style={{ fontSize: '0.6rem', color: 'rgba(99,102,241,0.8)', fontFamily: font.mono, letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 }}>
                AEGIS INTELLIGENCE ENGINE · READY
              </span>
            </div>
          </div>

          <h1 style={{
            fontSize: 'clamp(1.6rem, 3vw, 2.2rem)',
            fontWeight: 700,
            color: '#fff',
            letterSpacing: '-0.03em',
            margin: 0,
            lineHeight: 1.1,
            background: 'linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.7) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            What would you like to investigate?
          </h1>
          <p style={{
            margin: 0, fontSize: '0.82rem',
            color: colors.textMuted,
            fontFamily: font.mono, letterSpacing: '0.02em',
          }}>
            132 documents indexed · Hybrid retrieval active · All responses grounded
          </p>
        </div>

        {/* ── Command bar ── */}
        <div
          role="group"
          aria-label="Intelligence query input"
          style={{
            background: 'rgba(10,15,26,0.75)',
            border: `1px solid ${focused ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.08)'}`,
            borderRadius: '12px',
            backdropFilter: 'blur(20px)',
            boxShadow: focused
              ? '0 0 0 3px rgba(99,102,241,0.08), 0 16px 48px rgba(0,0,0,0.4)'
              : '0 8px 32px rgba(0,0,0,0.3)',
            transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
            overflow: 'hidden',
          }}
        >
          {/* Mode tab row */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '2px',
            padding: '8px 12px',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            background: 'rgba(255,255,255,0.01)',
          }}>
            {(['ask', 'deep', 'citation'] as const).map((m) => {
              const cfg = modeConfig[m]
              const active = mode === m
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  style={{
                    background:   active ? cfg.bg   : 'transparent',
                    border:       `1px solid ${active ? cfg.border : 'transparent'}`,
                    borderRadius: radius.md,
                    padding:      '3px 10px',
                    color:        active ? cfg.color : colors.textMuted,
                    fontSize:     '0.65rem',
                    fontWeight:   700,
                    cursor:       'pointer',
                    fontFamily:   font.mono,
                    textTransform:'uppercase',
                    letterSpacing:'0.06em',
                    transition:   'all 0.15s ease',
                    outline:      'none',
                    whiteSpace:   'nowrap',
                  }}
                >
                  {cfg.label}
                </button>
              )
            })}
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: '0.6rem', color: colors.textFaint, fontFamily: font.mono }}>
              Enter to send · Shift+Enter for newline
            </span>
          </div>

          {/* Textarea + send */}
          <div style={{ display: 'flex', alignItems: 'flex-end', padding: '14px 16px 14px' }}>
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={getPlaceholder()}
              rows={1}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#fff',
                fontSize: '0.95rem',
                lineHeight: 1.6,
                resize: 'none',
                fontFamily: font.sans,
                padding: '0',
                maxHeight: '140px',
              }}
            />
            <button
              type="button"
              onClick={() => value.trim() && onSubmit(value, mode)}
              disabled={!value.trim()}
              style={{
                background:   value.trim() ? activeMode.color : 'rgba(255,255,255,0.04)',
                border:       `1px solid ${value.trim() ? 'transparent' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: '8px',
                color:        value.trim() ? '#000' : colors.textFaint,
                width:        '34px',
                height:       '34px',
                display:      'flex',
                alignItems:   'center',
                justifyContent:'center',
                cursor:        value.trim() ? 'pointer' : 'default',
                transition:    'all 0.15s ease',
                flexShrink:    0,
                marginLeft:    '12px',
                fontWeight:    700,
              }}
            >
              <Icon icon="solar:arrow-up-linear" width={17} />
            </button>
          </div>
        </div>

        {/* ── Quick-fire suggestions ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.04)' }} />
            <span style={{ fontSize: '0.6rem', color: colors.textFaint, fontFamily: font.mono, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Quick Investigations
            </span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.04)' }} />
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px',
          }}>
            {SUGGESTED.map((s, i) => (
              <SuggestionChip
                key={i}
                icon={s.icon}
                label={s.label}
                query={s.query}
                onClick={() => onSubmit(s.query, 'ask')}
              />
            ))}
          </div>
        </div>

        {/* ── Capability cards ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
        }}>
          {CAPABILITIES.map((c, i) => (
            <CapabilityCard key={i} {...c} />
          ))}
        </div>

      </div>

      {/* Inject hover styles once */}
      <WelcomeStyleInjector />
    </div>
  )
}

/* ── Sub-components ─────────────────────────────────────────────────────── */

function SuggestionChip({ icon, label, query, onClick }: {
  icon: string; label: string; query: string; onClick: () => void
}) {
  return (
    <button
      type="button"
      className="welcome-chip"
      onClick={onClick}
      title={query}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '7px',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '8px',
        padding: '8px 12px',
        color: colors.textSecondary,
        fontSize: '0.72rem',
        fontWeight: 500,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.15s ease',
        fontFamily: font.sans,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
        width: '100%',
      }}
    >
      <Icon icon={icon} width={13} style={{ color: colors.textMuted, flexShrink: 0 }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </button>
  )
}

function CapabilityCard({ icon, title, desc, accent, accentBg }: {
  icon: string; title: string; desc: string; accent: string; accentBg: string
}) {
  return (
    <div
      className="welcome-cap-card"
      style={{
        padding: '14px 16px',
        background: accentBg,
        border: `1px solid ${accent}22`,
        borderRadius: '10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        transition: 'all 0.15s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
        <Icon icon={icon} width={15} style={{ color: accent, flexShrink: 0 }} />
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#fff', letterSpacing: '0.01em' }}>
          {title}
        </span>
      </div>
      <p style={{
        margin: 0,
        fontSize: '0.68rem',
        color: colors.textMuted,
        lineHeight: 1.5,
      }}>
        {desc}
      </p>
    </div>
  )
}

function WelcomeStyleInjector() {
  useEffect(() => {
    if (typeof document === 'undefined') return
    if (document.getElementById('welcome-state-styles')) return
    const el = document.createElement('style')
    el.id = 'welcome-state-styles'
    el.innerHTML = `
      .welcome-chip:hover {
        background: rgba(99,102,241,0.08) !important;
        border-color: rgba(99,102,241,0.25) !important;
        color: #fff !important;
      }
      .welcome-cap-card:hover {
        border-color: rgba(255,255,255,0.12) !important;
        transform: translateY(-1px);
      }
    `
    document.head.appendChild(el)
  }, [])
  return null
}
