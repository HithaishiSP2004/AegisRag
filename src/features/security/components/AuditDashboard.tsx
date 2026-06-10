'use client'
// AuditDashboard — Sprint 3B client shell
// Orchestrates: AuditStatsCards · AuditFilters · AuditTable · ActivityFeed
import { useState } from 'react'
import { Icon } from '@iconify/react'
import { useAudit } from '../hooks/useAudit'
import { AuditStatsCards } from './AuditStatsCards'
import { AuditFilters }    from './AuditFilters'
import { AuditTable }      from './AuditTable'
import { ActivityFeed }    from './ActivityFeed'
import type { AuditFilters as AuditFiltersShape } from '../hooks/useAudit'

interface Props {
  role: 'super_admin' | 'compliance_officer' | 'auditor'
}

const ROLE_LABEL: Record<Props['role'], string> = {
  super_admin:        'Super Admin',
  compliance_officer: 'Compliance Officer',
  auditor:            'Auditor',
}

const ROLE_COLOR: Record<Props['role'], string> = {
  super_admin:        '#F43F5E',
  compliance_officer: '#A78BFA',
  auditor:            '#38BDF8',
}

export function AuditDashboard({ role }: Props) {
  const [page,          setPage]          = useState(1)
  const [activeFilters, setActiveFilters] = useState<AuditFiltersShape>({})
  const [resetKey,      setResetKey]      = useState(0)

  const { logs, total, stats, loading, error, refetch, exportData } = useAudit({ page, limit: 25 })

  function handleApply(filters: AuditFiltersShape) {
    const next = { ...filters, page: 1 }
    setActiveFilters(next)
    setPage(1)
    refetch(next)
  }

  function handlePageChange(newPage: number) {
    setPage(newPage)
    refetch({ ...activeFilters, page: newPage })
  }

  function handleResetAll() {
    setResetKey((k) => k + 1)
    setActiveFilters({})
    setPage(1)
    refetch({ page: 1 })
  }

  return (
    <div style={{
      maxWidth:    '1400px',
      margin:      '0 auto',
      padding:     '32px 32px 60px',
      display:     'flex',
      flexDirection:'column',
      gap:         '24px',
    }}>
      {/* ── Page header ────────────────────────────────────────────────────── */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'6px' }}>
            <a
              href="/dashboard"
              style={{
                display:'flex', alignItems:'center', gap:'5px',
                color:'#475569', fontSize:'0.75rem', textDecoration:'none',
              }}
            >
              <Icon icon="solar:arrow-left-bold" width={12} /> Dashboard
            </a>
            <span style={{ color:'#1E293B', fontSize:'0.75rem' }}>/</span>
            <span style={{ color:'#64748B', fontSize:'0.75rem' }}>Audit</span>
          </div>
          <h1 style={{
            fontSize:'1.5rem', fontWeight:700, color:'#F8FAFC',
            letterSpacing:'-0.02em', margin:0,
          }}>
            Audit &amp; Governance
          </h1>
          <p style={{ color:'#475569', fontSize:'0.82rem', margin:'4px 0 0' }}>
            Immutable audit trail — all platform actions recorded.
          </p>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          {/* Role badge */}
          <span style={{
            padding:'4px 12px', borderRadius:'99px',
            background:`${ROLE_COLOR[role]}12`,
            border:`1px solid ${ROLE_COLOR[role]}28`,
            color: ROLE_COLOR[role],
            fontSize:'0.72rem', fontWeight:600,
          }}>
            {ROLE_LABEL[role]}
          </span>
          {/* Read-only badge for auditors */}
          {role === 'auditor' && (
            <span style={{
              padding:'3px 10px', borderRadius:'99px',
              background:'rgba(100,116,139,0.08)',
              border:'1px solid rgba(100,116,139,0.15)',
              color:'#64748B', fontSize:'0.68rem', fontWeight:500,
            }}>
              Read-only
            </span>
          )}
        </div>
      </div>

      {/* ── KPI stats row ──────────────────────────────────────────────────── */}
      <AuditStatsCards stats={stats} loading={loading && !stats} />

      {/* ── Filter bar ─────────────────────────────────────────────────────── */}
      <AuditFilters
        key={resetKey}
        onApply={handleApply}
        onExport={(f, format) => exportData(f, format)}
        loading={loading}
      />

      {/* ── Main content: table + activity feed ────────────────────────────── */}
      <div style={{
        display:             'grid',
        gridTemplateColumns: '1fr 320px',
        gap:                 '20px',
        alignItems:          'start',
      }}>
        <AuditTable
          logs={logs}
          total={total}
          page={page}
          limit={25}
          loading={loading}
          error={error === 'insufficient_permissions' ? 'Insufficient permissions' : error}
          onPageChange={handlePageChange}
          onReset={handleResetAll}
        />
        <ActivityFeed logs={logs} loading={loading} />
      </div>
    </div>
  )
}
