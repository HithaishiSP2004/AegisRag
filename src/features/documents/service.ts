// =============================================================================
// Sprint 1: Document Service — server-side library
// All DB interactions go through this module.
// ⚠️  Do NOT add 'use server' here — this is a plain server-side library,
//     not a Server Action file. It is imported by actions.ts which carries
//     'use server'. Adding 'use server' here bans non-async exports (like
//     DOCUMENTS_BUCKET) and causes Next.js to strip all exports silently.
// =============================================================================

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { logAuditEvent } from './audit'
import { buildStoragePath, sanitiseFilename } from './validation'
import type {
  DocumentRecord,
  DocumentVersionRecord,
  DocumentUploadInput,
  DocumentListFilters,
  DocumentStatus,
} from './types'

/** Supabase Storage bucket name (must exist in project settings) */
export const DOCUMENTS_BUCKET = 'documents'

// ─────────────────────────────────────────────────────────────────────────────
// 1. GET AUTHENTICATED USER PROFILE
// ─────────────────────────────────────────────────────────────────────────────
export async function getAuthenticatedProfile() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { profile: null, error: 'Not authenticated' }
  }

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('id, org_id, role, department, is_active')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return { profile: null, error: 'User profile not found' }
  }

  if (!profile.is_active) {
    return { profile: null, error: 'User account is inactive' }
  }

  return { profile, error: null }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. GENERATE SIGNED UPLOAD URL
