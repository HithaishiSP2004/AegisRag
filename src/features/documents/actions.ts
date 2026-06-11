// =============================================================================
// Sprint 1: Upload Orchestrator — Server Action
// This is the single entry point for the complete upload pipeline.
// Sequence:
//   1. Authenticate + check role
//   2. Validate file metadata (no file bytes sent to server)
//   3. Generate storage path + pre-signed upload URL
//   4. Register document row (status = 'uploading')
//   5. Create document_versions row (v1)
//   6. Write audit log: document.upload_started
//   7. Return signedUrl + docId to client
//   (Client uploads to Storage, then calls confirmUpload)
//   8. confirmUpload → status = 'parsing', audit log: document.upload_complete
// =============================================================================
'use server'

import { randomUUID } from 'crypto'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { validateUploadFile, buildStoragePath } from './validation'
import {
  registerDocument,
  generateUploadUrl,
  createDocumentVersion,
  getDocumentVersionCount,
  updateDocumentStatus,
  markDocumentFailed,
  softDeleteDocument,
  getDocumentDownloadUrl,
} from './service'
import { logAuditEvent } from './audit'
import { UPLOAD_ALLOWED_ROLES } from './types'
import type { DocumentUploadInput } from './types'
import { checkLimit, incrementUsage } from '@/features/trial/limits.server'


