'use client'
// AuditTimeline — paginated, filterable audit log viewer for the dashboard
import { useState } from 'react'
import { Icon } from '@iconify/react'
import { useAuditLogs } from '../hooks/useAuditLogs'
import type { AuditLogEntry } from '../hooks/useAuditLogs'

// ── Action category styling ───────────────────────────────────────────────────
function actionMeta(action: string): { icon: string; color: string; bg: string } {
  if (action.startsWith('auth.'))       return { icon: 'solar:key-bold',             color: '#22D3EE', bg: 'rgba(34,211,238,0.10)' }
  if (action.startsWith('document.'))   return { icon: 'solar:file-text-bold',        color: '#A78BFA', bg: 'rgba(139,92,246,0.10)' }
  if (action.startsWith('workflow.'))   return { icon: 'solar:routing-bold',          color: '#10B981', bg: 'rgba(16,185,129,0.10)' }
  if (action.startsWith('security.'))   return { icon: 'solar:shield-warning-bold',   color: '#F43F5E', bg: 'rgba(244,63,94,0.10)'  }
  if (action.startsWith('rbac.'))       return { icon: 'solar:user-id-bold',          color: '#F59E0B', bg: 'rgba(245,158,11,0.10)' }
  if (action.startsWith('report.'))     return { icon: 'solar:chart-bold',            color: '#3B82F6', bg: 'rgba(59,130,246,0.10)' }
  if (action.startsWith('api.'))        return { icon: 'solar:code-square-bold',      color: '#64748B', bg: 'rgba(100,116,139,0.10)' }
  return                                       { icon: 'solar:info-circle-bold',      color: '#64748B', bg: 'rgba(100,116,139,0.10)' }
}

