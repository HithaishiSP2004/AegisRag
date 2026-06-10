// =============================================================================
// Sprint 1: Feature barrel export
// Import from '@/features/documents' in page files.
// =============================================================================

// Types
export * from './types'

// Validation utilities
export { validateUploadFile, sanitiseFilename, buildStoragePath } from './validation'

// Server actions (Next.js 'use server')
export {
  initiateDocumentUpload,
  confirmDocumentUpload,
  failDocumentUpload,
  initiateVersionUpload,
} from './actions'

// Service (DB interactions)
export {
  listDocuments,
  getDocument,
  getDocumentVersions,
  getDocumentDownloadUrl,
  softDeleteDocument,
} from './service'

// Audit
export { logAuditEvent } from './audit'

// Client hooks
export { useDocumentUpload } from './hooks/useDocumentUpload'

// UI Components
export { UploadDropzone } from './components/UploadDropzone'
export { UploadModal } from './components/UploadModal'
export { DocumentStatusBadge } from './components/DocumentStatusBadge'
export { DocumentList } from './components/DocumentList'