// Returns a pre-signed URL the client uses to upload directly to Storage.
// Avoids routing large files through the Next.js server.
// ─────────────────────────────────────────────────────────────────────────────
export async function generateUploadUrl(params: {
  orgId: string
  docType: string
  docId: string
  originalFilename: string
}): Promise<{ signedUrl: string | null; storagePath: string | null; error: string | null }> {
  const { orgId, docType, docId, originalFilename } = params
  const storagePath = buildStoragePath(orgId, docType, docId, originalFilename)

  console.log('[generateUploadUrl] ENTER:', { orgId, docType, docId, originalFilename, storagePath, bucket: DOCUMENTS_BUCKET })

  let admin: ReturnType<typeof createAdminClient>
  try {
    admin = createAdminClient()
    console.log('[generateUploadUrl] admin client created OK')
  } catch (adminEx: unknown) {
    console.error('[generateUploadUrl] FAILED — createAdminClient() threw:', {
      exception: adminEx,
      message:   adminEx instanceof Error ? adminEx.message : String(adminEx),
      stack:     adminEx instanceof Error ? adminEx.stack   : undefined,
    })
    return { signedUrl: null, storagePath: null, error: adminEx instanceof Error ? adminEx.message : 'createAdminClient threw' }
  }

  try {
    const { data, error } = await admin.storage
      .from(DOCUMENTS_BUCKET)
      .createSignedUploadUrl(storagePath)

    // ── Full error object dump ────────────────────────────────────────────────
    if (error) {
      console.error('[generateUploadUrl] storage.createSignedUploadUrl FAILED — full error object:', {
        message:    error.message,
        name:       (error as { name?: string }).name,
        status:     (error as { status?: number }).status,
        statusCode: (error as { statusCode?: number }).statusCode,
        error:      (error as { error?: string }).error,
        cause:      (error as { cause?: unknown }).cause,
        raw:        JSON.stringify(error),
        storagePath,
        bucket: DOCUMENTS_BUCKET,
      })
      return { signedUrl: null, storagePath: null, error: error.message }
    }

    if (!data?.signedUrl) {
      console.error('[generateUploadUrl] storage.createSignedUploadUrl returned no signedUrl — data:', JSON.stringify(data))
      return { signedUrl: null, storagePath: null, error: 'Failed to create upload URL — no signedUrl in response' }
    }

    console.log('[generateUploadUrl] OK — signedUrl obtained for storagePath:', storagePath)
    return { signedUrl: data.signedUrl, storagePath, error: null }
  } catch (storageEx: unknown) {
    console.error('[generateUploadUrl] storage.createSignedUploadUrl THREW EXCEPTION:', {
      exception: storageEx,
      message:   storageEx instanceof Error ? storageEx.message : String(storageEx),
      stack:     storageEx instanceof Error ? storageEx.stack   : undefined,
      storagePath,
      bucket: DOCUMENTS_BUCKET,
    })
    return { signedUrl: null, storagePath: null, error: storageEx instanceof Error ? storageEx.message : 'storage call threw' }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. REGISTER DOCUMENT IN DB (status = 'uploading')
// Called BEFORE the storage upload begins so we have a document row to
// reference in audit logs even if the upload fails.
// ─────────────────────────────────────────────────────────────────────────────
export async function registerDocument(
  input: DocumentUploadInput,
  orgId: string,
  uploadedBy: string,
  storagePath: string,
  docId: string
): Promise<{ document: DocumentRecord | null; error: string | null }> {
  const supabase = await createClient()
  const safe = sanitiseFilename(input.file.name)
  const extIndex = input.file.name.lastIndexOf('.')
  const originalExt = extIndex !== -1 ? input.file.name.substring(extIndex).toLowerCase() : ''
  const isAllowedExt = ['.pdf', '.docx', '.txt', '.md'].includes(originalExt)
  const safeExt = isAllowedExt ? originalExt : '.pdf'
  const filename = safe.endsWith(safeExt) ? safe : `${safe}${safeExt}`

  const insertPayload = {
    id:              docId,
    org_id:          orgId,
    uploaded_by:     uploadedBy,
    filename,
    original_name:   input.file.name,
    storage_path:    storagePath,
    file_size_bytes: input.file.size,
    page_count:      0,
    status:          'uploading' as import('./types').DocumentStatus,
    doc_type:        input.doc_type,
    department:      input.department,
    sensitivity:     input.sensitivity,
  }

  const { data, error } = await supabase
    .from('documents')
    .insert({
      ...insertPayload,
      metadata: {
        tags: input.tags ?? [],
        source_url: null,
        custom_fields: {},
      },
    })
    .select()
    .single()

  if (error) {
    console.error('[registerDocument] INSERT failed:', error.message)
    return { document: null, error: error.message }
  }

  if (!data) {
    console.error('[registerDocument] INSERT returned no data (silent RLS block)')
    return { document: null, error: 'Failed to register document — no data returned' }
  }

  console.log('[registerDocument] INSERT succeeded — doc id:', data.id)
  return { document: data as DocumentRecord, error: null }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. UPDATE DOCUMENT STATUS
// Used by the ingestion pipeline to advance status through the state machine.
// Service-role client bypasses RLS — only callable from server actions.
// ─────────────────────────────────────────────────────────────────────────────
export async function updateDocumentStatus(
  docId: string,
  status: DocumentStatus,
  extras?: {
    page_count?: number
    error_message?: string | null
  }
): Promise<{ error: string | null }> {
  const admin = createAdminClient()

  const { error } = await admin
    .from('documents')
    .update({
      status,
      ...(extras?.page_count !== undefined ? { page_count: extras.page_count } : {}),
      ...(extras?.error_message !== undefined ? { error_message: extras.error_message } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', docId)

  return { error: error?.message ?? null }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. MARK DOCUMENT FAILED
// Sets status to 'failed' with an error message.
// ─────────────────────────────────────────────────────────────────────────────
export async function markDocumentFailed(
  docId: string,
  reason: string
): Promise<{ error: string | null }> {
  return updateDocumentStatus(docId, 'failed', { error_message: reason })
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. CREATE DOCUMENT VERSION
// Inserts an immutable version record (document_versions table).
// ─────────────────────────────────────────────────────────────────────────────
export async function createDocumentVersion(params: {
  documentId: string
  versionNumber: number
  storagePath: string
  fileSizeBytes: number
  createdBy: string
  changeSummary?: string
}): Promise<{ version: DocumentVersionRecord | null; error: string | null }> {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('document_versions')
    .insert({
      document_id: params.documentId,
      version_number: params.versionNumber,
      storage_path: params.storagePath,
      file_size_bytes: params.fileSizeBytes,
      page_count: 0,
      change_summary: params.changeSummary ?? null,
      created_by: params.createdBy,
    })
    .select()
    .single()

  if (error || !data) {
    return { version: null, error: error?.message ?? 'Failed to create version record' }
  }

  return { version: data as DocumentVersionRecord, error: null }
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. GET DOCUMENT VERSION COUNT (to determine next version number)
// ─────────────────────────────────────────────────────────────────────────────
export async function getDocumentVersionCount(documentId: string): Promise<number> {
  const admin = createAdminClient()
  const { count } = await admin
    .from('document_versions')
    .select('*', { count: 'exact', head: true })
    .eq('document_id', documentId)

  return count ?? 0
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. LIST DOCUMENTS (org-scoped, RLS-enforced)
// ─────────────────────────────────────────────────────────────────────────────
export async function listDocuments(
  filters: DocumentListFilters = {}
): Promise<{ documents: DocumentRecord[]; error: string | null }> {
  const supabase = await createClient()

  let query = supabase
    .from('documents')
    .select('*')
    .neq('status', 'deleted')
    .order('created_at', { ascending: false })

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.doc_type) query = query.eq('doc_type', filters.doc_type)
  if (filters.department) query = query.eq('department', filters.department)
  if (filters.sensitivity) query = query.eq('sensitivity', filters.sensitivity)

  const { data, error } = await query

  if (error) {
    return { documents: [], error: error.message }
  }

  return { documents: (data ?? []) as DocumentRecord[], error: null }
}

// ─────────────────────────────────────────────────────────────────────────────
// 9. GET SINGLE DOCUMENT (org-scoped, RLS-enforced)
// ─────────────────────────────────────────────────────────────────────────────
export async function getDocument(
  docId: string
): Promise<{ document: DocumentRecord | null; error: string | null }> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', docId)
    .neq('status', 'deleted')
    .single()

  if (error || !data) {
    return { document: null, error: error?.message ?? 'Document not found' }
  }

  return { document: data as DocumentRecord, error: null }
}

// ─────────────────────────────────────────────────────────────────────────────
// 10. SOFT DELETE DOCUMENT (status → 'deleted', super_admin only)
// ─────────────────────────────────────────────────────────────────────────────
export async function softDeleteDocument(
  docId: string
): Promise<{ error: string | null }> {
  // 1. Get current authenticated user profile
  const { profile, error: profileError } = await getAuthenticatedProfile()
  if (profileError || !profile) {
    return { error: profileError ?? 'Not authenticated' }
  }

  // 2. Fetch the document using admin client to check ownership and tenant org
  const admin = createAdminClient()
  const { data: document, error: docError } = await admin
    .from('documents')
    .select('org_id, uploaded_by')
    .eq('id', docId)
    .single()

  if (docError || !document) {
    return { error: docError?.message ?? 'Document not found' }
  }

  // 3. Application-level authorization check:
  // Must be same organization
  if (document.org_id !== profile.org_id) {
    return { error: 'Access denied: document belongs to another organization' }
  }

  // Must be uploader or super_admin or compliance_officer
  const isOwner = document.uploaded_by === profile.id
  const isAuthorizedRole = ['super_admin', 'compliance_officer'].includes(profile.role)

  if (!isOwner && !isAuthorizedRole) {
    return { error: 'Access denied: you do not have permission to delete this document' }
  }

  // 4. Perform soft-delete using admin client (bypasses RLS)
  // Uses service-role client intentionally.
  // Soft-delete is an administrative operation.
  // User authorization is validated before this call.
  const { error: updateError } = await admin
    .from('documents')
    .update({
      status: 'deleted',
      updated_at: new Date().toISOString(),
    })
    .eq('id', docId)

  if (!updateError) {
    await logAuditEvent({
      orgId: profile.org_id,
      userId: profile.id,
      action: 'document.soft_delete',
      resourceType: 'document',
      resourceId: docId,
      newValue: { status: 'deleted' },
    })
  }

  return { error: updateError?.message ?? null }
}

// ─────────────────────────────────────────────────────────────────────────────
// 11. GET DOCUMENT VERSIONS
// ─────────────────────────────────────────────────────────────────────────────
export async function getDocumentVersions(
  documentId: string
): Promise<{ versions: DocumentVersionRecord[]; error: string | null }> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('document_versions')
    .select('*')
    .eq('document_id', documentId)
    .order('version_number', { ascending: false })

  if (error) {
    return { versions: [], error: error.message }
  }

  return { versions: (data ?? []) as DocumentVersionRecord[], error: null }
}

// ─────────────────────────────────────────────────────────────────────────────
// 12. GENERATE SIGNED DOWNLOAD URL (for viewing uploaded PDFs)
// ─────────────────────────────────────────────────────────────────────────────
export async function getDocumentDownloadUrl(
  storagePath: string,
  expiresInSeconds = 3600
): Promise<{ url: string | null; error: string | null }> {
  const admin = createAdminClient()

  const { data, error } = await admin.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds)

  if (error || !data) {
    return { url: null, error: error?.message ?? 'Failed to generate download URL' }
  }

  let url = data.signedUrl
  if (url && url.startsWith('http://')) {
    try {
      const parsed = new URL(url)
      if (parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1' && !parsed.hostname.startsWith('192.168.')) {
        url = url.replace(/^http:/i, 'https:')
      }
    } catch (e) {
      // Ignore URL parsing errors and keep original url
    }
  }

  return { url, error: null }
}
