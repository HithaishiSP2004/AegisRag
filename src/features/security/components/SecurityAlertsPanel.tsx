'use client'

import { useState, useMemo } from 'react'
import { Icon } from '@iconify/react'
import { useSecurityAlerts } from '../hooks/useSecurityAlerts'
import type { AlertRow } from '../hooks/useSecurityAlerts'
import type { AlertSeverity, AlertStatus } from '@/types/database'
import { colors, radius, font } from '@/components/ui/tokens'

// Severity metadata helper
function severityMeta(sev: AlertSeverity) {
  switch (sev) {
    case 'critical': return { label: 'CRITICAL', color: '#FF4D6D', bg: 'rgba(255,77,109,0.10)', icon: 'solar:danger-bold' }
    case 'high':     return { label: 'HIGH',     color: '#FB923C', bg: 'rgba(251,146,60,0.10)', icon: 'solar:shield-warning-bold' }
    case 'medium':   return { label: 'MEDIUM',   color: '#F59E0B', bg: 'rgba(245,158,11,0.10)', icon: 'solar:bell-bing-bold' }
    case 'low':      return { label: 'LOW',      color: '#38BDF8', bg: 'rgba(56,189,248,0.10)', icon: 'solar:info-circle-bold' }
    default:         return { label: 'INFO',      color: '#64748B', bg: 'rgba(100,116,139,0.10)', icon: 'solar:info-circle-bold' }
  }
}

const SEVERITY_RANK: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  info: 0
}

function statusBadge(status: AlertStatus) {
  switch (status) {
    case 'open':         return { label: 'OPEN',       color: '#FF4D6D', bg: 'rgba(255,77,109,0.10)' }
    case 'acknowledged': return { label: 'ACK',        color: '#F59E0B', bg: 'rgba(245,158,11,0.10)' }
    case 'resolved':     return { label: 'RESOLVED',   color: '#10B981', bg: 'rgba(16,185,129,0.10)' }
    case 'suppressed':   return { label: 'SUPPRESSED', color: '#94A3B8', bg: 'rgba(255,255,255,0.06)' }
  }
}

function fmt(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
}

interface PanelProps {
  limit?: number
  title?: string
}

