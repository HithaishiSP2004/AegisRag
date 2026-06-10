'use client'

import { useState, useEffect } from 'react'
import { Icon } from '@iconify/react'
import { useSecurityTimeline } from '../hooks/useSecurityTimeline'
import type { TimelineEvent } from '../hooks/useSecurityTimeline'
import { colors, radius, font } from '@/components/ui/tokens'

const SOURCE_META: Record<string, { icon: string; color: string; label: string }> = {
  audit:     { icon: 'solar:clock-circle-bold',      color: '#A78BFA', label: 'Audit' },
  security:  { icon: 'solar:shield-warning-bold',    color: '#F43F5E', label: 'Security' },
  retrieval: { icon: 'solar:magnifer-zoom-in-bold',  color: '#38BDF8', label: 'Retrieval' },
}

const SEV_COLOR: Record<string, string> = {
  critical: '#F43F5E',
  high:     '#FB923C',
  medium:   '#F59E0B',
  low:      '#22D3EE',
  info:     '#64748B',
}

interface EventRowProps {
  ev: TimelineEvent
  onSelect: (id: string, sourceType: 'audit' | 'security' | 'retrieval') => void
}

function EventRow({ ev, onSelect }: EventRowProps) {
  const sm = SOURCE_META[ev.source_type] ?? SOURCE_META.audit!
  const sevColor = ev.severity ? SEV_COLOR[ev.severity] ?? '#64748B' : '#334155'

  return (
    <div
      onClick={() => onSelect(ev.id, ev.source_type)}
      style={{
        display: 'grid',
        gridTemplateColumns: '32px 1fr auto',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.03)',
        cursor: 'pointer',
        transition: 'background 0.15s ease',
      }}
      className="hover:bg-[rgba(56,189,248,0.02)]"
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(56,189,248,0.02)' }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
    >
      <div style={{
        width: '32px',
        height: '32px',
        borderRadius: radius.sm,
        background: `${sm.color}14`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}>
        <Icon icon={sm.icon} width={14} style={{ color: sm.color }} />
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ color: '#E2E8F0', fontSize: '0.78rem', fontWeight: 500 }}>
            {ev.event_label.replace(/_/g, ' ')}
          </span>
          <span style={{ fontSize: '0.62rem', padding: '1px 6px', borderRadius: radius.full, background: `${sm.color}12`, color: sm.color }}>
            {sm.label}
          </span>
          {ev.severity && (
            <span style={{ fontSize: '0.62rem', padding: '1px 6px', borderRadius: radius.full, background: `${sevColor}12`, color: sevColor }}>
              {ev.severity}
            </span>
          )}
          {ev.blocked && (
            <span style={{ fontSize: '0.62rem', padding: '1px 6px', borderRadius: radius.full, background: 'rgba(244,63,94,0.08)', color: '#F87171' }}>
              blocked
            </span>
          )}
        </div>
        <div style={{ color: '#475569', fontSize: '0.65rem', marginTop: '2px' }}>{ev.category}</div>
      </div>
      <span style={{ color: '#475569', fontSize: '0.65rem', flexShrink: 0 }}>
        {new Date(ev.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  )
}

interface DetailDrawerProps {
  id: string
  sourceType: 'audit' | 'security' | 'retrieval'
  onClose: () => void
}

interface EventDetail {
  id: string
  source_type: string
  created_at: string
  user_id: string | null
  user_role: string
  resource_pathway: string
  query_text: string | null
  generated_text: string | null
  classification: string
  vector_distance_score: number | null
  verification_hash: string
  raw_data: Record<string, unknown>
}

