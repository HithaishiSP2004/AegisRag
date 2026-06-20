'use client'
// =============================================================================
// Sprint 1: UploadDropzone Component
// Liquid Glass design — drag-and-drop PDF upload with real progress.
// Uses HugeIcons for feature icons, Solar (Iconify) for status icons.
// =============================================================================

import { useCallback, useState, useRef } from 'react'
import { Icon } from '@iconify/react'
import { CloudUploadIcon, File01Icon, AlertCircleIcon } from 'hugeicons-react'
import { useDocumentUpload } from '../hooks/useDocumentUpload'
import { DOC_TYPE_LABELS, SENSITIVITY_LABELS } from '../types'
import type { DocumentUploadInput, DocumentType, SensitivityLevel, DocumentFramework, DocumentClassification } from '../types'

interface UploadDropzoneProps {
  onUploadComplete?: (documentId: string) => void
}

export function UploadDropzone({ onUploadComplete }: UploadDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [docType, setDocType] = useState<DocumentType>('other')
  const [sensitivity, setSensitivity] = useState<SensitivityLevel>('internal')
  const [department, setDepartment] = useState('')
  const [framework, setFramework] = useState<DocumentFramework | ''>('')
  const [classification, setClassification] = useState<DocumentClassification>('organization')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { progress, upload, reset } = useDocumentUpload({
    onSuccess: (docId) => {
      onUploadComplete?.(docId)
    },
  })

  const handleFile = useCallback((file: File) => {
    const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()
    const allowedExts = ['.pdf', '.docx', '.txt', '.md']
    const allowedMime = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/markdown',
      'text/x-markdown',
    ]
    if (!allowedExts.includes(fileExt) && !allowedMime.includes(file.type)) return
    setSelectedFile(file)
    reset()
  }, [reset])

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFile || progress.phase === 'uploading' || progress.phase === 'registering') return

    const input: DocumentUploadInput = {
      file: selectedFile,
      doc_type: docType,
      sensitivity,
      department: department.trim() || null,
      classification,
      framework: framework || null,
    }
    await upload(input)
  }

  const handleReset = () => {
    setSelectedFile(null)
    setFramework('')
    setClassification('organization')
    reset()
  }

  const isActive = progress.phase === 'uploading' || progress.phase === 'registering' || progress.phase === 'validating'

  return (
    <div style={{ width: '100%' }}>
      <form onSubmit={handleSubmit}>
        {/* ── Drop Zone ──────────────────────────────────────────────────── */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !selectedFile && fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${isDragOver ? 'rgba(59,130,246,0.60)' : selectedFile ? 'rgba(16,185,129,0.40)' : 'rgba(255,255,255,0.12)'}`,
            borderRadius: '16px',
            padding: '40px 32px',
            textAlign: 'center',
            cursor: selectedFile ? 'default' : 'pointer',
            background: isDragOver
              ? 'rgba(59,130,246,0.06)'
              : selectedFile
              ? 'rgba(16,185,129,0.04)'
              : 'rgba(255,255,255,0.02)',
            backdropFilter: 'blur(16px)',
            transition: 'all 0.2s ease',
            marginBottom: '20px',
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleFile(f)
            }}
          />

          {!selectedFile ? (
            <>
              <CloudUploadIcon
                size={40}
                style={{ color: 'rgba(59,130,246,0.70)', marginBottom: '12px' }}
              />
              <p style={{ color: '#F8FAFC', fontWeight: 600, marginBottom: '4px' }}>
                Drop a file here or click to browse
              </p>
              <p style={{ color: '#475569', fontSize: '0.8rem' }}>
                PDF, DOCX, TXT, MD · Maximum 50 MB
              </p>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center' }}>
              <File01Icon size={28} style={{ color: '#10B981', flexShrink: 0 }} />
              <div style={{ textAlign: 'left' }}>
                <p style={{ color: '#F8FAFC', fontWeight: 600, fontSize: '0.9rem' }}>
                  {selectedFile.name}
                </p>
                <p style={{ color: '#475569', fontSize: '0.75rem' }}>
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              {!isActive && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleReset() }}
                  style={{
                    marginLeft: 'auto',
                    background: 'rgba(244,63,94,0.15)',
                    border: '1px solid rgba(244,63,94,0.30)',
                    borderRadius: '8px',
                    color: '#F43F5E',
                    padding: '4px 10px',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                  }}
                >
                  Remove
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Metadata Fields ─────────────────────────────────────────────── */}
        {selectedFile && progress.phase === 'idle' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
            <div>
              <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.75rem', marginBottom: '6px', fontWeight: 500 }}>
                Document Type *
              </label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value as DocumentType)}
                style={selectStyle}
                disabled={isActive}
              >
                {(Object.entries(DOC_TYPE_LABELS) as [DocumentType, string][]).map(([val, label]) => (
                  <option key={val} value={val} style={{ background: '#0D1117', color: '#F8FAFC' }}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.75rem', marginBottom: '6px', fontWeight: 500 }}>
                Sensitivity *
              </label>
              <select
                value={sensitivity}
                onChange={(e) => setSensitivity(e.target.value as SensitivityLevel)}
                style={selectStyle}
                disabled={isActive}
              >
                {(Object.entries(SENSITIVITY_LABELS) as [SensitivityLevel, string][]).map(([val, label]) => (
                  <option key={val} value={val} style={{ background: '#0D1117', color: '#F8FAFC' }}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.75rem', marginBottom: '6px', fontWeight: 500 }}>
                Compliance Framework
              </label>
              <select
                value={framework}
                onChange={(e) => setFramework(e.target.value as DocumentFramework | '')}
                style={selectStyle}
                disabled={isActive}
              >
                <option value="" style={{ background: '#0D1117', color: '#F8FAFC' }}>None</option>
                <option value="SOC2" style={{ background: '#0D1117', color: '#F8FAFC' }}>SOC2</option>
                <option value="NIST" style={{ background: '#0D1117', color: '#F8FAFC' }}>NIST</option>
                <option value="NIST_CSF" style={{ background: '#0D1117', color: '#F8FAFC' }}>NIST_CSF</option>
                <option value="OWASP" style={{ background: '#0D1117', color: '#F8FAFC' }}>OWASP</option>
                <option value="ISO27001" style={{ background: '#0D1117', color: '#F8FAFC' }}>ISO27001</option>
                <option value="PCI_DSS" style={{ background: '#0D1117', color: '#F8FAFC' }}>PCI_DSS</option>
                <option value="HIPAA" style={{ background: '#0D1117', color: '#F8FAFC' }}>HIPAA</option>
                <option value="GDPR" style={{ background: '#0D1117', color: '#F8FAFC' }}>GDPR</option>
                <option value="RESEARCH" style={{ background: '#0D1117', color: '#F8FAFC' }}>RESEARCH</option>
                <option value="SECURITY" style={{ background: '#0D1117', color: '#F8FAFC' }}>SECURITY</option>
                <option value="CUSTOM" style={{ background: '#0D1117', color: '#F8FAFC' }}>CUSTOM</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.75rem', marginBottom: '6px', fontWeight: 500 }}>
                Classification *
              </label>
              <select
                value={classification}
                onChange={(e) => setClassification(e.target.value as DocumentClassification)}
                style={selectStyle}
                disabled={isActive}
              >
                <option value="organization" style={{ background: '#0D1117', color: '#F8FAFC' }}>Organization</option>
                <option value="department" style={{ background: '#0D1117', color: '#F8FAFC' }}>Department</option>
                <option value="team" style={{ background: '#0D1117', color: '#F8FAFC' }}>Team</option>
                <option value="personal" style={{ background: '#0D1117', color: '#F8FAFC' }}>Personal</option>
              </select>
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', color: '#94A3B8', fontSize: '0.75rem', marginBottom: '6px', fontWeight: 500 }}>
                Department (optional)
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. HR, Finance, Legal"
                style={{ ...selectStyle, paddingLeft: '12px' }}
                disabled={isActive}
                maxLength={100}
              />
            </div>
          </div>
        )}

        {/* ── Progress Bar ────────────────────────────────────────────────── */}
        {(isActive || progress.phase === 'complete') && (
          <ProgressBar progress={progress} />
        )}

        {/* ── Error State ─────────────────────────────────────────────────── */}
        {progress.phase === 'error' && progress.error && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            background: 'rgba(244,63,94,0.08)',
            border: '1px solid rgba(244,63,94,0.25)',
            borderRadius: '10px',
            padding: '12px 16px',
            marginBottom: '16px',
          }}>
            <AlertCircleIcon size={18} style={{ color: '#F43F5E', flexShrink: 0 }} />
            <p style={{ color: '#F43F5E', fontSize: '0.825rem' }}>{progress.error}</p>
          </div>
        )}

        {/* ── Submit Button ───────────────────────────────────────────────── */}
        {selectedFile && progress.phase === 'idle' && (
          <button type="submit" style={submitButtonStyle}>
            <Icon icon="solar:upload-bold" width={18} />
            Begin Secure Upload
          </button>
        )}

        {progress.phase === 'error' && (
          <button type="button" onClick={handleReset} style={retryButtonStyle}>
            <Icon icon="solar:refresh-bold" width={16} />
            Try Again
          </button>
        )}
      </form>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Progress bar sub-component
// ─────────────────────────────────────────────────────────────────────────────
function ProgressBar({ progress }: { progress: import('../types').UploadProgressState }) {
  const phaseLabel: Record<string, string> = {
    validating: 'Validating file…',
    registering: 'Registering document…',
    uploading: `Uploading — ${progress.storageProgress}%`,
    complete: 'Upload complete',
  }

  const label = phaseLabel[progress.phase] ?? ''

  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{ color: '#94A3B8', fontSize: '0.78rem' }}>{label}</span>
        {progress.phase === 'complete' && (
          <Icon icon="solar:check-circle-bold" style={{ color: '#10B981' }} width={18} />
        )}
      </div>
      <div style={{
        height: '6px',
        background: 'rgba(255,255,255,0.08)',
        borderRadius: '99px',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${progress.phase === 'complete' ? 100 : progress.storageProgress}%`,
          background: progress.phase === 'complete'
            ? 'linear-gradient(90deg, #10B981, #34D399)'
            : 'linear-gradient(90deg, #3B82F6, #6366F1)',
          borderRadius: '99px',
          transition: 'width 0.3s ease',
        }} />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared inline styles
// ─────────────────────────────────────────────────────────────────────────────
const selectStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: '10px',
  color: '#F8FAFC',
  padding: '9px 10px',
  fontSize: '0.875rem',
  outline: 'none',
  cursor: 'pointer',
}

const submitButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  width: '100%',
  padding: '12px 24px',
  background: 'linear-gradient(135deg, #3B82F6, #6366F1)',
  border: 'none',
  borderRadius: '12px',
  color: '#fff',
  fontWeight: 600,
  fontSize: '0.9rem',
  cursor: 'pointer',
  boxShadow: '0 0 24px rgba(59,130,246,0.25)',
  transition: 'opacity 0.2s ease',
}

const retryButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  width: '100%',
  padding: '10px 24px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '12px',
  color: '#94A3B8',
  fontWeight: 500,
  fontSize: '0.875rem',
  cursor: 'pointer',
}
