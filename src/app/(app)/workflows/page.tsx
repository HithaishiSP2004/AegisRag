'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { WORKFLOW_TEMPLATES, type WorkflowTemplate } from '@/features/workflows/types'
import { colors, radius, font, transition } from '@/components/ui/tokens'
import {
  Play,
  FileText,
  Layers,
  ChevronRight,
  Plus,
  Loader2,
  AlertCircle,
  CheckCircle,
  HelpCircle
} from 'lucide-react'
import type { DocumentFramework } from '@/types/database'

interface DocumentItem {
  id: string
  original_name: string
  filename: string
  status: string
}

interface WorkflowItem {
  id: string
  name: string
  status: 'pending' | 'retrieving' | 'analyzing' | 'generating' | 'complete' | 'failed'
  progress_pct: number
  current_step: string | null
  error_message: string | null
  created_at: string
}

export default function WorkflowsPage() {
  const router = useRouter()
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [workflows, setWorkflows] = useState<WorkflowItem[]>([])
  const [loadingDocs, setLoadingDocs] = useState(true)
  const [loadingWorkflows, setLoadingWorkflows] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form State
  const [selectedDocId, setSelectedDocId] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(WORKFLOW_TEMPLATES[0])
  const [customFrameworks, setCustomFrameworks] = useState<DocumentFramework[]>([])
  const [customName, setCustomName] = useState('')

  const supabase = createClient()

  // Load documents
  useEffect(() => {
    async function loadDocuments() {
      try {
        const { data, error: docErr } = await supabase
          .from('documents')
          .select('id, original_name, filename, status')
          .eq('status', 'indexed')

        if (docErr) throw docErr
        setDocuments(data || [])
        if (data && data.length > 0) {
          setSelectedDocId(data[0].id)
        }
      } catch (err: any) {
        console.error('Failed to load documents:', err.message)
      } finally {
        setLoadingDocs(false)
      }
    }
    loadDocuments()
  }, [])

  // Load past workflows
  const loadWorkflows = useCallback(async () => {
    try {
      const res = await fetch('/api/workflows')
      if (res.ok) {
        const json = await res.json()
        setWorkflows(json.workflows || [])
      }
    } catch (err) {
      console.error('Failed to load workflows:', err)
    } finally {
      setLoadingWorkflows(false)
    }
  }, [])

  useEffect(() => {
    loadWorkflows()
  }, [loadWorkflows])

  // Automatically update name when doc or template changes
  useEffect(() => {
    const doc = documents.find(d => d.id === selectedDocId)
    const docName = doc ? doc.original_name : 'Document'
    const templateName = selectedTemplate ? selectedTemplate.name : 'Custom Compliance Review'
    setCustomName(`${templateName} - ${docName}`)
  }, [selectedDocId, selectedTemplate, documents])

  // Handle template selection
  const handleSelectTemplate = (template: WorkflowTemplate | null) => {
    setSelectedTemplate(template)
    if (template) {
      setCustomFrameworks(template.frameworks)
    } else {
      setCustomFrameworks([])
    }
  }

  // Handle framework checkbox change (Custom selection)
  const handleFrameworkToggle = (fw: DocumentFramework) => {
    if (customFrameworks.includes(fw)) {
      setCustomFrameworks(prev => prev.filter(item => item !== fw))
    } else {
      if (customFrameworks.length >= 3) {
        // Capped at 3 frameworks max
        return
      }
      setCustomFrameworks(prev => [...prev, fw])
    }
  }

  // Form Submit
  const handleLaunchReview = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!selectedDocId) {
      setError('Please select a target document for compliance review.')
      return
    }

    const finalFrameworks = selectedTemplate ? selectedTemplate.frameworks : customFrameworks
    if (finalFrameworks.length === 0) {
      setError('Please select at least one compliance framework.')
      return
    }

    if (finalFrameworks.length > 3) {
      setError('Maximum of 3 frameworks can be selected.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: selectedDocId,
          frameworks: finalFrameworks,
          name: customName,
          templateId: selectedTemplate?.id || 'custom'
        })
      })

      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || 'Failed to trigger workflow')
      }

      router.push(`/workflows/${json.workflow.id}`)
    } catch (err: any) {
      setError(err.message || 'Failed to start compliance review')
      setSubmitting(false)
    }
  }

  const allFrameworks: DocumentFramework[] = [
    'GDPR',
    'HIPAA',
    'SOC2',
    'ISO27001',
    'NIST',
    'OWASP_LLM_TOP_10',
    'EU_AI_ACT'
  ]

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'complete':
        return <span style={{ color: colors.emerald, fontSize: '0.65rem', fontWeight: 700, fontFamily: font.mono, textTransform: 'uppercase' }}>● Complete</span>
      case 'failed':
        return <span style={{ color: colors.rose, fontSize: '0.65rem', fontWeight: 700, fontFamily: font.mono, textTransform: 'uppercase' }}>● Failed</span>
      default:
        return <span style={{ color: colors.violetLight, fontSize: '0.65rem', fontWeight: 700, fontFamily: font.mono, textTransform: 'uppercase', animation: 'pulse 1.5s infinite' }}>● Running</span>
    }
  }

  return (
    <div style={{
      padding: '24px',
      maxWidth: '1200px',
      margin: '0 auto',
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      minHeight: '100%',
      color: colors.textPrimary
    }}>
      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>
          Compliance Review Workflows
        </h1>
        <p style={{ color: colors.textSecondary, fontSize: '0.8125rem' }}>
          Automate GRC audit assessments on contracts, vendor policies, and security standards using Retrieve + Rerank pipelines.
        </p>
      </div>

      {/* Grid: Form (Left) & History (Right) */}
      <div className="cockpit-grid">
        {/* Launch Form Card */}
        <div style={{
          background: colors.bgCard,
          border: `1px solid ${colors.glassBorder}`,
          borderRadius: radius.xl,
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: `1px solid ${colors.glassBorder}`, paddingBottom: '12px' }}>
            <Layers size={18} style={{ color: colors.indigoLight }} />
            <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Configure Compliance Audit</h2>
          </div>

          <form onSubmit={handleLaunchReview} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* 1. Target Document Selection */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                1. Select Target Document
              </label>
              {loadingDocs ? (
                <div style={{ color: colors.textMuted, fontSize: font.sizes.base }}>Loading indexed files...</div>
              ) : documents.length === 0 ? (
                <div style={{
                  padding: '12px',
                  background: 'rgba(244,63,94,0.05)',
                  border: `1px dashed rgba(244,63,94,0.25)`,
                  borderRadius: radius.md,
                  color: colors.roseLight,
                  fontSize: '0.75rem'
                }}>
                  No fully indexed documents found in the Knowledge Vault. Please upload and index a document first.
                </div>
              ) : (
                <select
                  value={selectedDocId}
                  onChange={e => setSelectedDocId(e.target.value)}
                  style={{
                    background: colors.bgBase,
                    border: `1px solid ${colors.glassBorder}`,
                    borderRadius: radius.md,
                    padding: '10px',
                    color: colors.textPrimary,
                    fontSize: font.sizes.base,
                    outline: 'none',
                    width: '100%'
                  }}
                >
                  {documents.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.original_name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* 2. Review Templates */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                2. Select Review Template
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px' }}>
                  {WORKFLOW_TEMPLATES.map(t => {
                    const isSelected = selectedTemplate?.id === t.id
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handleSelectTemplate(t)}
                        style={{
                          background: isSelected ? 'rgba(99,102,241,0.12)' : 'rgba(255,255,255,0.01)',
                          border: `1px solid ${isSelected ? 'rgba(99,102,241,0.3)' : colors.glassBorder}`,
                          borderRadius: radius.md,
                          padding: '10px',
                          color: isSelected ? colors.indigoLight : colors.textSecondary,
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          textAlign: 'left',
                          cursor: 'pointer',
                          transition: transition.fast,
                          minWidth: 0
                        }}
                      >
                        <div style={{ fontWeight: 700, color: isSelected ? colors.textPrimary : colors.textSecondary, marginBottom: '2px' }}>{t.name}</div>
                        <div style={{ fontSize: '0.625rem', opacity: 0.8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description}</div>
                      </button>
                    )
                  })}
                  {/* Custom Review Trigger */}
                  <button
                    type="button"
                    onClick={() => handleSelectTemplate(null)}
                    style={{
                      background: selectedTemplate === null ? 'rgba(34,211,238,0.12)' : 'rgba(255,255,255,0.01)',
                      border: `1px solid ${selectedTemplate === null ? 'rgba(34,211,238,0.3)' : colors.glassBorder}`,
                      borderRadius: radius.md,
                      padding: '10px',
                      color: selectedTemplate === null ? colors.cyan : colors.textSecondary,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: transition.fast,
                      minWidth: 0
                    }}
                  >
                    <div style={{ fontWeight: 700, color: selectedTemplate === null ? colors.textPrimary : colors.textSecondary, marginBottom: '2px' }}>Custom Review</div>
                    <div style={{ fontSize: '0.625rem', opacity: 0.8 }}>Choose frameworks manually (max 3)</div>
                  </button>
                </div>
              </div>
            </div>

            {/* 3. Custom Framework Checkboxes (Shown only when selectedTemplate === null) */}
            {selectedTemplate === null ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                padding: '12px',
                background: 'rgba(255,255,255,0.01)',
                border: `1px dashed ${colors.glassBorder}`,
                borderRadius: radius.md
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.7rem', fontWeight: 700, color: colors.cyan, textTransform: 'uppercase' }}>
                    Select Frameworks (Capped at 3)
                  </label>
                  <span style={{ fontSize: '0.65rem', color: customFrameworks.length >= 3 ? colors.roseLight : colors.textSecondary, fontFamily: font.mono }}>
                    {customFrameworks.length}/3 Selected
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {allFrameworks.map(fw => {
                    const checked = customFrameworks.includes(fw)
                    const disabled = !checked && customFrameworks.length >= 3
                    return (
                      <label
                        key={fw}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          color: disabled ? colors.textFaint : checked ? colors.cyan : colors.textSecondary,
                          fontSize: '0.72rem',
                          cursor: disabled ? 'not-allowed' : 'pointer',
                          fontWeight: checked ? 700 : 500,
                          opacity: disabled ? 0.4 : 1
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={() => handleFrameworkToggle(fw)}
                          style={{ accentColor: colors.cyan }}
                        />
                        <span>{fw.replace(/_/g, ' ')}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            ) : (
              /* Auto-assigned frameworks view */
              <div style={{
                padding: '10px 14px',
                background: 'rgba(99,102,241,0.05)',
                border: '1px solid rgba(99,102,241,0.12)',
                borderRadius: radius.md,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.72rem'
              }}>
                <span style={{ color: colors.textSecondary }}>Assigned Frameworks:</span>
                <span style={{ color: colors.indigoLight, fontWeight: 700, fontFamily: font.mono }}>
                  {selectedTemplate.frameworks.join(', ')}
                </span>
              </div>
            )}

            {/* 4. Name Field */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Review Run Name
              </label>
              <input
                type="text"
                value={customName}
                onChange={e => setCustomName(e.target.value)}
                maxLength={250}
                style={{
                  background: colors.bgBase,
                  border: `1px solid ${colors.glassBorder}`,
                  borderRadius: radius.md,
                  padding: '10px',
                  color: colors.textPrimary,
                  fontSize: font.sizes.base,
                  outline: 'none',
                  width: '100%'
                }}
              />
            </div>

            {error && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(244,63,94,0.08)',
                border: `1px solid rgba(244,63,94,0.25)`,
                borderRadius: radius.md,
                padding: '10px',
                color: colors.roseLight,
                fontSize: '0.75rem'
              }}>
                <AlertCircle size={14} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting || documents.length === 0}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                background: `linear-gradient(135deg, ${colors.indigo}, ${colors.violet})`,
                color: '#fff',
                border: 'none',
                borderRadius: radius.md,
                padding: '12px',
                cursor: submitting || documents.length === 0 ? 'not-allowed' : 'pointer',
                fontWeight: 700,
                fontSize: font.sizes.base,
                boxShadow: '0 0 16px rgba(99,102,241,0.2)',
                transition: transition.base,
                marginTop: '6px',
                opacity: submitting || documents.length === 0 ? 0.65 : 1
              }}
            >
              {submitting ? (
                <>
                  <Loader2 size={15} style={{ animation: 'spin 0.8s linear infinite' }} />
                  <span>Spinning up RAG analysis engine...</span>
                </>
              ) : (
                <>
                  <Play size={14} />
                  <span>Execute Compliance Review</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* History / Past Runs (Right) */}
        <div style={{
          background: colors.bgCard,
          border: `1px solid ${colors.glassBorder}`,
          borderRadius: radius.xl,
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          maxHeight: '520px',
          overflowY: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${colors.glassBorder}`, paddingBottom: '12px' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle size={18} style={{ color: colors.emerald }} />
              Audit Execution History
            </h2>
          </div>

          {loadingWorkflows ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ height: '56px', background: 'rgba(255,255,255,0.01)', border: `1px solid ${colors.glassBorder}`, borderRadius: radius.md, animation: 'pulse 1.5s infinite' }} />
              ))}
            </div>
          ) : workflows.length === 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '40px 20px',
              textAlign: 'center',
              color: colors.textSecondary,
              fontSize: '0.75rem',
              border: `1px dashed ${colors.glassBorder}`,
              borderRadius: radius.md
            }}>
              <HelpCircle size={32} style={{ color: colors.textMuted }} />
              <span>No past compliance workflow reviews found. Ingestion and evaluate files above.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {workflows.map(wf => (
                <button
                  key={wf.id}
                  onClick={() => router.push(`/workflows/${wf.id}`)}
                  style={{
                    background: 'rgba(255,255,255,0.01)',
                    border: `1px solid ${colors.glassBorder}`,
                    borderRadius: radius.md,
                    padding: '12px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    transition: transition.fast,
                    width: '100%',
                    outline: 'none'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.01)'; e.currentTarget.style.borderColor = colors.glassBorder }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                    <div style={{
                      fontWeight: 650,
                      color: colors.textPrimary,
                      fontSize: '0.78rem',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {wf.name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.65rem', color: colors.textSecondary }}>
                      <span>{new Date(wf.created_at).toLocaleDateString()}</span>
                      <span>•</span>
                      <span>{wf.status === 'complete' ? '100%' : `${wf.progress_pct}%`} complete</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    {getStatusBadge(wf.status)}
                    <ChevronRight size={14} style={{ color: colors.textMuted }} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
