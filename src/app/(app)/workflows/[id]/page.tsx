'use client'

import { use, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { colors, radius, font, transition } from '@/components/ui/tokens'
import type { ComplianceReportContent, ComplianceViolation, EvidenceCitation } from '@/features/workflows/types'

import {
  Loader2,
  AlertTriangle,
  CheckCircle,
  FileText,
  FileJson,
  ArrowLeft,
  ChevronRight,
  ShieldCheck,
  Zap,
  Info,
  Calendar,
  Clock,
  User,
  Search,
  ExternalLink,
  RefreshCw
} from 'lucide-react'

interface Violation {
  id: string
  clause_text: string
  policy_reference: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  description: string
  recommendation: string | null
  evidence_chunk_ids: string[]
  confidence_score: number
}

interface EvidenceItem {
  chunk_id: string
  content: string
  source_doc: string
  page_number: number
  framework: string | null
}

interface RecommendationItem {
  priority: 'critical' | 'high' | 'medium' | 'low'
  action: string
  rationale: string
}

interface WorkflowDetail {
  id: string
  name: string
  status: 'pending' | 'retrieving' | 'analyzing' | 'generating' | 'complete' | 'failed'
  progress_pct: number
  current_step: string | null
  error_message: string | null
  result_summary?: string | null
  created_at: string
  documents?: {
    original_name: string
    filename: string
  }
}

export default function WorkflowDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params)
  const router = useRouter()

  const [workflow, setWorkflow] = useState<WorkflowDetail | null>(null)
  const [report, setReport] = useState<any | null>(null)
  const [violations, setViolations] = useState<Violation[]>([])
  const [downloads, setDownloads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Interactive UI State
  const [selectedViolationId, setSelectedViolationId] = useState<string | null>(null)
  const [downloadingFormat, setDownloadingFormat] = useState<string | null>(null)
  const [resuming, setResuming] = useState(false)
  const [resumeError, setResumeError] = useState<string | null>(null)

  const handleResumeWorkflow = async () => {
    setResuming(true)
    setResumeError(null)
    try {
      const res = await fetch(`/api/workflows/${id}/resume`, {
        method: 'POST'
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to resume workflow')
      }
      await fetchDetails()
    } catch (err: any) {
      console.error(err)
      setResumeError(err.message || 'Failed to resume workflow')
    } finally {
      setResuming(false)
    }
  }

  // Fetch workflow details
  const fetchDetails = useCallback(async () => {
    try {
      const res = await fetch(`/api/workflows/${id}`)
      if (!res.ok) {
        throw new Error('Failed to retrieve workflow detail')
      }
      const json = await res.json()
      setWorkflow(json.workflow)
      setReport(json.report)
      setViolations(json.violations || [])
      setDownloads(json.downloads || [])

      if (json.violations && json.violations.length > 0 && !selectedViolationId) {
        setSelectedViolationId(json.violations[0].id)
      }
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Failed to load workflow')
    } finally {
      setLoading(false)
    }
  }, [id, selectedViolationId])

  // Initial load
  useEffect(() => {
    fetchDetails()
  }, [fetchDetails])

  // Polling for progress updates if workflow is not complete/failed
  useEffect(() => {
    if (!workflow) return
    const isTerminal = ['complete', 'failed'].includes(workflow.status)
    if (isTerminal) return

    const timer = setInterval(() => {
      fetchDetails()
    }, 1500)

    return () => clearInterval(timer)
  }, [workflow, fetchDetails])

  // Handle report downloads via pre-signed URL history endpoint
  const handleDownloadReport = async (format: 'PDF' | 'JSON') => {
    const record = downloads.find(d => d.format === format)
    if (!record) {
      alert(`Download file not ready yet. Please wait.`)
      return
    }

    setDownloadingFormat(format)
    try {
      const res = await fetch(`/api/reports/download?id=${record.id}`)
      if (!res.ok) {
        throw new Error('Failed to generate secure download link')
      }
      const data = await res.json()
      if (data.url) {
        window.open(data.url, '_blank')
      } else {
        throw new Error('No URL returned from server')
      }
    } catch (err: any) {
      alert(`Download failed: ${err.message}`)
    } finally {
      setDownloadingFormat(null)
    }
  }

  if (loading && !workflow) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px', color: colors.textSecondary }}>
        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: colors.indigoLight }} />
        <span style={{ fontSize: '0.8125rem', fontFamily: font.mono }}>Loading workflow workspace...</span>
      </div>
    )
  }

  if (error || !workflow) {
    return (
      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '600px', margin: '40px auto', color: colors.textPrimary }}>
        <div style={{ background: 'rgba(244,63,94,0.05)', border: `1px solid rgba(244,63,94,0.15)`, borderRadius: radius.lg, padding: '20px', display: 'flex', gap: '12px' }}>
          <AlertTriangle size={20} style={{ color: colors.rose, flexShrink: 0 }} />
          <div>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '0.9rem', fontWeight: 700 }}>Error Loading Workflow</h3>
            <p style={{ margin: 0, fontSize: '0.8rem', color: colors.textSecondary }}>{error || 'Workflow not found.'}</p>
          </div>
        </div>
        <button onClick={() => router.push('/workflows')} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: colors.glassSurface, border: `1px solid ${colors.glassBorder}`, borderRadius: radius.md, padding: '8px 16px', color: colors.textPrimary, cursor: 'pointer', outline: 'none' }}>
          <ArrowLeft size={14} /> Back to Workflows
        </button>
      </div>
    )
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 1. RUNNING PROGRESS VIEW
  // ───────────────────────────────────────────────────────────────────────────
  const isRunning = !['complete', 'failed'].includes(workflow.status)
  if (isRunning) {
    const progress = workflow.progress_pct ?? 0
    
    // Status colors
    const getStatusTheme = () => {
      switch (workflow.status) {
        case 'retrieving':
          return { color: colors.violetLight, bg: 'rgba(139,92,246,0.12)' }
        case 'analyzing':
          return { color: colors.blueLight, bg: 'rgba(59,130,246,0.12)' }
        case 'generating':
          return { color: colors.amberLight, bg: 'rgba(245,158,11,0.12)' }
        default:
          return { color: colors.textSecondary, bg: colors.glassSurface }
      }
    }

    const theme = getStatusTheme()

    return (
      <div style={{
        padding: '24px',
        maxWidth: '800px',
        margin: '60px auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        color: colors.textPrimary,
        alignItems: 'center',
        textAlign: 'center'
      }}>
        {/* Back Button */}
        <div style={{ alignSelf: 'flex-start' }}>
          <button
            onClick={() => router.push('/workflows')}
            style={{
              background: 'none', border: 'none', color: colors.textSecondary,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
              fontSize: '0.75rem', fontWeight: 600, outline: 'none'
            }}
          >
            <ArrowLeft size={13} /> BACK TO LIST
          </button>
        </div>

        {/* Loading HUD Shield */}
        <div style={{
          width: '72px', height: '72px', borderRadius: '50%',
          background: theme.bg,
          border: `1px solid ${theme.color}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 24px ${theme.color}20`,
          position: 'relative',
          marginBottom: '8px'
        }}>
          <Loader2 size={30} style={{ animation: 'spin 1.8s linear infinite', color: theme.color }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>{workflow.name}</h2>
          <span style={{
            fontSize: '0.625rem',
            fontFamily: font.mono,
            color: theme.color,
            background: theme.bg,
            padding: '3px 10px',
            borderRadius: radius.full,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            alignSelf: 'center',
            fontWeight: 700
          }}>
            {workflow.status}
          </span>
        </div>

        <p style={{ color: colors.textSecondary, fontSize: '0.8125rem', maxWidth: '480px', margin: 0 }}>
          {workflow.current_step || 'Initializing review pipeline...'}
        </p>

        {/* Progress Bar */}
        <div style={{ width: '100%', maxWidth: '450px', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
          <div style={{
            width: '100%', height: '5px', background: 'rgba(255,255,255,0.02)',
            border: `1px solid ${colors.glassBorder}`, borderRadius: radius.full,
            position: 'relative', overflow: 'hidden'
          }}>
            <div style={{
              position: 'absolute', top: 0, left: 0, bottom: 0,
              width: `${progress}%`,
              background: `linear-gradient(90deg, ${colors.indigo}, ${theme.color})`,
              boxShadow: `0 0 12px ${theme.color}40`,
              transition: 'width 0.4s ease'
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', fontFamily: font.mono, color: colors.textSecondary }}>
            <span>RAG SECURE PIPELINE IN PROGRESS</span>
            <span>{progress}%</span>
          </div>
        </div>
      </div>
    )
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 2. FAILED STATE VIEW
  // ───────────────────────────────────────────────────────────────────────────
  if (workflow.status === 'failed') {
    const isInsufficientEvidence = workflow.error_message === 'INSUFFICIENT_EVIDENCE'
    
    let suggestedDocs: string[] = []
    let suggestedTerms: string[] = []
    if (isInsufficientEvidence && workflow.result_summary) {
      try {
        const summaryData = JSON.parse(workflow.result_summary)
        suggestedDocs = summaryData.suggested_documents || []
        suggestedTerms = summaryData.suggested_search_terms || []
      } catch (e) {
        console.error('Failed to parse result_summary:', e)
      }
    }

    return (
      <div style={{
        padding: '24px',
        maxWidth: '800px',
        margin: '50px auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        color: colors.textPrimary,
      }}>
        {/* Back Button */}
        <div>
          <button
            onClick={() => router.push('/workflows')}
            style={{
              background: 'none', border: 'none', color: colors.textSecondary,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
              fontSize: '0.75rem', fontWeight: 600, outline: 'none'
            }}
          >
            <ArrowLeft size={13} /> BACK TO LIST
          </button>
        </div>

        <div style={{
          background: isInsufficientEvidence ? 'rgba(245,158,11,0.03)' : 'rgba(244,63,94,0.03)',
          border: `1px solid ${isInsufficientEvidence ? 'rgba(245,158,11,0.15)' : 'rgba(244,63,94,0.15)'}`,
          borderRadius: radius.xl,
          padding: '36px 30px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '24px',
          textAlign: 'center',
          boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
          backdropFilter: 'blur(8px)'
        }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%',
            background: isInsufficientEvidence ? 'rgba(245,158,11,0.08)' : 'rgba(244,63,94,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `1px solid ${isInsufficientEvidence ? colors.amber : colors.rose}`
          }}>
            <AlertTriangle size={32} style={{ color: isInsufficientEvidence ? colors.amber : colors.rose }} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
              {isInsufficientEvidence ? 'Retrieval Failure: Insufficient Evidence' : 'Review Execution Failed'}
            </h2>
            <p style={{ color: isInsufficientEvidence ? colors.amberLight : colors.roseLight, fontSize: '0.8125rem', fontFamily: font.mono, margin: 0 }}>
              Error ID: {workflow.error_message || 'AN_UNKNOWN_FAILURE'}
            </p>
          </div>

          <p style={{ color: colors.textSecondary, fontSize: '0.85rem', maxWidth: '520px', margin: 0, lineHeight: 1.5 }}>
            {isInsufficientEvidence 
              ? 'The document index search could not retrieve sufficient grounded evidence to evaluate your chosen compliance frameworks. Please review the recommendations below before resuming.'
              : 'This failure can occur if the AI model rate limits were hit, connection timed out, or storage uploads failed. You can resume execution from the last successful checkpoint.'}
          </p>

          {/* Insufficient Evidence Fallback Suggestions */}
          {isInsufficientEvidence && (
            <div style={{
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              textAlign: 'left',
              marginTop: '8px',
              background: 'rgba(255,255,255,0.01)',
              border: `1px solid ${colors.glassBorder}`,
              borderRadius: radius.lg,
              padding: '20px'
            }}>
              <h3 style={{ fontSize: '0.8125rem', fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em', color: colors.amberLight, display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Info size={14} /> GRC Fallback recommendations
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {/* Recommended Documents */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: colors.textPrimary, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={13} style={{ color: colors.indigoLight }} /> Suggested Reference Documents
                  </span>
                  {suggestedDocs.length > 0 ? (
                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.75rem', color: colors.textSecondary, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {suggestedDocs.map((doc, idx) => (
                        <li key={idx}>{doc}</li>
                      ))}
                    </ul>
                  ) : (
                    <span style={{ fontSize: '0.72rem', color: colors.textMuted }}>No documents suggested.</span>
                  )}
                </div>

                {/* Suggested Search Terms */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: colors.textPrimary, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Search size={13} style={{ color: colors.cyan }} /> Recommended Search Queries
                  </span>
                  {suggestedTerms.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {suggestedTerms.map((term, idx) => (
                        <span key={idx} style={{
                          padding: '3px 8px',
                          background: 'rgba(255,255,255,0.03)',
                          border: `1px solid ${colors.glassBorder}`,
                          borderRadius: radius.xs,
                          fontSize: '0.68rem',
                          fontFamily: font.mono,
                          color: colors.textSecondary
                        }}>
                          {term}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.72rem', color: colors.textMuted }}>No search queries suggested.</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', width: '100%' }}>
            <button
              onClick={handleResumeWorkflow}
              disabled={resuming}
              style={{
                background: `linear-gradient(135deg, ${colors.indigo}, ${colors.violet})`,
                color: '#fff', border: 'none', borderRadius: radius.md,
                padding: '10px 20px', cursor: resuming ? 'not-allowed' : 'pointer', fontWeight: 700,
                fontSize: '0.875rem', boxShadow: '0 4px 16px rgba(99,102,241,0.2)',
                display: 'inline-flex', alignItems: 'center', gap: '8px',
                transition: transition.fast,
                opacity: resuming ? 0.7 : 1
              }}
            >
              {resuming ? (
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                <RefreshCw size={16} />
              )}
              <span>{resuming ? 'Resuming Audit...' : 'Resume Execution'}</span>
            </button>

            <button
              onClick={() => router.push('/workflows')}
              style={{
                background: 'rgba(255,255,255,0.02)',
                color: colors.textPrimary, border: `1px solid ${colors.glassBorder}`, borderRadius: radius.md,
                padding: '10px 20px', cursor: 'pointer', fontWeight: 600,
                fontSize: '0.875rem', transition: transition.fast
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
            >
              Launch New Audit
            </button>
          </div>

          {/* Error feedback */}
          {resumeError && (
            <div style={{
              width: '100%',
              padding: '12px 16px',
              background: 'rgba(244,63,94,0.08)',
              border: `1px solid rgba(244,63,94,0.2)`,
              borderRadius: radius.md,
              color: colors.roseLight,
              fontSize: '0.78rem',
              textAlign: 'left'
            }}>
              <strong>Resumption Failed:</strong> {resumeError}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 3. COMPLETED REPORT VIEW
  // ───────────────────────────────────────────────────────────────────────────
  const reportPayload: ComplianceReportContent = report?.content || {}
  const activeViolation = violations.find(v => v.id === selectedViolationId)
  
  // HUD ring gauge helper
  const renderScoreGauge = (score: number, maxScore: number, label: string, color: string, glow: string) => {
    const radius = 28
    const circumference = 2 * Math.PI * radius
    const strokeDashoffset = circumference - (score / maxScore) * circumference

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', flex: 1 }}>
        <div style={{ position: 'relative', width: '72px', height: '72px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="72" height="72" viewBox="0 0 72 72" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="36" cy="36" r={radius} fill="transparent" stroke="rgba(255,255,255,0.02)" strokeWidth="5" />
            <circle
              cx="36" cy="36" r={radius} fill="transparent"
              stroke={color} strokeWidth="5"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              style={{
                transition: 'stroke-dashoffset 0.6s ease',
                filter: `drop-shadow(0 0 4px ${glow})`
              }}
            />
          </svg>
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.95rem', fontWeight: 800, fontFamily: font.mono, color: colors.textPrimary
          }}>
            {score}
            {maxScore === 100 && '%'}
          </div>
        </div>
        <span style={{ fontSize: '0.625rem', fontFamily: font.mono, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'center' }}>
          {label}
        </span>
      </div>
    )
  }

  const getSeverityStyle = (sev: string) => {
    switch (sev) {
      case 'critical':
        return { text: colors.rose, bg: 'rgba(244,63,94,0.1)' }
      case 'high':
        return { text: colors.amber, bg: 'rgba(245,158,11,0.1)' }
      case 'medium':
        return { text: colors.violetLight, bg: 'rgba(139,92,246,0.1)' }
      default:
        return { text: colors.cyan, bg: 'rgba(34,211,238,0.1)' }
    }
  }

  const getStrengthStyle = (str: string) => {
    switch (str) {
      case 'high':
        return { text: colors.emerald, bg: 'rgba(16,185,129,0.08)' }
      case 'medium':
        return { text: colors.amber, bg: 'rgba(245,158,11,0.08)' }
      default:
        return { text: colors.indigoLight, bg: 'rgba(99,102,241,0.08)' }
    }
  }

  return (
    <div style={{
      padding: '24px',
      maxWidth: '1250px',
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      color: colors.textPrimary
    }}>
      {/* Top Breadcrumb & Downloads Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <button
          onClick={() => router.push('/workflows')}
          style={{
            background: 'none', border: 'none', color: colors.textSecondary,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
            fontSize: '0.75rem', fontWeight: 600, outline: 'none'
          }}
        >
          <ArrowLeft size={13} /> BACK TO COMPLIANCE RUNS
        </button>

        {/* Download Buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => handleDownloadReport('PDF')}
            disabled={downloadingFormat !== null}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '6px 14px', borderRadius: radius.md, cursor: 'pointer',
              border: `1px solid rgba(244,63,94,0.25)`,
              background: 'rgba(244,63,94,0.12)', color: '#FB7185',
              fontSize: '0.68rem', fontWeight: 700, fontFamily: font.mono,
              textTransform: 'uppercase', transition: transition.fast,
              opacity: downloadingFormat !== null ? 0.5 : 1
            }}
          >
            <FileText size={12} />
            <span>{downloadingFormat === 'PDF' ? 'Downloading...' : 'PDF Report'}</span>
          </button>

          <button
            onClick={() => handleDownloadReport('JSON')}
            disabled={downloadingFormat !== null}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '6px 14px', borderRadius: radius.md, cursor: 'pointer',
              border: `1px solid ${colors.glassBorder}`,
              background: 'rgba(255,255,255,0.02)', color: colors.textPrimary,
              fontSize: '0.68rem', fontWeight: 700, fontFamily: font.mono,
              textTransform: 'uppercase', transition: transition.fast,
              opacity: downloadingFormat !== null ? 0.5 : 1
            }}
          >
            <FileJson size={12} />
            <span>{downloadingFormat === 'JSON' ? 'Downloading...' : 'JSON Report'}</span>
          </button>
        </div>
      </div>

      {/* Main Title Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(13,17,28,0.9), rgba(8,12,20,0.9))',
        border: `1px solid ${colors.glassBorder}`,
        borderRadius: radius.xl,
        padding: '24px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '24px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '320px', flex: 1.5 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldCheck size={20} style={{ color: colors.emerald }} />
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
              {workflow.name}
            </h1>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '0.72rem', color: colors.textSecondary }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Calendar size={12} /> Executed: {new Date(workflow.created_at).toLocaleDateString()}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <FileText size={12} /> File: {workflow.documents?.original_name || 'Index File'}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={12} /> Duration: {reportPayload.telemetry?.analysis_duration_ms || 0}ms
            </span>
          </div>
        </div>

        {/* Ring HUD score panel */}
        <div style={{ display: 'flex', gap: '20px', flex: 1, justifyContent: 'flex-end', borderLeft: `1px solid ${colors.glassBorder}`, paddingLeft: '20px' }}>
          {renderScoreGauge(reportPayload.compliance_score ?? 0, 100, 'Compliance score', colors.emerald, 'rgba(16,185,129,0.4)')}
          {renderScoreGauge(reportPayload.risk_score ?? 0, 100, 'Risk exposure', colors.rose, 'rgba(244,63,94,0.4)')}
          {renderScoreGauge(reportPayload.confidence_score ?? 0, 100, 'Confidence Seal', colors.indigo, 'rgba(99,102,241,0.4)')}
        </div>
      </div>

      {/* Grid: Left Column (Summary + Findings List) & Right Column (Finding Detail / Citations) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '24px', alignItems: 'start' }}>
        {/* Left Side: Brief + Findings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Executive Brief Card */}
          <div style={{
            background: colors.bgCard,
            border: `1px solid ${colors.glassBorder}`,
            borderRadius: radius.xl,
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <h2 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em', color: colors.indigoLight }}>
              Executive Brief &amp; GRC Standing
            </h2>
            <p style={{ color: colors.textSecondary, fontSize: '0.8rem', lineHeight: 1.6, margin: 0 }}>
              {reportPayload.executive_summary}
            </p>
            <div style={{ borderTop: `1px solid ${colors.glassBorder}`, paddingTop: '10px', display: 'flex', gap: '6px', alignItems: 'center', fontSize: '0.72rem', color: colors.textSecondary }}>
              <Info size={12} />
              <span><strong>Methodology:</strong> {reportPayload.methodology}</span>
            </div>
          </div>

          {/* Gaps Findings Table list */}
          <div style={{
            background: colors.bgCard,
            border: `1px solid ${colors.glassBorder}`,
            borderRadius: radius.xl,
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${colors.glassBorder}`, paddingBottom: '10px' }}>
              <h2 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>
                Compliance Findings &amp; Gaps Registry
              </h2>
              <span style={{ background: 'rgba(255,255,255,0.04)', borderRadius: radius.full, padding: '2px 8px', fontSize: '0.65rem', fontFamily: font.mono, color: colors.textSecondary }}>
                {violations.length} Items Ingested
              </span>
            </div>

            {violations.length === 0 ? (
              <div style={{ padding: '30px', textAlign: 'center', color: colors.textMuted, fontSize: '0.8rem' }}>
                No Findings Available
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {violations.map((v, index) => {
                  const isSelected = v.id === selectedViolationId
                  const sevStyle = getSeverityStyle(v.severity)
                  // Find evidence strength from the report content violation record
                  const correspondingContentViol = reportPayload.violations?.find((cv: ComplianceViolation) => cv.clause === v.clause_text || cv.policy_reference === v.policy_reference)
                  const strength = correspondingContentViol?.evidence_strength || 'medium'
                  const strStyle = getStrengthStyle(strength)

                  return (
                    <button
                      key={v.id}
                      onClick={() => setSelectedViolationId(v.id)}
                      style={{
                        background: isSelected ? 'rgba(255,255,255,0.02)' : 'transparent',
                        border: `1px solid ${isSelected ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.03)'}`,
                        borderRadius: radius.md,
                        padding: '12px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        outline: 'none',
                        transition: transition.fast,
                        width: '100%'
                      }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.01)' }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.78rem', color: colors.textPrimary }}>
                          {index + 1}. Ref: {v.policy_reference}
                        </div>
                        <div style={{ color: colors.textSecondary, fontSize: '0.72rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {v.description}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                        <span style={{
                          padding: '2px 8px', borderRadius: radius.xs,
                          fontSize: '0.625rem', fontWeight: 700, fontFamily: font.mono,
                          color: sevStyle.text, background: sevStyle.bg, textTransform: 'uppercase'
                        }}>
                          {v.severity}
                        </span>
                        <span style={{
                          padding: '2px 8px', borderRadius: radius.xs,
                          fontSize: '0.625rem', fontWeight: 700, fontFamily: font.mono,
                          color: strStyle.text, background: strStyle.bg, textTransform: 'uppercase'
                        }}>
                          {strength} Strength
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Active Finding Detail, Citations & Recommendations */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Finding Detail Panel */}
          {activeViolation && (
            <div style={{
              background: colors.bgCard,
              border: `1px solid rgba(99,102,241,0.18)`,
              boxShadow: '0 0 16px rgba(99,102,241,0.06)',
              borderRadius: radius.xl,
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderBottom: `1px solid ${colors.glassBorder}`, paddingBottom: '10px' }}>
                <span style={{ fontSize: '0.65rem', fontFamily: font.mono, color: colors.textSecondary, textTransform: 'uppercase' }}>
                  Auditor Inspection Panel
                </span>
                <h2 style={{ fontSize: '0.9rem', fontWeight: 800, margin: 0 }}>
                  Gap Detail: {activeViolation.policy_reference}
                </h2>
              </div>

              {/* Description */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: colors.textSecondary, textTransform: 'uppercase' }}>Description</span>
                <p style={{ color: colors.textPrimary, fontSize: '0.78rem', lineHeight: 1.5, margin: 0 }}>
                  {activeViolation.description}
                </p>
              </div>

              {/* Clause */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: colors.rose, textTransform: 'uppercase' }}>Offending Document Clause</span>
                <div style={{
                  padding: '10px', background: 'rgba(244,63,94,0.03)',
                  border: `1px solid rgba(244,63,94,0.1)`, borderRadius: radius.md,
                  color: colors.textPrimary, fontSize: '0.75rem', fontFamily: font.sans, fontStyle: 'italic', lineHeight: 1.5
                }}>
                  "{activeViolation.clause_text}"
                </div>
              </div>

              {/* Recommendation */}
              {activeViolation.recommendation && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: colors.cyan, textTransform: 'uppercase' }}>Remediation Recommendation</span>
                  <p style={{ color: colors.textPrimary, fontSize: '0.78rem', lineHeight: 1.5, margin: 0 }}>
                    {activeViolation.recommendation}
                  </p>
                </div>
              )}

              {/* Mapped Citations */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: colors.indigoLight, textTransform: 'uppercase' }}>
                  Grounded Evidence Vault Citations
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(() => {
                    const matchedCitations = reportPayload.evidence?.filter((ev: EvidenceCitation) =>
                      activeViolation.evidence_chunk_ids?.includes(ev.chunk_id)
                    ) || []

                    if (matchedCitations.length === 0) {
                      return <span style={{ fontSize: '0.72rem', color: colors.textMuted }}>No exact citations linked to this finding.</span>
                    }

                    return matchedCitations.map((cit: EvidenceCitation, idx: number) => (
                      <div
                        key={cit.chunk_id}
                        style={{
                          background: colors.bgBase,
                          border: `1px solid ${colors.glassBorder}`,
                          borderRadius: radius.md,
                          padding: '10px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: colors.cyan, fontWeight: 700, marginBottom: '6px' }}>
                          <span>[{idx + 1}] Source: {cit.source_doc} (Page {cit.page_number})</span>
                          {cit.framework && <span style={{ color: colors.indigoLight }}>{cit.framework}</span>}
                        </div>
                        <p style={{ color: colors.textSecondary, fontSize: '0.72rem', lineHeight: 1.5, margin: 0, fontFamily: font.sans }}>
                          {cit.content.slice(0, 240)}...
                        </p>
                      </div>
                    ))
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Strategic Action Items / Recommendations */}
          <div style={{
            background: colors.bgCard,
            border: `1px solid ${colors.glassBorder}`,
            borderRadius: radius.xl,
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            <h2 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0 }}>
              Strategic Remediation Directives
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {(reportPayload.recommendations || []).map((rec: RecommendationItem, idx: number) => {
                const isHigh = rec.priority === 'critical' || rec.priority === 'high'
                return (
                  <div
                    key={idx}
                    style={{
                      padding: '10px 14px',
                      background: 'rgba(255,255,255,0.01)',
                      border: `1px solid ${colors.glassBorder}`,
                      borderRadius: radius.md,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, color: colors.textPrimary, fontSize: '0.78rem' }}>
                        Directive {idx + 1}: {rec.action}
                      </span>
                      <span style={{
                        padding: '1px 6px', borderRadius: radius.xs,
                        fontSize: '0.55rem', fontWeight: 700, fontFamily: font.mono,
                        color: isHigh ? colors.rose : colors.cyan,
                        background: isHigh ? 'rgba(244,63,94,0.08)' : 'rgba(34,211,238,0.08)',
                        textTransform: 'uppercase'
                      }}>
                        {rec.priority}
                      </span>
                    </div>
                    <p style={{ color: colors.textSecondary, fontSize: '0.72rem', margin: 0 }}>
                      {rec.rationale}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
