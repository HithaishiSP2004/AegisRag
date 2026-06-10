'use client'
// =============================================================================
// ReprocessButton
// Allows administrators/users to manually trigger the full processing/re-indexing
// pipeline for a specific document from the Knowledge Vault.
// Sends POST /api/documents/{id}/process.
// =============================================================================

import { useState } from 'react'
import { Icon } from '@iconify/react'

export function ReprocessButton({ documentId }: { documentId: string }) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const handleReprocess = async () => {
    setLoading(true)
    setResult(null)
    console.log('[ReprocessButton] POSTing to /api/documents/' + documentId + '/process')

    try {
      const res = await fetch(`/api/documents/${documentId}/process?force=true`, {
        method: 'POST',
      })
      const json = await res.json()
      console.log('[ReprocessButton] Response status:', res.status)
      console.log('[ReprocessButton] Response body:', json)
      setResult(res.ok ? '✅ Re-indexed successfully' : '❌ Failed: ' + (json?.error ?? 'Unknown error'))
    } catch (err) {
      console.error('[ReprocessButton] Fetch error:', err)
      setResult('❌ Network error: ' + String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
      <button
        id={`reprocess-btn-${documentId}`}
        type="button"
        disabled={loading}
        onClick={handleReprocess}
        title="Re-run the full processing and indexing pipeline for this document"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '5px',
          padding: '0 8px',
          height: '25px',
          whiteSpace: 'nowrap',
          boxSizing: 'border-box',
          background: loading
            ? 'rgba(255,255,255,0.04)'
            : 'rgba(139,92,246,0.08)',
          border: loading
            ? '1px solid rgba(255,255,255,0.08)'
            : '1px solid rgba(139,92,246,0.25)',
          borderRadius: '6px',
          color: loading ? '#475569' : '#A78BFA',
          fontSize: '0.7rem',
          fontWeight: 600,
          cursor: loading ? 'not-allowed' : 'pointer',
          letterSpacing: '0.02em',
          transition: 'all 0.15s ease',
          opacity: loading ? 0.6 : 1,
        }}
        onMouseEnter={(e) => {
          if (!loading) {
            e.currentTarget.style.background = 'rgba(139,92,246,0.15)'
            e.currentTarget.style.border = '1px solid rgba(139,92,246,0.4)'
          }
        }}
        onMouseLeave={(e) => {
          if (!loading) {
            e.currentTarget.style.background = 'rgba(139,92,246,0.08)'
            e.currentTarget.style.border = '1px solid rgba(139,92,246,0.25)'
          }
        }}
      >
        <Icon
          icon={loading ? 'solar:refresh-bold' : 'solar:restart-bold'}
          width={11}
          style={loading ? { animation: 'spin 1s linear infinite' } : {}}
        />
        {loading ? 'Re-indexing…' : 'Re-index'}
      </button>

      {result && (
        <span style={{
          fontSize: '0.65rem',
          color: result.startsWith('✅') ? '#10B981' : '#F43F5E',
          maxWidth: '260px',
          wordBreak: 'break-all',
          textAlign: 'right',
          lineHeight: 1.4,
        }}>
          {result}
        </span>
      )}
    </div>
  )
}
