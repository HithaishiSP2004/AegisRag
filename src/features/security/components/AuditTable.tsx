'use client'
// AuditTable — paginated audit log table with expandable rows and client-side sorting
import { useState, useMemo } from 'react'
import { Icon } from '@iconify/react'
import type { AuditEntry } from '../hooks/useAudit'

interface Props {
  logs:         AuditEntry[]
  total:        number
  page:         number
  limit:        number
  loading:      boolean
  error:        string | null
  onPageChange: (page: number) => void
  onReset?:     () => void
}

type SortField = 'created_at' | 'actor' | 'action' | 'severity' | 'resource_type'
type SortDirection = 'asc' | 'desc'

// Helper to determine severity color and tier
function getSeverity(action: string): 'High' | 'Medium' | 'Low' {
  const lowercase = action.toLowerCase()
  if (
    lowercase.includes('delete') || 
    lowercase.includes('remove') || 
    lowercase.startsWith('security.') ||
    lowercase.includes('failure') ||
    lowercase.includes('alert')
  ) {
    return 'High'
  }
  if (
    lowercase.includes('create') || 
    lowercase.includes('update') || 
    lowercase.includes('edit') || 
    lowercase.includes('add') ||
    lowercase.includes('rbac') ||
    lowercase.includes('role')
  ) {
    return 'Medium'
  }
  return 'Low'
}

function severityMeta(severity: 'High' | 'Medium' | 'Low') {
  switch (severity) {
    case 'High':
      return { color: '#F43F5E', bg: 'rgba(244, 63, 94, 0.12)', label: 'High' }
    case 'Medium':
      return { color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.12)', label: 'Medium' }
    case 'Low':
      return { color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)', label: 'Low' }
  }
}

// Action icon metadata
function actionMeta(action: string): { icon: string; color: string; bg: string } {
  if (action.startsWith('auth.'))       return { icon: 'solar:key-bold',           color: '#22D3EE', bg: 'rgba(34,211,238,0.10)'  }
  if (action.startsWith('document.'))   return { icon: 'solar:file-text-bold',      color: '#A78BFA', bg: 'rgba(139,92,246,0.10)'  }
  if (action.startsWith('conversation'))return { icon: 'solar:chat-round-dots-bold',color: '#38BDF8', bg: 'rgba(56,189,248,0.10)'  }
  if (action.startsWith('workflow.'))   return { icon: 'solar:routing-bold',        color: '#10B981', bg: 'rgba(16,185,129,0.10)'  }
  if (action.startsWith('security.'))   return { icon: 'solar:shield-warning-bold', color: '#F43F5E', bg: 'rgba(244,63,94,0.10)'   }
  if (action.startsWith('rbac.'))       return { icon: 'solar:user-id-bold',        color: '#F59E0B', bg: 'rgba(245,158,11,0.10)'  }
  if (action.startsWith('report.'))     return { icon: 'solar:chart-bold',          color: '#3B82F6', bg: 'rgba(59,130,246,0.10)'  }
  return                                       { icon: 'solar:info-circle-bold',    color: '#64748B', bg: 'rgba(100,116,139,0.10)' }
}

