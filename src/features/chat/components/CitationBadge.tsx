'use client'
// Inline [N] superscript badge — clicking opens the citation panel
import type { CitationRef } from '@/features/retrieval'

interface Props {
  citation: CitationRef
  onClick:  (citation: CitationRef) => void
  active:   boolean
}

export function CitationBadge({ citation, onClick, active }: Props) {
  return (
    <button
      id={`citation-badge-${citation.chunkId}`}
      type="button"
      onClick={() => onClick(citation)}
      title={`Source: ${citation.result.document.originalName}`}
      style={{
        display:        'inline-flex',
        alignItems:     'center',
        justifyContent: 'center',
        width:          '18px',
        height:         '18px',
        borderRadius:   '4px',
        background:     active
          ? 'rgba(139,92,246,0.30)'
          : 'rgba(139,92,246,0.14)',
        border:         active
          ? '1px solid rgba(139,92,246,0.60)'
          : '1px solid rgba(139,92,246,0.30)',
        color:          '#A78BFA',
        fontSize:       '0.65rem',
        fontWeight:     700,
        cursor:         'pointer',
        verticalAlign:  'super',
        lineHeight:     1,
        marginLeft:     '1px',
        marginRight:    '1px',
        transition:     'all 0.12s ease',
        flexShrink:     0,
      }}
    >
      {citation.index}
    </button>
  )
}
