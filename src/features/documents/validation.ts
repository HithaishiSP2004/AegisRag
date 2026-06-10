// =============================================================================
// Sprint 1: Document Validation
// PDF-only, size constraints, filename sanitisation.
// All limits are enforced before any Supabase interaction.
// =============================================================================

import type { FileValidationResult } from './types'

/** Maximum PDF/document size: 50 MB (enforced here + Supabase storage policy) */
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024

/** Allowed file extensions */
export const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.txt', '.md'] as const

/** Allowed MIME types */
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'text/x-markdown',
] as const

/** Supabase storage max path segment length */
export const MAX_FILENAME_LENGTH = 255

/**
 * Sanitise an upload filename:
 * - Replace runs of non-alphanumeric chars (except dots/hyphens) with underscore
 * - Collapse multiple underscores
 * - Lowercase
 * - Trim leading/trailing underscores
 */
export function sanitiseFilename(original: string): string {
  const withoutPath = original.split(/[/\\]/).pop() ?? original
  return withoutPath
    .toLowerCase()
    .replace(/[^a-z0-9.\-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, MAX_FILENAME_LENGTH)
}

/**
 * Validate a File object before initiating the upload pipeline.
 * Returns {valid: true, error: null} on success.
 * Returns {valid: false, error: <human-readable message>} on failure.
 */
export function validateUploadFile(file: File): FileValidationResult {
  // 1. Extension and MIME type check
  const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()
  const isAllowedExt = ALLOWED_EXTENSIONS.includes(fileExt as any)
  const isAllowedMime = ALLOWED_MIME_TYPES.includes(file.type as any)

  if (!isAllowedExt && !isAllowedMime) {
    return {
      valid: false,
      error: `Unsupported file format. Allowed formats: PDF, DOCX, TXT, MD.`,
    }
  }

  // 2. Size check
  if (file.size === 0) {
    return { valid: false, error: 'File is empty.' }
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1)
    return {
      valid: false,
      error: `File is too large (${mb} MB). Maximum allowed size is 50 MB.`,
    }
  }

  // 3. Filename length
  if (file.name.length === 0) {
    return { valid: false, error: 'File has no name.' }
  }

  return { valid: true, error: null }
}

/**
 * Build the Supabase Storage object key.
 * Pattern: {org_id}/{doc_type}/{doc_id}/{sanitised_filename}
 * This structure enables org-level storage policies and efficient listing.
 */
export function buildStoragePath(
  orgId: string,
  docType: string,
  docId: string,
  originalFilename: string
): string {
  const safe = sanitiseFilename(originalFilename)
  const hasAllowedExt = ALLOWED_EXTENSIONS.some(ext => safe.endsWith(ext))
  if (hasAllowedExt) {
    return `${orgId}/${docType}/${docId}/${safe}`
  }
  // Fallback: extract extension from original filename and append it
  const dotIndex = originalFilename.lastIndexOf('.')
  const ext = dotIndex !== -1 ? originalFilename.substring(dotIndex).toLowerCase() : ''
  const safeExt = (ALLOWED_EXTENSIONS as unknown as string[]).includes(ext) ? ext : '.pdf'
  return `${orgId}/${docType}/${docId}/${safe}${safeExt}`
}

/**
 * Extract a MIME-type–based content-type header value for storage uploads.
 */
export function getContentType(filename: string): string {
  const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase()
  if (ext === '.pdf') return 'application/pdf'
  if (ext === '.docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (ext === '.txt') return 'text/plain'
  if (ext === '.md') return 'text/markdown'
  return 'application/octet-stream'
}
