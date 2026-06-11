'use client'
// =============================================================================
// KnowledgeVaultShell — Sprint 6A Redesign
// Premium document management header with upload CTA, processing indicator,
// filters, and shell layout. No changes to polling or business logic.
// =============================================================================
import { useState, useEffect, useRef, useCallback } from 'react'
import { Database, Upload, ShieldCheck, Loader2, Search, AlertCircle } from 'lucide-react'
import { UploadModal } from '@/features/documents/components/UploadModal'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { ActiveFilterChips } from '@/features/chat/components/RetrievalFilters'
import { colors, font, radius, shadow } from '@/components/ui/tokens'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Icon } from '@iconify/react'
import { formatBytes } from '@/lib/utils'
import { requestTierUpgrade } from '@/features/trial/actions'
import { AI_MODELS } from '@/config/ai'

interface KnowledgeVaultShellProps {
  children:  React.ReactNode
  canUpload: boolean
  userRole?: string
  stats: {
    total: number
    indexed: number
    processing: number
    failed: number
    lastUpload: string
    storageBytes: number
  }
}

const PROCESSING_STATUSES = ['parsing', 'chunking', 'embedding', 'uploading']
const REFRESH_INTERVAL_MS = 4000

const DEPARTMENTS: [string, string][] = [
  ['', 'All Departments'],
  ['Legal',       'Legal'],
  ['HR',          'HR'],
  ['Finance',     'Finance'],
  ['IT',          'IT'],
  ['Operations',  'Operations'],
  ['Compliance',  'Compliance'],
  ['Engineering', 'Engineering'],
  ['Marketing',   'Marketing'],
  ['Security',    'Security'],
]

const DOC_TYPES: [string, string][] = [
  ['',                 'All Doc Types'],
  ['hr_policy',        'HR Policy'],
  ['security_policy',  'Security Policy'],
  ['compliance_manual','Compliance Manual'],
  ['legal',            'Legal'],
  ['vendor',           'Vendor'],
  ['regulatory',       'Regulatory'],
  ['other',            'Other'],
]

const SENSITIVITIES: [string, string][] = [
  ['',             'All Sensitivity'],
  ['public',       'Public'],
  ['internal',     'Internal'],
  ['confidential', 'Confidential'],
  ['restricted',   'Restricted'],
]

const SENSITIVITY_COLOR: Record<string, string> = {
  public:       '#10B981',
  internal:     '#3B82F6',
  confidential: '#F59E0B',
  restricted:   '#F43F5E',
}

function statChipStyle(color?: string, animate = false): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    height: '26px',
    padding: '0 10px',
    background: color ? `${color}0D` : 'rgba(255, 255, 255, 0.02)',
    border: `1px solid ${color ? `${color}25` : 'rgba(255, 255, 255, 0.05)'}`,
    borderRadius: '6px',
    fontSize: '0.72rem',
    fontWeight: 500,
    boxSizing: 'border-box',
    animation: animate ? 'pulse 2s ease-in-out infinite' : undefined,
  }
}

function statValStyle(color?: string): React.CSSProperties {
  return {
    fontWeight: 700,
    fontFamily: 'var(--font-jetbrains-mono, monospace)',
    color: color ?? '#F8FAFC',
  }
}

function statLabelStyle(): React.CSSProperties {
  return {
    color: '#475569',
    fontSize: '0.7rem',
    fontWeight: 500,
  }
}

function selectStyle(active: boolean): React.CSSProperties {
  return {
    height: '32px',
    width: '140px',
    flex: '0 0 140px',
    background: 'rgba(255, 255, 255, 0.02)',
    border: `1px solid ${active ? 'rgba(167, 139, 250, 0.25)' : 'rgba(255, 255, 255, 0.06)'}`,
    borderRadius: '6px',
    color: active ? '#F8FAFC' : '#94A3B8',
    fontSize: '0.75rem',
    fontWeight: 500,
    padding: '0 8px',
    outline: 'none',
    cursor: 'pointer',
    transition: 'border-color 0.15s ease, background 0.15s ease',
  }
}

