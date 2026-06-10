'use client'
// =============================================================================
// SecurityDashboard — Sprint 6A Redesign
// SOC-style monitoring layout with TabBar, Stat cards, and Lucide icons.
// No changes to data hooks or API logic.
// =============================================================================
import { useState } from 'react'
import {
  Home, BellRing, BarChart2, FileText, AlignLeft, FileDown,
  RefreshCw, Shield,
} from 'lucide-react'
import { useSecurityDashboard } from '../hooks/useSecurityDashboard'
import { useSecurityTimeline }  from '../hooks/useSecurityTimeline'
import { SecurityKPICards }     from './SecurityKPICards'
import { SecurityAlertsPanel }  from './SecurityAlertsPanel'
import { GovernancePanel }      from './GovernancePanel'
import { DocumentRiskPanel }    from './DocumentRiskPanel'
import { SecurityTimelinePanel }from './SecurityTimelinePanel'
import { ComplianceExportPanel }from './ComplianceExportPanel'
import { RecentActivityWidget } from './RecentActivityWidget'
import { TabBar }    from '@/components/ui/TabBar'
import { PageHeader }from '@/components/ui/PageHeader'
import { colors, font, radius, transition } from '@/components/ui/tokens'
import { roleColors } from '@/components/ui/tokens'
import type { UserRole } from '@/types/database'

type Tab = 'overview' | 'alerts' | 'governance' | 'risk' | 'timeline' | 'evidence'

interface Props {
  role: UserRole
}

const ROLE_LABEL: Partial<Record<UserRole, string>> = {
  super_admin:        'Super Admin',
  compliance_officer: 'Compliance Officer',
  security_analyst:   'Security Analyst',
  auditor:            'Auditor',
}

const ROLE_TABS: Partial<Record<UserRole, Tab[]>> = {
  super_admin:        ['overview','alerts','governance','risk','timeline','evidence'],
  compliance_officer: ['overview','alerts','governance','risk','timeline','evidence'],
  security_analyst:   ['overview','alerts','risk','timeline'],
  auditor:            ['overview','alerts','timeline'],
}

const TAB_META: Record<Tab, { label: string; icon: React.ReactNode; color: string }> = {
  overview:   { label: 'Overview',      icon: <Home     size={14} aria-hidden="true" />, color: '#6366F1' }, // indigo
  alerts:     { label: 'Alerts',        icon: <BellRing size={14} aria-hidden="true" />, color: '#F43F5E' }, // rose-red  (alerts = danger)
  governance: { label: 'AI Governance', icon: <BarChart2 size={14} aria-hidden="true" />, color: '#10B981' }, // emerald   (AI / health)
  risk:       { label: 'Doc Risk',      icon: <FileText size={14} aria-hidden="true" />, color: '#F59E0B' }, // amber     (risk / warning)
  timeline:   { label: 'Timeline',      icon: <AlignLeft size={14} aria-hidden="true" />, color: '#38BDF8' }, // sky-blue  (telemetry)
  evidence:   { label: 'Evidence',      icon: <FileDown size={14} aria-hidden="true" />, color: '#A78BFA' }, // violet    (audit / export)
}

const TIMEFRAME_OPTIONS = [
  { label: '24h', value: 1 },
  { label: '7d',  value: 7 },
  { label: '30d', value: 30 },
  { label: '90d', value: 90 },
]

export function SecurityDashboard({ role }: Props) {
  const [tab,  setTab]  = useState<Tab>('overview')
  const [days, setDays] = useState(7)
  const { kpi, alerts, loading, refetch } = useSecurityDashboard(days)
  const { events: timelineEvents, loading: timelineLoading, refetch: refetchTimeline } = useSecurityTimeline({ limit: 5 })

  const availTabs  = ROLE_TABS[role] ?? ['overview','alerts','timeline']
  const rColor     = roleColors[role]

  const tabs = availTabs.map((t) => ({
    id:    t,
    label: TAB_META[t].label,
    icon:  TAB_META[t].icon,
    color: TAB_META[t].color,
    ...(t === 'alerts' && alerts && alerts.length > 0 ? { badge: alerts.length } : {}),
  }))

  const activeTabColor = TAB_META[tab].color

  return (
    <div
      style={{
        maxWidth: '1400px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        animation: 'fadeInUp 0.3s ease forwards',
      }}
    >
      {/* ── Page header ───────────────────────────────────────── */}
      <PageHeader
        crumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Security' }]}
        title="Security Dashboard"
        description="Real-time security posture, alerts, AI governance monitoring, and risk analysis."
        badge={
          rColor ? (
            <span
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                background: rColor.bg, border: `1px solid ${rColor.border}`,
                color: rColor.text, borderRadius: radius.full,
                padding: '2px 10px', fontSize: font.sizes.xs, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.05em',
              }}
            >
              <Shield size={10} aria-hidden="true" />
              {ROLE_LABEL[role] ?? role}
            </span>
          ) : undefined
        }
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Timeframe selector */}
            <div
              role="group"
              aria-label="Select time range"
              style={{
                display: 'flex', gap: '2px',
                background: colors.glassSurface,
                border: `1px solid ${colors.glassBorder}`,
                borderRadius: radius.lg, padding: '3px',
              }}
            >
              {TIMEFRAME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDays(opt.value)}
                  aria-pressed={days === opt.value}
                  aria-label={`Last ${opt.label}`}
                  style={{
                    padding: '4px 12px', borderRadius: radius.md,
                    border: 'none', cursor: 'pointer',
                    fontSize: font.sizes.base, fontWeight: 600,
                    transition: 'all 0.12s ease',
                    background: days === opt.value ? 'rgba(99,102,241,0.16)' : 'transparent',
                    color:      days === opt.value ? colors.indigoLight : colors.textMuted,
                    fontFamily: font.sans,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                refetch()
                refetchTimeline()
              }}
              disabled={loading || timelineLoading}
              aria-label="Refresh security data"
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 12px', borderRadius: radius.lg,
                background: colors.glassSurface, border: `1px solid ${colors.glassBorder}`,
                color: colors.textSecondary, fontSize: font.sizes.base, fontWeight: 600,
                cursor: (loading || timelineLoading) ? 'not-allowed' : 'pointer', transition: transition.fast,
                fontFamily: font.sans,
              }}
            >
              <RefreshCw size={13} style={(loading || timelineLoading) ? { animation: 'spin 0.8s linear infinite' } : {}} aria-hidden="true" />
              Refresh
            </button>
          </div>
        }
      />

      {/* ── Tab bar ───────────────────────────────────────────── */}
      <TabBar
        tabs={tabs}
        activeId={tab}
        onChange={(id) => setTab(id as Tab)}
        accentColor={activeTabColor}
      />

      {/* ── Tab content ───────────────────────────────────────── */}
      <div
        id={`tabpanel-${tab}`}
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
        style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}
      >
        {tab === 'overview'   && (
          <>
            <SecurityKPICards kpi={kpi} loading={loading} />
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))',
              gap: '24px',
              alignItems: 'start',
            }}>
              <SecurityAlertsPanel />
              <RecentActivityWidget events={timelineEvents} loading={timelineLoading} />
            </div>
          </>
        )}
        {tab === 'alerts'     && <SecurityAlertsPanel />}
        {tab === 'governance' && <GovernancePanel />}
        {tab === 'risk'       && <DocumentRiskPanel />}
        {tab === 'timeline'   && <SecurityTimelinePanel />}
        {tab === 'evidence'   && <ComplianceExportPanel />}
      </div>
    </div>
  )
}
