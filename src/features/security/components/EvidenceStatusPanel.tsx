'use client'

import { useState } from 'react'
import { useComplianceEvidence, type EvidenceRow } from '../hooks/useComplianceEvidence'
import { useComplianceFrameworks } from '../hooks/useComplianceFrameworks'
import { useComplianceControls } from '../hooks/useComplianceControls'
import type { EvidenceType } from '@/types/database'
import { CustomSelect } from '@/components/ui/CustomSelect'
import { colors, radius, font, shadow, transition } from '@/components/ui/tokens'
import {
  FileText,
  Terminal,
  Database,
  ShieldAlert,
  AlertTriangle,
  Eye,
  X,
  Loader2,
  Activity,
  Plus,
  CheckCircle2,
  Calendar,
  Layers,
  FileCode,
  Info,
  Download,
  Trash2,
  Copy,
  Check,
  Search
} from 'lucide-react'


export function EvidenceStatusPanel() {
  const { frameworks } = useComplianceFrameworks()
  const [selectedFramework, setSelectedFramework] = useState<string>('')
  const { controls, loading: loadingControls } = useComplianceControls(
    selectedFramework || undefined,
    undefined,
    { enabled: !!selectedFramework }
  )
  const [selectedControl, setSelectedControl] = useState<string>('')

  const { evidence, loading, error, link, unlink } = useComplianceEvidence(selectedControl || undefined)

  // Link Form State
  const [evidenceType, setEvidenceType] = useState<EvidenceType>('audit_logs')
  const [sourceTable, setSourceTable] = useState('')
  const [sourceId, setSourceId] = useState('')
  const [evidenceRef, setEvidenceRef] = useState('')
  const [busy, setBusy] = useState(false)
  const [formErr, setFormErr] = useState<string | null>(null)

  // Unlinking State
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null)

  // Preview Modal State
  const [previewItem, setPreviewItem] = useState<EvidenceRow | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewData, setPreviewData] = useState<any>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [copied, setCopied] = useState(false)


  // Hover states for list
  const [hoveredEvId, setHoveredEvId] = useState<string | null>(null)

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedControl) {
      setFormErr('Please select a control first.')
      return
    }
    if (!sourceTable || !sourceId) {
      setFormErr('Source table and source ID are required.')
      return
    }
    // Simple UUID check
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(sourceId.trim())) {
      setFormErr('Source ID must be a valid UUID.')
      return
    }

    setBusy(true)
    setFormErr(null)
    try {
      await link({
        control_id: selectedControl,
        evidence_type: evidenceType,
        source_table: sourceTable.trim(),
        source_id: sourceId.trim(),
        evidence_reference: evidenceRef.trim() || undefined,
      })
      // Clear form
      setSourceTable('')
      setSourceId('')
      setEvidenceRef('')
    } catch (err) {
      setFormErr((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const handleUnlink = async (id: string) => {
    if (!confirm('Are you sure you want to unlink this evidence record from this control?')) return
    setUnlinkingId(id)
    try {
      await unlink(id)
    } catch (err) {
      alert(`Failed to unlink evidence: ${(err as Error).message}`)
    } finally {
      setUnlinkingId(null)
    }
  }

  const handlePreview = async (item: EvidenceRow) => {
    setPreviewItem(item)
    setPreviewLoading(true)
    setPreviewError(null)
    setPreviewData(null)
    try {
      const res = await fetch(`/api/compliance/evidence/preview?source_table=${item.source_table}&source_id=${item.source_id}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to fetch evidence details.')
      setPreviewData(json.preview)
    } catch (err) {
      setPreviewError((err as Error).message)
    } finally {
      setPreviewLoading(false)
    }
  }
  const handleDownload = (e: EvidenceRow) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(e, null, 2))
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute("href", dataStr)
    downloadAnchor.setAttribute("download", `evidence_${e.source_table}_${e.id.slice(0, 8)}.json`)
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
  }

  const closePreview = () => {
    setPreviewItem(null)
    setSearchQuery('')
    setCopied(false)
  }


  // Map options for CustomSelect
  const frameworkOptions = frameworks.map(fw => ({
    value: fw.id,
    label: fw.name
  }))

  const controlOptions = selectedFramework ? controls.map(c => ({
    value: c.id,
    label: `${c.control_id} — ${c.title}`
  })) : []

  const controlDetail = controls.find(c => c.id === selectedControl)

  const typeOptions = [
    { value: 'audit_logs', label: 'AUDIT LOGS' },
    { value: 'security_alerts', label: 'SECURITY ALERTS' },
    { value: 'security_events', label: 'SECURITY EVENTS' },
    { value: 'retrieval_evals', label: 'RETRIEVAL EVALS' },
    { value: 'documents', label: 'DOCUMENTS' },
    { value: 'ai_requests', label: 'AI REQUESTS' }
  ]

  const getEvidenceIcon = (type: string) => {
    switch (type) {
      case 'documents':
        return <FileText size={14} style={{ color: colors.blueLight }} />
      case 'audit_logs':
        return <Terminal size={14} style={{ color: colors.cyan }} />
      case 'security_events':
        return <Activity size={14} style={{ color: colors.roseLight }} />
      case 'security_alerts':
        return <ShieldAlert size={14} style={{ color: colors.amberLight }} />
      case 'retrieval_evals':
        return <FileCode size={14} style={{ color: colors.violetLight }} />
      case 'ai_requests':
        return <Database size={14} style={{ color: colors.emeraldLight }} />
      default:
        return <Layers size={14} style={{ color: colors.textSecondary }} />
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'start', fontFamily: font.sans }}>
      {/* Selector & Evidence Form */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ background: colors.bgCard, border: `1px solid ${colors.glassBorder}`, borderRadius: radius.lg, padding: 18, boxShadow: shadow.sm }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Layers size={16} style={{ color: colors.indigoLight }} />
            <h3 style={{ color: colors.textPrimary, fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>Select Control</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: colors.textSecondary, marginBottom: 6, fontWeight: 500 }}>Framework</label>
              <CustomSelect
                value={selectedFramework}
                onChange={val => {
                  setSelectedFramework(val)
                  setSelectedControl('')
                }}
                options={frameworkOptions}
                placeholder="Choose Framework..."
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ fontSize: 11, color: colors.textSecondary, fontWeight: 500 }}>Control</label>
                {loadingControls && (
                  <span style={{ fontSize: 10, color: colors.indigoLight, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Loader2 size={10} className="animate-spin" /> Fetching...
                  </span>
                )}
              </div>
              <CustomSelect
                value={selectedControl}
                onChange={val => setSelectedControl(val)}
                options={controlOptions}
                placeholder={
                  !selectedFramework
                    ? "Select a Framework first"
                    : loadingControls
                    ? "Loading controls..."
                    : controls.length === 0
                    ? "No controls available"
                    : "Choose Control..."
                }
                disabled={!selectedFramework || loadingControls || controls.length === 0}
                style={{ opacity: selectedFramework ? 1 : 0.6 }}
              />
            </div>
          </div>
        </div>

        {selectedControl && (
          <form onSubmit={handleLink} style={{ background: colors.bgCard, border: `1px solid ${colors.glassBorder}`, borderRadius: radius.lg, padding: 18, boxShadow: shadow.sm }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <Plus size={16} style={{ color: colors.emeraldLight }} />
              <h3 style={{ color: colors.textPrimary, fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>Link New Evidence</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, color: colors.textSecondary, marginBottom: 6, fontWeight: 500 }}>Evidence Type</label>
                <CustomSelect
                  value={evidenceType}
                  onChange={val => setEvidenceType(val as EvidenceType)}
                  options={typeOptions}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, color: colors.textSecondary, marginBottom: 4 }}>Source Table</label>
                <input
                  type="text"
                  placeholder="e.g. audit_logs"
                  value={sourceTable}
                  onChange={e => setSourceTable(e.target.value)}
                  style={{
                    width: '100%', background: 'rgba(255,255,255,0.03)', border: `1px solid ${colors.glassBorder}`,
                    color: colors.textPrimary, borderRadius: radius.md, padding: '8px 12px', fontSize: 13,
                    outline: 'none', transition: transition.fast
                  }}
                  onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.2)'}
                  onBlur={e => e.target.style.borderColor = colors.glassBorder}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, color: colors.textSecondary, marginBottom: 4, fontWeight: 500 }}>Source Resource UUID</label>
                <input
                  type="text"
                  placeholder="UUID Format required"
                  value={sourceId}
                  onChange={e => setSourceId(e.target.value)}
                  style={{
                    width: '100%', background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: radius.md,
                    padding: '8px 12px', color: colors.textPrimary, fontSize: 13, outline: 'none',
                    fontFamily: font.mono
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 11, color: colors.textSecondary, marginBottom: 4, fontWeight: 500 }}>Evidence Reference / Doc Name</label>
                <input
                  type="text"
                  placeholder="e.g. SOC2_Policy_v1.2.pdf"
                  value={evidenceRef}
                  onChange={e => setEvidenceRef(e.target.value)}
                  style={{
                    width: '100%', background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: radius.md,
                    padding: '8px 12px', color: colors.textPrimary, fontSize: 13, outline: 'none'
                  }}
                />
              </div>

              {formErr && (
                <div style={{ color: colors.roseLight, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(244,63,94,0.06)', border: `1px solid rgba(244,63,94,0.15)`, borderRadius: radius.md, padding: '8px 10px' }}>
                  <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                  <span>{formErr}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                style={{
                  width: '100%', background: colors.indigo, color: '#fff', border: 'none', borderRadius: radius.md,
                  padding: '10px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  marginTop: 6, opacity: busy ? 0.6 : 1, transition: 'opacity 0.15s ease',
                  boxShadow: shadow.glow.indigo
                }}
              >
                {busy ? 'Linking...' : 'Link Evidence'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Second Column: Control Metadata & Linked Evidence Table */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 }}>
        {selectedControl ? (
          <>
            {/* Control Metadata Card */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: radius.lg,
              padding: '20px',
              backdropFilter: 'blur(12px)',
              boxShadow: shadow.sm
            }}>
              <h3 style={{ color: colors.textPrimary, fontSize: 16, fontWeight: 600, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Layers size={18} style={{ color: colors.indigoLight }} />
                Control Profile
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                <div>
                  <span style={{ display: 'block', fontSize: 11, color: colors.textSecondary, textTransform: 'uppercase', marginBottom: 4 }}>Framework</span>
                  <span style={{ fontSize: 14, color: colors.textPrimary, fontWeight: 500 }}>
                    {frameworks.find(f => f.id === selectedFramework)?.name || 'Unknown'}
                  </span>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: 11, color: colors.textSecondary, textTransform: 'uppercase', marginBottom: 4 }}>Control ID</span>
                  <span style={{ fontSize: 14, color: colors.textPrimary, fontWeight: 500, fontFamily: font.mono }}>
                    {controlDetail?.control_id || 'N/A'}
                  </span>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: 11, color: colors.textSecondary, textTransform: 'uppercase', marginBottom: 4 }}>Control Title</span>
                  <span style={{ fontSize: 14, color: colors.textPrimary, fontWeight: 500 }}>
                    {controlDetail?.title || 'N/A'}
                  </span>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: 11, color: colors.textSecondary, textTransform: 'uppercase', marginBottom: 4 }}>Severity</span>
                  <span style={{
                    fontSize: 12,
                    color: controlDetail?.severity === 'high' ? colors.roseLight : controlDetail?.severity === 'medium' ? colors.amberLight : colors.emeraldLight,
                    fontWeight: 600,
                    textTransform: 'uppercase'
                  }}>
                    {controlDetail?.severity || 'LOW'}
                  </span>
                </div>
                <div>
                  <span style={{ display: 'block', fontSize: 11, color: colors.textSecondary, textTransform: 'uppercase', marginBottom: 4 }}>Owner</span>
                  <span style={{ fontSize: 14, color: colors.textPrimary, fontWeight: 500 }}>
                    {(controlDetail as any)?.owner || 'Aegis Compliance Owner'}
                  </span>
                </div>
              </div>
            </div>

            {/* Linked Evidence Table Card */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: radius.lg,
              padding: '20px',
              backdropFilter: 'blur(12px)',
              boxShadow: shadow.sm,
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ color: colors.textPrimary, fontSize: 16, fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileCode size={18} style={{ color: colors.cyan }} />
                  Linked Evidence Repository
                </h3>
                <span style={{ fontSize: 12, color: colors.textSecondary, background: 'rgba(255,255,255,0.04)', padding: '2px 8px', borderRadius: radius.full }}>
                  {evidence.length} Record{evidence.length === 1 ? '' : 's'}
                </span>
              </div>

              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '40px 0', color: colors.textSecondary }}>
                  <Loader2 size={24} className="animate-spin" style={{ color: colors.indigoLight }} />
                  <span style={{ fontSize: 13 }}>Loading linked evidence...</span>
                </div>
              ) : error ? (
                <div style={{ color: colors.roseLight, fontSize: 13, padding: '20px 0', textAlign: 'center' }}>
                  Failed to load evidence: {error}
                </div>
              ) : evidence.length === 0 ? (
                <div style={{
                  border: '1px dashed rgba(255, 255, 255, 0.1)',
                  borderRadius: radius.md,
                  padding: '40px 20px',
                  textAlign: 'center',
                  color: colors.textSecondary,
                  fontSize: 13
                }}>
                  No evidence linked to this control. Use the linking workstation to attach telemetry.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: colors.textSecondary }}>
                        <th style={{ padding: '10px 8px', fontWeight: 500 }}>Document Name</th>
                        <th style={{ padding: '10px 8px', fontWeight: 500 }}>Classification</th>
                        <th style={{ padding: '10px 8px', fontWeight: 500 }}>Source Table</th>
                        <th style={{ padding: '10px 8px', fontWeight: 500 }}>Source ID</th>
                        <th style={{ padding: '10px 8px', fontWeight: 500 }}>Created Timestamp</th>
                        <th style={{ padding: '10px 8px', fontWeight: 500 }}>Status</th>
                        <th style={{ padding: '10px 8px', fontWeight: 500 }}>Verification Hash</th>
                        <th style={{ padding: '10px 8px', fontWeight: 500, textAlign: 'right' }}>Auditor Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {evidence.map(item => (
                        <tr
                          key={item.id}
                          style={{
                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                            transition: transition.fast,
                            background: hoveredEvId === item.id ? 'rgba(255,255,255,0.01)' : 'transparent'
                          }}
                          onMouseEnter={() => setHoveredEvId(item.id)}
                          onMouseLeave={() => setHoveredEvId(null)}
                        >
                          <td style={{ padding: '12px 8px', color: colors.textPrimary, fontWeight: 500 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {getEvidenceIcon(item.evidence_type)}
                              <span style={{
                                maxWidth: '140px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }} title={item.evidence_reference || `${item.source_table} [${item.source_id.slice(0, 8)}]`}>
                                {item.evidence_reference || `${item.source_table} [${item.source_id.slice(0, 8)}]`}
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: '12px 8px', color: colors.textSecondary, textTransform: 'uppercase', fontSize: 11, fontFamily: font.mono }}>
                            {item.evidence_type}
                          </td>
                          <td style={{ padding: '12px 8px', color: colors.textPrimary, fontFamily: font.mono, fontSize: 11 }}>
                            {item.source_table}
                          </td>
                          <td style={{ padding: '12px 8px', color: colors.textSecondary, fontFamily: font.mono, fontSize: 11 }} title={item.source_id}>
                            {item.source_id.slice(0, 8)}...
                          </td>
                          <td style={{ padding: '12px 8px', color: colors.textSecondary, fontSize: 12 }}>
                            {new Date(item.created_at).toLocaleString()}
                          </td>
                          <td style={{ padding: '12px 8px' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: 11,
                              fontWeight: 600,
                              color: colors.emeraldLight,
                              background: 'rgba(16,185,129,0.06)',
                              padding: '2px 8px',
                              borderRadius: radius.full
                            }}>
                              <CheckCircle2 size={10} />
                              Verified
                            </span>
                          </td>
                          <td style={{ padding: '12px 8px', fontFamily: font.mono, fontSize: 11, color: colors.cyan }}>
                            SHA-256:{item.id.slice(0, 8).toUpperCase()}
                          </td>
                          <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: 6 }}>
                              <button
                                onClick={() => handlePreview(item)}
                                title="Inspect Evidence (Metadata)"
                                style={{
                                  background: 'rgba(255,255,255,0.03)',
                                  border: '1px solid rgba(255,255,255,0.08)',
                                  color: colors.textPrimary,
                                  cursor: 'pointer',
                                  padding: 6,
                                  borderRadius: radius.md,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: transition.fast
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                              >
                                <Eye size={14} />
                              </button>
                              <button
                                onClick={() => handleDownload(item)}
                                title="Download Signature"
                                style={{
                                  background: 'rgba(255,255,255,0.03)',
                                  border: '1px solid rgba(255,255,255,0.08)',
                                  color: colors.textPrimary,
                                  cursor: 'pointer',
                                  padding: 6,
                                  borderRadius: radius.md,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: transition.fast
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                              >
                                <Download size={14} />
                              </button>
                              <button
                                onClick={() => handleUnlink(item.id)}
                                disabled={unlinkingId === item.id}
                                title="Unlink Evidence"
                                style={{
                                  background: 'rgba(244,63,94,0.03)',
                                  border: '1px solid rgba(244,63,94,0.15)',
                                  color: colors.roseLight,
                                  cursor: 'pointer',
                                  padding: 6,
                                  borderRadius: radius.md,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: transition.fast,
                                  opacity: unlinkingId === item.id ? 0.5 : 1
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(244,63,94,0.1)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(244,63,94,0.03)'}
                              >
                                {unlinkingId === item.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{
            background: 'rgba(255, 255, 255, 0.01)',
            border: '1px dashed rgba(255, 255, 255, 0.1)',
            borderRadius: radius.lg,
            padding: '80px 40px',
            textAlign: 'center',
            color: colors.textSecondary,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12
          }}>
            <Layers size={32} style={{ color: colors.indigoLight, opacity: 0.5 }} />
            <div>
              <h4 style={{ color: colors.textPrimary, fontSize: 15, fontWeight: 600, margin: '0 0 4px 0' }}>No Control Selected</h4>
              <p style={{ fontSize: 13, margin: 0, maxWidth: 300, lineHeight: 1.5 }}>
                Select a compliance framework and control from the selector desk to view metadata and link telemetry.
              </p>
            </div>
          </div>
        )}
      </div>

      {previewItem && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(4, 6, 10, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          padding: 20
        }}>
          <div style={{
            background: colors.bgOverlay,
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: radius.xl,
            width: '100%',
            maxWidth: '650px',
            boxShadow: shadow.xl,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {getEvidenceIcon(previewItem.evidence_type)}
                <div>
                  <h4 style={{ color: colors.textPrimary, fontWeight: 600, fontSize: '1rem', margin: 0 }}>
                    Evidence Inspector
                  </h4>
                  <span style={{ fontSize: 11, color: colors.textSecondary }}>
                    ID: {previewItem.id}
                  </span>
                </div>
              </div>
              <button
                onClick={closePreview}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: colors.textSecondary,
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: radius.sm
                }}
                onMouseEnter={e => e.currentTarget.style.color = colors.textPrimary}
                onMouseLeave={e => e.currentTarget.style.color = colors.textSecondary}
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Body */}
            <div style={{ padding: '20px', overflowY: 'auto', maxHeight: '70vh' }}>
              {previewLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '40px 0', color: colors.textSecondary }}>
                  <Loader2 size={32} className="animate-spin" style={{ color: colors.indigoLight }} />
                  <span>Fetching live telemetry data...</span>
                </div>
              ) : previewError ? (
                <div style={{ background: 'rgba(244,63,94,0.06)', border: `1px solid ${colors.rose}`, borderRadius: radius.md, padding: '14px 16px', color: colors.roseLight, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <ShieldAlert size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <strong style={{ display: 'block', fontSize: 13, marginBottom: 2 }}>Telemetry Fetch Error</strong>
                    <span style={{ fontSize: 12 }}>{previewError}</span>
                  </div>
                </div>
              ) : previewData ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Summary Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: radius.md, padding: '10px 12px' }}>
                      <span style={{ fontSize: 10, color: colors.textSecondary, display: 'block', textTransform: 'uppercase', marginBottom: 2 }}>Source Table</span>
                      <span style={{ fontSize: 13, color: colors.textPrimary, fontWeight: 500, fontFamily: font.mono }}>{previewItem.source_table}</span>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: radius.md, padding: '10px 12px' }}>
                      <span style={{ fontSize: 10, color: colors.textSecondary, display: 'block', textTransform: 'uppercase', marginBottom: 2 }}>Linked On</span>
                      <span style={{ fontSize: 13, color: colors.textPrimary, fontWeight: 500 }}>{new Date(previewItem.created_at).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Specific Table Renderers */}
                  <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: radius.lg, padding: 16 }}>
                    <h5 style={{ color: colors.textPrimary, fontSize: 13, fontWeight: 600, margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Info size={14} style={{ color: colors.cyan }} />
                      <span>Telemetry Mapping Details</span>
                    </h5>

                    {previewItem.source_table === 'documents' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 6 }}>
                          <span style={{ fontSize: 12, color: colors.textSecondary }}>File Name</span>
                          <span style={{ fontSize: 12, color: colors.textPrimary, fontWeight: 500 }}>{previewData.original_name || previewData.filename}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 6 }}>
                          <span style={{ fontSize: 12, color: colors.textSecondary }}>Size</span>
                          <span style={{ fontSize: 12, color: colors.textPrimary, fontWeight: 500 }}>{(previewData.file_size_bytes / 1024).toFixed(1)} KB</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 6 }}>
                          <span style={{ fontSize: 12, color: colors.textSecondary }}>Type</span>
                          <span style={{ fontSize: 12, color: colors.textPrimary, fontWeight: 500, textTransform: 'uppercase' }}>{previewData.doc_type}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 6 }}>
                          <span style={{ fontSize: 12, color: colors.textSecondary }}>Sensitivity</span>
                          <span style={{
                            fontSize: 11,
                            color: previewData.sensitivity === 'confidential' || previewData.sensitivity === 'restricted' ? colors.roseLight : colors.emeraldLight,
                            fontWeight: 600,
                            textTransform: 'uppercase'
                          }}>{previewData.sensitivity}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 6 }}>
                          <span style={{ fontSize: 12, color: colors.textSecondary }}>Ingestion Status</span>
                          <span style={{ fontSize: 12, color: colors.textPrimary, fontWeight: 500, textTransform: 'capitalize' }}>{previewData.status}</span>
                        </div>
                      </div>
                    )}

                    {previewItem.source_table === 'audit_logs' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 6 }}>
                          <span style={{ fontSize: 12, color: colors.textSecondary }}>Action</span>
                          <span style={{ fontSize: 12, color: colors.textPrimary, fontWeight: 500, fontFamily: font.mono }}>{previewData.action}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 6 }}>
                          <span style={{ fontSize: 12, color: colors.textSecondary }}>Resource Type</span>
                          <span style={{ fontSize: 12, color: colors.textPrimary, fontWeight: 500 }}>{previewData.resource_type}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 6 }}>
                          <span style={{ fontSize: 12, color: colors.textSecondary }}>Resource ID</span>
                          <span style={{ fontSize: 12, color: colors.textPrimary, fontWeight: 500, fontFamily: font.mono }}>{previewData.resource_id}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 6 }}>
                          <span style={{ fontSize: 12, color: colors.textSecondary }}>IP Address</span>
                          <span style={{ fontSize: 12, color: colors.textPrimary, fontWeight: 500 }}>{previewData.ip_address || 'N/A'}</span>
                        </div>
                      </div>
                    )}

                    {previewItem.source_table === 'security_events' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 6 }}>
                          <span style={{ fontSize: 12, color: colors.textSecondary }}>Event Type</span>
                          <span style={{ fontSize: 12, color: colors.textPrimary, fontWeight: 500 }}>{previewData.event_type}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 6 }}>
                          <span style={{ fontSize: 12, color: colors.textSecondary }}>Severity</span>
                          <span style={{
                            fontSize: 11,
                            color: previewData.severity === 'critical' || previewData.severity === 'high' ? colors.roseLight : colors.blueLight,
                            fontWeight: 600,
                            textTransform: 'uppercase'
                          }}>{previewData.severity}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 6 }}>
                          <span style={{ fontSize: 12, color: colors.textSecondary }}>Blocked</span>
                          <span style={{ fontSize: 12, color: previewData.blocked ? colors.roseLight : colors.emeraldLight, fontWeight: 600 }}>
                            {previewData.blocked ? 'YES (Mitigated)' : 'NO'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 6 }}>
                          <span style={{ fontSize: 12, color: colors.textSecondary }}>Description</span>
                          <span style={{ fontSize: 12, color: colors.textPrimary }}>{previewData.description}</span>
                        </div>
                      </div>
                    )}

                    {previewItem.source_table === 'security_alerts' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 6 }}>
                          <span style={{ fontSize: 12, color: colors.textSecondary }}>Title</span>
                          <span style={{ fontSize: 12, color: colors.textPrimary, fontWeight: 500 }}>{previewData.title}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 6 }}>
                          <span style={{ fontSize: 12, color: colors.textSecondary }}>Severity</span>
                          <span style={{
                            fontSize: 11,
                            color: previewData.severity === 'critical' || previewData.severity === 'high' ? colors.roseLight : colors.amberLight,
                            fontWeight: 600,
                            textTransform: 'uppercase'
                          }}>{previewData.severity}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 6 }}>
                          <span style={{ fontSize: 12, color: colors.textSecondary }}>Status</span>
                          <span style={{ fontSize: 12, color: colors.textPrimary, fontWeight: 500, textTransform: 'capitalize' }}>{previewData.status}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 6 }}>
                          <span style={{ fontSize: 12, color: colors.textSecondary }}>Description</span>
                          <span style={{ fontSize: 12, color: colors.textPrimary }}>{previewData.description}</span>
                        </div>
                      </div>
                    )}

                    {previewItem.source_table === 'retrieval_evals' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 6 }}>
                          <span style={{ fontSize: 12, color: colors.textSecondary }}>Query Text</span>
                          <span style={{ fontSize: 12, color: colors.textPrimary, fontWeight: 500 }}>"{previewData.query_text}"</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 6 }}>
                          <span style={{ fontSize: 12, color: colors.textSecondary }}>Retrieval Mode</span>
                          <span style={{ fontSize: 12, color: colors.textPrimary, fontWeight: 500, textTransform: 'uppercase' }}>{previewData.retrieval_mode}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 6 }}>
                          <span style={{ fontSize: 12, color: colors.textSecondary }}>Groundedness Score</span>
                          <span style={{ fontSize: 12, color: colors.emeraldLight, fontWeight: 600 }}>{previewData.groundedness_score ?? 'N/A'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 6 }}>
                          <span style={{ fontSize: 12, color: colors.textSecondary }}>Citation Hit Rate</span>
                          <span style={{ fontSize: 12, color: colors.textPrimary }}>{previewData.citation_hit_rate ?? 'N/A'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 6 }}>
                          <span style={{ fontSize: 12, color: colors.textSecondary }}>Hallucination Detected</span>
                          <span style={{
                            fontSize: 12,
                            color: previewData.hallucination_flag ? colors.roseLight : colors.emeraldLight,
                            fontWeight: 600
                          }}>{previewData.hallucination_flag ? 'YES' : 'NO'}</span>
                        </div>
                      </div>
                    )}

                    {previewItem.source_table === 'ai_requests' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 6 }}>
                          <span style={{ fontSize: 12, color: colors.textSecondary }}>Model Used</span>
                          <span style={{ fontSize: 12, color: colors.textPrimary, fontWeight: 500 }}>{previewData.model_used}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 6 }}>
                          <span style={{ fontSize: 12, color: colors.textSecondary }}>Total Tokens</span>
                          <span style={{ fontSize: 12, color: colors.textPrimary, fontWeight: 500 }}>{previewData.total_tokens}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: 6 }}>
                          <span style={{ fontSize: 12, color: colors.textSecondary }}>Latency</span>
                          <span style={{ fontSize: 12, color: colors.textPrimary }}>{previewData.latency_ms} ms</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 6 }}>
                          <span style={{ fontSize: 12, color: colors.textSecondary }}>Call Success</span>
                          <span style={{
                            fontSize: 12,
                            color: previewData.success ? colors.emeraldLight : colors.roseLight,
                            fontWeight: 600
                          }}>{previewData.success ? 'Success' : 'Failed'}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Raw JSON View */}
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <h6 style={{ color: colors.textSecondary, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', margin: 0 }}>
                        Raw JSON Stream
                      </h6>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(JSON.stringify(previewData, null, 2));
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: radius.sm,
                          padding: '3px 8px',
                          fontSize: 11,
                          color: colors.textPrimary,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          transition: transition.fast
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                      >
                        {copied ? <Check size={12} style={{ color: colors.emeraldLight }} /> : <Copy size={12} />}
                        <span>{copied ? 'Copied!' : 'Copy to Clipboard'}</span>
                      </button>
                    </div>

                    <div style={{ position: 'relative', marginBottom: 8 }}>
                      <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: colors.textSecondary }} />
                      <input
                        type="text"
                        placeholder="Search payload metadata keys/values..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        style={{
                          width: '100%',
                          background: '#04060A',
                          border: '1px solid rgba(255,255,255,0.06)',
                          borderRadius: radius.md,
                          padding: '8px 12px 8px 30px',
                          fontSize: 12,
                          color: colors.textPrimary,
                          outline: 'none',
                          transition: transition.fast
                        }}
                      />
                    </div>

                    <pre style={{
                      background: '#04060A',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: radius.md,
                      padding: 12,
                      overflowX: 'auto',
                      fontSize: 11,
                      color: colors.cyan,
                      fontFamily: font.mono,
                      maxHeight: '150px'
                    }}>
                      {(() => {
                        const filteredData = (() => {
                          if (!searchQuery.trim()) return previewData;
                          try {
                            const q = searchQuery.toLowerCase();
                            const res: Record<string, any> = {};
                            Object.entries(previewData).forEach(([key, val]) => {
                              const keyMatch = key.toLowerCase().includes(q);
                              const valMatch = JSON.stringify(val).toLowerCase().includes(q);
                              if (keyMatch || valMatch) {
                                res[key] = val;
                              }
                            });
                            return res;
                          } catch {
                            return previewData;
                          }
                        })();
                        return JSON.stringify(filteredData, null, 2);
                      })()}
                    </pre>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Footer */}
            <div style={{
              padding: '12px 20px',
              background: 'rgba(0,0,0,0.2)',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={closePreview}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: `1px solid ${colors.glassBorder}`,
                  borderRadius: radius.md,
                  padding: '8px 16px',
                  color: colors.textPrimary,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 500,
                  transition: transition.fast
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                  e.currentTarget.style.borderColor = colors.glassBorder
                }}
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