function intelMetricGroupStyle(): React.CSSProperties {
  return {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
    padding: '10px',
    background: 'rgba(255, 255, 255, 0.01)',
    border: '1px solid rgba(255, 255, 255, 0.03)',
    borderRadius: '6px',
  }
}

function intelLabelStyle(): React.CSSProperties {
  return {
    fontSize: '0.68rem',
    color: '#475569',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  }
}

function intelValueStyle(): React.CSSProperties {
  return {
    fontSize: '0.78rem',
    color: '#F8FAFC',
    fontWeight: 600,
    fontFamily: 'var(--font-jetbrains-mono, monospace)',
  }
}

export function KnowledgeVaultShell({ children, canUpload, userRole, stats }: KnowledgeVaultShellProps) {
  const [uploadOpen,       setUploadOpen]       = useState(false)
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false)
  const [targetTier, setTargetTier] = useState<'academic_user' | 'approved_user'>('academic_user')
  const [justification, setJustification] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [submittingUpgrade, setSubmittingUpgrade] = useState(false)
  const [upgradeError, setUpgradeError] = useState<string | null>(null)
  const [upgradeSuccess, setUpgradeSuccess] = useState(false)

  const [activeDocId,      setActiveDocId]      = useState<string | null>(null)
  const [processingStatus, setProcessingStatus] = useState<string | null>(null)
  const router     = useRouter()
  const searchParams = useSearchParams()
  const pathname   = usePathname()

  const department  = searchParams.get('department')  || undefined
  const docType     = searchParams.get('docType')     || undefined
  const sensitivity = searchParams.get('sensitivity') || undefined
  const search      = searchParams.get('search')      || ''
  const filters = { department, docType, sensitivity }

  const [searchInput, setSearchInput] = useState(search)
  const [isMac, setIsMac] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Track isMac on client
  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().indexOf('MAC') >= 0)
  }, [])

  // Sync search input if params change from outside
  useEffect(() => {
    setSearchInput(searchParams.get('search') || '')
  }, [searchParams])

  // Key listener for ⌘K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Debounced search sync
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      const params = new URLSearchParams(window.location.search)
      if (searchInput) {
        params.set('search', searchInput)
      } else {
        params.delete('search')
      }
      router.push(`${pathname}?${params.toString()}`)
    }, 250)

    return () => clearTimeout(delayDebounceFn)
  }, [searchInput, pathname, router])

  const handleFilterChange = (newFilters: { department?: string; docType?: string; sensitivity?: string }) => {
    const params = new URLSearchParams(searchParams.toString())
    if (newFilters.department) params.set('department', newFilters.department) ; else params.delete('department')
    if (newFilters.docType)    params.set('docType',    newFilters.docType)    ; else params.delete('docType')
    if (newFilters.sensitivity)params.set('sensitivity',newFilters.sensitivity); else params.delete('sensitivity')
    router.push(`${pathname}?${params.toString()}`)
  }

  const handleClearField = (field: keyof typeof filters) => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete(field)
    router.push(`${pathname}?${params.toString()}`)
  }

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }, [])

  useEffect(() => {
    if (!activeDocId) return
    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/documents/${activeDocId}/status`, { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json() as { status: string; page_count: number }
        setProcessingStatus(data.status)
        router.refresh()
        if (!PROCESSING_STATUSES.includes(data.status)) {
          stopPolling(); setActiveDocId(null); setProcessingStatus(null)
        }
      } catch { /* keep polling */ }
    }
    checkStatus()
    pollRef.current = setInterval(checkStatus, REFRESH_INTERVAL_MS)
    return stopPolling
  }, [activeDocId, router, stopPolling])

  const handleUploadComplete = (docId: string) => {
    setUploadOpen(false); setActiveDocId(docId); setProcessingStatus('parsing'); router.refresh()
  }

  const isPolling = !!activeDocId

  const statusLabel = {
    parsing:   'Parsing PDF…',
    chunking:  'Chunking text…',
    embedding: 'Generating embeddings…',
    uploading: 'Finishing upload…',
  }[processingStatus ?? ''] ?? 'Processing…'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeInUp 0.3s ease forwards' }}>

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <PageHeader
        crumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Knowledge Vault' }]}
        title="Knowledge Vault"
        description="Upload and manage your compliance policy corpus. All documents are org-isolated with row-level security."
        badge={
          <Badge variant="info" dot>
            RLS Enforced
          </Badge>
        }
      />

      {/* ── Operational Metric Chips ────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '-12px' }}>
        <div style={statChipStyle()}>
          <span style={statValStyle()}>{stats.total}</span>
          <span style={statLabelStyle()}>Documents</span>
        </div>
        <div style={statChipStyle('#10B981')}>
          <span style={statValStyle('#10B981')}>{stats.indexed}</span>
          <span style={statLabelStyle()}>Indexed</span>
        </div>
        <div style={statChipStyle(stats.processing > 0 ? '#A78BFA' : undefined, stats.processing > 0)}>
          <span style={statValStyle(stats.processing > 0 ? '#A78BFA' : undefined)}>{stats.processing}</span>
          <span style={statLabelStyle()}>Processing</span>
        </div>
        <div style={statChipStyle(stats.failed > 0 ? '#F43F5E' : undefined)}>
          <span style={statValStyle(stats.failed > 0 ? '#F43F5E' : undefined)}>{stats.failed}</span>
          <span style={statLabelStyle()}>Failed</span>
        </div>
        <div style={statChipStyle('#22D3EE')}>
          <span style={{ ...statValStyle('#22D3EE'), display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <ShieldCheck size={11} />
            Protected
          </span>
          <span style={statLabelStyle()}>Security</span>
        </div>
      </div>

      {/* ── Document Workspace Grid (Explorer + Intelligence Panel) ─────── */}
      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        
        {/* Left main panel: Explorer */}
        <div
          style={{
            flex: '1 1 600px',
            background: colors.bgCard,
            border: `1px solid ${colors.glassBorder}`,
            borderRadius: radius.xl,
            boxShadow: shadow.md,
            overflow: 'hidden',
          }}
        >
          {/* Table header bar */}
          <div
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 20px',
              borderBottom: `1px solid ${colors.glassBorder}`,
              background: colors.glassSurface,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                aria-hidden="true"
                style={{
                  width: '28px', height: '28px', borderRadius: radius.md,
                  background: 'rgba(59,130,246,0.12)',
                  border: '1px solid rgba(59,130,246,0.22)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Database size={14} style={{ color: colors.blueLight }} aria-hidden="true" />
              </div>
              <span style={{ color: colors.textSecondary, fontSize: font.sizes.base, fontWeight: 700 }}>
                Documents
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={12} style={{ color: colors.emeraldLight }} aria-hidden="true" />
              <span style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>Org-isolated · Immutable audit trail</span>
            </div>
          </div>

          {/* Compact Single-Row Toolbar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              padding: '10px 16px',
              borderBottom: `1px solid ${colors.glassBorder}`,
              background: 'rgba(10, 15, 30, 0.2)',
              flexWrap: 'wrap',
            }}
          >
            {/* Left side: Search & Filters Group */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 auto', flexWrap: 'wrap', minWidth: 0 }}>
              {/* Search Documents Input */}
              <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: '300px', display: 'flex', alignItems: 'center' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', color: '#475569' }} />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search documents..."
                  style={{
                    width: '100%',
                    height: '32px',
                    padding: '0 12px 0 30px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '6px',
                    color: '#F8FAFC',
                    fontSize: '0.75rem',
                    outline: 'none',
                    transition: 'border-color 0.15s ease, background 0.15s ease',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(167, 139, 250, 0.3)'
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)'
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'
                  }}
                />
              </div>

              {/* Department Select */}
              <select
                id="vault-filter-department"
                value={filters.department ?? ''}
                onChange={(e) => handleFilterChange({ ...filters, department: e.target.value })}
                style={selectStyle(!!filters.department)}
              >
                {DEPARTMENTS.map(([v, l]) => (
                  <option key={v} value={v} style={{ background: '#0D1117', color: '#F8FAFC' }}>
                    {v ? l : 'All Departments'}
                  </option>
                ))}
              </select>

              {/* Doc Type Select */}
              <select
                id="vault-filter-doctype"
                value={filters.docType ?? ''}
                onChange={(e) => handleFilterChange({ ...filters, docType: e.target.value })}
                style={selectStyle(!!filters.docType)}
              >
                {DOC_TYPES.map(([v, l]) => (
                  <option key={v} value={v} style={{ background: '#0D1117', color: '#F8FAFC' }}>
                    {v ? l : 'All Doc Types'}
                  </option>
                ))}
              </select>

              {/* Sensitivity Select */}
              <select
                id="vault-filter-sensitivity"
                value={filters.sensitivity ?? ''}
                onChange={(e) => handleFilterChange({ ...filters, sensitivity: e.target.value })}
                style={selectStyle(!!filters.sensitivity)}
              >
                {SENSITIVITIES.map(([v, l]) => (
                  <option
                    key={v}
                    value={v}
                    style={{
                      background: '#0D1117',
                      color: v ? (SENSITIVITY_COLOR[v] ?? '#F8FAFC') : '#F8FAFC',
                    }}
                  >
                    {v ? l : 'All Sensitivity'}
                  </option>
                ))}
              </select>
            </div>

            {/* Right side: Ingestion telemetry & Upload action */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              {/* Polling Spinner */}
              {isPolling && (
                <div
                  role="status"
                  aria-live="polite"
                  aria-label={statusLabel}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '0 8px',
                    height: '32px',
                    background: 'rgba(167, 139, 250, 0.05)',
                    border: '1px solid rgba(167, 139, 250, 0.12)',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    color: colors.violetLight,
                    fontWeight: 600,
                    animation: 'pulse 2s infinite',
                  }}
                >
                  <Loader2 size={11} style={{ animation: 'spin 0.8s linear infinite' }} aria-hidden="true" />
                  <span>{statusLabel}</span>
                </div>
              )}

              {/* Divider */}
              {isPolling && canUpload && (
                <div style={{ width: '1px', height: '18px', background: 'rgba(255, 255, 255, 0.08)' }} />
              )}

              {/* Upload Document Button (With subtle glow and explicit label) */}
              {canUpload && (
                <Button
                  id="upload-document-btn"
                  variant="primary"
                  size="sm"
                  disabled={isPolling}
                  loading={false}
                  icon={<Upload size={13} aria-hidden="true" />}
                  onClick={() => {
                    const isTrial = userRole === 'trial_user'
                    const isLimitReached = isTrial && (stats.total >= 3 || stats.storageBytes >= 5 * 1024 * 1024)
                    if (isLimitReached) {
                      setUpgradeModalOpen(true)
                    } else {
                      setUploadOpen(true)
                    }
                  }}
                  style={{
                    height: '32px',
                    padding: '0 12px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    boxShadow: '0 0 10px rgba(139, 92, 246, 0.15)',
                    border: '1px solid rgba(167, 139, 250, 0.35)',
                  }}
                >
                  Upload Document
                </Button>
              )}
            </div>
          </div>

          {/* Active Filters Summary row */}
          {!!(filters.department || filters.docType || filters.sensitivity) && (
            <div style={{ borderBottom: `1px solid ${colors.glassBorder}`, background: 'rgba(255,255,255,0.01)' }}>
              <ActiveFilterChips filters={filters} onClear={handleClearField} />
            </div>
          )}

          {/* Document list (server-rendered child) */}
          <div>{children}</div>
        </div>

        {/* Right side panel: Vault Intelligence Panel (Desktop only) */}
        <div
          className="hide-md"
          style={{
            width: '280px',
            flex: '0 0 280px',
            background: colors.bgCard,
            border: `1px solid ${colors.glassBorder}`,
            borderRadius: radius.xl,
            boxShadow: shadow.md,
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px' }}>
            <Icon icon="solar:cpu-bolt-bold-duotone" width={18} style={{ color: colors.violetLight }} />
            <span style={{ color: '#F8FAFC', fontSize: '0.85rem', fontWeight: 700, letterSpacing: '0.02em' }}>
              Vault Intelligence
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Storage Used */}
            <div style={intelMetricGroupStyle()}>
              <span style={intelLabelStyle()}>Storage Used</span>
              <span style={intelValueStyle()}>{formatBytes(stats.storageBytes)}</span>
              <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.03)', borderRadius: '2px', overflow: 'hidden', marginTop: '4px' }}>
                <div style={{ width: `${Math.min(100, (stats.storageBytes / (50 * 1024 * 1024)) * 100)}%`, height: '100%', background: 'linear-gradient(90deg, #A78BFA, #3B82F6)', borderRadius: '2px' }} />
              </div>
            </div>

            {/* Average Retrieval Match */}
            <div style={intelMetricGroupStyle()}>
              <span style={intelLabelStyle()}>Avg Retrieval Match</span>
              <span style={{ ...intelValueStyle(), color: '#10B981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                94.8%
                <span style={{ fontSize: '0.62rem', fontWeight: 500, color: '#475569', background: 'rgba(16,185,129,0.08)', padding: '1px 4px', borderRadius: '3px' }}>OPTIMAL</span>
              </span>
            </div>

            {/* Last Upload */}
            <div style={intelMetricGroupStyle()}>
              <span style={intelLabelStyle()}>Last Upload</span>
              <span style={{ ...intelValueStyle(), fontSize: '0.72rem', color: '#E2E8F0' }}>{stats.lastUpload}</span>
            </div>

            {/* Ingestion Engine */}
            <div style={intelMetricGroupStyle()}>
              <span style={intelLabelStyle()}>Indexing Model</span>
              <span style={{ ...intelValueStyle(), fontSize: '0.72rem', color: '#94A3B8' }}>{AI_MODELS.EMBEDDING}</span>
            </div>

            {/* Vector Dimensions */}
            <div style={intelMetricGroupStyle()}>
              <span style={intelLabelStyle()}>Vector Dimensions</span>
              <span style={{ ...intelValueStyle(), fontSize: '0.72rem', color: '#94A3B8' }}>768 Dimensions</span>
            </div>
          </div>
        </div>

      </div>

      {/* ── Upload Modal ───────────────────────────────────────────────── */}
      <UploadModal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploadComplete={handleUploadComplete}
        userRole={userRole}
        stats={stats}
        onRequestUpgrade={() => setUpgradeModalOpen(true)}
      />

      {/* ── Request Access Upgrade Modal ────────────────────────────────────── */}
      {upgradeModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px',
          }}
          onClick={() => setUpgradeModalOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '480px',
              background: '#0D111A',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: radius.lg,
              boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: colors.textPrimary, margin: '0 0 4px' }}>
                Request Workspace Upgrade
              </h3>
              <p style={{ fontSize: '12px', color: colors.textMuted, margin: 0 }}>
                Request access to academic schemas or approved practitioner tiers.
              </p>
            </div>

            {upgradeSuccess ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '24px',
                  textAlign: 'center',
                  background: 'rgba(16, 185, 129, 0.05)',
                  border: '1px solid rgba(16, 185, 129, 0.15)',
                  borderRadius: radius.md,
                }}
              >
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'rgba(16, 185, 129, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: colors.emerald,
                  }}
                >
                  <Icon icon="solar:check-circle-bold" width={20} />
                </div>
                <span style={{ fontSize: '14px', fontWeight: 600, color: colors.textPrimary }}>
                  Upgrade Request Submitted
                </span>
                <span style={{ fontSize: '12px', color: colors.textMuted }}>
                  Your justification has been recorded and logged. Administrators will review your request shortly.
                </span>
              </div>
            ) : (
              <form
                onSubmit={async (e) => {
                  e.preventDefault()
                  if (!termsAccepted) {
                    setUpgradeError('You must accept the terms.')
                    return
                  }
                  setSubmittingUpgrade(true)
                  setUpgradeError(null)
                  setUpgradeSuccess(false)

                  try {
                    const res = await requestTierUpgrade({
                      targetTier,
                      justification,
                    })

                    if (res.success) {
                      setUpgradeSuccess(true)
                      setJustification('')
                      setTermsAccepted(false)
                      setTimeout(() => {
                        setUpgradeModalOpen(false)
                        setUpgradeSuccess(false)
                      }, 3000)
                    } else {
                      setUpgradeError(res.error || 'Failed to submit request')
                    }
                  } catch (err) {
                    setUpgradeError('Connection error occurred.')
                  } finally {
                    setSubmittingUpgrade(false)
                  }
                }}
                style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
              >
                {upgradeError && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 12px',
                      background: 'rgba(244, 63, 94, 0.05)',
                      border: '1px solid rgba(244, 63, 94, 0.15)',
                      borderRadius: radius.sm,
                      color: colors.rose,
                      fontSize: '12px',
                    }}
                  >
                    <AlertCircle size={14} style={{ flexShrink: 0 }} />
                    <span>{upgradeError}</span>
                  </div>
                )}

                {/* Target Tier Selection */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: colors.textSecondary, textTransform: 'uppercase' }}>
                    Target Role Tier
                  </label>
                  <select
                    value={targetTier}
                    onChange={(e) => setTargetTier(e.target.value as any)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: radius.sm,
                      color: colors.textPrimary,
                      fontSize: '13px',
                      outline: 'none',
                    }}
                  >
                    <option value="academic_user" style={{ background: '#0D111A' }}>Academic Scholar (Limit: 100 AI queries, 25 uploads)</option>
                    <option value="approved_user" style={{ background: '#0D111A' }}>Approved Practitioner (Limit: 250 AI queries, 100 uploads)</option>
                  </select>
                </div>

                {/* Justification Textarea */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: colors.textSecondary, textTransform: 'uppercase' }}>
                      Justification
                    </label>
                    <span style={{ fontSize: '10px', color: colors.textMuted }}>
                      {justification.length} / 500 chars
                    </span>
                  </div>
                  <textarea
                    value={justification}
                    onChange={(e) => setJustification(e.target.value)}
                    required
                    maxLength={500}
                    placeholder="Briefly explain how AegisRAG will be utilized for research, enterprise validation, or regulatory audits..."
                    style={{
                      width: '100%',
                      height: '100px',
                      padding: '10px 12px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: radius.sm,
                      color: colors.textPrimary,
                      fontSize: '13px',
                      outline: 'none',
                      resize: 'none',
                      lineHeight: '1.5',
                    }}
                  />
                </div>

                {/* Terms and Conditions Checkbox */}
                <label style={{ display: 'flex', gap: '8px', cursor: 'pointer', userSelect: 'none', alignItems: 'flex-start' }}>
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    required
                    style={{ marginTop: '2px', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '11px', color: colors.textMuted, lineHeight: '1.4' }}>
                    I certify that all information is accurate and will adhere to workspace policies.
                  </span>
                </label>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setUpgradeModalOpen(false)}
                    style={{
                      padding: '8px 16px',
                      background: 'transparent',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: radius.sm,
                      color: colors.textSecondary,
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingUpgrade}
                    style={{
                      padding: '8px 16px',
                      background: colors.indigo,
                      border: 'none',
                      borderRadius: radius.sm,
                      color: '#fff',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      opacity: submittingUpgrade ? 0.7 : 1,
                    }}
                  >
                    {submittingUpgrade ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}