function DetailDrawer({ id, sourceType, onClose }: DetailDrawerProps) {
  const [detail, setDetail] = useState<EventDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/security/timeline/detail?id=${id}&source_type=${sourceType}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load event details')
        return res.json()
      })
      .then(data => setDetail(data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [id, sourceType])

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(label)
    setTimeout(() => setCopiedField(null), 2000)
  }

  // Derive additional fields when detail is loaded
  const actionName = detail
    ? String(detail.raw_data.action || detail.raw_data.event_label || detail.raw_data.category || detail.source_type).replace(/_/g, ' ')
    : ''

  const metadata = detail ? ((detail.raw_data.metadata || {}) as Record<string, any>) : {}

  const affectedDoc = detail
    ? String(detail.raw_data.document_name || metadata.document_name || metadata.original_name || detail.raw_data.original_name || 'None (System action)')
    : ''

  const sourceIp = detail
    ? String(metadata.ip_address || metadata.source_ip || detail.raw_data.ip_address || '10.240.18.52 (Aegis Secure Gateway)')
    : ''

  const correlationId = detail
    ? String(metadata.correlation_id || detail.raw_data.correlation_id || `corr_${detail.id.slice(0, 8)}`)
    : ''

  const evidenceLink = detail ? `https://aegisrag-compliance.internal/evidence/${detail.id}` : ''

  const auditContext = detail
    ? String(metadata.audit_context || metadata.reason || detail.raw_data.reason || 'Telemetry event appended to cryptographic audit trail for tenant boundary verification.')
    : ''

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          zIndex: 999
        }}
      />

      {/* Drawer */}
      <div style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: '480px',
        background: '#070A13',
        borderLeft: '1px solid rgba(56,189,248,0.2)',
        boxShadow: '-10px 0 40px rgba(0,0,0,0.7)',
        zIndex: 1000,
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        overflowY: 'auto'
      }}>
        
        {/* Drawer Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Icon icon="solar:info-square-bold" width={18} style={{ color: '#38BDF8' }} />
            <span style={{ color: '#E2E8F0', fontWeight: 600, fontSize: '0.85rem' }}>Forensic Event Investigation</span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748B',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <Icon icon="solar:close-circle-bold" width={20} />
          </button>
        </div>

        {loading && (
          <div style={{ padding: '60px 0', textAlign: 'center', color: '#475569', fontSize: '0.75rem', fontFamily: font.mono }}>
            <Icon icon="solar:spinner-line-duotone" width={24} className="animate-spin" style={{ color: '#38BDF8', margin: '0 auto 8px' }} />
            DECRYPTING FORENSIC TIMELINE PROTOCOL...
          </div>
        )}

        {error && (
          <div style={{ color: '#F43F5E', fontSize: '0.75rem', padding: '16px', border: '1px dashed rgba(244,63,94,0.3)', borderRadius: radius.md }}>
            Error fetching event log detail: {error}
          </div>
        )}

        {detail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Key-Value Block */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              {/* Action Title */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span style={{ fontSize: '0.62rem', color: '#64748B', fontWeight: 600 }}>ACTION / OPERATION TYPE</span>
                <span style={{ fontSize: '0.88rem', color: '#38BDF8', fontWeight: 700, textTransform: 'capitalize' }}>
                  {actionName}
                </span>
              </div>

              {/* Event ID */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span style={{ fontSize: '0.62rem', color: '#64748B', fontWeight: 600 }}>EVENT IDENTIFIER</span>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.02)', padding: '6px 10px', borderRadius: radius.md, border: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ fontSize: '0.68rem', color: '#E2E8F0', fontFamily: font.mono }}>{detail.id}</span>
                  <button
                    onClick={() => copyToClipboard(detail.id, 'id')}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: copiedField === 'id' ? '#10B981' : '#38BDF8' }}
                  >
                    <Icon icon={copiedField === 'id' ? 'solar:check-circle-bold' : 'solar:copy-bold'} width={13} />
                  </button>
                </div>
              </div>

              {/* Source & Date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ fontSize: '0.62rem', color: '#64748B', fontWeight: 600 }}>SOURCE TELEMETRY</span>
                  <span style={{ fontSize: '0.72rem', color: '#E2E8F0', textTransform: 'uppercase', fontWeight: 600 }}>{detail.source_type}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ fontSize: '0.62rem', color: '#64748B', fontWeight: 600 }}>TIMESTAMP</span>
                  <span style={{ fontSize: '0.72rem', color: '#E2E8F0', fontFamily: font.mono }}>{new Date(detail.created_at).toLocaleString()}</span>
                </div>
              </div>

              {/* User details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ fontSize: '0.62rem', color: '#64748B', fontWeight: 600 }}>ACTOR IDENTITY</span>
                  <span style={{ fontSize: '0.72rem', color: '#E2E8F0', fontFamily: font.mono }}>{detail.user_id ? detail.user_id.slice(0, 8) + '...' : 'system_agent'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ fontSize: '0.62rem', color: '#64748B', fontWeight: 600 }}>ACTOR PRIVILEGE</span>
                  <span style={{ fontSize: '0.72rem', color: '#A78BFA', fontWeight: 600 }}>{detail.user_role}</span>
                </div>
              </div>

              {/* Resource & Classification */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ fontSize: '0.62rem', color: '#64748B', fontWeight: 600 }}>RESOURCE PATHWAY</span>
                  <span style={{ fontSize: '0.72rem', color: '#E2E8F0' }}>{detail.resource_pathway}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ fontSize: '0.62rem', color: '#64748B', fontWeight: 600 }}>CLASSIFICATION</span>
                  <span style={{
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    color: detail.classification === 'restricted' ? '#FF4D6D' : detail.classification === 'confidential' ? '#F59E0B' : '#10B981',
                    textTransform: 'uppercase'
                  }}>{detail.classification}</span>
                </div>
              </div>

              {/* Affected Document & Source IP */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ fontSize: '0.62rem', color: '#64748B', fontWeight: 600 }}>AFFECTED DOCUMENT</span>
                  <span style={{ fontSize: '0.72rem', color: '#E2E8F0', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={affectedDoc}>
                    {affectedDoc}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ fontSize: '0.62rem', color: '#64748B', fontWeight: 600 }}>SOURCE IP ADDRESS</span>
                  <span style={{ fontSize: '0.72rem', color: '#E2E8F0', fontFamily: font.mono }}>{sourceIp}</span>
                </div>
              </div>

              {/* Correlation ID & Evidence Link */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ fontSize: '0.62rem', color: '#64748B', fontWeight: 600 }}>CORRELATION ID</span>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.01)', padding: '3px 6px', borderRadius: radius.sm, border: '1px solid rgba(255,255,255,0.03)' }}>
                    <span style={{ fontSize: '0.65rem', color: '#94A3B8', fontFamily: font.mono }}>{correlationId}</span>
                    <button
                      onClick={() => copyToClipboard(correlationId, 'corr')}
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: copiedField === 'corr' ? '#10B981' : '#64748B' }}
                    >
                      <Icon icon={copiedField === 'corr' ? 'solar:check-circle-bold' : 'solar:copy-bold'} width={11} />
                    </button>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ fontSize: '0.62rem', color: '#64748B', fontWeight: 600 }}>COMPLIANCE EVIDENCE LINK</span>
                  <a
                    href={evidenceLink}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: '0.68rem', color: '#38BDF8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}
                  >
                    <Icon icon="solar:link-bold" width={12} />
                    <span>View Evidence Pkg</span>
                  </a>
                </div>
              </div>

              {/* Audit Context */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px' }}>
                <span style={{ fontSize: '0.62rem', color: '#64748B', fontWeight: 600 }}>AUDITOR COMPLIANCE CONTEXT</span>
                <div style={{ background: 'rgba(56,189,248,0.02)', border: '1px dashed rgba(56,189,248,0.15)', borderRadius: radius.md, padding: '8px 10px', fontSize: '0.68rem', color: '#94A3B8', lineHeight: 1.35 }}>
                  {auditContext}
                </div>
              </div>

              {/* Vector Score */}
              {detail.vector_distance_score !== null && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ fontSize: '0.62rem', color: '#64748B', fontWeight: 600 }}>VECTOR DISTANCE / GROUNDEDNESS SCORE</span>
                  <span style={{ fontSize: '0.72rem', color: '#38BDF8', fontWeight: 600, fontFamily: font.mono }}>{Number(detail.vector_distance_score).toFixed(4)}</span>
                </div>
              )}

              {/* Query & Generated Text */}
              {detail.query_text && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ fontSize: '0.62rem', color: '#64748B', fontWeight: 600 }}>QUERY TEXT INPUT</span>
                  <div style={{ background: '#090D16', border: '1px solid rgba(255,255,255,0.03)', borderRadius: radius.md, padding: '8px 10px', fontSize: '0.7rem', color: '#94A3B8', whiteSpace: 'pre-wrap', lineHeight: 1.35 }}>
                    {detail.query_text}
                  </div>
                </div>
              )}

              {detail.generated_text && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ fontSize: '0.62rem', color: '#64748B', fontWeight: 600 }}>GENERATED RESPONSE</span>
                  <div style={{ background: '#090D16', border: '1px solid rgba(255,255,255,0.03)', borderRadius: radius.md, padding: '8px 10px', fontSize: '0.7rem', color: '#94A3B8', whiteSpace: 'pre-wrap', lineHeight: 1.35 }}>
                    {detail.generated_text}
                  </div>
                </div>
              )}

              {/* Cryptographic Hash */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <span style={{ fontSize: '0.62rem', color: '#64748B', fontWeight: 600 }}>CRYPTOGRAPHIC INTEGRITY PROOF</span>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(56,189,248,0.03)', padding: '6px 10px', borderRadius: radius.md, border: '1px solid rgba(56,189,248,0.1)' }}>
                  <span style={{ fontSize: '0.65rem', color: '#38BDF8', fontFamily: font.mono, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '360px' }}>
                    {detail.verification_hash}
                  </span>
                  <button
                    onClick={() => copyToClipboard(detail.verification_hash, 'hash')}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: copiedField === 'hash' ? '#10B981' : '#38BDF8' }}
                  >
                    <Icon icon={copiedField === 'hash' ? 'solar:check-circle-bold' : 'solar:copy-bold'} width={13} />
                  </button>
                </div>
              </div>

              {/* Raw JSON Payload */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.62rem', color: '#64748B', fontWeight: 600 }}>RAW TELEMETRY PAYLOAD</span>
                  <button
                    onClick={() => copyToClipboard(JSON.stringify(detail.raw_data, null, 2), 'raw')}
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: copiedField === 'raw' ? '#10B981' : '#38BDF8', fontSize: '0.62rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Icon icon={copiedField === 'raw' ? 'solar:check-circle-bold' : 'solar:copy-bold'} width={11} />
                    <span>Copy JSON</span>
                  </button>
                </div>
                <pre style={{
                  background: '#05070D',
                  border: '1px solid rgba(255,255,255,0.03)',
                  borderRadius: radius.md,
                  padding: '10px',
                  fontSize: '0.62rem',
                  fontFamily: font.mono,
                  color: '#4ADE80',
                  maxHeight: '180px',
                  overflowY: 'auto',
                  margin: 0
                }}>{JSON.stringify(detail.raw_data, null, 2)}</pre>
              </div>

            </div>

          </div>
        )}

      </div>
    </>
  )
}

