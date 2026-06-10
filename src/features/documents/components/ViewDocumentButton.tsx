'use client'

import { useState } from 'react'
import { Icon } from '@iconify/react'
import { getDocumentViewUrl } from '../actions'

export function ViewDocumentButton({ documentId }: { documentId: string }) {
  const [loading, setLoading] = useState(false)

  const handleView = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setLoading(true)
    try {
      const res = await getDocumentViewUrl(documentId)
      if (res.url) {
        let downloadUrl = res.url
        if (typeof window !== 'undefined' && window.location.protocol === 'https:' && downloadUrl.startsWith('http://')) {
          downloadUrl = downloadUrl.replace('http://', 'https://')
        }
        window.open(downloadUrl, '_blank')
      } else {
        alert(`Failed to view document: ${res.error}`)
      }
    } catch (err) {
      alert(`Error loading view URL: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleView}
      disabled={loading}
      title="View PDF"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '25px',
        height: '25px',
        boxSizing: 'border-box',
        background: 'rgba(59, 130, 246, 0.08)',
        border: '1px solid rgba(59, 130, 246, 0.25)',
        borderRadius: '6px',
        color: '#3B82F6',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(59, 130, 246, 0.18)'
        e.currentTarget.style.border = '1px solid rgba(59, 130, 246, 0.4)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(59, 130, 246, 0.08)'
        e.currentTarget.style.border = '1px solid rgba(59, 130, 246, 0.25)'
      }}
    >
      <Icon
        icon={loading ? 'solar:spinner-bold' : 'solar:eye-bold'}
        width={13}
        style={loading ? { animation: 'spin 1s linear infinite' } : {}}
      />
    </button>
  )
}
