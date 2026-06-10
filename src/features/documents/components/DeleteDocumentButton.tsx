'use client'

import { useState } from 'react'
import { Icon } from '@iconify/react'
import { deleteDocument } from '../actions'
import { useRouter } from 'next/navigation'

export function DeleteDocumentButton({ documentId }: { documentId: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!window.confirm('Are you sure you want to delete this document? This cannot be undone.')) {
      return
    }
    setLoading(true)
    try {
      const res = await deleteDocument(documentId)
      if (res.success) {
        router.refresh()
      } else {
        alert(`Failed to delete: ${res.error}`)
      }
    } catch (err) {
      alert(`Error deleting document: ${err}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      title="Delete Document"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '25px',
        height: '25px',
        boxSizing: 'border-box',
        background: 'rgba(244, 63, 94, 0.08)',
        border: '1px solid rgba(244, 63, 94, 0.25)',
        borderRadius: '6px',
        color: '#F43F5E',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'rgba(244, 63, 94, 0.18)'
        e.currentTarget.style.border = '1px solid rgba(244, 63, 94, 0.4)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'rgba(244, 63, 94, 0.08)'
        e.currentTarget.style.border = '1px solid rgba(244, 63, 94, 0.25)'
      }}
    >
      <Icon
        icon={loading ? 'solar:spinner-bold' : 'solar:trash-bin-trash-bold'}
        width={13}
        style={loading ? { animation: 'spin 1s linear infinite' } : {}}
      />
    </button>
  )
}
