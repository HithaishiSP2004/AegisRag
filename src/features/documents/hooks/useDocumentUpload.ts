'use client'
// =============================================================================
// Sprint 1: useDocumentUpload Hook
// Manages the complete client-side upload state machine.
// Pipeline:
//   idle → validating → uploading (progress 0-100%) → registering → complete/error
// =============================================================================

import { useState, useCallback, useRef } from 'react'
import { validateUploadFile, getContentType } from '../validation'
import {
  initiateDocumentUpload,
  confirmDocumentUpload,
  failDocumentUpload,
} from '../actions'
import type { DocumentUploadInput, UploadProgressState } from '../types'

interface UseDocumentUploadOptions {
  onSuccess?: (documentId: string) => void
  onError?: (error: string) => void
}

interface UseDocumentUploadReturn {
  progress: UploadProgressState
  upload: (input: DocumentUploadInput) => Promise<void>
  reset: () => void
}

const INITIAL_PROGRESS: UploadProgressState = {
  storageProgress: 0,
  phase: 'idle',
  documentId: null,
  error: null,
}

export function useDocumentUpload(options: UseDocumentUploadOptions = {}): UseDocumentUploadReturn {
  const [progress, setProgress] = useState<UploadProgressState>(INITIAL_PROGRESS)
  const abortRef = useRef<AbortController | null>(null)

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setProgress(INITIAL_PROGRESS)
  }, [])

  const upload = useCallback(
    async (input: DocumentUploadInput) => {
      const { file, doc_type, sensitivity, department, classification, framework, tags } = input

      // ── Phase: validating ───────────────────────────────────────────────
      setProgress({ storageProgress: 0, phase: 'validating', documentId: null, error: null })

      const validation = validateUploadFile(file)
      if (!validation.valid) {
        setProgress({ storageProgress: 0, phase: 'error', documentId: null, error: validation.error })
        options.onError?.(validation.error ?? 'Validation failed')
        return
      }

      // ── Phase: registering (DB row + signed URL) ──────────────────────
      setProgress({ storageProgress: 0, phase: 'registering', documentId: null, error: null })

      const initResult = await initiateDocumentUpload({
        fileName: file.name,
        fileSize: file.size,
        fileMimeType: file.type,
        doc_type,
        sensitivity,
        department,
        classification,
        framework,
        tags,
      })

      if (!initResult.success || !initResult.signedUrl || !initResult.documentId) {
        const err = initResult.error ?? 'Failed to initiate upload'
        setProgress({ storageProgress: 0, phase: 'error', documentId: null, error: err })
        options.onError?.(err)
        return
      }

      const { signedUrl, documentId } = initResult

      // ── Phase: uploading (XHR for real progress events) ───────────────
      setProgress({ storageProgress: 0, phase: 'uploading', documentId, error: null })

      try {
        await uploadWithProgress(file, signedUrl, (pct) => {
          setProgress((prev) => ({ ...prev, storageProgress: pct }))
        })
      } catch (uploadErr) {
        const reason = uploadErr instanceof Error ? uploadErr.message : 'Storage upload failed'
        await failDocumentUpload(documentId, reason)
        setProgress({ storageProgress: 0, phase: 'error', documentId, error: reason })
        options.onError?.(reason)
        return
      }

      // ── Phase: confirm (status transition uploading → parsing) ─────────
      setProgress({ storageProgress: 100, phase: 'registering', documentId, error: null })

      const confirmResult = await confirmDocumentUpload(documentId)
      if (!confirmResult.success) {
        const err = confirmResult.error ?? 'Failed to confirm upload'
        setProgress({ storageProgress: 100, phase: 'error', documentId, error: err })
        options.onError?.(err)
        return
      }

      // ── Trigger processing pipeline (fire-and-forget from the client) ──
      // The route runs synchronously server-side; client can poll status.
      // We do NOT await this — the upload modal closes immediately.
      fetch(`/api/documents/${documentId}/process`, { method: 'POST' })
        .then((res) => {
          if (!res.ok) {
            res.json().then((body) => {
              console.error('[useDocumentUpload] Pipeline trigger failed:', body)
            }).catch(() => {})
          } else {
            console.log('[useDocumentUpload] Pipeline completed for', documentId)
          }
        })
        .catch((err) => {
          console.error('[useDocumentUpload] Pipeline fetch error:', err)
        })

      // ── Phase: complete ────────────────────────────────────────────────
      setProgress({ storageProgress: 100, phase: 'complete', documentId, error: null })
      options.onSuccess?.(documentId)
    },
    [options]
  )

  return { progress, upload, reset }
}


// ─────────────────────────────────────────────────────────────────────────────
// XHR-based upload with real progress events
// fetch() does not expose upload progress — XHR is required.
// ─────────────────────────────────────────────────────────────────────────────
function uploadWithProgress(
  file: File,
  signedUrl: string,
  onProgress: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
      } else {
        reject(new Error(`Storage upload failed with status ${xhr.status}`))
      }
    })

    xhr.addEventListener('error', () => reject(new Error('Network error during upload')))
    xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')))

    xhr.open('PUT', signedUrl)
    xhr.setRequestHeader('Content-Type', getContentType(file.name))
    xhr.send(file)
  })
}
