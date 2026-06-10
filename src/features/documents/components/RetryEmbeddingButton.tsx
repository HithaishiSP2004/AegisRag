'use client'
// =============================================================================
// RetryEmbeddingButton
// Shown when a document is in 'embedding_failed' status.
// POSTs to /api/documents/{id}/process which resets status → 'parsing'
// and re-runs the full pipeline (Sprint 1B: full re-run is simpler than
// a partial embedding-only resume).
// =============================================================================

import { useState } from 'react'
import { Icon } from '@iconify/react'

interface Props {
  documentId: string
  /** Called after a successful retry POST so the parent can refresh */
  onRetryStarted?: () => void
}

export function RetryEmbeddingButton({ documentId, onRetryStarted }: Props) {
  const [loading, setLoading]   = useState(false)
  const [error,   setError]     = useState<string | null>(null)
  const [done,    setDone]      = useState(false)

  const handleRetry = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/documents/${documentId}/process`, {
        method: 'POST',
      })

      const json = await res.json()

      if (!res.ok) {
        setError(json?.error ?? `Server error ${res.status}`)
      } else {
        setDone(true)
        onRetryStarted?.()
      }
    } catch (err) {
      setError('Network error — ' + String(err))
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <span style={{
        display:    'inline-flex',
        alignItems: 'center',
        gap:        '5px',
        fontSize:   '0.7rem',
        color:      '#A78BFA',
        fontWeight: 500,
      }}>
        <Icon icon="solar:refresh-bold" width={11} />
        Re-processing…
      </span>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
      <button
        id={`retry-embedding-btn-${documentId}`}
        type="button"
        disabled={loading}
        onClick={handleRetry}
        title="Re-run the embedding pipeline for this document"
        style={{
          display:    'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap:        '5px',
          padding:    '0 8px',
          height:     '25px',
          whiteSpace: 'nowrap',
          boxSizing:  'border-box',
          background: loading
            ? 'rgba(255,255,255,0.04)'
            : 'rgba(251,146,60,0.12)',
          border: loading
            ? '1px solid rgba(255,255,255,0.08)'
            : '1px solid rgba(251,146,60,0.35)',
          borderRadius: '6px',
          color:      loading ? '#475569' : '#FB923C',
          fontSize:   '0.7rem',
          fontWeight: 600,
          cursor:     loading ? 'not-allowed' : 'pointer',
          letterSpacing: '0.02em',
          transition: 'all 0.15s ease',
          opacity:    loading ? 0.6 : 1,
        }}
      >
        <Icon
          icon={loading ? 'solar:refresh-bold' : 'solar:restart-bold'}
          width={12}
          style={loading ? { animation: 'spin 1s linear infinite' } : {}}
        />
        {loading ? 'Queuing…' : 'Retry Embedding'}
      </button>

      {error && (
        <span style={{
          fontSize:     '0.65rem',
          color:        '#F43F5E',
          maxWidth:     '240px',
          wordBreak:    'break-all',
          textAlign:    'right',
          lineHeight:   1.4,
        }}>
          ❌ {error}
        </span>
      )}
    </div>
  )
}