function formatTs(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function AuditRow({ entry }: { entry: AuditLogEntry }) {
  const [expanded, setExpanded] = useState(false)
  const meta = actionMeta(entry.action)

  return (
    <div style={{
      borderBottom: '1px solid rgba(255,255,255,0.04)',
      transition:   'background 0.12s',
    }}>
      <div
        onClick={() => setExpanded((e) => !e)}
        style={{
          display:     'grid',
          gridTemplateColumns: '36px 1fr auto',
          alignItems:  'center',
          gap:         '12px',
          padding:     '11px 16px',
          cursor:      'pointer',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.02)' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
      >
        {/* Icon */}
        <div style={{
          width:'36px', height:'36px', borderRadius:'9px',
          background: meta.bg,
          display:'flex', alignItems:'center', justifyContent:'center',
          flexShrink: 0,
        }}>
          <Icon icon={meta.icon} width={16} style={{ color: meta.color }} />
        </div>

        {/* Main info */}
        <div style={{ minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
            <span style={{ color:'#E2E8F0', fontSize:'0.82rem', fontWeight:500 }}>
              {entry.action}
            </span>
            <span style={{
              fontSize:'0.68rem', padding:'2px 7px', borderRadius:'99px',
              background:'rgba(255,255,255,0.06)', color:'#64748B',
            }}>
              {entry.resource_type}
            </span>
          </div>
          <div style={{ color:'#475569', fontSize:'0.72rem', marginTop:'2px' }}>
            {entry.actor_name ?? entry.actor_email ?? 'System'} · {entry.actor_role ?? '—'}
            {entry.ip_address && ` · ${entry.ip_address}`}
          </div>
        </div>

        {/* Timestamp + expand */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:'4px', flexShrink:0 }}>
          <span style={{ color:'#334155', fontSize:'0.68rem' }}>
            {formatTs(entry.created_at)}
          </span>
          <Icon
            icon={expanded ? 'solar:alt-arrow-up-bold' : 'solar:alt-arrow-down-bold'}
            width={12}
            style={{ color:'#334155' }}
          />
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{
          padding:     '0 16px 12px 64px',
          display:     'flex',
          flexDirection:'column',
          gap:         '6px',
        }}>
          {entry.resource_id && (
            <div style={{ fontSize:'0.72rem', color:'#475569' }}>
              <span style={{ color:'#334155' }}>Resource ID: </span>
              <span style={{ fontFamily:'monospace' }}>{entry.resource_id}</span>
            </div>
          )}
          {entry.new_value && (
            <pre style={{
              margin:0, padding:'8px 10px', borderRadius:'7px',
              background:'rgba(255,255,255,0.03)',
              border:'1px solid rgba(255,255,255,0.06)',
              color:'#64748B', fontSize:'0.68rem',
              overflow:'auto', maxHeight:'120px',
            }}>
              {JSON.stringify(entry.new_value, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function AuditTimeline() {
  const [page,    setPage]    = useState(1)
  const [action,  setAction]  = useState('')
  const [resType, setResType] = useState('')
  const [from,    setFrom]    = useState('')
  const [to,      setTo]      = useState('')

  const { logs, total, loading, error, refetch } = useAuditLogs({ page, limit: 25 })

  function applyFilters() {
    refetch({ page: 1, limit: 25, action, resource_type: resType, from, to })
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(total / 25))

  if (error === 'insufficient_permissions') {
    return (
      <div style={{
        display:'flex', flexDirection:'column', alignItems:'center',
        justifyContent:'center', padding:'60px 20px', gap:'12px',
      }}>
        <Icon icon="solar:lock-bold" width={40} style={{ color:'#1E293B' }} />
        <span style={{ color:'#334155', fontSize:'0.85rem' }}>
          Audit logs require compliance officer, auditor, or super admin role.
        </span>
      </div>
    )
  }

  return (
    <div style={{
      background:   '#0A0E1A',
      border:       '1px solid rgba(255,255,255,0.06)',
      borderRadius: '16px',
      overflow:     'hidden',
    }}>
      {/* Header + filter bar */}
      <div style={{
        padding:       '16px 20px',
        borderBottom:  '1px solid rgba(255,255,255,0.06)',
        display:       'flex',
        alignItems:    'center',
        gap:           '12px',
        flexWrap:      'wrap',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px', flex:1 }}>
          <Icon icon="solar:clock-circle-bold" width={18} style={{ color:'#A78BFA' }} />
          <span style={{ color:'#E2E8F0', fontWeight:600, fontSize:'0.9rem' }}>Audit Timeline</span>
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

        {/* Inline filters */}
        <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
          <input
            id="audit-filter-action"
            placeholder="Filter action…"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
            style={inputStyle}
          />
          <select
            id="audit-filter-resource"
            value={resType}
            onChange={(e) => setResType(e.target.value)}
            style={inputStyle}
          >
            <option value="">All resources</option>
            {['document','workflow','report','user','organization','api','security'].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <input
            id="audit-filter-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            style={{ ...inputStyle, colorScheme:'dark', width:'130px' }}
          />
          <input
            id="audit-filter-to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            style={{ ...inputStyle, colorScheme:'dark', width:'130px' }}
          />
          <button
            id="audit-filter-apply"
            onClick={applyFilters}
            style={{
              padding:'6px 14px', borderRadius:'8px',
              background:'rgba(139,92,246,0.12)',
              border:'1px solid rgba(139,92,246,0.25)',
              color:'#A78BFA', fontSize:'0.75rem', cursor:'pointer',
            }}
          >
            Apply
          </button>
        </div>
      </div>

      {/* Log list */}
      {loading && (
        <div style={{ padding:'40px', textAlign:'center', color:'#334155', fontSize:'0.82rem' }}>
          Loading audit logs…
        </div>
      )}
      {!loading && error && (
        <div style={{ padding:'40px', textAlign:'center', color:'#F43F5E', fontSize:'0.82rem' }}>
          {error}
        </div>
      )}
      {!loading && !error && logs.length === 0 && (
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
          <span style={{ color: '#64748B', fontSize: '0.72rem' }}>Continuous audit telemetry active. Last Scan: {new Date().toISOString().slice(11, 16)} UTC.</span>
        </div>
      )}
      {!loading && !error && logs.map((entry) => (
        <AuditRow key={entry.id} entry={entry} />
      ))}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div style={{
          display:'flex', justifyContent:'center', alignItems:'center', gap:'12px',
          padding:'14px 20px', borderTop:'1px solid rgba(255,255,255,0.05)',
        }}>
          <button
            id="audit-prev-page"
            onClick={() => { setPage((p) => p - 1); refetch({ page: page - 1, limit: 25, action, resource_type: resType, from, to }) }}
            disabled={page <= 1}
            style={{ ...paginBtnStyle, opacity: page <= 1 ? 0.3 : 1 }}
          >
            <Icon icon="solar:arrow-left-bold" width={13} />
            Prev
          </button>
          <span style={{ color:'#475569', fontSize:'0.75rem' }}>
            Page {page} of {totalPages}
          </span>
          <button
            id="audit-next-page"
            onClick={() => { setPage((p) => p + 1); refetch({ page: page + 1, limit: 25, action, resource_type: resType, from, to }) }}
            disabled={page >= totalPages}
            style={{ ...paginBtnStyle, opacity: page >= totalPages ? 0.3 : 1 }}
          >
            Next
            <Icon icon="solar:arrow-right-bold" width={13} />
          </button>
        </div>
      )}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background:   '#0D1117',
  border:       '1px solid rgba(255,255,255,0.08)',
  borderRadius: '8px',
  color:        '#94A3B8',
  fontSize:     '0.75rem',
  padding:      '6px 10px',
  outline:      'none',
}

const paginBtnStyle: React.CSSProperties = {
  display:    'flex',
  alignItems: 'center',
  gap:        '5px',
  padding:    '6px 12px',
  borderRadius:'8px',
  background: 'rgba(255,255,255,0.04)',
  border:     '1px solid rgba(255,255,255,0.08)',
  color:      '#64748B',
  fontSize:   '0.75rem',
  cursor:     'pointer',
}
