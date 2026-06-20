// =============================================================================
// Sprint 1: DocumentList — Server Component
// Fetches and renders documents for the current org.
// RLS on the documents table ensures org isolation automatically.
// =============================================================================

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { DocumentStatusBadge } from './DocumentStatusBadge'
import { ReprocessButton } from './ReprocessButton'
import { RetryEmbeddingButton } from './RetryEmbeddingButton'
import { DeleteDocumentButton } from './DeleteDocumentButton'
import { ViewDocumentButton } from './ViewDocumentButton'
import { Icon } from '@iconify/react'
import { formatBytes } from '@/lib/utils'
import type { DocumentRecord, DocumentType, SensitivityLevel } from '../types'
import { DOC_TYPE_LABELS, SENSITIVITY_LABELS } from '../types'

const SENSITIVITY_COLOR: Record<string, string> = {
  public: '#10B981',
  internal: '#3B82F6',
  confidential: '#F59E0B',
  restricted: '#F43F5E',
}

interface DocumentListProps {
  department?: string
  docType?: DocumentType
  sensitivity?: SensitivityLevel
  search?: string
}

export async function DocumentList({ department, docType, sensitivity, search }: DocumentListProps = {}) {
  const supabase = await createClient()

  let query = supabase
    .from('documents')
    .select('*')
    .neq('status', 'deleted')

  if (department) {
    query = query.eq('department', department)
  }
  if (docType) {
    query = query.eq('doc_type', docType)
  }
  if (sensitivity) {
    query = query.eq('sensitivity', sensitivity)
  }
  if (search) {
    query = query.ilike('original_name', `%${search}%`)
  }

  const { data: documents, error } = await query
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    return (
      <div style={{
        padding: '20px',
        background: 'rgba(244,63,94,0.06)',
        border: '1px solid rgba(244,63,94,0.20)',
        borderRadius: '12px',
        color: '#F43F5E',
        fontSize: '0.875rem',
      }}>
        Failed to load documents: {error.message}
      </div>
    )
  }

  // Fetch queue jobs for loaded documents (using admin client to bypass RLS)
  const docIds = documents?.map(d => d.id) || []
  const jobsMap = new Map<string, any>()
  if (docIds.length > 0) {
    const admin = createAdminClient()
    const { data: jobs } = await (admin as any)
      .from('embedding_jobs')
      .select('document_id, status, total_chunks, processed_chunks')
      .in('document_id', docIds)
      .order('created_at', { ascending: false })

    if (jobs) {
      for (const job of jobs) {
        if (!jobsMap.has(job.document_id)) {
          jobsMap.set(job.document_id, job)
        }
      }
    }
  }

  const isFiltered = !!(department || docType || sensitivity || search)

  if (!documents || documents.length === 0) {
    return (
      <div style={{
        padding: '48px 24px',
        textAlign: 'center',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '16px',
      }}>
        <Icon icon={isFiltered ? "solar:filter-bold" : "solar:folder-open-bold"} width={40} style={{ color: 'rgba(255,255,255,0.15)', marginBottom: '12px' }} />
        <p style={{ color: '#475569', fontSize: '0.875rem' }}>
          {isFiltered ? 'No documents match the active filters.' : 'No documents uploaded yet.'}
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '12px 16px 16px' }}>
      {/* Rows */}
      {(documents as DocumentRecord[]).map((doc) => (
        <DocumentRow key={doc.id} doc={doc} job={jobsMap.get(doc.id)} />
      ))}
    </div>
  )
}

function DocumentRow({ doc, job }: { doc: DocumentRecord; job?: any }) {
  const sensitivityColor = SENSITIVITY_COLOR[doc.sensitivity] ?? '#94A3B8'
  const createdDate = new Date(doc.created_at).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  })

  const docTypeLabel = DOC_TYPE_LABELS[doc.doc_type]
  const deptPart = doc.department ? `${doc.department} • ` : ''
  const pagesPart = `${doc.page_count || 0} Page${doc.page_count !== 1 ? 's' : ''}`
  const sizePart = formatBytes(doc.file_size_bytes)
  const metadataLine = `${deptPart}${docTypeLabel} • ${pagesPart} • ${sizePart} • ${createdDate}`

  return (
    <div
      className="document-row"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        background: 'rgba(255,255,255,0.01)',
        border: '1px solid rgba(255,255,255,0.04)',
        borderRadius: '8px',
        position: 'relative',
        gap: '16px',
      }}
    >
      {/* Left side: Icon, Name and Metadata Line */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
        <div className="doc-icon" style={{
          width: '28px', height: '28px', flexShrink: 0,
          background: 'rgba(59,130,246,0.06)',
          border: '1px solid rgba(59,130,246,0.15)',
          borderRadius: '6px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.2s',
        }}>
          <Icon icon="solar:document-bold" width={14} style={{ color: '#3B82F6' }} />
        </div>

        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{
            color: '#F8FAFC',
            fontWeight: 500,
            fontSize: '0.82rem',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            margin: 0,
            lineHeight: '1.25',
          }} title={doc.original_name}>
            {doc.original_name}
          </p>
          <p style={{ color: '#475569', fontSize: '0.7rem', margin: '2px 0 0 0', lineHeight: '1.2' }}>
            {metadataLine}
          </p>
          {job && (doc.status === 'queued' || doc.status === 'processing' || doc.status === 'waiting_provider') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
              <div style={{ width: '120px', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.min(100, Math.round((job.processed_chunks / (job.total_chunks || 1)) * 100))}%`,
                  height: '100%',
                  background: doc.status === 'processing'
                    ? 'linear-gradient(90deg, #A78BFA, #3B82F6)'
                    : doc.status === 'waiting_provider'
                    ? 'linear-gradient(90deg, #F59E0B, #D97706)'
                    : 'rgba(148,163,184,0.3)',
                  borderRadius: '2px',
                  transition: 'width 0.3s ease'
                }} />
              </div>
              <span style={{ fontSize: '0.62rem', color: '#64748B', fontFamily: 'var(--font-jetbrains-mono, monospace)' }}>
                {job.processed_chunks}/{job.total_chunks} ({Math.round((job.processed_chunks / (job.total_chunks || 1)) * 100)}%)
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Right side: Status chip & Hover actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', position: 'relative', height: '100%', flexShrink: 0 }}>
        {/* Normal Content */}
        <div className="row-normal-content" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontSize: '0.62rem',
            fontWeight: 700,
            color: sensitivityColor,
            background: `${sensitivityColor}12`,
            border: `1px solid ${sensitivityColor}25`,
            borderRadius: '4px',
            padding: '1px 6px',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}>
            {SENSITIVITY_LABELS[doc.sensitivity]}
          </span>
          <DocumentStatusBadge status={doc.status} size="sm" />
        </div>

        {/* Hover Actions */}
        <div className="row-hover-actions" style={{
          position: 'absolute',
          right: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}>
          <ViewDocumentButton documentId={doc.id} />
          {doc.status === 'embedding_failed' ? (
            <RetryEmbeddingButton documentId={doc.id} />
          ) : (
            <ReprocessButton documentId={doc.id} />
          ) }
          <DeleteDocumentButton documentId={doc.id} />
        </div>
      </div>
    </div>
  )
}


