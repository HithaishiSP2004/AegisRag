// =============================================================================
// Sprint 1: Document Ingestion — Domain Types
// These mirror the DB schema exactly. Never invent new field names.
// =============================================================================

export type DocumentStatus =
  | 'uploading'
  | 'parsing'
  | 'chunking'
  | 'embedding'
  | 'indexed'
  | 'embedding_failed'
  | 'failed'
  | 'deleted'

export type DocumentType =
  | 'hr_policy'
  | 'security_policy'
  | 'compliance_manual'
  | 'legal'
  | 'vendor'
  | 'regulatory'
  | 'other'

export type SensitivityLevel = 'public' | 'internal' | 'confidential' | 'restricted'

// ── Upload form payload (from the UI) ────────────────────────────────────────
export interface DocumentUploadInput {
  file: File
  doc_type: DocumentType
  sensitivity: SensitivityLevel
  department: string | null
  /** Custom metadata tags the user can provide */
  tags?: string[]
}

// ── Document record as returned by the DB ───────────────────────────────────
export interface DocumentRecord {
  id: string
  org_id: string
  uploaded_by: string
  filename: string
  original_name: string
  storage_path: string
  file_size_bytes: number
  page_count: number
  status: DocumentStatus
  doc_type: DocumentType
  department: string | null
  sensitivity: SensitivityLevel
  metadata: Record<string, unknown>
  error_message: string | null
  created_at: string
  updated_at: string
}

// ── Document version record ──────────────────────────────────────────────────
export interface DocumentVersionRecord {
  id: string
  document_id: string
  version_number: number
  storage_path: string
  file_size_bytes: number
  page_count: number
  change_summary: string | null
  created_by: string
  created_at: string
}

// ── Upload progress state (tracked client-side) ──────────────────────────────
export interface UploadProgressState {
  /** 0–100 for the storage upload phase */
  storageProgress: number
  /** Current pipeline phase */
  phase: 'idle' | 'validating' | 'uploading' | 'registering' | 'complete' | 'error'
  /** Document ID once registered in DB */
  documentId: string | null
  /** Human-readable error if phase === 'error' */
  error: string | null
}

// ── Validation result ────────────────────────────────────────────────────────
export interface FileValidationResult {
  valid: boolean
  error: string | null
}

// ── Storage path structure: {org_id}/{doc_type}/{uuid}/{filename} ─────────────
export interface StoragePathParts {
  orgId: string
  docType: DocumentType
  docId: string
  filename: string
}

// ── Document list query filters ──────────────────────────────────────────────
export interface DocumentListFilters {
  status?: DocumentStatus
  doc_type?: DocumentType
  department?: string
  sensitivity?: SensitivityLevel
  search?: string
}

// ── Document label maps for UI rendering ────────────────────────────────────
export const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  hr_policy: 'HR Policy',
  security_policy: 'Security Policy',
  compliance_manual: 'Compliance Manual',
  legal: 'Legal',
  vendor: 'Vendor',
  regulatory: 'Regulatory',
  other: 'Other',
}

export const SENSITIVITY_LABELS: Record<SensitivityLevel, string> = {
  public: 'Public',
  internal: 'Internal',
  confidential: 'Confidential',
  restricted: 'Restricted',
}

export const STATUS_LABELS: Record<DocumentStatus, string> = {
  uploading:        'Uploading',
  parsing:          'Parsing',
  chunking:         'Chunking',
  embedding:        'Embedding',
  indexed:          'Indexed',
  embedding_failed: 'Embedding Failed',
  failed:           'Failed',
  deleted:          'Deleted',
}

// ── Roles allowed to upload documents (mirrors DB policy) ───────────────────
export const UPLOAD_ALLOWED_ROLES = ['super_admin', 'compliance_officer'] as const
export type UploadAllowedRole = (typeof UPLOAD_ALLOWED_ROLES)[number]
