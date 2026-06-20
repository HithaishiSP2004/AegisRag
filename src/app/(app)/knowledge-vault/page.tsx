// =============================================================================
// Sprint 1: Knowledge Vault Page — /knowledge-vault
// Server Component: loads user role → passes canUpload to shell.
// DocumentList is rendered server-side inside the shell.
// =============================================================================

import { Suspense } from 'react'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { UPLOAD_ALLOWED_ROLES, DocumentType, SensitivityLevel } from '@/features/documents/types'
import { DocumentList } from '@/features/documents/components/DocumentList'
import { KnowledgeVaultShell } from './KnowledgeVaultShell'
import { embeddingService } from '@/features/embeddings/embeddingService'

export const metadata: Metadata = {
  title: 'Knowledge Vault',
  description: 'Upload and manage your compliance policy corpus.',
}

// Always render fresh — canUpload depends on user_profiles which must never be stale.
// Status changes in DocumentList are handled by router.refresh() in the shell.
export const dynamic = 'force-dynamic'

export default async function KnowledgeVaultPage({
  searchParams,
}: {
  searchParams: Promise<{
    department?: string
    docType?: string
    sensitivity?: string
    search?: string
  }>
}) {
  const resolvedParams = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Determine upload permission from user_profiles.
  // If this query fails (e.g. RLS misconfiguration), canUpload defaults to false
  // and the error is logged server-side so it's visible in Next.js stdout.
  let canUpload = false
  let userRole = ''
  if (user) {
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('[KnowledgeVault] user_profiles query failed:', profileError.message)
    } else if (profile) {
      userRole = profile.role || ''
      canUpload = UPLOAD_ALLOWED_ROLES.includes(
        profile.role as (typeof UPLOAD_ALLOWED_ROLES)[number]
      ) || profile.role === 'trial_user'
    }
  }

  // Fetch document stats for the org
  const stats = {
    total: 0,
    indexed: 0,
    processing: 0,
    failed: 0,
    lastUpload: '—',
    storageBytes: 0,
  }
  if (user) {
    const { data: allDocs } = await supabase
      .from('documents')
      .select('status, created_at, file_size_bytes')
      .neq('status', 'deleted')

    if (allDocs) {
      stats.total = allDocs.length
      stats.indexed = allDocs.filter(d => d.status === 'indexed').length
      stats.processing = allDocs.filter(d => ['parsing', 'chunking', 'embedding', 'uploading', 'queued', 'processing', 'waiting_provider'].includes(d.status)).length
      stats.failed = allDocs.filter(d => d.status === 'failed' || d.status === 'embedding_failed').length

      // Compute total storage
      stats.storageBytes = allDocs.reduce((acc, d) => acc + (d.file_size_bytes || 0), 0)

      // Compute last upload date
      if (allDocs.length > 0) {
        const sorted = [...allDocs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        const latest = sorted[0]?.created_at
        if (latest) {
          stats.lastUpload = new Date(latest).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
          })
        }
      }
    }
  }

  const providerName = embeddingService.getProviderName()
  const modelName = embeddingService.getModelName()
  const dimensions = embeddingService.getDimensions()

  return (
    <Suspense fallback={<div style={{ padding: '24px', color: '#475569', fontSize: '0.875rem' }}>Loading Vault...</div>}>
      <KnowledgeVaultShell
        canUpload={canUpload}
        userRole={userRole}
        stats={stats}
        providerName={providerName}
        modelName={modelName}
        dimensions={dimensions}
      >
        <Suspense fallback={<DocumentListSkeleton />}>
          <DocumentList
            department={resolvedParams.department}
            docType={resolvedParams.docType as DocumentType}
            sensitivity={resolvedParams.sensitivity as SensitivityLevel}
            search={resolvedParams.search}
          />
        </Suspense>
      </KnowledgeVaultShell>
    </Suspense>
  )
}

function DocumentListSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          style={{
            height: '44px',
            background: 'rgba(255,255,255,0.01)',
            border: '1px solid rgba(255,255,255,0.04)',
            borderRadius: '8px',
            animation: 'pulse 1.5s ease-in-out infinite',
            opacity: 1 - i * 0.15,
          }}
        />
      ))}
    </div>
  )
}

