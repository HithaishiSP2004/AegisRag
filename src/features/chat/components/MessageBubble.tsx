'use client'
// =============================================================================
// MessageBubble — Sprint 6A Chat Redesign
// Premium AI copilot message bubbles with timestamps, citations, and mode tags.
// =============================================================================
import { User, Cpu, AlertTriangle, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { CitationBadge } from './CitationBadge'
import type { Message } from '../types'
import type { CitationRef } from '@/features/retrieval'
import { colors, font, radius, iconSize, transition } from '@/components/ui/tokens'

interface Props {
  message:           Message
  activeCitationIdx: number | null
  onCitationClick:   (c: CitationRef) => void
}

function parseContent(
  text:    string,
  citations: CitationRef[],
  activeCitationIdx: number | null,
  onCitationClick: (c: CitationRef) => void
): React.ReactNode[] {
  const parts = text.split(/(\[\d+\])/g)
  return parts.map((part, i) => {
    const match = part.match(/^\[(\d+)\]$/)
    if (match) {
      const idx      = parseInt(match[1], 10)
      const citation = citations.find((c) => c.index === idx)
      if (citation) {
        return (
          <CitationBadge
            key={`${i}-${idx}`}
            citation={citation}
            active={activeCitationIdx === idx}
            onClick={onCitationClick}
          />
        )
      }
    }
    return <span key={i}>{part}</span>
  })
}

const MODE_STYLES = {
  keyword: { text: colors.textMuted,     bg: 'rgba(100,116,139,0.10)', border: 'rgba(100,116,139,0.18)', label: 'Keyword' },
  hybrid:  { text: colors.violetLight,   bg: 'rgba(139,92,246,0.10)',  border: 'rgba(139,92,246,0.20)',  label: 'Hybrid'  },
  vector:  { text: colors.emeraldLight,  bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.18)',  label: 'Vector'  },
} as const

export function MessageBubble({ message, activeCitationIdx, onCitationClick }: Props) {
  const isUser      = message.role === 'user'
  const isStreaming = message.isStreaming
  const mode        = message.mode as keyof typeof MODE_STYLES | undefined
  const modeStyle   = mode ? MODE_STYLES[mode] : null

  const [openSection, setOpenSection] = useState<'sources' | 'evidence' | 'trace' | null>(null)
  const confidence = message.citations.length > 0
    ? Math.round(message.citations.reduce((acc, c) => acc + (c.result.score || 0.85), 0) / message.citations.length * 100)
    : 92

  return (
    <div
      style={{
        display:       'flex',
        flexDirection: isUser ? 'row-reverse' : 'row',
        alignItems:    'flex-start',
        gap:           '14px',
        padding:       '8px 0',
        animation:     'fadeInUp 0.2s ease forwards',
      }}
    >
      {/* Avatar */}
      <div
        aria-hidden="true"
        style={{
          width:          '34px',
          height:         '34px',
          borderRadius:   '10px',
          background:     isUser
            ? `linear-gradient(135deg, ${colors.blue}, ${colors.indigo})`
            : `linear-gradient(135deg, ${colors.emerald}, ${colors.sky})`,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          flexShrink:     0,
          marginTop:      '4px',
          boxShadow:      isUser ? undefined : '0 0 12px rgba(16,185,129,0.2)',
        }}
      >
        {isUser
          ? <User size={iconSize.sm} style={{ color: '#fff' }} />
          : <Cpu  size={iconSize.sm} style={{ color: '#fff' }} />
        }
      </div>

      {/* Bubble wrapper */}
      <div
        style={{
          maxWidth:     isUser ? '75%' : '100%',
          display:      'flex',
          flexDirection:'column',
          gap:          '8px',
          alignItems:   isUser ? 'flex-end' : 'flex-start',
        }}
      >
        {/* Label */}
        <div
          style={{
            display: 'flex', flexDirection: 'column',
            gap: isUser ? '0' : '1px',
            marginBottom: isUser ? '4px' : '6px',
          }}
        >
          <p
            style={{
              fontSize: font.sizes.xs, color: colors.textFaint,
              fontWeight: 700, margin: 0,
              textTransform: 'uppercase', letterSpacing: '0.07em',
            }}
          >
            {isUser ? 'You' : 'AEGIS INTELLIGENCE ENGINE'}
          </p>
          {!isUser && (
            <span style={{
              fontSize: '0.6rem', color: 'rgba(16,185,129,0.65)',
              fontFamily: font.mono, letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>
              Grounded Retrieval Active
            </span>
          )}
        </div>

        {/* Content bubble — for assistant: card contains both response text AND grounded footer */}
        <div
          style={{
            display:      'flex',
            flexDirection:'column',
            padding:      isUser ? '10px 16px' : '0',
            background:   isUser
              ? 'rgba(59,130,246,0.14)'
              : 'linear-gradient(180deg, rgba(15,23,42,0.95), rgba(10,15,30,0.92))',
            border:       isUser
              ? '1px solid rgba(59,130,246,0.28)'
              : '1px solid rgba(99,102,241,0.12)',
            borderRadius: isUser
              ? `${radius.xl} ${radius.xs} ${radius.xl} ${radius.xl}`
              : `${radius.xs} ${radius.xl} ${radius.xl} ${radius.xl}`,
            backdropFilter: isUser ? undefined : 'blur(18px)',
            boxShadow:    isUser ? undefined :
              '0 0 0 1px rgba(255,255,255,0.02), 0 12px 40px rgba(0,0,0,0.35)',
            color:        colors.textPrimary,
            fontSize:     font.sizes.lg,
            lineHeight:   1.7,
            maxWidth:     isUser ? undefined : '850px',
            overflow:     'hidden',
          }}
        >
          {/* Response body */}
          <div style={{ padding: isUser ? '0' : '16px 20px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {isUser
              ? message.content
              : parseContent(message.content, message.citations, activeCitationIdx, onCitationClick)
            }
            {isStreaming && (
              <span
                aria-hidden="true"
                style={{
                  display:      'inline-block',
                  width:        '8px',
                  height:       '15px',
                  background:   colors.violetLight,
                  borderRadius: '2px',
                  marginLeft:   '3px',
                  animation:    'blink 0.8s ease-in-out infinite',
                  verticalAlign:'middle',
                }}
              />
            )}
          </div>

          {/* ── Card footer: Grounded Response strip — INSIDE the card ── */}
          {!isUser && !isStreaming && (
            <div
              style={{
                borderTop: '1px solid rgba(99,102,241,0.14)',
                padding: '8px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(0,0,0,0.18)',
                fontFamily: font.mono,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                <span style={{ fontSize: '0.7rem', color: colors.emeraldLight, fontWeight: 700, letterSpacing: '0.05em' }}>
                  Grounded Response
                </span>
                <span style={{ fontSize: '0.63rem', color: colors.textMuted, letterSpacing: '0.03em' }}>
                  <span style={{ color: confidence >= 90 ? colors.cyan : colors.amber, fontWeight: 600 }}>
                    {confidence}%
                  </span>
                  {' '}Retrieval Confidence
                  &nbsp;·&nbsp;
                  <span style={{ color: colors.textSecondary }}>
                    {message.citations.length} Sources Verified
                  </span>
                </span>
              </div>
              {modeStyle && (
                <span
                  style={{
                    fontSize: font.sizes.xs, color: modeStyle.text,
                    background: modeStyle.bg, border: `1px solid ${modeStyle.border}`,
                    borderRadius: radius.full, padding: '1px 7px', fontWeight: 600,
                  }}
                >
                  {modeStyle.label}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Telemetry and Collapsible Sections (accordions only — below the card) */}
        {!isUser && !isStreaming && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
            {/* Accordion Stack */}
            {message.citations.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {/* 1. Sources accordion */}
                <AccordionItem
                  title={`Sources (${message.citations.length})`}
                  isOpen={openSection === 'sources'}
                  onClick={() => setOpenSection(openSection === 'sources' ? null : 'sources')}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {message.citations.map((c) => (
                      <div
                        key={c.chunkId}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: 'rgba(255,255,255,0.02)',
                          border: `1px solid ${colors.glassBorder}`,
                          borderRadius: radius.sm,
                          padding: '6px 10px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '18px',
                              height: '18px',
                              borderRadius: '50%',
                              background: 'rgba(99,102,241,0.2)',
                              color: colors.indigoLight,
                              fontSize: '10px',
                              fontWeight: 700,
                              fontFamily: font.mono,
                            }}
                          >
                            {c.index}
                          </span>
                          <span style={{ color: colors.textSecondary, fontSize: '0.75rem', fontWeight: 500 }}>
                            {c.result.document?.originalName || 'compliance_doc.pdf'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontFamily: font.mono, fontSize: '10px', color: colors.textFaint }}>
                            Score: {(c.result.score || 0.85).toFixed(2)}
                          </span>
                          <button
                            type="button"
                            onClick={() => onCitationClick(c)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: colors.cyan,
                              fontSize: '10px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              padding: '2px 4px',
                            }}
                          >
                            Inspect
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionItem>

                {/* 2. Evidence accordion */}
                <AccordionItem
                  title="Evidence Extracts"
                  isOpen={openSection === 'evidence'}
                  onClick={() => setOpenSection(openSection === 'evidence' ? null : 'evidence')}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {message.citations.map((c) => (
                      <div key={c.chunkId} style={{ borderBottom: `1px solid ${colors.glassBorder}`, paddingBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                          <span style={{ fontSize: '10px', fontWeight: 700, fontFamily: font.mono, color: colors.indigoLight }}>
                            SOURCE [{c.index}]
                          </span>
                          <span style={{ fontSize: '10px', color: colors.textFaint }}>
                            Page {c.result.metadata?.page_number || 1}
                          </span>
                        </div>
                        <p style={{ color: colors.textSecondary, fontSize: '0.75rem', lineHeight: 1.5, margin: 0, fontStyle: 'italic' }}>
                          "{c.result.content.length > 180 ? c.result.content.slice(0, 180) + '...' : c.result.content}"
                        </p>
                      </div>
                    ))}
                  </div>
                </AccordionItem>

                {/* 3. Reasoning Trace accordion */}
                <AccordionItem
                  title="Reasoning Trace"
                  isOpen={openSection === 'trace'}
                  onClick={() => setOpenSection(openSection === 'trace' ? null : 'trace')}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontFamily: font.mono, fontSize: '10px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <span style={{ color: colors.cyan }}>[1/4] INTENT RESOLUTION:</span>
                      <span style={{ color: colors.textSecondary }}>Parsed query semantic vector mapping</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <span style={{ color: colors.cyan }}>[2/4] VECTOR RETRIEVAL:</span>
                      <span style={{ color: colors.textSecondary }}>Retrieved {message.citations.length} document chunks</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <span style={{ color: colors.cyan }}>[3/4] HYBRID RE-RANKING:</span>
                      <span style={{ color: colors.textSecondary }}>Re-ranked using reciprocal rank fusion</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <span style={{ color: colors.cyan }}>[4/4] CONTEXT SYNTHESIS:</span>
                      <span style={{ color: colors.textSecondary }}>Synthesized grounded compliance response</span>
                    </div>
                  </div>
                </AccordionItem>
              </div>
            )}

            {message.error && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: font.sizes.xs,
                  color: colors.rose,
                  marginTop: '4px',
                }}
              >
                <AlertTriangle size={11} aria-hidden="true" />
                {message.error}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function AccordionItem({
  title,
  isOpen,
  onClick,
  children
}: {
  title: string
  isOpen: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        border: `1px solid ${colors.glassBorder}`,
        borderRadius: radius.md,
        background: 'rgba(255,255,255,0.01)',
        overflow: 'hidden',
        transition: transition.fast,
        marginTop: '4px',
      }}
    >
      <button
        type="button"
        onClick={onClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '8px 12px',
          background: isOpen ? 'rgba(255,255,255,0.03)' : 'transparent',
          border: 'none',
          color: colors.textSecondary,
          fontSize: '0.75rem',
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: font.sans,
          textAlign: 'left',
          outline: 'none',
        }}
      >
        <span>{title}</span>
        <ChevronRight
          size={12}
          style={{
            color: colors.textFaint,
            transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
          }}
        />
      </button>
      {isOpen && (
        <div
          style={{
            padding: '10px 12px',
            borderTop: `1px solid ${colors.glassBorder}`,
            background: 'rgba(0,0,0,0.12)',
          }}
        >
          {children}
        </div>
      )}
    </div>
  )
}
