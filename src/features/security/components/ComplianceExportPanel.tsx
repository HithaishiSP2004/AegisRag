'use client'

import { useState, useEffect } from 'react'
import { Icon } from '@iconify/react'
import { colors, radius, font, shadow, transition } from '@/components/ui/tokens'

interface Issue {
  type: 'evidence_completeness' | 'reference_integrity' | 'signoff_coverage'
  severity: 'critical' | 'high' | 'medium'
  message: string
  control_id: string
  control_code: string
}

interface ReadinessStats {
  totalControls: number
  controlsWithEvidence: number
  controlsWithSignoff: number
  totalEvidenceCount: number
  validEvidenceCount: number
}

interface ReadinessData {
  score: number
  stats: ReadinessStats
  issues: Issue[]
}

export function ComplianceExportPanel() {
  const [days,     setDays]     = useState(30)
  const [format,   setFormat]   = useState<'json' | 'csv' | 'pdf'>('pdf')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [preview,  setPreview]  = useState<any | null>(null)

  // Compliance Readiness Validator States
  const [readiness, setReadiness] = useState<ReadinessData | null>(null)
  const [validating, setValidating] = useState(true)
  const [bypassWarnings, setBypassWarnings] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [showIssues, setShowIssues] = useState(false)

  async function fetchReadiness() {
    setValidating(true)
    setValidationError(null)
    try {
      const res = await fetch('/api/compliance/readiness')
      if (!res.ok) throw new Error('Failed to run compliance validation scan')
      const data = await res.json()
      setReadiness(data)
    } catch (err) {
      setValidationError(String(err))
    } finally {
      setValidating(false)
    }
  }

  useEffect(() => {
    fetchReadiness()
  }, [])

  async function doExport() {
    setLoading(true)
    setError(null)
    setPreview(null)
    try {
      if (format === 'pdf') {
        const res = await fetch(`/api/security/compliance-export?days=${days}&format=pdf`)
        if (!res.ok) {
          const d = await res.json().catch(() => ({}))
          setError(d.error ?? 'PDF export is not available on your current tier. Please request a tier upgrade.')
          return
        }
        const blob = await res.blob()
        const url  = URL.createObjectURL(blob)
        const a    = document.createElement('a')
        a.href     = url
        a.download = `aegisrag-compliance-evidence-${new Date().toISOString().slice(0, 10)}.pdf`
        a.click()
        URL.revokeObjectURL(url)

      } else if (format === 'csv') {
        const csvRes = await fetch(`/api/security/compliance-export?days=${days}&format=csv`)
        if (!csvRes.ok) throw new Error('Failed to retrieve CSV file')
        const blob = await csvRes.blob()
        const url  = URL.createObjectURL(blob)
        const a    = document.createElement('a')
        a.href     = url
        a.download = `aegisrag-evidence-${new Date().toISOString().slice(0,10)}.csv`
        a.click()
        URL.revokeObjectURL(url)

      } else {
        const res = await fetch(`/api/security/compliance-export?days=${days}&format=json`)
        if (!res.ok) {
          const d = await res.json()
          setError(d.error ?? 'Export failed')
          return
        }
        const data = await res.json()
        setPreview(data)
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  // Determine export block conditions
  const hasCriticalOrHigh = readiness
    ? readiness.issues.some(i => i.severity === 'critical' || i.severity === 'high')
    : false
  const isExportBlocked = hasCriticalOrHigh && !bypassWarnings

  const getScoreColor = (score: number) => {
    if (score >= 90) return '#10B981' // Green
    if (score >= 70) return '#F59E0B' // Orange
    return '#F43F5E' // Red
  }

  return (
    <div style={{ background: '#0A0E1A', border: '1px solid rgba(255,255,255,0.06)', borderRadius: radius.xl, overflow: 'hidden', fontFamily: font.sans }}>
      {/* Header */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Icon icon="solar:file-download-bold" width={17} style={{ color: '#10B981' }} />
          <span style={{ color: '#E2E8F0', fontWeight: 600, fontSize: '0.9rem' }}>Compliance Evidence Center</span>
        </div>
        <button
          onClick={fetchReadiness}
          disabled={validating}
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: radius.md,
            color: colors.textSecondary,
            padding: '4px 8px',
            fontSize: '0.7rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            transition: transition.fast
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
        >
          <Icon icon="solar:refresh-bold" width={12} className={validating ? 'spin-anim' : ''} />
          <span>{validating ? 'Scanning...' : 'Run Scan'}</span>
        </button>
      </div>

      <div style={{ padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <p style={{ color: '#64748B', fontSize: '0.78rem', margin: 0, lineHeight: 1.4 }}>
          Export a structured evidence package for audit submissions or regulatory reviews.
          Generates a multi-page PDF with cryptographic verification seals of all system activities.
        </p>

        {/* ── Compliance Readiness Validator Widget ── */}
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: radius.lg,
          padding: '16px'
        }}>
          {validating && !readiness ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 0', gap: '8px', color: colors.textSecondary, fontSize: '0.78rem' }}>
              <Icon icon="solar:refresh-bold" width={16} style={{ animation: 'spin 1.5s linear infinite' }} />
              <span>Analyzing compliance database readiness...</span>
            </div>
          ) : validationError ? (
            <div style={{ color: '#F43F5E', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Icon icon="solar:danger-bold" width={16} />
              <span>Validation failed: {validationError}</span>
            </div>
          ) : readiness ? (
            <div>
              {/* Score and Overview */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {/* Gauge */}
                  <div style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    border: `3px solid ${getScoreColor(readiness.score)}1A`,
                    borderTop: `3px solid ${getScoreColor(readiness.score)}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    color: getScoreColor(readiness.score)
                  }}>
                    {readiness.score}%
                  </div>
                  <div>
                    <div style={{ color: '#E2E8F0', fontSize: '0.8rem', fontWeight: 600 }}>Compliance Readiness Score</div>
                    <div style={{ color: '#64748B', fontSize: '0.7rem', marginTop: '1px' }}>
                      {readiness.score >= 90 ? 'SOC2 / ISO27001 Audit Ready' : readiness.score >= 70 ? 'Ready with Minor Issues' : 'Action Required Before Audit'}
                    </div>
                  </div>
                </div>

                {/* Badges/Checks */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <div style={checkBadgeStyle(readiness.stats.controlsWithEvidence === readiness.stats.totalControls)}>
                    <Icon icon={readiness.stats.controlsWithEvidence === readiness.stats.totalControls ? "solar:shield-check-bold" : "solar:shield-warning-bold"} width={12} />
                    <span>Evidence: {readiness.stats.controlsWithEvidence}/{readiness.stats.totalControls}</span>
                  </div>
                  <div style={checkBadgeStyle(readiness.stats.validEvidenceCount === readiness.stats.totalEvidenceCount && readiness.stats.totalEvidenceCount > 0)}>
                    <Icon icon={(readiness.stats.validEvidenceCount === readiness.stats.totalEvidenceCount && readiness.stats.totalEvidenceCount > 0) ? "solar:shield-check-bold" : "solar:shield-warning-bold"} width={12} />
                    <span>Integrity: {readiness.stats.validEvidenceCount}/{readiness.stats.totalEvidenceCount}</span>
                  </div>
                  <div style={checkBadgeStyle(readiness.stats.controlsWithSignoff === readiness.stats.totalControls)}>
                    <Icon icon={readiness.stats.controlsWithSignoff === readiness.stats.totalControls ? "solar:shield-check-bold" : "solar:shield-warning-bold"} width={12} />
                    <span>Sign-offs: {readiness.stats.controlsWithSignoff}/{readiness.stats.totalControls}</span>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.04)', borderRadius: '3px', overflow: 'hidden', marginBottom: '16px' }}>
                <div style={{ width: `${readiness.score}%`, height: '100%', background: getScoreColor(readiness.score), borderRadius: '3px', transition: 'width 0.4s ease' }} />
              </div>

              {/* Issues Alerts List */}
              {readiness.issues.length > 0 && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '12px' }}>
                  <button
                    onClick={() => setShowIssues(!showIssues)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: showIssues ? '#E2E8F0' : colors.textSecondary,
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: 0
                    }}
                  >
                    <Icon icon={showIssues ? "solar:alt-arrow-up-bold" : "solar:alt-arrow-down-bold"} width={12} />
                    <span>{showIssues ? 'Hide Alerts' : `View ${readiness.issues.length} Compliance Alerts`}</span>
                  </button>

                  {showIssues && (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      marginTop: '10px',
                      maxHeight: '160px',
                      overflowY: 'auto',
                      paddingRight: '4px'
                    }}>
                      {readiness.issues.map((iss, i) => (
                        <div key={i} style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '8px',
                          padding: '6px 10px',
                          borderRadius: radius.md,
                          background: iss.severity === 'critical' ? 'rgba(244,63,94,0.04)' : iss.severity === 'high' ? 'rgba(251,146,60,0.04)' : 'rgba(245,158,11,0.04)',
                          border: `1px solid ${iss.severity === 'critical' ? 'rgba(244,63,94,0.15)' : iss.severity === 'high' ? 'rgba(251,146,60,0.15)' : 'rgba(245,158,11,0.15)'}`
                        }}>
                          <span style={{
                            fontSize: '0.62rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            padding: '1px 5px',
                            borderRadius: '3px',
                            background: iss.severity === 'critical' ? '#F43F5E25' : iss.severity === 'high' ? '#FB923C25' : '#F59E0B25',
                            color: iss.severity === 'critical' ? '#F43F5E' : iss.severity === 'high' ? '#FB923C' : '#F59E0B',
                            marginTop: '1px'
                          }}>
                            {iss.severity}
                          </span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                            <span style={{ color: '#E2E8F0', fontSize: '0.72rem', fontWeight: 600 }}>{iss.control_code}</span>
                            <span style={{ color: '#94A3B8', fontSize: '0.68rem', lineHeight: 1.3 }}>{iss.message}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Blocking Warnings Banner */}
        {hasCriticalOrHigh && (
          <div style={{
            background: 'rgba(244,63,94,0.03)',
            border: '1px solid rgba(244,63,94,0.15)',
            borderRadius: radius.lg,
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#F43F5E' }}>
              <Icon icon="solar:danger-bold" width={16} />
              <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Export Restriction Enforced</span>
            </div>
            <p style={{ color: '#94A3B8', fontSize: '0.72rem', margin: 0, lineHeight: 1.35 }}>
              Critical validation failures (missing evidence or broken references) exist. Submitting this report to external auditors will likely fail SOC2 / ISO27001 readiness standards.
            </p>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: '#F8FAFC',
              fontSize: '0.72rem',
              cursor: 'pointer',
              marginTop: '4px',
              userSelect: 'none'
            }}>
              <input
                type="checkbox"
                id="bypass-warnings"
                checked={bypassWarnings}
                onChange={(e) => setBypassWarnings(e.target.checked)}
                style={{
                  accentColor: '#F43F5E',
                  borderRadius: '3px',
                  width: '13px',
                  height: '13px',
                  cursor: 'pointer'
                }}
              />
              <span>I acknowledge the compliance errors and want to proceed with exporting an incomplete package.</span>
            </label>
          </div>
        )}

        {/* Controls */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <label style={{ color: '#64748B', fontSize: '0.68rem', display: 'block', marginBottom: '4px' }}>Period</label>
            <select
              id="export-days"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              style={selStyle}
            >
              {[7, 14, 30, 60, 90].map((d) => (
                <option key={d} value={d} style={{ background: '#0D1117', color: '#94A3B8' }}>Last {d} days</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ color: '#64748B', fontSize: '0.68rem', display: 'block', marginBottom: '4px' }}>Format</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              {(['pdf', 'csv', 'json'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: radius.md,
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                    background: format === f ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.04)',
                    border: format === f ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(255,255,255,0.08)',
                    color: format === f ? '#10B981' : '#64748B',
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 'auto' }}>
            <button
              id="export-download"
              onClick={doExport}
              disabled={loading || isExportBlocked}
              style={{
                padding: '8px 20px',
                borderRadius: radius.md,
                fontSize: '0.78rem',
                cursor: isExportBlocked ? 'not-allowed' : 'pointer',
                background: loading || isExportBlocked ? 'rgba(255,255,255,0.03)' : 'rgba(16,185,129,0.12)',
                border: isExportBlocked ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(16,185,129,0.25)',
                color: isExportBlocked ? colors.textMuted : '#10B981',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                opacity: loading || isExportBlocked ? 0.6 : 1,
              }}
            >
              <Icon icon={loading ? 'solar:refresh-bold' : 'solar:download-bold'} width={15} />
              {loading ? 'Exporting…' : format === 'pdf' ? 'Export Audit PDF' : format === 'csv' ? 'Download CSV' : 'Preview JSON'}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.15)', borderRadius: radius.md, color: '#F43F5E', fontSize: '0.78rem' }}>
            {error}
          </div>
        )}

        {/* JSON preview */}
        {preview && format === 'json' && (
          <div>
            <div style={{ color: '#E2E8F0', fontSize: '0.72rem', marginBottom: '8px', fontWeight: 600 }}>
              Evidence Preview (JSON)
            </div>
            {/* Summary table */}
            {(preview.evidence as { summary?: Record<string, number> })?.summary && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px', marginBottom: '12px' }}>
                {Object.entries((preview.evidence as { summary: Record<string, number> }).summary).map(([k, v]) => (
                  <div key={k} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: radius.md, padding: '10px 14px' }}>
                    <div style={{ color: '#10B981', fontSize: '1.1rem', fontWeight: 700 }}>{String(v)}</div>
                    <div style={{ color: '#64748B', fontSize: '0.65rem', marginTop: '3px' }}>{k.replace(/_/g, ' ')}</div>
                  </div>
                ))}
              </div>
            )}
            <pre style={{
              margin: 0,
              padding: '12px',
              borderRadius: radius.md,
              background: 'rgba(255,255,255,0.01)',
              border: '1px solid rgba(255,255,255,0.03)',
              color: '#64748B',
              fontSize: '0.65rem',
              overflow: 'auto',
              maxHeight: '280px',
            }}>
              {JSON.stringify(preview, null, 2)}
            </pre>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin-anim {
          animation: spin 1.5s linear infinite;
        }
      `}</style>
    </div>
  )
}

const selStyle: React.CSSProperties = {
  background: '#0D1117',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: radius.md,
  color: '#94A3B8',
  fontSize: '0.72rem',
  padding: '6px 10px',
  outline: 'none',
}

const checkBadgeStyle = (passed: boolean): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  padding: '3px 8px',
  borderRadius: radius.full,
  fontSize: '0.65rem',
  fontWeight: 600,
  background: passed ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)',
  border: `1px solid ${passed ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)'}`,
  color: passed ? '#10B981' : '#F59E0B',
})