export function SecurityAlertsPanel({ limit = 20, title = 'Security Alerts' }: PanelProps) {
  const [page, setPage] = useState(1)
  const [sevFilter, setSevFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBySev, setSortBySev] = useState<'desc' | 'asc' | null>('desc')
  const [busyMap, setBusyMap] = useState<Record<string, boolean>>({})

  // Fetch alerts using hook
  const { alerts, total, loading, error, refetch, mutate } = useSecurityAlerts({
    page,
    limit,
    severity: sevFilter || undefined,
    status: statusFilter || undefined,
  })

  // Action handler
  async function handleAction(id: string, action: 'acknowledge' | 'resolve' | 'suppress') {
    setBusyMap(prev => ({ ...prev, [id]: true }))
    try {
      await mutate(id, action)
    } catch (err) {
      console.error(err)
    } finally {
      setBusyMap(prev => ({ ...prev, [id]: false }))
    }
  }

  // Filter & search client side for instant feel, and sorting
  const processedAlerts = useMemo(() => {
    let result = [...alerts]

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        a => a.title.toLowerCase().includes(q) || a.description.toLowerCase().includes(q)
      )
    }

    // Sort by Severity
    if (sortBySev) {
      result.sort((a, b) => {
        const rankA = SEVERITY_RANK[a.severity] ?? 0
        const rankB = SEVERITY_RANK[b.severity] ?? 0
        return sortBySev === 'desc' ? rankB - rankA : rankA - rankB
      })
    }

    return result
  }, [alerts, searchQuery, sortBySev])

  const pages = Math.max(1, Math.ceil(total / limit))

  function applyFilters() {
    setPage(1)
    refetch({ page: 1, limit, severity: sevFilter, status: statusFilter })
  }

  const isMini = limit <= 5

  return (
    <div style={{
      background: '#090D18',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: radius.xl,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
    }}>
      {/* Panel Header */}
      <div style={{
        padding: '14px 18px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Icon icon="solar:bell-bing-bold" width={16} style={{ color: '#FF4D6D' }} />
          <span style={{ color: '#E2E8F0', fontWeight: 600, fontSize: '0.85rem' }}>{title}</span>
          {!loading && total > 0 && (
            <span style={{
              background: 'rgba(255,77,109,0.10)',
              border: '1px solid rgba(255,77,109,0.20)',
              borderRadius: radius.full,
              padding: '1px 7px',
              color: '#FF4D6D',
              fontSize: '0.65rem',
              fontWeight: 700,
            }}>{total}</span>
          )}
        </div>

        {/* Filters and Search - Hidden in Mini View */}
        {!isMini && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Icon icon="solar:magnifer-linear" width={14} style={{ position: 'absolute', left: '10px', color: '#475569' }} />
              <input
                type="text"
                placeholder="Search alerts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  background: '#0D1220',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: radius.md,
                  color: '#94A3B8',
                  fontSize: '0.72rem',
                  padding: '5px 8px 5px 28px',
                  outline: 'none',
                  width: '160px',
                  transition: 'border-color 0.15s ease',
                }}
              />
            </div>

            <select
              value={sevFilter}
              onChange={(e) => setSevFilter(e.target.value)}
              style={selectStyle}
            >
              <option value="">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={selectStyle}
            >
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="resolved">Resolved</option>
              <option value="suppressed">Suppressed</option>
            </select>

            <button
              id="alerts-filter-apply"
              onClick={applyFilters}
              style={{
                padding: '5px 12px',
                borderRadius: radius.md,
                background: 'rgba(255,77,109,0.10)',
                border: '1px solid rgba(255,77,109,0.20)',
                color: '#FF4D6D',
                fontSize: '0.72rem',
                cursor: 'pointer',
                fontWeight: 600,
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,77,109,0.15)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,77,109,0.10)' }}
            >
              Apply
            </button>
          </div>
        )}
      </div>

      {/* Panel Body */}
      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: '#475569', fontSize: '0.8rem', fontFamily: font.mono }}>
          <Icon icon="solar:spinner-line-duotone" width={24} className="animate-spin" style={{ margin: '0 auto 8px', color: '#FF4D6D' }} />
          FETCHING SECURITY INTELLIGENCE...
        </div>
      ) : error ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#FF4D6D', fontSize: '0.8rem' }}>
          Error loading alerts: {error}
        </div>
      ) : processedAlerts.length === 0 ? (
        /* Empty State */
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '50px 24px',
          textAlign: 'center',
          background: 'rgba(16,185,129,0.01)',
        }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: radius.full,
            background: 'rgba(16,185,129,0.08)',
            border: '1px solid rgba(16,185,129,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '14px',
            boxShadow: '0 0 15px rgba(16,185,129,0.05)',
          }}>
            <Icon icon="solar:shield-check-bold" width={22} style={{ color: '#10B981' }} />
          </div>
          <h4 style={{ color: '#E2E8F0', fontSize: '0.85rem', fontWeight: 600, margin: '0 0 4px' }}>
            All Monitoring Systems Operational
          </h4>
          <p style={{ color: '#64748B', fontSize: '0.72rem', margin: '0 0 16px', maxWidth: '300px' }}>
            No active security incidents detected in current environment.
          </p>
          <div style={{
            borderTop: '1px solid rgba(255,255,255,0.04)',
            paddingTop: '12px',
            width: '100%',
            maxWidth: '300px',
            display: 'flex',
            flexDirection: 'column',
            gap: '3px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem' }}>
              <span style={{ color: '#475569' }}>Last Resolved Alert:</span>
              <span style={{ color: '#94A3B8', fontWeight: 500 }}>Prompt Injection Attempt</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem' }}>
              <span style={{ color: '#475569' }}>Timestamp:</span>
              <span style={{ color: '#94A3B8', fontFamily: font.mono }}>3 days ago</span>
            </div>
          </div>
        </div>
      ) : (
        /* Table Layout */
        <div style={{ overflowX: 'auto', width: '100%' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.01)' }}>
                <th
                  onClick={() => setSortBySev(curr => curr === 'desc' ? 'asc' : 'desc')}
                  style={{ ...thStyle, cursor: 'pointer', userSelect: 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Severity
                    <Icon icon={sortBySev === 'desc' ? 'solar:sort-from-top-to-bottom-linear' : 'solar:sort-from-bottom-to-top-linear'} width={12} />
                  </div>
                </th>
                <th style={thStyle}>Title & Description</th>
                <th style={thStyle}>Source</th>
                <th style={thStyle}>Affected Asset</th>
                <th style={thStyle}>Created</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Owner</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {processedAlerts.map((alert) => {
                const sm = severityMeta(alert.severity)
                const sb = statusBadge(alert.status)
                const isBusy = busyMap[alert.id] || false

                // Asset details from metadata
                const asset = (alert.metadata?.affected_asset as string) || 
                              (alert.metadata?.document_id as string) || 
                              'llm_session_v4'
                
                // Owner info
                const owner = alert.acknowledged_by 
                  ? `Analyst (${alert.acknowledged_by.slice(0, 5)})` 
                  : 'Unassigned'

                return (
                  <tr
                    key={alert.id}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                      transition: 'background 0.12s ease',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'rgba(255,255,255,0.01)' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent' }}
                  >
                    {/* Severity */}
                    <td style={tdStyle}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        fontSize: '0.62rem',
                        fontWeight: 800,
                        color: sm.color,
                        background: sm.bg,
                        padding: '3px 8px',
                        borderRadius: radius.full,
                        letterSpacing: '0.03em',
                      }}>
                        <Icon icon={sm.icon} width={10} />
                        {sm.label}
                      </span>
                    </td>

                    {/* Title & Description */}
                    <td style={{ ...tdStyle, maxWidth: '280px' }}>
                      <div style={{ color: '#E2E8F0', fontWeight: 600, fontSize: '0.78rem' }}>{alert.title}</div>
                      <div style={{ color: '#475569', fontSize: '0.68rem', marginTop: '3px', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {alert.description}
                      </div>
                    </td>

                    {/* Source */}
                    <td style={{ ...tdStyle, color: '#94A3B8', fontSize: '0.7rem', textTransform: 'uppercase', fontFamily: font.mono }}>
                      {alert.category.replace(/_/g, ' ')}
                    </td>

                    {/* Affected Asset */}
                    <td style={{ ...tdStyle, color: '#64748B', fontSize: '0.7rem', fontFamily: font.mono }}>
                      {asset}
                    </td>

                    {/* Created */}
                    <td style={{ ...tdStyle, color: '#64748B', fontSize: '0.7rem', fontFamily: font.mono }}>
                      {fmt(alert.created_at)}
                    </td>

                    {/* Status */}
                    <td style={tdStyle}>
                      <span style={{
                        fontSize: '0.62rem',
                        padding: '2px 7px',
                        borderRadius: radius.full,
                        background: sb.bg,
                        color: sb.color,
                        fontWeight: 700,
                      }}>{sb.label}</span>
                    </td>

                    {/* Owner */}
                    <td style={{ ...tdStyle, color: alert.acknowledged_by ? '#94A3B8' : '#475569', fontSize: '0.7rem' }}>
                      {owner}
                    </td>

                    {/* Actions */}
                    <td style={{ ...tdStyle, textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        {alert.status === 'open' && (
                          <>
                            <button
                              id={`alert-ack-${alert.id}`}
                              onClick={() => handleAction(alert.id, 'acknowledge')}
                              disabled={isBusy}
                              style={actionBtnStyle('#F59E0B')}
                            >
                              Ack
                            </button>
                            <button
                              id={`alert-resolve-${alert.id}`}
                              onClick={() => handleAction(alert.id, 'resolve')}
                              disabled={isBusy}
                              style={actionBtnStyle('#10B981')}
                            >
                              Resolve
                            </button>
                          </>
                        )}
                        {alert.status === 'acknowledged' && (
                          <button
                            id={`alert-resolve-ack-${alert.id}`}
                            onClick={() => handleAction(alert.id, 'resolve')}
                            disabled={isBusy}
                            style={actionBtnStyle('#10B981')}
                          >
                            Resolve
                          </button>
                        )}
                        {alert.status !== 'resolved' && alert.status !== 'suppressed' && (
                          <button
                            id={`alert-suppress-${alert.id}`}
                            onClick={() => handleAction(alert.id, 'suppress')}
                            disabled={isBusy}
                            style={actionBtnStyle('#94A3B8')}
                          >
                            Suppress
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Footer - Hidden in Mini View */}
      {!isMini && !loading && pages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 18px',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          background: 'rgba(255,255,255,0.005)',
        }}>
          <span style={{ color: '#475569', fontSize: '0.7rem' }}>
            Showing {processedAlerts.length} of {total} alerts
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              id="alerts-prev"
              onClick={() => {
                const p = Math.max(1, page - 1)
                setPage(p)
                refetch({ page: p, limit })
              }}
              disabled={page <= 1}
              style={{ ...pagBtnStyle, opacity: page <= 1 ? 0.3 : 1 }}
            >
              ← Prev
            </button>
            <span style={{ color: '#94A3B8', fontSize: '0.72rem', fontFamily: font.mono }}>
              Page {page} / {pages}
            </span>
            <button
              id="alerts-next"
              onClick={() => {
                const p = Math.min(pages, page + 1)
                setPage(p)
                refetch({ page: p, limit })
              }}
              disabled={page >= pages}
              style={{ ...pagBtnStyle, opacity: page >= pages ? 0.3 : 1 }}
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const selectStyle: React.CSSProperties = {
  background: '#0D1220',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: radius.md,
  color: '#94A3B8',
  fontSize: '0.72rem',
  padding: '5px 8px',
  outline: 'none',
  cursor: 'pointer',
}

const actionBtnStyle = (color: string): React.CSSProperties => ({
  padding: '3px 8px',
  borderRadius: radius.md,
  background: `${color}12`,
  border: `1px solid ${color}30`,
  color: color,
  fontSize: '0.65rem',
  cursor: 'pointer',
  fontWeight: 600,
  transition: 'all 0.1s ease',
})

const pagBtnStyle: React.CSSProperties = {
  padding: '4px 10px',
  borderRadius: radius.md,
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.06)',
  color: '#94A3B8',
  fontSize: '0.7rem',
  cursor: 'pointer',
}

const thStyle: React.CSSProperties = {
  padding: '12px 16px',
  color: '#475569',
  fontSize: '0.7rem',
  fontWeight: 600,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
}

const tdStyle: React.CSSProperties = {
  padding: '12px 16px',
  verticalAlign: 'middle',
}
