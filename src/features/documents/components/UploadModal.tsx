'use client'
// =============================================================================
// Sprint 1: UploadModal — Liquid Glass modal wrapping the UploadDropzone
// Triggered from the Knowledge Vault page.
// =============================================================================

import { useState, useEffect } from 'react'
import { Icon } from '@iconify/react'
import { UploadDropzone } from './UploadDropzone'

interface UploadModalProps {
  isOpen: boolean
  onClose: () => void
  onUploadComplete?: (documentId: string) => void
  userRole?: string
  stats?: {
    total: number
    storageBytes: number
  }
  onRequestUpgrade?: () => void
}

export function UploadModal({ isOpen, onClose, onUploadComplete, userRole, stats, onRequestUpgrade }: UploadModalProps) {
  const [uploadedDocId, setUploadedDocId] = useState<string | null>(null)

  // Reset on close
  useEffect(() => {
    console.log('[UploadModal] isOpen changed:', isOpen)
    if (!isOpen) {
      Promise.resolve().then(() => {
        setUploadedDocId(null)
      })
    }
  }, [isOpen])

  console.log('[UploadModal] render — isOpen:', isOpen)
  if (!isOpen) return null
  console.log('[UploadModal] MOUNTING backdrop into DOM')

  const handleSuccess = (docId: string) => {
    setUploadedDocId(docId)
    onUploadComplete?.(docId)
  }

  const isTrial = userRole === 'trial_user'
  const isLimitReached = isTrial && stats && (stats.total >= 3 || stats.storageBytes >= 5 * 1024 * 1024)

  return (
    // Backdrop
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(8,12,20,0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      {/* Modal panel */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '560px',
          background: 'rgba(13,17,23,0.92)',
          backdropFilter: 'blur(32px)',
          WebkitBackdropFilter: 'blur(32px)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: '20px',
          overflow: 'hidden',
          boxShadow: '0 24px 80px rgba(0,0,0,0.60)',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px', height: '32px',
              background: 'rgba(59,130,246,0.15)',
              border: '1px solid rgba(59,130,246,0.30)',
              borderRadius: '10px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon icon="solar:cloud-upload-bold" width={16} style={{ color: '#3B82F6' }} />
            </div>
            <div>
              <h2 style={{ color: '#F8FAFC', fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>
                Upload Document
              </h2>
              <p style={{ color: '#475569', fontSize: '0.72rem', margin: 0 }}>
                PDF, DOCX, TXT, MD · Encrypted transit · Org-isolated
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: '8px',
              color: '#94A3B8',
              padding: '6px',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Icon icon="solar:close-bold" width={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px' }}>
          {isLimitReached ? (
            <QuotaExceededState stats={stats} onRequestUpgrade={onRequestUpgrade} onClose={onClose} />
          ) : uploadedDocId ? (
            <SuccessState documentId={uploadedDocId} onClose={onClose} />
          ) : (
            <UploadDropzone onUploadComplete={handleSuccess} />
          )}
        </div>

        {/* Ingestion Pipeline Flow */}
        <div style={{
          padding: '16px 24px',
          background: 'rgba(255,255,255,0.01)',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 600, color: '#475569', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Ingestion Pipeline Flow
          </span>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative', padding: '4px 0' }}>
            {/* Background connecting line */}
            <div style={{ position: 'absolute', top: '15px', left: '20px', right: '20px', height: '2px', background: 'rgba(255,255,255,0.04)', zIndex: 0 }} />
            
            {/* Steps */}
            {[
              { label: 'Upload', icon: 'solar:upload-bold-duotone', active: true },
              { label: 'OCR', icon: 'solar:scanner-bold-duotone', active: true },
              { label: 'Embedding', icon: 'solar:graph-bold-duotone', active: true },
              { label: 'Indexing', icon: 'solar:database-bold-duotone', active: true },
              { label: 'Ready', icon: 'solar:check-circle-bold-duotone', activeColor: '#10B981' }
            ].map((step, idx) => {
              const activeColor = step.activeColor ?? (step.active ? '#A78BFA' : undefined)
              return (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', zIndex: 1, position: 'relative', width: '70px' }}>
                  <div style={{
                    width: '24px', height: '24px',
                    borderRadius: '50%',
                    background: activeColor ? `${activeColor}12` : 'rgba(255, 255, 255, 0.02)',
                    border: `1px solid ${activeColor ? `${activeColor}33` : 'rgba(255, 255, 255, 0.08)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: activeColor ?? '#475569',
                    transition: 'all 0.3s ease',
                  }}>
                    <Icon icon={step.icon} width={12} />
                  </div>
                  <span style={{ fontSize: '0.62rem', fontWeight: 500, color: activeColor ?? '#475569' }}>
                    {step.label}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Security footer */}
        <div style={{
          padding: '12px 24px',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <Icon icon="solar:shield-check-bold" width={13} style={{ color: '#10B981' }} />
          <p style={{ color: '#334155', fontSize: '0.7rem' }}>
            Files are encrypted in transit and stored in your private organisation bucket.
            Access is enforced by Row Level Security.
          </p>
        </div>
      </div>
    </div>
  )
}

function SuccessState({ documentId, onClose }: { documentId: string; onClose: () => void }) {
  return (
    <div style={{ textAlign: 'center', padding: '24px 0' }}>
      <div style={{
        width: '56px', height: '56px',
        background: 'rgba(16,185,129,0.12)',
        border: '1px solid rgba(16,185,129,0.30)',
        borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 16px',
      }}>
        <Icon icon="solar:check-circle-bold" width={28} style={{ color: '#10B981' }} />
      </div>
      <h3 style={{ color: '#F8FAFC', fontWeight: 600, marginBottom: '8px' }}>
        Document uploaded successfully
      </h3>
      <p style={{ color: '#475569', fontSize: '0.825rem', marginBottom: '4px' }}>
        Queued for processing. Status will update automatically.
      </p>
      <p style={{
        color: '#334155',
        fontSize: '0.72rem',
        fontFamily: 'var(--font-jetbrains-mono)',
        marginBottom: '24px',
      }}>
        ID: {documentId}
      </p>
      <button
        onClick={onClose}
        style={{
          padding: '10px 28px',
          background: 'linear-gradient(135deg, #10B981, #059669)',
          border: 'none',
          borderRadius: '10px',
          color: '#fff',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Done
      </button>
    </div>
  )
}

function QuotaExceededState({ stats, onRequestUpgrade, onClose }: { stats?: any; onRequestUpgrade?: () => void; onClose: () => void }) {
  return (
    <div style={{ textAlign: 'center', padding: '24px 0' }}>
      <div style={{
        width: '56px', height: '56px',
        background: 'rgba(244,63,94,0.12)',
        border: '1px solid rgba(244,63,94,0.30)',
        borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 16px',
      }}>
        <Icon icon="solar:info-circle-bold" width={28} style={{ color: '#F43F5E' }} />
      </div>
      <h3 style={{ color: '#F8FAFC', fontWeight: 600, marginBottom: '8px' }}>
        Trial Limits Exceeded
      </h3>
      <p style={{ color: '#94A3B8', fontSize: '0.825rem', marginBottom: '20px', lineHeight: '1.5' }}>
        Trial users are limited to 3 documents and 5MB of storage.
        <br />
        You are currently using <strong>{stats?.total ?? 0}/3 documents</strong> ({((stats?.storageBytes ?? 0) / (1024 * 1024)).toFixed(2)}MB).
      </p>
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
        <button
          onClick={onClose}
          style={{
            padding: '10px 24px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: '10px',
            color: '#94A3B8',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          onClick={() => {
            onClose()
            onRequestUpgrade?.()
          }}
          style={{
            padding: '10px 24px',
            background: 'linear-gradient(135deg, #6366F1, #4F46E5)',
            border: 'none',
            borderRadius: '10px',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
          }}
        >
          Request Upgrade
        </button>
      </div>
    </div>
  )
}