export interface InitiateUploadResult {
  success: boolean
  signedUrl: string | null
  storagePath: string | null
  documentId: string | null
  error: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP A: initiate upload — called before the browser upload begins
// ─────────────────────────────────────────────────────────────────────────────
export async function initiateDocumentUpload(
  input: Omit<DocumentUploadInput, 'file'> & {
    fileName: string
    fileSize: number
    fileMimeType: string
  }
): Promise<InitiateUploadResult> {
  // 1. Authenticate
  const supabase = await createClient()
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()

  if (authErr || !user) {
    return { success: false, signedUrl: null, storagePath: null, documentId: null, error: 'Not authenticated' }
  }

  // 2. Load profile for org_id + role check
  const { data: profile, error: profileErr } = await supabase
    .from('user_profiles')
    .select('org_id, role, is_active')
    .eq('id', user.id)
    .single()

  if (profileErr || !profile) {
    return { success: false, signedUrl: null, storagePath: null, documentId: null, error: 'Profile not found' }
  }

  if (!profile.is_active) {
    return { success: false, signedUrl: null, storagePath: null, documentId: null, error: 'Account inactive' }
  }

  // 3. Role-based upload permission (mirrors DB policy)
  if (!UPLOAD_ALLOWED_ROLES.includes(profile.role as (typeof UPLOAD_ALLOWED_ROLES)[number])) {
    await logAuditEvent({
      orgId: profile.org_id,
      userId: user.id,
      action: 'document.upload_failed',
      resourceType: 'document',
      newValue: { reason: 'insufficient_role', role: profile.role },
    })
    return {
      success: false, signedUrl: null, storagePath: null, documentId: null,
      error: `Role '${profile.role}' is not permitted to upload documents`,
    }
  }

  // 3b. Check trial/tier limits (daily uploads and storage capacity)
  const uploadLimitCheck = await checkLimit(user.id, profile.role, 'document_upload')
  if (!uploadLimitCheck.allowed) {
    return {
      success: false, signedUrl: null, storagePath: null, documentId: null,
      error: uploadLimitCheck.reason ?? null
    }
  }

  const storageLimitCheck = await checkLimit(user.id, profile.role, 'storage_upload', input.fileSize)
  if (!storageLimitCheck.allowed) {
    return {
      success: false, signedUrl: null, storagePath: null, documentId: null,
      error: storageLimitCheck.reason ?? null
    }
  }


  // ── DIAGNOSTIC ▶ APP-LAYER AUTH CONTEXT (checkpoint 0) ──────────────────
  console.log('[initiateDocumentUpload] APP-LAYER AUTH CONTEXT:', {
    user_id:   user.id,
    org_id:    profile.org_id,
    role:      profile.role,
    is_active: profile.is_active,
  })

  // 4. Validate file metadata (mime + size — no actual bytes here)
  const fakeFile = { type: input.fileMimeType, size: input.fileSize, name: input.fileName } as File
  const validation = validateUploadFile(fakeFile)
  if (!validation.valid) {
    console.error('[initiateDocumentUpload] STEP 4 FAILED — file validation:', validation.error)
    return { success: false, signedUrl: null, storagePath: null, documentId: null, error: validation.error }
  }
  console.log('[initiateDocumentUpload] STEP 4 OK — file validation passed')

  // 5. Generate document ID upfront so storage path + DB row share the same UUID
  const docId = randomUUID()
  const storagePath = buildStoragePath(profile.org_id, input.doc_type, docId, input.fileName)
  console.log('[initiateDocumentUpload] STEP 5 OK — docId:', docId, '| storagePath:', storagePath)

  // ── CHECKPOINT 1: BEFORE generateUploadUrl() ─────────────────────────────
  console.log('[initiateDocumentUpload] CHECKPOINT 1 — calling generateUploadUrl()', {
    orgId:            profile.org_id,
    docType:          input.doc_type,
    docId,
    originalFilename: input.fileName,
  })

  let signedUrl: string | null = null
  let storagePath2: string | null = null

  try {
    const urlResult = await generateUploadUrl({
      orgId: profile.org_id,
      docType: input.doc_type,
      docId,
      originalFilename: input.fileName,
    })

    // ── CHECKPOINT 2: AFTER generateUploadUrl() ────────────────────────────
    console.log('[initiateDocumentUpload] CHECKPOINT 2 — generateUploadUrl() returned:', {
      signedUrl:   urlResult.signedUrl   ?? 'NULL',
      storagePath: urlResult.storagePath ?? 'NULL',
      error:       urlResult.error       ?? 'none',
    })

    if (urlResult.error || !urlResult.signedUrl) {
      console.error('[initiateDocumentUpload] STEP 6 FAILED — generateUploadUrl error:', {
        error:       urlResult.error,
        signedUrl:   urlResult.signedUrl,
        storagePath: urlResult.storagePath,
        orgId:       profile.org_id,
        docType:     input.doc_type,
        docId,
      })
      return {
        success: false, signedUrl: null, storagePath: null, documentId: null,
        error: urlResult.error ?? 'URL generation failed',
      }
    }

    signedUrl  = urlResult.signedUrl
    storagePath2 = urlResult.storagePath
    console.log('[initiateDocumentUpload] STEP 6 OK — signed URL obtained')
  } catch (urlException: unknown) {
    // ── EXCEPTION inside generateUploadUrl() itself ────────────────────────
    console.error('[initiateDocumentUpload] STEP 6 THREW EXCEPTION — generateUploadUrl():', {
      exception: urlException,
      message:   urlException instanceof Error ? urlException.message : String(urlException),
      stack:     urlException instanceof Error ? urlException.stack   : undefined,
    })
    return {
      success: false, signedUrl: null, storagePath: null, documentId: null,
      error: urlException instanceof Error ? urlException.message : 'generateUploadUrl threw',
    }
  }

  // 7. Register document row
  const fullFile = { ...fakeFile, name: input.fileName } as File
  const docInput: DocumentUploadInput = {
    file: fullFile,
    doc_type:       input.doc_type,
    sensitivity:    input.sensitivity,
    department:     input.department,
    classification: input.classification,
    framework:      input.framework,
    tags:           input.tags,
  }

  // ── CHECKPOINT 3: BEFORE registerDocument() ──────────────────────────────
  console.log('[initiateDocumentUpload] CHECKPOINT 3 — calling registerDocument()', {
    orgId:          profile.org_id,
    uploadedBy:     user.id,
    storagePath,
    docId,
    doc_type:       input.doc_type,
    sensitivity:    input.sensitivity,
    classification: input.classification,
    framework:      input.framework,
  })

  let document: import('./types').DocumentRecord | null = null

  try {
    const regResult = await registerDocument(
      docInput,
      profile.org_id,
      user.id,
      storagePath,
      docId,
    )

    // ── CHECKPOINT 4: AFTER registerDocument() ────────────────────────────
    console.log('[initiateDocumentUpload] CHECKPOINT 4 — registerDocument() returned:', {
      document: regResult.document ? `id=${regResult.document.id}` : 'NULL',
      error:    regResult.error ?? 'none',
    })

    if (regResult.error || !regResult.document) {
      console.error('[initiateDocumentUpload] STEP 7 FAILED — registerDocument error:', {
        error:   regResult.error,
        user_id: user.id,
        org_id:  profile.org_id,
        role:    profile.role,
        doc_id:  docId,
      })
      return {
        success: false, signedUrl: null, storagePath: null, documentId: null,
        error: regResult.error ?? 'Registration failed',
      }
    }

    document = regResult.document
    console.log('[initiateDocumentUpload] STEP 7 OK — registerDocument succeeded, doc id:', document.id)
  } catch (regException: unknown) {
    // ── EXCEPTION inside registerDocument() itself ─────────────────────────
    console.error('[initiateDocumentUpload] STEP 7 THREW EXCEPTION — registerDocument():', {
      exception: regException,
      message:   regException instanceof Error ? regException.message : String(regException),
      stack:     regException instanceof Error ? regException.stack   : undefined,
    })
    return {
      success: false, signedUrl: null, storagePath: null, documentId: null,
      error: regException instanceof Error ? regException.message : 'registerDocument threw',
    }
  }

  // ── CHECKPOINT 5: BEFORE createDocumentVersion() ─────────────────────────
  console.log('[initiateDocumentUpload] CHECKPOINT 5 — calling createDocumentVersion()', {
    documentId:     docId,
    versionNumber:  1,
    storagePath,
    fileSizeBytes:  input.fileSize,
    createdBy:      user.id,
  })

  try {
    const versionResult = await createDocumentVersion({
      documentId:    docId,
      versionNumber: 1,
      storagePath,
      fileSizeBytes: input.fileSize,
      createdBy:     user.id,
      changeSummary: 'Initial upload',
    })

    // ── CHECKPOINT 6: AFTER createDocumentVersion() ──────────────────────
    console.log('[initiateDocumentUpload] CHECKPOINT 6 — createDocumentVersion() returned:', {
      version: versionResult.version ? `id=${versionResult.version.id}` : 'NULL',
      error:   versionResult.error ?? 'none',
    })

    if (versionResult.error) {
      console.error('[initiateDocumentUpload] STEP 8 FAILED — createDocumentVersion error:', {
        error:      versionResult.error,
        documentId: docId,
      })
      // Non-fatal: document row exists; log and continue
    } else {
      console.log('[initiateDocumentUpload] STEP 8 OK — version record created')
    }
  } catch (verException: unknown) {
    console.error('[initiateDocumentUpload] STEP 8 THREW EXCEPTION — createDocumentVersion():', {
      exception: verException,
      message:   verException instanceof Error ? verException.message : String(verException),
      stack:     verException instanceof Error ? verException.stack   : undefined,
    })
    // Non-fatal: continue
  }

  // 9. Audit log: upload started
  try {
    await logAuditEvent({
      orgId:        profile.org_id,
      userId:       user.id,
      action:       'document.upload_started',
      resourceType: 'document',
      resourceId:   docId,
      newValue: {
        filename:    input.fileName,
        size_bytes:  input.fileSize,
        doc_type:    input.doc_type,
        sensitivity: input.sensitivity,
      },
    })
    console.log('[initiateDocumentUpload] STEP 9 OK — audit log written')
  } catch (auditException: unknown) {
    console.error('[initiateDocumentUpload] STEP 9 THREW EXCEPTION — logAuditEvent():', {
      exception: auditException,
      message:   auditException instanceof Error ? auditException.message : String(auditException),
    })
    // Non-fatal: continue
  }

  console.log('[initiateDocumentUpload] ✅ COMPLETE — returning success', { documentId: docId })
  return { success: true, signedUrl: signedUrl!, storagePath: storagePath2 ?? storagePath, documentId: docId, error: null }
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP B: confirmUpload — called after the browser successfully uploads to Storage
// Advances status from 'uploading' → 'parsing'
// ─────────────────────────────────────────────────────────────────────────────
export async function confirmDocumentUpload(
  documentId: string
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('org_id, role')
    .eq('id', user.id)
    .single()

  // Find the latest version from document_versions to sync metadata
  const admin = createAdminClient()
  const { data: latestVersion } = await admin
    .from('document_versions')
    .select('storage_path, file_size_bytes')
    .eq('document_id', documentId)
    .order('version_number', { ascending: false })
    .limit(1)
    .single()

  if (latestVersion) {
    const filename = latestVersion.storage_path.split('/').pop() || ''
    await admin
      .from('documents')
      .update({
        storage_path: latestVersion.storage_path,
        filename,
        file_size_bytes: latestVersion.file_size_bytes,
      })
      .eq('id', documentId)
  }

  // Advance to parsing (Sprint 2 will process from here)
  const { error } = await updateDocumentStatus(documentId, 'parsing')
  if (error) {
    await markDocumentFailed(documentId, `Status transition failed: ${error}`)
    return { success: false, error }
  }

  // Increment document upload count if metered tier
  if (profile && ['trial_user', 'academic_user', 'approved_user'].includes(profile.role)) {
    await incrementUsage(user.id, 'document_uploads')
  }


  // Audit log: upload complete
  await logAuditEvent({
    orgId: profile?.org_id ?? '',
    userId: user.id,
    action: 'document.upload_complete',
    resourceType: 'document',
    resourceId: documentId,
    newValue: { status: 'parsing' },
  })

  return { success: true, error: null }
}


// ─────────────────────────────────────────────────────────────────────────────
// STEP C: failUpload — called if the browser-side upload to Storage fails
// Marks document as 'failed' with reason
// ─────────────────────────────────────────────────────────────────────────────
export async function failDocumentUpload(
  documentId: string,
  reason: string
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('org_id')
    .eq('id', user.id)
    .single()

  await markDocumentFailed(documentId, reason)

  await logAuditEvent({
    orgId: profile?.org_id ?? '',
    userId: user.id,
    action: 'document.upload_failed',
    resourceType: 'document',
    resourceId: documentId,
    newValue: { reason },
  })

  return { success: true, error: null }
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP D: initiateVersionUpload
// Handles re-upload of an existing document (creates v2, v3, etc.)
// ─────────────────────────────────────────────────────────────────────────────
export async function initiateVersionUpload(
  existingDocumentId: string,
  input: Omit<DocumentUploadInput, 'file'> & {
    fileName: string
    fileSize: number
    fileMimeType: string
    changeSummary?: string
  }
): Promise<InitiateUploadResult> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()

  if (authErr || !user) {
    return { success: false, signedUrl: null, storagePath: null, documentId: null, error: 'Not authenticated' }
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('org_id, role')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return { success: false, signedUrl: null, storagePath: null, documentId: null, error: 'Profile not found' }
  }

  if (!UPLOAD_ALLOWED_ROLES.includes(profile.role as (typeof UPLOAD_ALLOWED_ROLES)[number])) {
    return { success: false, signedUrl: null, storagePath: null, documentId: null, error: 'Insufficient permissions' }
  }

  // Check trial/tier limits
  const uploadLimitCheck = await checkLimit(user.id, profile.role, 'document_upload')
  if (!uploadLimitCheck.allowed) {
    return { success: false, signedUrl: null, storagePath: null, documentId: null, error: uploadLimitCheck.reason ?? null }
  }

  const storageLimitCheck = await checkLimit(user.id, profile.role, 'storage_upload', input.fileSize)
  if (!storageLimitCheck.allowed) {
    return { success: false, signedUrl: null, storagePath: null, documentId: null, error: storageLimitCheck.reason ?? null }
  }


  const fakeFile = { type: input.fileMimeType, size: input.fileSize, name: input.fileName } as File
  const validation = validateUploadFile(fakeFile)
  if (!validation.valid) {
    return { success: false, signedUrl: null, storagePath: null, documentId: null, error: validation.error }
  }

  // New storage path uses the existing doc ID (keeps files grouped under same document)
  const storagePath = buildStoragePath(
    profile.org_id,
    input.doc_type,
    existingDocumentId,
    input.fileName
  )

  const { signedUrl, error: urlErr } = await generateUploadUrl({
    orgId: profile.org_id,
    docType: input.doc_type,
    docId: existingDocumentId,
    originalFilename: input.fileName,
  })

  if (urlErr || !signedUrl) {
    return { success: false, signedUrl: null, storagePath: null, documentId: null, error: urlErr ?? 'URL failed' }
  }

  const currentVersionCount = await getDocumentVersionCount(existingDocumentId)
  const nextVersion = currentVersionCount + 1

  await createDocumentVersion({
    documentId: existingDocumentId,
    versionNumber: nextVersion,
    storagePath,
    fileSizeBytes: input.fileSize,
    createdBy: user.id,
    changeSummary: input.changeSummary ?? `Version ${nextVersion}`,
  })

  await updateDocumentStatus(existingDocumentId, 'uploading')

  await logAuditEvent({
    orgId: profile.org_id,
    userId: user.id,
    action: 'document.version_created',
    resourceType: 'document',
    resourceId: existingDocumentId,
    newValue: { version_number: nextVersion, filename: input.fileName },
  })

  return {
    success: true,
    signedUrl,
    storagePath,
    documentId: existingDocumentId,
    error: null,
  }
}

export async function deleteDocument(documentId: string): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { error } = await softDeleteDocument(documentId)
  if (error) return { success: false, error }

  if (profile) {
    await logAuditEvent({
      orgId: profile.org_id,
      userId: user.id,
      action: 'DOCUMENT_DELETED',
      resourceType: 'document',
      resourceId: documentId,
      newValue: { status: 'deleted' },
    })
  }

  return { success: true, error: null }
}


export async function getDocumentViewUrl(documentId: string): Promise<{ url: string | null; error: string | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { url: null, error: 'Not authenticated' }

  const { data: document, error: docErr } = await supabase
    .from('documents')
    .select('storage_path')
    .eq('id', documentId)
    .single()

  if (docErr || !document) return { url: null, error: docErr?.message ?? 'Document not found' }

  return getDocumentDownloadUrl(document.storage_path)
}