function formatTs(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', second: '2-digit',
  })
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  const [expanded, setExpanded] = useState(false)
  const meta = actionMeta(entry.action)
  const severity = getSeverity(entry.action)
  const sev = severityMeta(severity)

  // Copy helper
  const [copiedId, setCopiedId] = useState(false)
  function copyId(text: string) {
    navigator.clipboard.writeText(text)
    setCopiedId(true)
    setTimeout(() => setCopiedId(false), 2000)
  }

  return (
    <div style={{ borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={() => setExpanded((e) => !e)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setExpanded((x) => !x)}
        style={{
          display:             'grid',
          gridTemplateColumns: '40px 1.5fr 1fr 1fr 120px 16px',
          alignItems:          'center',
          gap:                 '12px',
          padding:             '11px 16px',
          cursor:              'pointer',
          outline:             'none',
          transition:          'background 0.15s ease',
          background:          expanded ? 'rgba(255,255,255,0.01)' : 'transparent'
        }}
        onMouseEnter={(e) => { if(!expanded) e.currentTarget.style.background = 'rgba(255,255,255,0.02)' }}
        onMouseLeave={(e) => { if(!expanded) e.currentTarget.style.background = 'transparent' }}
      >
        {/* Icon */}
        <div style={{
          width:'40px', height:'40px', borderRadius:'10px',
          background: meta.bg,
          display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
        }}>
          <Icon icon={meta.icon} width={17} style={{ color: meta.color }} />
        </div>

        {/* Main info (Action & Actor) */}
        <div style={{ minWidth:0 }}>
          <span style={{ color:'#E2E8F0', fontSize:'0.82rem', fontWeight:600, display: 'block' }}>
            {entry.action}
          </span>
          <div style={{ color:'#64748B', fontSize:'0.72rem', marginTop:'2px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
            <span style={{ color: '#94A3B8', fontWeight: 500 }}>{entry.actor_name ?? 'System'}</span>
            {entry.actor_role && <span style={{ color:'#475569' }}> ({entry.actor_role})</span>}
          </div>
        </div>

        {/* Resource Type & ID preview */}
        <div style={{ minWidth: 0 }}>
          <span style={{
            fontSize:'0.67rem', padding:'1px 6px', borderRadius:'4px',
            background:'rgba(255,255,255,0.05)', color:'#94A3B8',
            border:'1px solid rgba(255,255,255,0.06)',
            display: 'inline-block',
            marginBottom: '2px'
          }}>
            {entry.resource_type}
          </span>
          <div style={{ color: '#475569', fontSize: '0.66rem', fontFamily: 'monospace' }}>
            {entry.resource_id ? entry.resource_id.slice(0, 8) + '…' : '—'}
          </div>
        </div>

        {/* Severity pill */}
        <div>
          <span style={{
            fontSize: '0.68rem',
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: '99px',
            background: sev.bg,
            color: sev.color,
            display: 'inline-block'
          }}>
            {sev.label}
          </span>
        </div>

        {/* Timestamp */}
        <span style={{ color:'#64748B', fontSize:'0.72rem', fontFamily:'monospace', textAlign:'right' }}>
          {formatTs(entry.created_at)}
        </span>

        {/* Expand chevron */}
        <Icon
          icon={expanded ? 'solar:alt-arrow-up-bold' : 'solar:alt-arrow-down-bold'}
          width={12}
          style={{ color:'#475569', flexShrink:0 }}
        />
      </div>

      {/* Expanded detail panel */}
      {expanded && (
        <div style={{
          padding:'12px 16px 20px 68px',
          background: 'rgba(0, 0, 0, 0.2)',
          borderTop: '1px solid rgba(255,255,255,0.02)',
          display:'flex',
          flexDirection:'column',
          gap:'12px',
          animation: 'fadeIn 0.15s ease-out'
        }}>
          {/* Metadata Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '12px',
          }}>
            <div style={detailItemStyle}>
              <span style={detailLabelStyle}>Event ID</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontFamily:'monospace', color: '#CBD5E1' }}>{entry.id}</span>
                <button
                  onClick={() => copyId(entry.id)}
                  style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                  title="Copy Event ID"
                >
                  <Icon icon={copiedId ? "solar:check-circle-bold" : "solar:copy-bold"} width={13} style={{ color: copiedId ? '#10B981' : '#475569' }} />
                </button>
              </div>
            </div>

            <div style={detailItemStyle}>
              <span style={detailLabelStyle}>IP Address</span>
              <span style={{ fontFamily:'monospace', color: '#CBD5E1' }}>{entry.ip_address ?? 'Unavailable'}</span>
            </div>

            <div style={detailItemStyle}>
              <span style={detailLabelStyle}>Organization (Tenant ID)</span>
              <span style={{ fontFamily:'monospace', color: '#CBD5E1' }}>{entry.org_id}</span>
            </div>

            <div style={detailItemStyle}>
              <span style={detailLabelStyle}>Actor (Email)</span>
              <span style={{ color: '#CBD5E1' }}>{entry.actor_email ?? 'System Process'}</span>
            </div>

            {entry.resource_id && (
              <div style={detailItemStyle}>
                <span style={detailLabelStyle}>Target Resource ID</span>
                <span style={{ fontFamily:'monospace', color: '#CBD5E1' }}>{entry.resource_id}</span>
              </div>
            )}
          </div>

          {/* JSON Metadata Viewer */}
          {(entry.new_value || entry.old_value) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={detailLabelStyle}>JSON Payload Metadata</span>
              <div style={{
                display: 'grid',
                gridTemplateColumns: entry.new_value && entry.old_value ? '1fr 1fr' : '1fr',
                gap: '12px'
              }}>
                {entry.old_value && (
                  <div>
                    <span style={{ fontSize: '0.65rem', color: '#64748B', fontWeight: 600, display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>Old Value</span>
                    <pre style={codeBlockStyle}>
                      {JSON.stringify(entry.old_value, null, 2)}
                    </pre>
                  </div>
                )}
                {entry.new_value && (
                  <div>
                    <span style={{ fontSize: '0.65rem', color: '#10B981', fontWeight: 600, display: 'block', marginBottom: '4px', textTransform: 'uppercase' }}>New Value</span>
                    <pre style={codeBlockStyle}>
                      {JSON.stringify(entry.new_value, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const detailItemStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '3px',
  fontSize: '0.72rem',
}

const detailLabelStyle: React.CSSProperties = {
  color: '#475569',
  fontWeight: 600,
  fontSize: '0.65rem',
  textTransform: 'uppercase',
  letterSpacing: '0.04em'
}

const codeBlockStyle: React.CSSProperties = {
  margin: 0,
  padding: '10px 12px',
  borderRadius: '6px',
  background: '#070A13',
  border: '1px solid rgba(255,255,255,0.05)',
  color: '#94A3B8',
  fontSize: '0.70rem',
  fontFamily: 'monospace',
  overflow: 'auto',
  maxHeight: '180px',
}

// ── Main AuditTable ───────────────────────────────────────────────────────────
export function AuditTable({ logs, total, page, limit, loading, error, onPageChange, onReset }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / limit))

  // Sort States
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  // Handler for sort click
  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('desc') // default desc for first clicks
    }
  }

  // Client-side memoized sort for instant responsiveness
  const sortedLogs = useMemo(() => {
    return [...logs].sort((a, b) => {
      let valA: any = ''
      let valB: any = ''

      if (sortField === 'created_at') {
        valA = new Date(a.created_at).getTime()
        valB = new Date(b.created_at).getTime()
      } else if (sortField === 'actor') {
        valA = a.actor_name || ''
        valB = b.actor_name || ''
      } else if (sortField === 'action') {
        valA = a.action || ''
        valB = b.action || ''
      } else if (sortField === 'resource_type') {
        valA = a.resource_type || ''
        valB = b.resource_type || ''
      } else if (sortField === 'severity') {
        const severityA = getSeverity(a.action)
        const severityB = getSeverity(b.action)
        const sevMap = { 'High': 3, 'Medium': 2, 'Low': 1 }
        valA = sevMap[severityA]
        valB = sevMap[severityB]
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
  }, [logs, sortField, sortDirection])

  // Column header component with indicator
  function SortHeader({ field, label, alignment = 'left' }: { field: SortField; label: string; alignment?: 'left' | 'right' }) {
    const isActive = sortField === field
    return (
      <button
        onClick={() => handleSort(field)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: alignment === 'right' ? 'flex-end' : 'flex-start',
          gap: '4px',
          background: 'none',
          border: 0,
          padding: 0,
          cursor: 'pointer',
          width: '100%',
          textAlign: alignment,
          color: isActive ? '#A78BFA' : '#475569',
          fontSize: '0.67rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          transition: 'color 0.15s ease',
          outline: 'none',
        }}
        onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = '#94A3B8' }}
        onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = '#475569' }}
      >
        {label}
        <Icon
          icon={isActive ? (sortDirection === 'asc' ? 'solar:alt-arrow-up-bold' : 'solar:alt-arrow-down-bold') : 'solar:sort-vertical-bold'}
          width={10}
          style={{ opacity: isActive ? 1 : 0.4 }}
        />
      </button>
    )
  }

  return (
    <div style={{
      background:   '#090D18',
      border:       '1px solid rgba(255,255,255,0.06)',
      borderRadius: '14px',
      overflow:     'hidden',
      display:      'flex',
      flexDirection:'column',
    }}>
      {/* Title bar */}
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'14px 18px',
        borderBottom:'1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <Icon icon="solar:clock-circle-bold" width={16} style={{ color:'#A78BFA' }} />
          <span style={{ color:'#E2E8F0', fontWeight:600, fontSize:'0.875rem' }}>Audit Timeline</span>
          {total > 0 && (
            <span style={{
              background:'rgba(139,92,246,0.12)',
              border:'1px solid rgba(139,92,246,0.2)',
              borderRadius:'99px', padding:'2px 8px',
              color:'#A78BFA', fontSize:'0.68rem',
            }}>
              {total.toLocaleString()} events
            </span>
          )}
        </div>
        <span style={{ color:'#475569', fontSize:'0.72rem' }}>
          Page {page} of {totalPages}
        </span>
      </div>

      {/* Sticky Table Header */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 10,
        display:'grid',
        gridTemplateColumns:'40px 1.5fr 1fr 1fr 120px 16px',
        alignItems:'center',
        gap:'12px',
        padding:'10px 16px',
        borderBottom:'1px solid rgba(255,255,255,0.06)',
        background:'#090D18',
      }}>
        <div />
        <SortHeader field="action" label="Action / Actor" />
        <SortHeader field="resource_type" label="Resource" />
        <SortHeader field="severity" label="Severity" />
        <SortHeader field="created_at" label="Timestamp" alignment="right" />
        <div />
      </div>

      {/* Table Body Area */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Loading skeleton */}
        {loading && Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}

        {/* Error */}
        {!loading && error && (
          <div style={{
            display:'flex', flexDirection:'column', alignItems:'center',
            padding:'48px 20px', gap:'10px',
          }}>
            <Icon icon="solar:danger-triangle-bold" width={32} style={{ color:'#F43F5E' }} />
            <span style={{ color:'#F43F5E', fontSize:'0.82rem' }}>{error}</span>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && (total === 0 || sortedLogs.length === 0) && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '60px 20px', gap: '12px',
          }}>
            <Icon icon="solar:shield-check-bold" width={40} style={{ color: '#334155' }} />
            <span style={{ color: '#64748B', fontSize: '0.82rem', fontWeight: 500 }}>
              {total === 0 ? 'No Audit Activity Recorded' : 'No audit events match the current filters.'}
            </span>
            {total === 0 ? (
              <span style={{ color: '#475569', fontSize: '0.72rem', maxWidth: '280px', textAlign: 'center' }}>
                System audit logs will populate as user actions and background jobs execute.
              </span>
            ) : onReset && (
              <button
                id="audit-empty-reset"
                onClick={onReset}
                style={{
                  height: '32px',
                  padding: '0 14px',
                  borderRadius: '6px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#94A3B8',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.08)'
                  e.currentTarget.style.color = '#F8FAFC'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                  e.currentTarget.style.color = '#94A3B8'
                }}
              >
                Clear all filters
              </button>
            )}
          </div>
        )}

        {/* Rows */}
        {!loading && !error && sortedLogs.map((entry) => (
          <AuditRow key={entry.id} entry={entry} />
        ))}
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div style={{
          display:'flex', justifyContent:'center', alignItems:'center', gap:'12px',
          padding:'12px 20px', borderTop:'1px solid rgba(255,255,255,0.05)',
        }}>
          <button
            id="audit-prev-page"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            style={{ ...paginStyle, opacity: page <= 1 ? 0.3 : 1 }}
          >
            <Icon icon="solar:arrow-left-bold" width={12} /> Prev
          </button>
          <span style={{ color:'#64748B', fontSize:'0.75rem', fontWeight: 500 }}>
            {page} / {totalPages}
          </span>
          <button
            id="audit-next-page"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            style={{ ...paginStyle, opacity: page >= totalPages ? 0.3 : 1 }}
          >
            Next <Icon icon="solar:arrow-right-bold" width={12} />
          </button>
        </div>
      )}
    </div>
  )
}

const paginStyle: React.CSSProperties = {
  display:'flex', alignItems:'center', gap:'5px',
  padding:'6px 12px', borderRadius:'8px',
  background:'rgba(255,255,255,0.04)',
  border:'1px solid rgba(255,255,255,0.08)',
  color:'#94A3B8', fontSize:'0.75rem', cursor:'pointer',
}

// ── Skeleton row ──────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div style={{
      display:'grid', gridTemplateColumns:'40px 1.5fr 1fr 1fr 120px 16px',
      alignItems:'center', gap:'12px',
      padding:'12px 16px',
      borderBottom:'1px solid rgba(255,255,255,0.04)',
    }}>
      <div style={{ width:'40px', height:'40px', borderRadius:'10px', background:'rgba(255,255,255,0.04)' }} />
      <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
        <div style={{ width:'65%', height:'11px', borderRadius:'5px', background:'rgba(255,255,255,0.05)' }} />
        <div style={{ width:'45%', height:'10px', borderRadius:'5px', background:'rgba(255,255,255,0.03)' }} />
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:'5px' }}>
        <div style={{ width:'60px', height:'10px', borderRadius:'4px', background:'rgba(255,255,255,0.03)' }} />
        <div style={{ width:'40px', height:'8px', borderRadius:'4px', background:'rgba(255,255,255,0.02)' }} />
      </div>
      <div style={{ width:'50px', height:'16px', borderRadius:'99px', background:'rgba(255,255,255,0.03)' }} />
      <div style={{ width:'80px', height:'10px', borderRadius:'5px', background:'rgba(255,255,255,0.03)', marginLeft:'auto' }} />
      <div />
    </div>
  )
}