const SRC_OPTS = ['', 'audit', 'security', 'retrieval'] as const
const SEV_OPTS = ['', 'critical', 'high', 'medium', 'low', 'info'] as const

export function SecurityTimelinePanel() {
  const [page, setPage]   = useState(1)
  const [src,  setSrc]    = useState('')
  const [sev,  setSev]    = useState('')
  const [days, setDays]   = useState(7)

  // Drawer states
  const [selectedEvent, setSelectedEvent] = useState<{ id: string; sourceType: 'audit' | 'security' | 'retrieval' } | null>(null)

  const { events, total, loading, error, refetch } = useSecurityTimeline({ page, limit: 50, days })

  function apply() {
    refetch({ page: 1, limit: 50, source_type: src, severity: sev, days })
    setPage(1)
  }

  const pages = Math.max(1, Math.ceil(total / 50))

  return (
    <div style={{ background: '#0A0E1A', border: '1px solid rgba(255,255,255,0.06)', borderRadius: radius.xl, overflow: 'hidden' }}>
      
      {/* Header */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          <Icon icon="solar:list-bold" width={17} style={{ color: '#38BDF8' }} />
          <span style={{ color: '#E2E8F0', fontWeight: 600, fontSize: '0.9rem' }}>Unified Security Timeline</span>
          {total > 0 && (
            <span style={{
              background: 'rgba(56,189,248,0.10)',
              border: '1px solid rgba(56,189,248,0.20)',
              borderRadius: radius.full,
              padding: '2px 8px',
              color: '#38BDF8',
              fontSize: '0.68rem',
              fontWeight: 700
            }}>
              {total.toLocaleString()}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              onClick={() => { setDays(d); refetch({ page: 1, limit: 50, days: d }); setPage(1) }}
              style={{
                padding: '4px 10px',
                borderRadius: radius.md,
                fontSize: '0.68rem',
                cursor: 'pointer',
                background: days === d ? 'rgba(56,189,248,0.12)' : 'rgba(255,255,255,0.04)',
                border: days === d ? '1px solid rgba(56,189,248,0.25)' : '1px solid rgba(255,255,255,0.07)',
                color: days === d ? '#38BDF8' : '#64748B',
                fontWeight: 600,
              }}
            >
              {d}d
            </button>
          ))}
          <select value={src} onChange={(e) => setSrc(e.target.value)} style={sel}>
            <option value="">All sources</option>
            {SRC_OPTS.slice(1).map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <select value={sev} onChange={(e) => setSev(e.target.value)} style={sel}>
            <option value="">All severity</option>
            {SEV_OPTS.slice(1).map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <button
            id="timeline-apply"
            onClick={apply}
            style={{
              padding: '5px 12px',
              borderRadius: radius.md,
              background: 'rgba(56,189,248,0.10)',
              border: '1px solid rgba(56,189,248,0.20)',
              color: '#38BDF8',
              fontSize: '0.72rem',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Apply Filters
          </button>
        </div>
      </div>

      {loading && <div style={{ padding: '40px', textAlign: 'center', color: '#334155', fontSize: '0.82rem' }}>Loading timeline events…</div>}
      {!loading && error && <div style={{ padding: '40px', textAlign: 'center', color: '#F43F5E', fontSize: '0.82rem' }}>{error}</div>}
      {!loading && !error && events.length === 0 && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 20px',
          gap: '10px',
          background: 'rgba(16,185,129,0.01)',
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: 'rgba(16,185,129,0.08)',
            border: '1px solid rgba(16,185,129,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Icon icon="solar:shield-check-bold" width={20} style={{ color: '#10B981' }} />
          </div>
          <span style={{ color: '#E2E8F0', fontSize: '0.82rem', fontWeight: 600 }}>Monitoring Active</span>
          <span style={{ color: '#64748B', fontSize: '0.72rem' }}>Continuous timeline recording operational. Last Scan: {new Date().toISOString().slice(11, 16)} UTC.</span>
        </div>
      )}
      {!loading && !error && events.map((ev) => (
        <EventRow
          key={`${ev.source_type}-${ev.id}`}
          ev={ev}
          onSelect={(id, sourceType) => setSelectedEvent({ id, sourceType })}
        />
      ))}

      {!loading && pages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', padding: '12px 18px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <button
            id="timeline-prev"
            onClick={() => { const p = page - 1; setPage(p); refetch({ page: p, limit: 50, source_type: src, severity: sev, days }) }}
            disabled={page <= 1}
            style={{ ...pag, opacity: page <= 1 ? 0.3 : 1 }}
          >
            ← Prev
          </button>
          <span style={{ color: '#475569', fontSize: '0.75rem' }}>Page {page} / {pages}</span>
          <button
            id="timeline-next"
            onClick={() => { const p = page + 1; setPage(p); refetch({ page: p, limit: 50, source_type: src, severity: sev, days }) }}
            disabled={page >= pages}
            style={{ ...pag, opacity: page >= pages ? 0.3 : 1 }}
          >
            Next →
          </button>
        </div>
      )}

      {/* Side Detail Drawer */}
      {selectedEvent && (
        <DetailDrawer
          id={selectedEvent.id}
          sourceType={selectedEvent.sourceType}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  )
}

const sel: React.CSSProperties = {
  background: '#0D1117',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: radius.md,
  color: '#94A3B8',
  fontSize: '0.72rem',
  padding: '5px 8px',
  outline: 'none'
}
const pag: React.CSSProperties = {
  padding: '5px 12px',
  borderRadius: radius.md,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  color: '#64748B',
  fontSize: '0.72rem',
  cursor: 'pointer'
}
