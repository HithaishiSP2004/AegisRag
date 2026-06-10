'use client'
// Single source citation card shown inside the CitationPanel
import { Icon } from '@iconify/react'
import type { CitationRef } from '@/features/retrieval'
import { ChamferedShard } from '@/components/ui'
import { colors } from '@/components/ui/tokens'

const SENSITIVITY_COLOR: Record<string, string> = {
  public:       '#10B981',
  internal:     '#3B82F6',
  confidential: '#F59E0B',
  restricted:   '#F43F5E',
}

interface Props {
  citation: CitationRef
  isActive: boolean
}

export function SourceCard({ citation, isActive }: Props) {
  const { result } = citation
  const sentColor = SENSITIVITY_COLOR[result.document.sensitivity] ?? '#94A3B8'

  // Trim excerpt to ~280 chars with ellipsis
  const excerpt = result.content.length > 280
    ? result.content.slice(0, 280).trimEnd() + '…'
    : result.content

  return (
    <ChamferedShard
      variant={isActive ? 'cognitive' : 'default'}
      noPad={true}
      style={{
        transition:   'all 0.15s ease',
      }}
    >
      <div style={{ padding: '14px 16px' }}>
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
          {/* Citation index bubble */}
          <span style={{
            display:        'inline-flex',
            alignItems:     'center',
            justifyContent: 'center',
            width:          '22px',
            height:         '22px',
            flexShrink:     0,
            borderRadius:   '6px',
            background:     isActive ? 'rgba(34,211,238,0.2)' : 'rgba(139,92,246,0.18)',
            border:         isActive ? '1px solid rgba(34,211,238,0.45)' : '1px solid rgba(139,92,246,0.35)',
            color:          isActive ? colors.cyan : '#A78BFA',
            fontSize:       '0.7rem',
            fontWeight:     700,
          }}>
            {citation.index}
          </span>

          {/* Doc name */}
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{
              color:        isActive ? '#ffffff' : '#E2E8F0',
              fontSize:     '0.8rem',
              fontWeight:   600,
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
              margin:       0,
            }}>
              {result.document.originalName}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px', flexWrap: 'wrap' }}>
              <span style={{ color: isActive ? 'rgba(255,255,255,0.7)' : '#64748B', fontSize: '0.7rem' }}>
                Page {result.metadata.page_number}
              </span>
              <span style={{ color: isActive ? 'rgba(255,255,255,0.3)' : '#334155', fontSize: '0.7rem' }}>·</span>
              <span style={{
                fontSize:    '0.68rem',
                fontWeight:  600,
                color:       sentColor,
                background:  `${sentColor}15`,
                border:      `1px solid ${sentColor}28`,
                borderRadius:'99px',
                padding:     '1px 6px',
                textTransform:'uppercase',
                letterSpacing:'0.04em',
              }}>
                {result.document.sensitivity}
              </span>
              <span style={{ color: isActive ? 'rgba(255,255,255,0.3)' : '#334155', fontSize: '0.7rem' }}>·</span>
              <span style={{
                fontSize:  '0.7rem',
                color:     isActive ? '#22D3EE' : '#A78BFA',
                background: isActive ? 'rgba(34,211,238,0.1)' : 'rgba(139,92,246,0.08)',
                border:    isActive ? '1px solid rgba(34,211,238,0.22)' : '1px solid rgba(139,92,246,0.18)',
                borderRadius:'6px',
                padding:   '1px 6px',
              }}>
                {(result.score * 100).toFixed(0)}% match
              </span>
              {result.mode === 'keyword' && (
                <>
                  <span style={{ color: isActive ? 'rgba(255,255,255,0.3)' : '#334155', fontSize: '0.7rem' }}>·</span>
                  <span style={{ fontSize: '0.68rem', color: isActive ? 'rgba(255,255,255,0.8)' : '#64748B' }}>keyword</span>
                </>
              )}
            </div>
          </div>

          <Icon
            icon="solar:document-text-bold"
            width={16}
            style={{ color: isActive ? colors.cyan : '#334155', flexShrink: 0 }}
          />
        </div>

        {/* Excerpt */}
        <p style={{
          color:      isActive ? '#E2E8F0' : '#8892B0',
          fontSize:   '0.78rem',
          lineHeight: 1.6,
          margin:     0,
          fontFamily: 'var(--font-jetbrains-mono, monospace)',
          background: isActive ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.15)',
          borderRadius:'8px',
          padding:    '10px 12px',
          borderLeft: `2px solid ${isActive ? '#22D3EE' : 'rgba(139,92,246,0.25)'}`,
        }}>
          {excerpt}
        </p>
      </div>
    </ChamferedShard>
  )
}
